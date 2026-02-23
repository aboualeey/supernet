import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { VpnProfile } from './entities/vpn-profile.entity';
import { VpnService } from './vpn.service';

/** Parsed row from `wg show wg0 dump` (peer lines only). */
interface WgDumpPeer {
    publicKey: string;
    endpoint: string | null;
    allowedIps: string;
    latestHandshakeTs: number | null;
    rxBytes: number;
    txBytes: number;
}

const ONLINE_THRESHOLD_MS = 120_000; // 2 minutes

@Injectable()
export class TelemetryService {
    private readonly logger = new Logger(TelemetryService.name);

    constructor(
        @InjectRepository(VpnProfile)
        private readonly profileRepo: Repository<VpnProfile>,
        private readonly vpnService: VpnService,
    ) { }

    // ─── 10-second ingestion cron ────────────────────────────────────────────

    @Cron('*/30 * * * * *')
    async ingestWgTelemetry(): Promise<void> {
        let raw: string;
        try {
            raw = await this.vpnService.executeRemoteWg('sudo wg show wg0 dump');
        } catch (err) {
            this.logger.log(
                `TelemetryService: VPS unreachable — ${(err as Error).message.split('\n')[0]}. ` +
                'Telemetry paused until SSH is restored.',
            );
            return;
        }

        const peers = this.parseDump(raw);
        if (peers.length === 0) {
            this.logger.debug('TelemetryService: no peers in wg dump.');
            return;
        }

        const now = Date.now();
        let ingested = 0;

        for (const peer of peers) {
            const isOnline = peer.latestHandshakeTs !== null
                ? (now - peer.latestHandshakeTs * 1000) < ONLINE_THRESHOLD_MS
                : false;

            const lastSeenAt = peer.latestHandshakeTs
                ? new Date(peer.latestHandshakeTs * 1000)
                : null;

            // Try to find existing DB record
            const existing = await this.profileRepo.findOne({
                where: { publicKey: peer.publicKey },
            });

            if (existing) {
                // Update telemetry in-place
                await this.profileRepo.update(
                    { publicKey: peer.publicKey },
                    {
                        totalRx: peer.rxBytes,
                        totalTx: peer.txBytes,
                        dataUsage: peer.rxBytes + peer.txBytes,
                        lastSeenAt,
                        isOnline,
                        lastEndpoint: peer.endpoint ?? existing.lastEndpoint,
                    },
                );
            } else {
                // Peer exists on VPS but not in DB — create a stub record so it
                // shows in the admin dashboard until a user claims it.
                const ipFromAllowed = peer.allowedIps?.split('/')[0] ?? '10.8.0.0';
                const stub = this.profileRepo.create({
                    publicKey: peer.publicKey,
                    encryptedPrivateKey: '',
                    ipAddress: ipFromAllowed,
                    deviceName: 'Unknown (VPS peer)',
                    nodeName: 'default',
                    isActive: true,
                    totalRx: peer.rxBytes,
                    totalTx: peer.txBytes,
                    dataUsage: peer.rxBytes + peer.txBytes,
                    lastSeenAt,
                    isOnline,
                    lastEndpoint: peer.endpoint ?? undefined,
                    user: null,
                });
                await this.profileRepo.save(stub);
            }
            ingested++;
        }

        // Mark any DB peers NOT in the current dump as offline
        const liveKeys = new Set(peers.map(p => p.publicKey));
        await this.profileRepo
            .createQueryBuilder()
            .update()
            .set({ isOnline: false })
            .where('public_key NOT IN (:...keys)', { keys: [...liveKeys] })
            .andWhere('is_online = true')
            .execute();

        this.logger.debug(`TelemetryService: ingested ${ingested} peer(s) from wg dump.`);
    }

    // ─── Parser ──────────────────────────────────────────────────────────────

    /**
     * `wg show wg0 dump` tab-separated columns:
     *
     * Interface line (first):
     *   private-key  public-key  listen-port  fwmark
     *
     * Peer lines:
     *   public-key  preshared-key  endpoint  allowed-ips
     *   latest-handshake  rx-bytes  tx-bytes  persistent-keepalive
     */
    private parseDump(raw: string): WgDumpPeer[] {
        const lines = raw.split('\n').filter(Boolean);
        // Skip the first line (interface row has 4 fields, peer rows have 8)
        return lines
            .slice(1)
            .map(line => {
                const parts = line.split('\t');
                if (parts.length < 8) return null;
                const [publicKey, , endpoint, allowedIps, latestHandshake, rxBytes, txBytes] = parts;
                const ts = parseInt(latestHandshake, 10);
                return {
                    publicKey,
                    endpoint: endpoint === '(none)' ? null : endpoint,
                    allowedIps,
                    latestHandshakeTs: isNaN(ts) || ts === 0 ? null : ts,
                    rxBytes: parseInt(rxBytes, 10) || 0,
                    txBytes: parseInt(txBytes, 10) || 0,
                } satisfies WgDumpPeer;
            })
            .filter((p): p is WgDumpPeer => p !== null);
    }
}
