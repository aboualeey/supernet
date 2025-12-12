import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('servers')
export class Server {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    ipAddress: string;

    @Column()
    region: string;

    @Column()
    publicKey: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: 'online' })
    status: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
