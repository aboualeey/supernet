import { Controller, Post, Get, UseGuards, Request, Body, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { VpnService } from './vpn.service';
import { WgWatcherService } from './wg-watcher.service';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

@Controller('vpn')
export class VpnController {
    constructor(
        private readonly vpnService: VpnService,
        private readonly wgWatcherService: WgWatcherService,
        private readonly configService: ConfigService,
    ) { }

    @UseGuards(AuthGuard('jwt'))
    @Post('generate')
    async generate(@Request() req, @Body() body: { deviceName?: string; nodeName?: string }) {
        return this.vpnService.createProfile(req.user, body?.deviceName, body?.nodeName);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('config')
    async getConfig(@Request() req) {
        const profile = await this.vpnService.getProfile(req.user);

        if (!profile) {
            return { config: null, message: 'No VPN profile found. Please generate one.' };
        }

        const serverKey = this.configService.get<string>('WIREGUARD_SERVER_PUBLIC_KEY') || 'SERVER_PUB_KEY_PLACEHOLDER';
        const nodeEnv = (this.configService.get<string>('NODE_ENV') || 'development').toLowerCase();
        const wgPort = this.configService.get<string>('WG_PORT') || '51820';
        const host = nodeEnv === 'production'
            ? (this.configService.get<string>('WG_PROD_ENDPOINT') || '')
            : (this.configService.get<string>('WG_DEV_ENDPOINT') || '');
        const endpoint = host ? `${host}:${wgPort}` : 'vpn.example.com:51820';

        const config = await this.vpnService.getClientConfig(profile, serverKey, endpoint);
        return { config, profile };
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('toggle-mode')
    async toggleMode(@Request() req, @Body() body: { profileId: string; mode: 'saas' | 'private' }) {
        const profile = await this.vpnService.toggleExitMode(body.profileId, req.user, body.mode);

        const serverKey = this.configService.get<string>('WIREGUARD_SERVER_PUBLIC_KEY') || 'SERVER_PUB_KEY_PLACEHOLDER';
        const nodeEnv = (this.configService.get<string>('NODE_ENV') || 'development').toLowerCase();
        const wgPort = this.configService.get<string>('WG_PORT') || '51820';
        const host = nodeEnv === 'production'
            ? (this.configService.get<string>('WG_PROD_ENDPOINT') || '')
            : (this.configService.get<string>('WG_DEV_ENDPOINT') || '');
        const endpoint = host ? `${host}:${wgPort}` : 'vpn.example.com:51820';

        const config = await this.vpnService.getClientConfig(profile, serverKey, endpoint);
        return { config, profile };
    }


    /**
     * GET /vpn/clients
     * Returns a JSON list of all auto-generated WireGuard clients.
     */
    @Get('clients')
    async listClients() {
        const clients = this.wgWatcherService.listClients();
        return { clients };
    }

    /**
     * GET /vpn/clients/:name/qr
     * Streams the QR code PNG for the named client (e.g., iphone, android).
     */
    @Get('clients/:name/qr')
    async getClientQr(@Param('name') name: string, @Res() res: Response) {
        const qrPath = this.wgWatcherService.getQrPath(name);
        if (!qrPath) {
            throw new NotFoundException(`QR code not found for client: ${name}`);
        }
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store');
        const stream = fs.createReadStream(qrPath);
        stream.pipe(res);
    }

    /**
     * GET /vpn/clients/:name/conf
     * Downloads the .conf file for the named client.
     */
    @Get('clients/:name/conf')
    async getClientConf(@Param('name') name: string, @Res() res: Response) {
        const confPath = this.wgWatcherService.getConfPath(name);
        if (!confPath) {
            throw new NotFoundException(`Config file not found for client: ${name}`);
        }
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${name}.conf"`);
        const stream = fs.createReadStream(confPath);
        stream.pipe(res);
    }
}
