import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { VpnProfile } from '../vpn/entities/vpn-profile.entity';
import { User } from '../users/entities/user.entity';
import { VpnService } from '../vpn/vpn.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { VerificationResult } from './entities/verification-result.entity';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface LivePeerStat {
    id: string;
    publicKey: string;
    deviceName: string;
    nodeName: string;
    endpoint: string | null;
    allowedIps: string;
    latestHandshake: number | null;
    rxBytes: number;
    txBytes: number;
    isOnline: boolean;
    privateGatewayApproved: boolean;
    ownerEmail?: string;
}

export interface UserUsageRow {
    userId: string;
    email: string;
    plan: string;
    maxDevices: number;
    activeDevices: number;
    dataUsageBytes: number;
    bandwidthLimitGb: number | null;
    isActive: boolean;
    privateGatewayAllowed: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(
        @InjectRepository(VpnProfile)
        private vpnRepository: Repository<VpnProfile>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(VerificationResult)
        private verificationRepository: Repository<VerificationResult>,
        private vpnService: VpnService,
        private subscriptionsService: SubscriptionsService,
    ) { }

    // ─── Live peers — read from DB ────────────────────────────────────────────

    async getLivePeerStats(): Promise<LivePeerStat[]> {
        try {
            const profiles = await this.vpnRepository.find({
                where: [
                    { isOnline: true },
                    { lastSeenAt: Not(IsNull()) },
                ],
                relations: ['user'],
                order: { lastSeenAt: 'DESC' },
            });
            return profiles.map(this.profileToStat);
        } catch (err) {
            this.logger.error('getLivePeerStats failed:', err);
            return [];
        }
    }

    async getAllPeerStats(): Promise<LivePeerStat[]> {
        try {
            const profiles = await this.vpnRepository.find({
                relations: ['user'],
                order: { lastSeenAt: 'DESC' },
            });
            return profiles.map(this.profileToStat);
        } catch (err) {
            this.logger.error('getAllPeerStats failed:', err);
            return [];
        }
    }

    private profileToStat = (p: VpnProfile): LivePeerStat => ({
        id: p.id,
        publicKey: p.publicKey,
        deviceName: p.deviceName ?? 'Unknown',
        nodeName: p.nodeName ?? 'default',
        endpoint: p.lastEndpoint ?? null,
        allowedIps: `${p.ipAddress}/32`,
        latestHandshake: p.lastSeenAt ? Math.floor(p.lastSeenAt.getTime() / 1000) : null,
        rxBytes: Number(p.totalRx ?? 0),
        txBytes: Number(p.totalTx ?? 0),
        isOnline: p.isOnline,
        privateGatewayApproved: p.privateGatewayApproved,
        ownerEmail: p.user?.email,
    });

    // ─── All users — show every registered user (even without a VPN profile) ──

    async getUserUsage(): Promise<UserUsageRow[]> {
        try {
            // Load ALL non-admin users
            const allUsers = await this.userRepository.find({
                where: { role: 'user' as any },
                order: { createdAt: 'ASC' },
            });

            // Load ALL vpn profiles with user relations
            const allProfiles = await this.vpnRepository.find({ relations: ['user'] });

            // Index profiles by userId
            const profilesByUser = new Map<string, VpnProfile[]>();
            for (const p of allProfiles) {
                if (!p.user) continue;
                const uid = p.user.id;
                if (!profilesByUser.has(uid)) profilesByUser.set(uid, []);
                profilesByUser.get(uid)!.push(p);
            }

            const rows: UserUsageRow[] = [];
            for (const user of allUsers) {
                let sub: any = null;
                try {
                    sub = await this.subscriptionsService.getActiveSubscription(user.id);
                } catch { /* no sub is fine */ }

                const userProfiles = profilesByUser.get(user.id) ?? [];
                const totalUsage = userProfiles.reduce((acc, p) => acc + Number(p.dataUsage ?? 0), 0);

                rows.push({
                    userId: user.id,
                    email: user.email,
                    plan: sub?.plan?.name ?? 'None',
                    maxDevices: sub?.plan?.maxDevices ?? 0,
                    activeDevices: userProfiles.filter(p => p.isActive).length,
                    dataUsageBytes: totalUsage,
                    bandwidthLimitGb: sub?.plan?.bandwidthLimitGb ?? null,
                    isActive: user.isActive,
                    privateGatewayAllowed: user.privateGatewayAllowed,
                });
            }
            return rows;
        } catch (err) {
            this.logger.error('getUserUsage failed:', err);
            return [];
        }
    }

