import { Controller, Get, UseGuards, SetMetadata } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from './entities/user.entity';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @SetMetadata('roles', [UserRole.ADMIN])
    findAll() {
        return this.usersService.findAll();
    }
}
