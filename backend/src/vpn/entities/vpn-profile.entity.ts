import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('vpn_profiles')
export class VpnProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, (user) => user.id, { nullable: true })
    user: User | null;

    @Index()
    @Column({ unique: true })
    publicKey: string;

    @Column({ nullable: true })
    encryptedPrivateKey: string;

    @Column()
    ipAddress: string;

    /** Optional human-readable device label set at profile creation time */
    @Column({ nullable: true })
    deviceName: string;

    /** Which VPS node this peer is assigned to (future multi-region use) */
    @Column({ nullable: true, default: 'default' })
    nodeName: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({
        type: 'enum',
        enum: ['saas', 'private'],
        default: 'saas',
    })
    exitMode: 'saas' | 'private';

    @Column({ default: false })
    privateGatewayApproved: boolean;

    // ─── Telemetry (updated every 10 seconds by TelemetryService) ──────────

    /** Cumulative bytes received by this peer since WireGuard started */
    @Column({ type: 'bigint', default: 0 })
    totalRx: number;

    /** Cumulative bytes transmitted by this peer since WireGuard started */
    @Column({ type: 'bigint', default: 0 })
    totalTx: number;

    /** Legacy combined field kept for backward-compat and limit enforcement */
    @Column({ type: 'bigint', default: 0 })
    dataUsage: number;

    /** Unix timestamp of last WireGuard handshake (null = never seen) */
    @Column({ type: 'timestamptz', nullable: true })
    lastSeenAt: Date | null;

    /** True when lastSeenAt was < 2 minutes ago (updated by ingestion cron) */
    @Column({ default: false })
    isOnline: boolean;

    /** Last known endpoint (IP:port) from wg dump */
    @Column({ nullable: true })
    lastEndpoint: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