    // ─── Summary cards ────────────────────────────────────────────────────────

    async getSummaryStats() {
        try {
            const [totalPeers, activeConnections, totalUsers] = await Promise.all([
                this.vpnRepository.count(),
                this.vpnRepository.count({ where: { isOnline: true } }),
                this.userRepository.count({ where: { role: 'user' as any } }),
            ]);

            // Aggregate total bandwidth from DB (bigint comes as string from PG, must cast)
            let totalBandwidthBytes = 0;
            try {
                const bwResult = await this.vpnRepository
                    .createQueryBuilder('p')
                    .select('COALESCE(SUM(CAST(p.dataUsage AS BIGINT)), 0)', 'total')
                    .getRawOne<{ total: string }>();
                totalBandwidthBytes = parseInt(bwResult?.total ?? '0', 10);
            } catch (e) {
                this.logger.warn('Bandwidth SUM query failed:', e);
            }

            return { totalUsers, activeConnections, totalPeers, totalBandwidthBytes };
        } catch (err) {
            this.logger.error('getSummaryStats failed:', err);
            return { totalUsers: 0, activeConnections: 0, totalPeers: 0, totalBandwidthBytes: 0 };
        }
    }

    // ─── Admin Gateway Management ─────────────────────────────────────────────

    async allowUserGateway(userId: string, allowed: boolean): Promise<void> {
        await this.userRepository.update(userId, { privateGatewayAllowed: allowed });
        this.logger.log(`User ${userId} gateway access: ${allowed}`);
    }

    async approveProfileGateway(profileId: string, approved: boolean): Promise<void> {
        await this.vpnRepository.update(profileId, { privateGatewayApproved: approved });
        this.logger.log(`Profile ${profileId} gateway approval: ${approved}`);
    }

    // ─── Admin peer actions ───────────────────────────────────────────────────

    async adminDisablePeer(publicKey: string): Promise<void> {
        await this.vpnService.disablePeer(publicKey);
    }

    async adminEnablePeer(publicKey: string): Promise<void> {
        const profile = await this.vpnRepository.findOne({ where: { publicKey } });
        if (profile) {
            await this.vpnService.enablePeer(publicKey, profile.ipAddress);
        }
    }

    async verifyPrivateGateway(profileId: string, deviceExitIp: string) {
        const profile = await this.vpnRepository.findOne({
            where: { id: profileId },
            relations: ['user']
        });
        if (!profile) throw new Error('Profile not found');
        if (!profile.user) throw new Error('User not found');

        const gatewayHost = process.env.VPN_REMOTE_HOST;
        const gatewayUser = process.env.VPN_REMOTE_USER || 'ubuntu';
        const keyPath = process.env.VPN_SSH_KEY_PATH;

        let gatewayData: any;
        try {
            // 1. Run Gateway Verification Agent via SSH
            const sshCmd = `ssh -i ${keyPath} -o StrictHostKeyChecking=no ${gatewayUser}@${gatewayHost} "sudo /usr/local/bin/supernet-gateway-verify.sh"`;
            const { stdout } = await execAsync(sshCmd);
            gatewayData = JSON.parse(stdout);
        } catch (err) {
            this.logger.error(`Gateway verification failed: ${err.message}`);
            throw new Error(`Failed to contact gateway: ${err.message}`);
        }

        // 2. Deterministic Proof: Compare IPs
        const ipMatch = gatewayData.gateway_public_ip.trim() === deviceExitIp.trim();

        // 3. Find peer in gateway data to check RX/TX activity
        const peerData = gatewayData.peers.find(p => p.public_key === profile.publicKey);

        // 4. Verification Verdict
        let result: 'VERIFIED' | 'FAILED' = 'FAILED';
        let failureReason = '';

        if (!ipMatch) {
            failureReason = `IP Mismatch: Gateway[${gatewayData.gateway_public_ip}] vs Device[${deviceExitIp}]`;
        } else if (!peerData) {
            failureReason = 'Device not seen by Gateway WireGuard interface';
        } else if (peerData.rx_bytes === 0) {
            failureReason = 'No traffic (RX) received from device on Gateway';
        } else if (!gatewayData.kill_switch_active) {
            failureReason = 'Gateway Kill-Switch rules are NOT active and hardened';
        } else {
            result = 'VERIFIED';
        }

        // 5. Persist Result
        const verification = this.verificationRepository.create({
            user: profile.user,
            profile: profile,
            gatewayId: gatewayHost,
            gatewayIp: gatewayData.gateway_public_ip,
            exitIp: deviceExitIp,
            result: result,
            sessionId: gatewayData.session_id,
            failureReason: failureReason,
            killSwitchVerified: gatewayData.kill_switch_active,
        });

        await this.verificationRepository.save(verification);

        return {
            status: result,
            reason: failureReason,
            gatewayIp: gatewayData.gateway_public_ip,
            deviceIp: deviceExitIp,
            timestamp: new Date().toISOString()
        };
    }

