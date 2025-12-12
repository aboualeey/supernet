import { Controller, Post, Get, UseGuards, Request, Body } from '@nestjs/common';
import { VpnService } from './vpn.service';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@UseGuards(AuthGuard('jwt'))
@Controller('vpn')
export class VpnController {
    constructor(
        private readonly vpnService: VpnService,
        private readonly configService: ConfigService,
    ) { }

    @Post('generate')
    async generate(@Request() req) {
        return this.vpnService.createProfile(req.user);
    }

    @Get('config')
    async getConfig(@Request() req) {
        const profile = await this.vpnService.getProfile(req.user);

        if (!profile) {
            return { config: null, message: 'No VPN profile found. Please generate one.' };
        }

        const serverKey = this.configService.get<string>('WIREGUARD_SERVER_PUBLIC_KEY') || 'SERVER_PUB_KEY_PLACEHOLDER';
        const endpoint = this.configService.get<string>('WIREGUARD_ENDPOINT') || 'vpn.example.com:51820';

        const config = await this.vpnService.getClientConfig(profile, serverKey, endpoint);
        return { config };
    }
}
