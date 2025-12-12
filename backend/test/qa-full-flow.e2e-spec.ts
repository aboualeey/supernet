
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './../src/users/users.module';
import { AuthModule } from './../src/auth/auth.module';
import { SubscriptionsModule } from './../src/subscriptions/subscriptions.module';
import { PaymentsModule } from './../src/payments/payments.module';
import { VpnModule } from './../src/vpn/vpn.module';
import { ServersModule } from './../src/servers/servers.module';

describe('QA Full System Flow (E2E)', () => {
    let app: INestApplication;
    let accessToken: string;
    let refreshToken: string;
    let userId: string;
    let planId: string;
    let userEmail: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.example' }),
                TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [__dirname + '/../src/**/*.entity.ts'],
                    synchronize: true,
                    dropSchema: true
                }),
                UsersModule,
                AuthModule,
                SubscriptionsModule,
                PaymentsModule,
                VpnModule,
                ServersModule
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    // --- 1. Authentication ---
    it('1. Signup - Should create a new user', async () => {
        userEmail = `qa_${Date.now()}@test.com`;
        const res = await request(app.getHttpServer())
            .post('/auth/signup')
            .send({
                email: userEmail,
                password: 'password123',
                name: 'QA Tester',
                role: 'user'
            })
            .expect(201);

        expect(res.body.email).toBe(userEmail);
        expect(res.body.id).toBeDefined();
    });

    it('2. Login - Should return Access and Refresh Tokens', async () => {
        const res = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: userEmail,
                password: 'password123'
            })
            .expect(201);

        expect(res.body.access_token).toBeDefined();
        expect(res.body.refresh_token).toBeDefined();
        accessToken = res.body.access_token;
        refreshToken = res.body.refresh_token;
    });

    it('3. Refresh Token - Should return new tokens', async () => {
        const res = await request(app.getHttpServer())
            .post('/auth/refresh')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ refresh_token: refreshToken })
            .expect(201);

        expect(res.body.access_token).toBeDefined();
        expect(res.body.refresh_token).toBeDefined();
        accessToken = res.body.access_token;
        refreshToken = res.body.refresh_token;
    });

    // --- 2. Plans & Admin ---
    it('4. Admin Create Plan - Should create a plan', async () => {
        const adminEmail = `admin_${Date.now()}@test.com`;
        await request(app.getHttpServer())
            .post('/auth/signup')
            .send({ email: adminEmail, password: 'adminpass', role: 'admin' });

        const loginRes = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: adminEmail, password: 'adminpass' });

        const adminToken = loginRes.body.access_token;

        const res = await request(app.getHttpServer())
            .post('/subscriptions/plans')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'QA Premium Plan',
                durationDays: 30,
                price: 999,
                currency: 'USD',
                bandwidthLimitGb: 100
            })
            .expect(201);

        planId = res.body.id;
        expect(planId).toBeDefined();
    });

    it('5. Fetch Plans - Should list plans', async () => {
        const res = await request(app.getHttpServer())
            .get('/subscriptions/plans')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(Array.isArray(res.body)).toBeTruthy();
        expect(res.body.length).toBeGreaterThan(0);
        const found = res.body.find(p => p.id === planId);
        expect(found).toBeDefined();
    });

    // --- 3. Payments & Subscription ---
    it('6. Initialize Payment - Should return reference', async () => {
        const res = await request(app.getHttpServer())
            .post('/payments/initialize')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                planId: planId,
                amount: 999
            })
            .expect(201);

        expect(res.body.reference).toBeDefined();
        (global as any).paymentRef = res.body.reference;
    });

    it('7. Verify Payment & Subscribe - Should activate subscription', async () => {
        const ref = (global as any).paymentRef;
        const res = await request(app.getHttpServer())
            .get(`/payments/verify?reference=${ref}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');

        const subRes = await request(app.getHttpServer())
            .get('/subscriptions/current')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(subRes.body.isActive).toBe(true);
        expect(subRes.body.plan.id).toBe(planId);
    });

    // --- 4. VPN Generation ---
    it('8. Generate VPN Profile - Should return keys (encrypted) and IP', async () => {
        const res = await request(app.getHttpServer())
            .post('/vpn/generate')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(201);

        expect(res.body.publicKey).toBeDefined();
        expect(res.body.encryptedPrivateKey).toBeDefined();
        expect(res.body.ipAddress).toMatch(/^10\.8\.0\.\d+$/);
    });

    it('9. Get Config - Should return decrypted config', async () => {
        const res = await request(app.getHttpServer())
            .get('/vpn/config')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.config).toBeDefined();
        expect(res.body.config).toContain('[Interface]');
    });
});
