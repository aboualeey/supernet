import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) { }

    async create(data: Partial<User>): Promise<User> {
        const existing = await this.usersRepository.findOne({ where: { email: data.email } });
        if (existing) {
            throw new ConflictException('User with this email already exists');
        }
        if (!data.password) {
            throw new ConflictException('Password is required');
        }
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const user = this.usersRepository.create({ ...data, password: hashedPassword });
        return this.usersRepository.save(user);
    }

    async findOne(id: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({
            where: { email },
            select: ['id', 'email', 'password', 'role', 'isActive', 'currentHashedRefreshToken']
        });
    }

    async update(id: string, attrs: Partial<User>) {
        const user = await this.findOne(id);
        if (!user) {
            throw new Error('User not found');
        }
        Object.assign(user, attrs);
        return this.usersRepository.save(user);
    }

    async setCurrentRefreshToken(refreshToken: string, userId: string) {
        const currentHashedRefreshToken = await bcrypt.hash(refreshToken, 10);
        await this.update(userId, { currentHashedRefreshToken });
    }

    async getUserIfRefreshTokenMatches(refreshToken: string, userId: string) {
        const userById = await this.findOne(userId);
        if (!userById) return null;

        const user = await this.findByEmail(userById.email);
        if (!user || !user.currentHashedRefreshToken) return null;

        const isRefreshTokenMatching = await bcrypt.compare(
            refreshToken,
            user.currentHashedRefreshToken,
        );

        if (isRefreshTokenMatching) {
            return user;
        }
    }

    async removeRefreshToken(userId: string) {
        return this.update(userId, {
            currentHashedRefreshToken: null,
        });
    }

    async findAll(): Promise<User[]> {
        return this.usersRepository.find();
    }
}
