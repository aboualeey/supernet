import { Injectable, InternalServerErrorException } from '@nestjs/common';
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

@Injectable()
export class VpnService {
    private wgConfigPath: string;

    private encryptionKey: string;

    constructor(
        @InjectRepository(VpnProfile)
        private vpnRepository: Repository<VpnProfile>,
        private configService: ConfigService,
        private subscriptionsService: SubscriptionsService,
    ) {
        this.wgConfigPath = this.configService.get<string>('WIREGUARD_CONFIG_PATH') || './wg0.conf';
        this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') || 'fallback_secret_key_32_bytes_long!!';
    }

    private encrypt(text: string): string {
        const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
        const messageUint8 = Buffer.from(text);
        // We need a 32-byte key for secretbox. Ensure encryptionKey is 32 bytes or hash it.
        // For simplicity using a simple buffer from string (in prod, use a proper KDF)
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
        if (!decrypted) {
            throw new InternalServerErrorException('Could not decrypt private key');
        }
        return Buffer.from(decrypted).toString('utf-8');
    }

    async generateKeys() {
        const keyPair = nacl.box.keyPair();
        const publicKey = Buffer.from(keyPair.publicKey).toString('base64');
        const privateKey = Buffer.from(keyPair.secretKey).toString('base64');
        return { publicKey, privateKey };
    }

    async createProfile(user: User) {
        // Check for active subscription
        const activeSub = await this.subscriptionsService.getActiveSubscription(user.id);
        if (!activeSub) {
            throw new InternalServerErrorException('No active subscription found. Please subscribe to a plan first.');
        }

        // Generate Keys
        const { publicKey, privateKey } = await this.generateKeys();
        const encryptedPrivateKey = this.encrypt(privateKey);

        // Assign IP
        const ipAddress = await this.assignIpAddress();

        // Save to DB
        const profile = this.vpnRepository.create({
            user,
            publicKey,
            encryptedPrivateKey,
            ipAddress,
        });
        const savedProfile = await this.vpnRepository.save(profile);

        // Append to wg0.conf
        this.appendPeerToConfig(savedProfile.publicKey, savedProfile.ipAddress);

        // Execute Script to update live interface
        try {
            await this.executeVpnScript('add-peer', savedProfile.publicKey, savedProfile.ipAddress);
        } catch (error) {
            console.error('Failed to execute VPN script:', error);
            // Don't fail the request, just log it. The config file is updated anyway.
        }

        return savedProfile;
    }

    private async executeVpnScript(command: string, ...args: string[]) {
        const scriptPath = path.resolve(__dirname, '../../scripts/manage-vpn.sh');
        // Ensure script is executable (on Linux)
        // fs.chmodSync(scriptPath, '755'); 

        const cmd = `bash ${scriptPath} ${command} ${args.join(' ')}`;
        console.log(`Executing: ${cmd}`);

        return new Promise((resolve, reject) => {
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    // In real prod, reject. In dev/windows, we might ignore if bash is missing or fails.
                    // For now, let's reject to see logs.
                    // reject(error); 
                    // Actually, let's just log stdout/stderr
                }
                console.log(`stdout: ${stdout}`);
                console.error(`stderr: ${stderr}`);
                resolve(stdout);
            });
        });
    }

    async getProfile(user: User): Promise<VpnProfile | null> {
        return this.vpnRepository.findOne({
            where: { user: { id: user.id } },
            order: { createdAt: 'DESC' },
        });
    }

    private async assignIpAddress(): Promise<string> {
        const lastProfile = await this.vpnRepository.find({
            order: { createdAt: 'DESC' },
            take: 1
        });

        let nextSuffix = 2;
        if (lastProfile.length > 0) {
            const lastIp = lastProfile[0].ipAddress;
            const parts = lastIp.split('.');
            nextSuffix = parseInt(parts[3]) + 1;
        }

        if (nextSuffix > 254) {
            throw new InternalServerErrorException('Subnet exhausted');
        }

        return `10.8.0.${nextSuffix}`;
    }

    private appendPeerToConfig(publicKey: string, allowedIps: string) {
        const peerConfig = `
# Peer ${allowedIps}
[Peer]
PublicKey = ${publicKey}
AllowedIPs = ${allowedIps}/32
`;
        // Ensure directory exists
        const dir = path.dirname(this.wgConfigPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.appendFileSync(this.wgConfigPath, peerConfig);
    }

    async getClientConfig(profile: VpnProfile, serverPublicKey: string, endpoint: string): Promise<string> {
        let privateKey = profile.encryptedPrivateKey;
        try {
            privateKey = this.decrypt(profile.encryptedPrivateKey);
        } catch (e) {
            // Fallback for legacy plain keys if any
            console.warn('Could not decrypt key, assuming plain:', e);
        }

        return `
[Interface]
PrivateKey = ${privateKey}
Address = ${profile.ipAddress}/24
DNS = 8.8.8.8

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${endpoint}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;
    }

    // Update bandwidth usage every hour
    @Cron('0 * * * *')
    async updateBandwidthUsage() {
        try {
            const stdout = await this.executeVpnScript('get-stats') as string;
            const lines = stdout.split('\n');

            for (const line of lines) {
                const parts = line.split('\t'); // wg show transfer uses tabs usually, output depends on script
                // In our script usage: "PUBLIC_KEY RX TX" (space separated likely)
                const [publicKey, rx, tx] = line.trim().split(/\s+/);

                if (publicKey && rx && tx) {
                    const totalBytes = parseInt(rx) + parseInt(tx);
                    await this.vpnRepository.update({ publicKey }, { dataUsage: totalBytes });
                }
            }
            console.log('Bandwidth usage updated.');
        } catch (err) {
            console.error('Failed to update bandwidth usage', err);
        }
    }
}
