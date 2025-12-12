import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VpnService } from './vpn.service';
import { VpnController } from './vpn.controller';
import { VpnProfile } from './entities/vpn-profile.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VpnProfile]),
    SubscriptionsModule,
  ],
  controllers: [VpnController],
  providers: [VpnService],
  exports: [VpnService],
})
export class VpnModule { }
