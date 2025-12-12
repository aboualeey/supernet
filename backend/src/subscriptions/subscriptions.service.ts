import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SubscriptionsService {
    constructor(
        @InjectRepository(Plan)
        private plansRepository: Repository<Plan>,
        @InjectRepository(Subscription)
        private subsRepository: Repository<Subscription>,
    ) { }

    async createPlan(data: Partial<Plan>) {
        return this.plansRepository.save(this.plansRepository.create(data));
    }

    async findAllPlans() {
        return this.plansRepository.find();
    }

    async subscribe(user: User, planId: string) {
        const plan = await this.plansRepository.findOne({ where: { id: planId } });
        if (!plan) throw new NotFoundException('Plan not found');

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.durationDays);

        // Deactivate old active subscriptions
        await this.subsRepository.update({ user: { id: user.id }, isActive: true }, { isActive: false });

        // Create new
        const sub = this.subsRepository.create({
            user,
            plan,
            startDate,
            endDate,
            isActive: true,
        });
        return this.subsRepository.save(sub);
    }

    async getActiveSubscription(userId: string) {
        return this.subsRepository.findOne({
            where: { user: { id: userId }, isActive: true },
            relations: ['plan'],
        });
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async handleCron() {
        const expiredSubs = await this.subsRepository.createQueryBuilder('subscription')
            .where('subscription.isActive = :isActive', { isActive: true })
            .andWhere('subscription.endDate < :now', { now: new Date() })
            .getMany();

        if (expiredSubs.length > 0) {
            console.log(`Found ${expiredSubs.length} expired subscriptions. Deactivating...`);
            for (const sub of expiredSubs) {
                sub.isActive = false;
                await this.subsRepository.save(sub);
            }
        }
    }
}
