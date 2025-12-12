import { Test, TestingModule } from '@nestjs/testing';
import { VpnController } from './vpn.controller';

describe('VpnController', () => {
  let controller: VpnController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VpnController],
    }).compile();

    controller = module.get<VpnController>(VpnController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
