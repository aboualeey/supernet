import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from './entities/server.entity';

@Injectable()
export class ServersService {
    constructor(
        @InjectRepository(Server)
        private serversRepository: Repository<Server>,
    ) { }

    async create(data: Partial<Server>) {
        const server = this.serversRepository.create(data);
        return this.serversRepository.save(server);
    }

    async findAll() {
        return this.serversRepository.find();
    }

    async findOne(id: string) {
        return this.serversRepository.findOne({ where: { id } });
    }
}
