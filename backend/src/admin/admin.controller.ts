import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
    ForbiddenException,
    Request,
    Headers,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';

/** Simple inline admin guard — reuse JWT auth + check role. */
function assertAdmin(req: any) {
    if (!req.user || req.user.role !== 'admin') {
        throw new ForbiddenException('Admin access required.');
    }
}

@UseGuards(AuthGuard('jwt'))
@Controller('admin')
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    /** GET /admin/stats — summary cards */
    @Get('stats')
    async getStats(@Request() req) {
        assertAdmin(req);
        return this.adminService.getSummaryStats();
    }

    /** GET /admin/usage — per-user bandwidth + subscription data */
    @Get('usage')
    async getUsage(@Request() req) {
        assertAdmin(req);
        return this.adminService.getUserUsage();
    }

    /** GET /admin/live — online peers only (from DB, populated by TelemetryService) */
    @Get('live')
    async getLive(@Request() req) {
        assertAdmin(req);
        return this.adminService.getLivePeerStats();
    }

    /** GET /admin/peers — ALL tracked peers (online + offline) for full table */
    @Get('peers')
    async getAllPeers(@Request() req) {
        assertAdmin(req);
        return this.adminService.getAllPeerStats();
    }

    /**
     * POST /admin/ingest-telemetry
     * Called by host-side wg-sync.sh script with raw wg dump output.
     * Bypasses Docker network limitations (Docker can't SSH to VPS directly).
     * Auth: X-Telemetry-Secret header must match TELEMETRY_SECRET env var.
     * Body: { dump: string } (raw output of `wg show wg0 dump`)
     */
    @Post('ingest-telemetry')
    async ingestTelemetry(
        @Body() body: { dump: string },
        @Headers('x-telemetry-secret') secret: string,
    ) {
        const expected = process.env.TELEMETRY_SECRET || 'supernet-telemetry-secret-2024';
        if (secret !== expected) throw new ForbiddenException('Invalid telemetry secret.');
        await this.adminService.ingestRawDump(body.dump);
        return { ok: true };
    }

    /** POST /admin/disable-peer  Body: { publicKey } */
    @Post('disable-peer')
    async disablePeer(@Request() req, @Body() body: { publicKey: string }) {
        assertAdmin(req);
        await this.adminService.adminDisablePeer(body.publicKey);
        return { message: `Peer ${body.publicKey.substring(0, 8)}… disabled.` };
    }

    /** POST /admin/enable-peer  Body: { publicKey } */
    @Post('enable-peer')
    async enablePeer(@Request() req, @Body() body: { publicKey: string }) {
        assertAdmin(req);
        await this.adminService.adminEnablePeer(body.publicKey);
        return { message: `Peer ${body.publicKey.substring(0, 8)}… enabled.` };
    }

    /** POST /admin/allow-gateway  Body: { userId, allowed } */
    @Post('allow-gateway')
    async allowGateway(@Request() req, @Body() body: { userId: string; allowed: boolean }) {
        assertAdmin(req);
        await this.adminService.allowUserGateway(body.userId, body.allowed);
        return { message: `User gateway access set to: ${body.allowed}` };
    }

    /** POST /admin/approve-gateway  Body: { profileId, approved } */
    @Post('approve-gateway')
    async approveGateway(@Request() req, @Body() body: { profileId: string; approved: boolean }) {
        assertAdmin(req);
        await this.adminService.approveProfileGateway(body.profileId, body.approved);
        return { message: `Profile gateway approval set to: ${body.approved}` };
    }

    /** POST /admin/private-gateway/verify  Body: { profileId, deviceExitIp } */
    @Post('private-gateway/verify')
    async verifyPrivateGateway(@Request() req, @Body() body: { profileId: string; deviceExitIp: string }) {
        assertAdmin(req);
        return this.adminService.verifyPrivateGateway(body.profileId, body.deviceExitIp);
    }
}

