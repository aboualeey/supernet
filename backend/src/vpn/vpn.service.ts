import {
    Injectable,
    InternalServerErrorException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nacl from 'tweetnacl';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { VpnProfile } from './entities/vpn-profile.entity';
import { User } from '../users/entities/user.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

// 1 GB in bytes
const GB = 1_073_741_824;

@Injectable()
export class VpnService {
    private readonly logger = new Logger(VpnService.name);
    private wgConfigPath: string;
    private encryptionKey: string;

    private gatewayEnabled: boolean;
    private gatewayEndpoint: string;
    private gatewayPublicKey: string;

    constructor(
        @InjectRepository(VpnProfile)
        private vpnRepository: Repository<VpnProfile>,
        private configService: ConfigService,
        private subscriptionsService: SubscriptionsService,
    ) {
        this.wgConfigPath = this.configService.get<string>('WIREGUARD_CONFIG_PATH') || './wg0.conf';
        this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') || 'fallback_secret_key_32_bytes_long!!';
        this.gatewayEnabled = this.configService.get<boolean>('SUPERNET_PRIVATE_GATEWAY_ENABLED') || false;
        this.gatewayEndpoint = this.configService.get<string>('PRIVATE_GATEWAY_ENDPOINT') || '0.0.0.0:51820';
        this.gatewayPublicKey = this.configService.get<string>('PRIVATE_GATEWAY_PUBLIC_KEY') || '';
    }

    // ─── SSH config ──────────────────────────────────────────────────────────────

    private get remoteHost(): string | undefined {
        return this.configService.get<string>('VPN_REMOTE_HOST');
    }
    private get remoteUser(): string | undefined {
        return this.configService.get<string>('VPN_REMOTE_USER');
    }
    private get sshKeyPath(): string | undefined {
        return this.configService.get<string>('VPN_SSH_KEY_PATH');
    }

    // ─── Encryption helpers ──────────────────────────────────────────────────────

    private encrypt(text: string): string {
        const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
        const messageUint8 = Buffer.from(text);
        const keyUint8 = Buffer.alloc(32);
        keyUint8.write(this.encryptionKey);
        const box = nacl.secretbox(messageUint8, nonce, keyUint8);
        const fullMessage = new Uint8Array(nonce.length + box.length);
        fullMessage.set(nonce);
        fullMessage.set(box, nonce.length);
        return Buffer.from(fullMessage).toString('base64');
    }

    private decrypt(textWithNonce: string): string {
        const fullMessage = Buffer.from(textWithNonce, 'base64');
        const nonce = fullMessage.subarray(0, nacl.secretbox.nonceLength);
        const box = fullMessage.subarray(nacl.secretbox.nonceLength);
        const keyUint8 = Buffer.alloc(32);
        keyUint8.write(this.encryptionKey);
        const decrypted = nacl.secretbox.open(box, nonce, keyUint8);
        if (!decrypted) throw new InternalServerErrorException('Could not decrypt private key');
        return Buffer.from(decrypted).toString('utf-8');
    }

    async generateKeys() {
        const keyPair = nacl.box.keyPair();
        return {
            publicKey: Buffer.from(keyPair.publicKey).toString('base64'),
            privateKey: Buffer.from(keyPair.secretKey).toString('base64'),
        };
    }

    // ─── Profile creation with plan enforcement ──────────────────────────────────

    /**
     * Creates a VPN profile for the user.
     * @param user       The authenticated user
     * @param deviceName Optional label ("iPhone", "Android", "Desktop")
     * @param nodeName   Optional target VPS node (defaults to "default")
     */
    async createProfile(user: User, deviceName?: string, nodeName?: string) {
        // ① Require an active subscription
        const activeSub = await this.subscriptionsService.getActiveSubscription(user.id);
        if (!activeSub) {
            throw new ForbiddenException('No active subscription. Please subscribe to a plan first.');
        }

        // ② Enforce maxDevices limit
        const maxDevices = activeSub.plan?.maxDevices ?? 1;
        const existingDevices = await this.vpnRepository.count({
            where: { user: { id: user.id }, isActive: true },
        });
        if (existingDevices >= maxDevices) {
            throw new ForbiddenException(
                `Your ${activeSub.plan?.name ?? 'current'} plan allows ${maxDevices} device(s). ` +
                `You already have ${existingDevices}. Upgrade to add more.`,
            );
        }

        // ③ Generate keys & assign IP
        const { publicKey, privateKey } = await this.generateKeys();
        const encryptedPrivateKey = this.encrypt(privateKey);
        const ipAddress = await this.assignIpAddress();

        // ④ Save to DB (including deviceName + nodeName)
        const profile = this.vpnRepository.create({
            user,
            publicKey,
            encryptedPrivateKey,
            ipAddress,
            deviceName: deviceName ?? 'Personal Device',
            nodeName: nodeName ?? 'default',
        });
        const savedProfile = await this.vpnRepository.save(profile);

        // ⑤ Append peer to wg0.conf and live interface
        this.appendPeerToConfig(savedProfile.publicKey, savedProfile.ipAddress);
        try {
            await this.executeRemoteWg(
                `sudo wg set wg0 peer ${savedProfile.publicKey} allowed-ips ${savedProfile.ipAddress}/32`,
            );
        } catch (err) {
            this.logger.warn('Live wg set failed (config file already updated):', err);
        }

        return savedProfile;
    }

    // ─── Peer enable / disable via SSH ──────────────────────────────────────────

    async disablePeer(publicKey: string): Promise<void> {
        await this.executeRemoteWg(`sudo wg set wg0 peer ${publicKey} remove`);
        await this.vpnRepository.update({ publicKey }, { isActive: false, isOnline: false });
        this.logger.log(`Peer disabled: ${publicKey.substring(0, 8)}…`);
    }

    async enablePeer(publicKey: string, allowedIps: string): Promise<void> {
        await this.executeRemoteWg(`sudo wg set wg0 peer ${publicKey} allowed-ips ${allowedIps}/32`);
        await this.vpnRepository.update({ publicKey }, { isActive: true });
        this.logger.log(`Peer re-enabled: ${publicKey.substring(0, 8)}…`);
    }

    // ─── Cron: enforce bandwidth limits (every hour) ─────────────────────────────
    // NOTE: Raw bytes now come from TelemetryService which updates dataUsage every 10s.
    // This cron reads from DB (no more SSH wg show transfer).

    @Cron('0 * * * *')
    async updateBandwidthUsage() {
        this.logger.log('Checking bandwidth limits against DB-backed usage...');
        try {
            // Read active profiles with their users
            const profiles = await this.vpnRepository.find({
                where: { isActive: true },
                relations: ['user'],
            });

            for (const profile of profiles) {
                if (!profile.user) continue;
                const sub = await this.subscriptionsService.getActiveSubscription(profile.user.id);
                const limitGb = sub?.plan?.bandwidthLimitGb;
                const usage = Number(profile.dataUsage ?? 0);
                if (limitGb && limitGb > 0 && usage > limitGb * GB) {
                    this.logger.warn(
                        `User ${profile.user.id} exceeded ${limitGb} GB bandwidth. Disabling peer.`,
                    );
                    await this.disablePeer(profile.publicKey);
                }
            }
            this.logger.log('Bandwidth limit check complete.');
        } catch (err) {
            this.logger.error('Failed to check bandwidth limits:', err);
        }
    }

    // ─── Cron: monthly bandwidth reset ──────────────────────────────────────────

    @Cron('0 0 1 * *')
    async resetMonthlyBandwidth() {
        this.logger.log('Monthly bandwidth reset — resetting usage counters and re-enabling peers...');

        await this.vpnRepository
            .createQueryBuilder()
            .update()
            .set({ dataUsage: 0, totalRx: 0, totalTx: 0 })
            .execute();

        const disabledProfiles = await this.vpnRepository.find({
            where: { isActive: false },
        });
        for (const profile of disabledProfiles) {
            try {
                await this.enablePeer(profile.publicKey, profile.ipAddress);
            } catch (err) {
                this.logger.error(`Failed to re-enable peer ${profile.publicKey.substring(0, 8)}:`, err);
            }
        }
        this.logger.log(`Monthly reset complete. Re-enabled ${disabledProfiles.length} peer(s).`);
    }

    // ─── Existing helpers ────────────────────────────────────────────────────────

    async getProfile(user: User): Promise<VpnProfile | null> {
        return this.vpnRepository.findOne({
            where: { user: { id: user.id } },
            order: { createdAt: 'DESC' },
        });
    }

    private async assignIpAddress(): Promise<string> {
        const lastProfile = await this.vpnRepository.find({
            order: { createdAt: 'DESC' },
            take: 1,
        });
        let nextSuffix = 2;
        if (lastProfile.length > 0) {
            const parts = lastProfile[0].ipAddress.split('.');
            nextSuffix = parseInt(parts[3], 10) + 1;
        }
        if (nextSuffix > 254) throw new InternalServerErrorException('Subnet exhausted');
        return `10.8.0.${nextSuffix}`;
    }

    private appendPeerToConfig(publicKey: string, allowedIps: string) {
        const peerConfig = `\n# Peer ${allowedIps}\n[Peer]\nPublicKey = ${publicKey}\nAllowedIPs = ${allowedIps}/32\n`;
        if (this.remoteHost && this.remoteUser && this.sshKeyPath) {
            const cmd = `echo "${peerConfig}" | ssh -i ${this.sshKeyPath} -o StrictHostKeyChecking=no ${this.remoteUser}@${this.remoteHost} "sudo tee -a /etc/wireguard/wg0.conf"`;
            exec(cmd, (error, _stdout, stderr) => {
                if (error) this.logger.error('Remote config update failed:', stderr);
                else this.logger.log('Remote wg0.conf updated.');
            });
        } else {
            const dir = path.dirname(this.wgConfigPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.appendFileSync(this.wgConfigPath, peerConfig);
        }
    }

    /**
     * Executes a raw command on the remote WireGuard VPS via SSH.
     * Falls back to local `bash` execution if no remote host configured.
     */
    async executeRemoteWg(remoteCmd: string): Promise<string> {
        let cmd: string;
        if (this.remoteHost && this.remoteUser && this.sshKeyPath) {
            cmd = `ssh -i ${this.sshKeyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=8 ${this.remoteUser}@${this.remoteHost} "${remoteCmd}"`;
        } else {
            cmd = remoteCmd; // local fallback
        }
        return new Promise((resolve, reject) => {
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    this.logger.error(`exec error: ${stderr}`);
                    reject(new Error(stderr || error.message));
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    async getClientConfig(profile: VpnProfile, saasPublicKey: string, saasEndpoint: string): Promise<string> {
        let privateKey = profile.encryptedPrivateKey;
        try {
            privateKey = this.decrypt(profile.encryptedPrivateKey);
        } catch {
            this.logger.warn('Could not decrypt key — using raw value.');
        }

        // Determine which gateway/endpoint to use
        const usePrivate = profile.exitMode === 'private' && this.gatewayEnabled;
        const targetPublicKey = usePrivate ? this.gatewayPublicKey : saasPublicKey;
        const targetEndpoint = usePrivate ? this.gatewayEndpoint : saasEndpoint;

        return `[Interface]
PrivateKey = ${privateKey}
Address = ${profile.ipAddress}/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${targetPublicKey}
Endpoint = ${targetEndpoint}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
`;
    }

    /**
     * Toggles a profile between SaaS and Private Gateway mode.
     * Validates eligibility (user.privateGatewayAllowed and profile.privateGatewayApproved).
     */
    async toggleExitMode(profileId: string, user: User, mode: 'saas' | 'private') {
        if (!this.gatewayEnabled && mode === 'private') {
            throw new ForbiddenException('Private Gateway mode is not enabled on this server.');
        }

        const profile = await this.vpnRepository.findOne({
            where: { id: profileId, user: { id: user.id } },
            relations: ['user'],
        });

        if (!profile) throw new ForbiddenException('Profile not found.');

        if (mode === 'private') {
            if (!user.privateGatewayAllowed) {
                throw new ForbiddenException('User is not authorized to use Private Gateway.');
            }
            if (!profile.privateGatewayApproved) {
                throw new ForbiddenException('This device is not approved for Private Gateway access.');
            }
        }

        profile.exitMode = mode;
        return this.vpnRepository.save(profile);
    }

    /** Returns all profiles with their users (used by AdminService). */
    async getAllProfilesWithUsers(): Promise<VpnProfile[]> {
        return this.vpnRepository.find({ relations: ['user'] });
    }
}
