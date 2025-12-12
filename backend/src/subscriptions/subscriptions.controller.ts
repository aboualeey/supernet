import { Controller, Get, Post, Body, UseGuards, Request, SetMetadata } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreatePlanDto } from '../common/dtos/create-plan.dto';

@Controller('subscriptions')
@UseGuards(AuthGuard('jwt'))
export class SubscriptionsController {
    constructor(private readonly subService: SubscriptionsService) { }

    @Get('plans')
    getPlans() {
        return this.subService.findAllPlans();
    }

    @Post('plans')
    @UseGuards(RolesGuard)
    @SetMetadata('roles', [UserRole.ADMIN])
    createPlan(@Body() body: CreatePlanDto) {
        return this.subService.createPlan(body);
    }

    @Post('subscribe')
    subscribe(@Request() req, @Body() body: { planId: string }) {
        // In real app, verify payment first!
        return this.subService.subscribe(req.user, body.planId);
    }

    @Get('current')
    getCurrent(@Request() req) {
        return this.subService.getActiveSubscription(req.user.id);
    }
}
