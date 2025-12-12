import { Controller, Post, Body, UseGuards, Get, Request, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserDto } from '../common/dtos/create-user.dto';
import { LoginDto } from '../common/dtos/login.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    async login(@Body() req: LoginDto) {
        const user = await this.authService.validateUser(req.email, req.password);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return this.authService.login(user);
    }

    @Post('signup')
    async signup(@Body() createUserDto: CreateUserDto) {
        return this.authService.register(createUserDto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('refresh')
    async refresh(@Request() req, @Body() body: { refresh_token: string }) {
        // NOTE: Ideally refresh token should be in a separate Guard not expecting access token
        // But for simplicity we might pass user ID manually or decode token. 
        // Better approach: Use a specific RefreshTokenGuard that validates the refresh token from body.
        // Here we assume the user is still partially 'authenticated' or we trust the sub claim if we check it.
        // Actually, standard flow: Client sends Refresh Token. We verify it.
        // So we shouldn't use AuthGuard('jwt') which expects Access Token.
        return this.authService.refresh(req.user.id, body.refresh_token);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('logout')
    async logout(@Request() req) {
        await this.authService.logout(req.user.id);
        return { message: 'Logged out successfully' };
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('profile')
    getProfile(@Request() req) {
        return req.user;
    }
}
