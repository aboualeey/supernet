import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as QRCode from 'qrcode';

interface ClientInfo {
    name: string;
    privateKey: string;
    publicKey: string;
    ip: string;
    confPath: string;
    qrPath: string;
}

// Known initial devices with their pre-assigned private/public keys
const KNOWN_DEVICES: { name: string; privateKey: string; publicKey: string }[] = [
    {
        name: 'iphone',
        privateKey: 'IMGbzhFuLJ1uCviklgnh4Uv6EROphTtf6XAcB11MyEc=',
        publicKey: 'cK65Y998hoFMOoEQ9t23WuiX5kYr0PgtxJ1PA4L2XR0=',
    },
    {
        name: 'android',
        privateKey: 'sLKBiC2l1EmnKyNPrFS3rxPl8rjStWT3EdXrejBPV3M=',
        publicKey: 'D27DrKJLmvv6TWKxFAECoKWZIdp19g9+SSLzDqZVL1E=',
    },
];

/**
 * WgWatcherService
 *
 * Watches wg0.conf for changes. On every update (and on boot), it:
 *  1. Parses all [Peer] blocks from the file.
 *  2. Assigns device names (iphone, android, peer3, …) by peer order.
 *  3. Generates a WireGuard client .conf file for each peer.
 *  4. Generates a QR code PNG for each client.
 *  5. Logs every generation event.
 */
