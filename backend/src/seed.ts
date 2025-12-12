import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { UserRole } from './users/entities/user.entity';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);
    const subsService = app.get(SubscriptionsService);

    // Seed Admin
    const adminEmail = 'admin@example.com';
    const existingAdmin = await usersService.findByEmail(adminEmail);
    if (!existingAdmin) {
        console.log('Creating Admin User...');
        await usersService.create({
            email: adminEmail,
            password: 'adminpassword',
            role: UserRole.ADMIN,
            name: 'Super Admin',
        });
    } else {
        console.log('Admin already exists.');
    }

    // Seed Plans
    console.log('Seeding Plans...');
    const plans = [
        { name: 'Starter (1 Day)', price: 500, durationDays: 1, bandwidthLimitGb: 1 },
        { name: 'Weekly (7 Days)', price: 3000, durationDays: 7, bandwidthLimitGb: 10 },
        { name: 'Unlimited (30 Days)', price: 10000, durationDays: 30, bandwidthLimitGb: 100 },
    ];

    for (const p of plans) {
        await subsService.createPlan(p);
    }

    console.log('Seeding Complete.');
    await app.close();
}
bootstrap();
