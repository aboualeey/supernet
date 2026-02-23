import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('plans')
export class Plan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column('decimal')
    price: number;

    @Column()
    durationDays: number;

    @Column({ nullable: true })
    bandwidthLimitGb: number;

    /** Max WireGuard peers this plan allows. FREE=1, PRO=3, TEAM=10 */
    @Column({ default: 1 })
    maxDevices: number;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
