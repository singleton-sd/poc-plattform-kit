import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@poc-plattform-kit/db';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns ok status', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });

  it('returns ok status when the database is queryable', async () => {
    await expect(controller.checkDatabase()).resolves.toEqual({ status: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('propagates the error when the database is not queryable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database is locked'));
    await expect(controller.checkDatabase()).rejects.toThrow('database is locked');
  });
});
