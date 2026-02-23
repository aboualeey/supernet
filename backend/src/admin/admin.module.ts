import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { VpnProfile } from '../vpn/entities/vpn-profile.entity';
import { User } from '../users/entities/user.entity';
import { VpnModule } from '../vpn/vpn.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { VerificationResult } from './entities/verification-result.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([VpnProfile, User, VerificationResult]),
        VpnModule,
        SubscriptionsModule,
    ],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }
