import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('vpn_profiles')
export class VpnProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, (user) => user.id)
    user: User;

    @Column()
    publicKey: string;

    @Column()
    encryptedPrivateKey: string;

    @Column()
    ipAddress: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'bigint', default: 0 })
    dataUsage: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
