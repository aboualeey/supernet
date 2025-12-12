import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.usersService.findByEmail(email);
        if (user && (await bcrypt.compare(pass, user.password))) {
            const { password, currentHashedRefreshToken, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any) {
        const { accessToken, refreshToken } = this.getTokens(user.id, user.email, user.role);
        await this.usersService.setCurrentRefreshToken(refreshToken, user.id);
        return {
            access_token: accessToken,
            refresh_token: refreshToken, // Client should store this securely
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        };
    }

    async register(user: any) {
        return this.usersService.create(user);
    }

    getTokens(userId: string, email: string, role: string) {
        const payload = { email, sub: userId, role };
        const accessToken = this.jwtService.sign(payload, {
            secret: process.env.JWT_SECRET,
            expiresIn: '15m'
        });
        const refreshToken = this.jwtService.sign(payload, {
            secret: process.env.JWT_SECRET, // In prod use separate secret
            expiresIn: '7d'
        });
        return { accessToken, refreshToken };
    }

    async refresh(userId: string, refreshToken: string) {
        const user = await this.usersService.getUserIfRefreshTokenMatches(refreshToken, userId);
        if (!user) throw new UnauthorizedException('Access Denied');

        const tokens = this.getTokens(user.id, user.email, user.role);
        await this.usersService.setCurrentRefreshToken(tokens.refreshToken, user.id);
        return {
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
        };
    }

    async logout(userId: string) {
        return this.usersService.removeRefreshToken(userId);
    }
}