    // ─── Telemetry ingestion (called by /admin/ingest-telemetry) ─────────────

    /** Parses raw `wg show wg0 dump` text and upserts telemetry into DB. */
    async ingestRawDump(raw: string): Promise<void> {
        if (!raw?.trim()) return;

        const ONLINE_THRESHOLD_MS = 120_000;
        const now = Date.now();
        const lines = raw.split('\n').filter(Boolean);
        const peerLines = lines.slice(1); // skip interface row
        const liveKeys = new Set<string>();

        for (const line of peerLines) {
            const parts = line.split('\t');
            if (parts.length < 7) continue;
            const [publicKey, , endpoint, allowedIps, latestHandshake, rxBytesStr, txBytesStr] = parts;
            if (!publicKey) continue;

            const ts = parseInt(latestHandshake, 10);
            const latestHandshakeTs = isNaN(ts) || ts === 0 ? null : ts;
            const rxBytes = parseInt(rxBytesStr, 10) || 0;
            const txBytes = parseInt(txBytesStr, 10) || 0;
            const isOnline = latestHandshakeTs !== null
                ? (now - latestHandshakeTs * 1000) < ONLINE_THRESHOLD_MS
                : false;
            const lastSeenAt = latestHandshakeTs ? new Date(latestHandshakeTs * 1000) : null;
            const ep = endpoint === '(none)' ? null : endpoint;

            liveKeys.add(publicKey);

            const existing = await this.vpnRepository.findOne({ where: { publicKey } });
            if (existing) {
                await this.vpnRepository.update({ publicKey }, {
                    totalRx: rxBytes, totalTx: txBytes,
                    dataUsage: rxBytes + txBytes,
                    lastSeenAt, isOnline,
                    lastEndpoint: ep ?? existing.lastEndpoint,
                });
            } else {
                const ipFromAllowed = allowedIps?.split('/')[0] ?? '10.8.0.0';
                const stub = this.vpnRepository.create({
                    publicKey, encryptedPrivateKey: '', ipAddress: ipFromAllowed,
                    deviceName: 'Unknown (VPS peer)', nodeName: 'default',
                    isActive: true, totalRx: rxBytes, totalTx: txBytes,
                    dataUsage: rxBytes + txBytes, lastSeenAt, isOnline,
                    lastEndpoint: ep ?? undefined, user: null,
                });
                await this.vpnRepository.save(stub);
            }
        }

        if (liveKeys.size > 0) {
            await this.vpnRepository
                .createQueryBuilder()
                .update()
                .set({ isOnline: false })
                .where('public_key NOT IN (:...keys)', { keys: [...liveKeys] })
                .andWhere('is_online = true')
                .execute();
        }
        this.logger.log(`ingestRawDump: processed ${liveKeys.size} peer(s).`);
    }
}