@Injectable()
export class WgWatcherService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(WgWatcherService.name);
    private wgConfigPath: string;
    private clientsDir: string;
    private endpoint: string;
    private serverPublicKey: string;
    private stopWatching: (() => void) | null = null;
    private clients: Map<string, ClientInfo> = new Map();

    constructor(private configService: ConfigService) {
        this.wgConfigPath =
            this.configService.get<string>('WIREGUARD_CONFIG_PATH') || './wg0.conf';

        // Output dir — configurable, defaults to ~/wg_clients
        this.clientsDir =
            this.configService.get<string>('WG_CLIENTS_DIR') ||
            path.join(os.homedir(), 'wg_clients');

        // ── Environment-aware endpoint selection ──────────────────────────────
        const nodeEnv = (this.configService.get<string>('NODE_ENV') || 'development').toLowerCase();
        const wgPort = this.configService.get<string>('WG_PORT') || '51820';
        const devHost = this.configService.get<string>('WG_DEV_ENDPOINT') || '';
        const prodHost = this.configService.get<string>('WG_PROD_ENDPOINT') || '';

        const selectedHost = nodeEnv === 'production' ? prodHost : devHost;

        // Validation: reject empty, localhost, and loopback addresses
        const INVALID_HOSTS = ['', 'localhost', '127.0.0.1', '::1'];
        if (INVALID_HOSTS.includes(selectedHost.trim())) {
            throw new Error(
                `[WireGuard] Invalid endpoint host for NODE_ENV=${nodeEnv}: "${selectedHost}". ` +
                `Set ${nodeEnv === 'production' ? 'WG_PROD_ENDPOINT' : 'WG_DEV_ENDPOINT'} to a routable IP or hostname.`,
            );
        }

        this.endpoint = `${selectedHost.trim()}:${wgPort}`;

        this.serverPublicKey =
            this.configService.get<string>('WIREGUARD_SERVER_PUBLIC_KEY') ||
            'AQEK26OTn0q+Xg7UjKRfeoI9/TbkcDw9sY96m0Vr/2M=';

        // Log the resolved environment + endpoint (single source of truth)
        new Logger(WgWatcherService.name).log(
            `[WireGuard] ENV=${nodeEnv} ENDPOINT=${this.endpoint}`,
        );
    }

    async onModuleInit() {
        // Ensure output directory exists
        fs.mkdirSync(this.clientsDir, { recursive: true });

        this.logger.log(`WgWatcherService started.`);
        this.logger.log(`Watching: ${this.wgConfigPath}`);
        this.logger.log(`Output dir: ${this.clientsDir}`);

        // Initial generation on startup
        await this.processConfig();

        // Start watching
        this.startWatching();
    }

    onModuleDestroy() {
        if (this.stopWatching) {
            this.stopWatching();
            this.logger.log('Stopped watching wg0.conf.');
        }
    }

    // ─── File Watcher ────────────────────────────────────────────────────────────

    private startWatching() {
        const configPath = this.wgConfigPath;

        if (!fs.existsSync(configPath)) {
            this.logger.warn(`Config file not found: ${configPath}. Will retry when it appears.`);
        }

        // Use fs.watchFile (polling) for maximum compatibility across filesystems/Docker volumes
        const POLL_INTERVAL_MS = 2000;
        let lastMtime = 0;

        const interval = setInterval(async () => {
            try {
                if (!fs.existsSync(configPath)) return;
                const stat = fs.statSync(configPath);
                const mtime = stat.mtimeMs;

                if (mtime !== lastMtime) {
                    lastMtime = mtime;
                    this.logger.log('wg0.conf changed — re-generating client configs...');
                    await this.processConfig();
                }
            } catch (err) {
                this.logger.error('Error polling wg0.conf:', err);
            }
        }, POLL_INTERVAL_MS);

        this.stopWatching = () => clearInterval(interval);
        this.logger.log(`Polling wg0.conf every ${POLL_INTERVAL_MS}ms for changes.`);
    }

    // ─── Config Parser ────────────────────────────────────────────────────────────

    /**
     * Parses a WireGuard config file and returns all [Peer] blocks as key-value maps.
     */
    private parsePeers(configContent: string): Array<Record<string, string>> {
        const peers: Array<Record<string, string>> = [];
        const sections = configContent.split(/^\[/m);

        for (const section of sections) {
            const trimmed = section.trim();
            if (!trimmed.toLowerCase().startsWith('peer]')) continue;

            const peer: Record<string, string> = {};
            const lines = trimmed.split('\n').slice(1); // skip the "Peer]" header line

            for (const line of lines) {
                const stripped = line.replace(/#.*$/, '').trim(); // strip inline comments
                if (!stripped || stripped.startsWith('#')) continue;
                const eqIdx = stripped.indexOf('=');
                if (eqIdx < 0) continue;
                const key = stripped.substring(0, eqIdx).trim();
                const value = stripped.substring(eqIdx + 1).trim();
                if (key) peer[key] = value;
            }

            if (Object.keys(peer).length > 0) {
                peers.push(peer);
            }
        }

        return peers;
    }

    /**
     * Extracts the last octet from an AllowedIPs entry like "10.8.0.2/32" → "10.8.0.2"
     */
    private extractIpFromAllowedIPs(allowedIPs: string): string {
        const ip = allowedIPs.split(',')[0].trim().split('/')[0].trim();
        return ip;
    }

    // ─── Config Generation ────────────────────────────────────────────────────────

    private buildClientConf(privateKey: string, ip: string): string {
        return `[Interface]
PrivateKey = ${privateKey}
Address = ${ip}/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${this.serverPublicKey}
Endpoint = ${this.endpoint}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
`;
    }

    private async processConfig() {
        const configPath = this.wgConfigPath;

        if (!fs.existsSync(configPath)) {
            this.logger.warn(`wg0.conf not found at ${configPath}, skipping generation.`);
            return;
        }

        const content = fs.readFileSync(configPath, 'utf-8');
        const peers = this.parsePeers(content);

        if (peers.length === 0) {
            this.logger.log('No [Peer] blocks found in wg0.conf — seeding initial iPhone & Android clients.');
            // Generate configs for the two known devices even without a real [Peer] block,
            // so the user gets pre-populated files immediately.
            await this.generateInitialClients();
            return;
        }

        this.logger.log(`Found ${peers.length} peer(s) in wg0.conf.`);

        const newClients: Map<string, ClientInfo> = new Map();

        for (let i = 0; i < peers.length; i++) {
            const peer = peers[i];
            const device = KNOWN_DEVICES[i] || { name: `peer${i + 1}`, privateKey: '<REPLACE_WITH_PRIVATE_KEY>', publicKey: '' };
            const name = device.name;

            // Use AllowedIPs from peer block if present, fallback to sequential IP
            let ip = `10.8.0.${i + 2}`;
            if (peer['AllowedIPs']) {
                ip = this.extractIpFromAllowedIPs(peer['AllowedIPs']);
            }

            const privateKey = device.privateKey;
            const confContent = this.buildClientConf(privateKey, ip);
            const confPath = path.join(this.clientsDir, `${name}.conf`);
            const qrPath = path.join(this.clientsDir, `${name}.png`);

            // Write .conf file
            fs.writeFileSync(confPath, confContent, 'utf-8');

            // Write QR code PNG
            await QRCode.toFile(qrPath, confContent, { type: 'png', errorCorrectionLevel: 'M' });

            this.logger.log(`Generated: ${confPath}, ${qrPath}`);

            const info: ClientInfo = {
                name,
                privateKey,
                publicKey: peer['PublicKey'] || '',
                ip,
                confPath,
                qrPath,
            };
            newClients.set(name, info);

            // Log the event
            this.appendLog(name, ip, peer['PublicKey'] || 'N/A');
        }

        this.clients = newClients;
    }

    /**
     * Generates client configs for the two known devices even when wg0.conf has no peers yet.
     * IPs are assigned sequentially starting from 10.8.0.2.
     */
    private async generateInitialClients() {
        const newClients: Map<string, ClientInfo> = new Map();

        for (let i = 0; i < KNOWN_DEVICES.length; i++) {
            const device = KNOWN_DEVICES[i];
            // Start at .3 since .2 is reserved for the existing server peer
            const ip = `10.8.0.${i + 3}`;
            const confContent = this.buildClientConf(device.privateKey, ip);
            const confPath = path.join(this.clientsDir, `${device.name}.conf`);
            const qrPath = path.join(this.clientsDir, `${device.name}.png`);

            fs.writeFileSync(confPath, confContent, 'utf-8');
            await QRCode.toFile(qrPath, confContent, { type: 'png', errorCorrectionLevel: 'M' });

            this.logger.log(`[Initial] Generated: ${confPath}, ${qrPath}`);

            const info: ClientInfo = {
                name: device.name,
                privateKey: device.privateKey,
                publicKey: device.publicKey,
                ip,
                confPath,
                qrPath,
            };
            newClients.set(device.name, info);
            this.appendLog(device.name, ip, device.publicKey || '(initial seed)');
        }
        this.clients = newClients;
    }

    // ─── Logging ─────────────────────────────────────────────────────────────────

    private appendLog(name: string, ip: string, publicKey: string) {
        const logPath = path.join(this.clientsDir, 'generation.log');
        const timestamp = new Date().toISOString();
        const entry = `[${timestamp}] client="${name}" ip="${ip}" pubkey="${publicKey}"\n`;
        fs.appendFileSync(logPath, entry, 'utf-8');
    }

    // ─── Public API for Controller ────────────────────────────────────────────────

    listClients(): Array<{ name: string; ip: string; publicKey: string; hasQr: boolean }> {
        return Array.from(this.clients.values()).map((c) => ({
            name: c.name,
            ip: c.ip,
            publicKey: c.publicKey,
            hasQr: fs.existsSync(c.qrPath),
        }));
    }

    getQrPath(name: string): string | null {
        const client = this.clients.get(name);
        if (!client) return null;
        if (!fs.existsSync(client.qrPath)) return null;
        return client.qrPath;
    }

    getConfPath(name: string): string | null {
        const client = this.clients.get(name);
        if (!client) return null;
        if (!fs.existsSync(client.confPath)) return null;
        return client.confPath;
    }

    getClientInfo(name: string): ClientInfo | undefined {
        return this.clients.get(name);
    }
}
