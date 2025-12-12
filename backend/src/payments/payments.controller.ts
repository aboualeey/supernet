import { Controller, Post, Body, Get, Query, UseGuards, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('payments')
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly subscriptionsService: SubscriptionsService
    ) { }

    @UseGuards(AuthGuard('jwt'))
    @Post('initialize')
    async initialize(@Request() req, @Body() body: { amount: number, planId: string }) {
        return this.paymentsService.initializePayment(req.user, body.amount, body.planId, req.user.email);
    }

    @Get('verify')
    async verify(@Query('reference') reference: string) {
        const payment = await this.paymentsService.verifyPayment(reference);
        if (payment.status === 'success') {
            // Activate subscription
            // We need to fetch the user again or ensure relation is loaded
            const paymentWithUser = await this.paymentsService.findOneByReference(reference);
            if (paymentWithUser) {
                await this.subscriptionsService.subscribe(paymentWithUser.user, payment.planId);
            }
        }
        return payment;
    }

    // Webhook endpoint would go here
}
