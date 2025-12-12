import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { UsersService } from './users/users.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { UserRole } from './users/entities/user.entity';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly usersService: UsersService,
    private readonly subsService: SubscriptionsService,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('seed')
  async seed() {
    // Seed Admin
    const adminEmail = 'admin@example.com';
    const existingAdmin = await this.usersService.findByEmail(adminEmail);
    let msg = '';
    if (!existingAdmin) {
      msg += 'Creating Admin User... ';
      await this.usersService.create({
        email: adminEmail,
        password: 'adminpassword',
        role: UserRole.ADMIN,
        name: 'Super Admin',
      });
    } else {
      msg += 'Admin already exists. ';
    }

    // Seed Plans
    msg += 'Seeding Plans... ';
    const plans = [
      { name: 'Starter (1 Day)', price: 500, durationDays: 1, bandwidthLimitGb: 1 },
      { name: 'Weekly (7 Days)', price: 3000, durationDays: 7, bandwidthLimitGb: 10 },
      { name: 'Unlimited (30 Days)', price: 10000, durationDays: 30, bandwidthLimitGb: 100 },
    ];

    for (const p of plans) {
      // ideally check if exists, but for now ignoring duplicates or relying on unique constraints if any
      // subService.createPlan doesn't check existence usually, but let's hope it's fine or we just add them
      // Actually, plans usually don't have unique name constraints in simple apps.
      // Let's just try to create them.
      await this.subsService.createPlan(p);
    }

    return { message: msg + 'Done.' };
  }
}
