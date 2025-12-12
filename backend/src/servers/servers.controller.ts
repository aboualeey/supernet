import { Controller, Get, Post, Body, UseGuards, SetMetadata } from '@nestjs/common';
import { ServersService } from './servers.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@Controller('servers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ServersController {
    constructor(private readonly serversService: ServersService) { }

    @Get()
    @SetMetadata('roles', [UserRole.ADMIN])
    findAll() {
        return this.serversService.findAll();
    }

    @Post()
    @SetMetadata('roles', [UserRole.ADMIN])
    create(@Body() body: any) {
        return this.serversService.create(body);
    }
}
