import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PaymentsService {
    constructor(
        @InjectRepository(Payment)
        private paymentsRepository: Repository<Payment>,
    ) { }

    async initializePayment(user: User, amount: number, planId: string, email: string) {
        // Mock Paystack initialization
        // In real world, call Paystack API to get authorization URL and access_code
        const reference = `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const payment = this.paymentsRepository.create({
            user,
            amount,
            planId,
            transactionReference: reference,
            status: 'pending'
        });
        await this.paymentsRepository.save(payment);

        return {
            authorization_url: `https://checkout.paystack.com/${reference}`, // Mock URL
            access_code: reference,
            reference: reference
        };
    }

    async verifyPayment(reference: string) {
        const payment = await this.paymentsRepository.findOne({ where: { transactionReference: reference } });
        if (!payment) {
            throw new BadRequestException('Transaction reference not found');
        }

        // Mock verification logic
        // In real world, call Paystack API to verify status
        payment.status = 'success';
        await this.paymentsRepository.save(payment);

        return payment;
    }

    async findOneByReference(reference: string) {
        return this.paymentsRepository.findOne({ where: { transactionReference: reference }, relations: ['user'] });
    }
}
