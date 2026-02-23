import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { VpnProfile } from '../../vpn/entities/vpn-profile.entity';

@Entity('verification_results')
export class VerificationResult {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User)
    user: User;

    @ManyToOne(() => VpnProfile)
    profile: VpnProfile;

    @Column()
    gatewayId: string;

    @Column()
    gatewayIp: string;

    @Column()
    exitIp: string;

    @Column({
        type: 'enum',
        enum: ['VERIFIED', 'FAILED'],
    })
    result: 'VERIFIED' | 'FAILED';

    @Column({ default: false })
    killSwitchVerified: boolean;

    @Column({ nullable: true })
    sessionId: string;

    @Column({ type: 'text', nullable: true })
    failureReason: string;

    @CreateDateColumn()
    timestamp: Date;
}
