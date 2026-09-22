import { PrismaService } from '../src/storage/prisma.service';

type TestablePrismaService = PrismaService & {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
};

describe('PrismaService', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = 'mysql://root:password@127.0.0.1:3306/erp';
  });

  afterEach(async () => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }

    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
  });

  it('does not connect on module init while runtime storage remains default', async () => {
    delete process.env.ERP_STORAGE_MODE;
    const service = new PrismaService();
    const testableService = service as TestablePrismaService;
    const connect = jest
      .spyOn(testableService, '$connect')
      .mockResolvedValue(undefined);
    const disconnect = jest
      .spyOn(testableService, '$disconnect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('connects on module init when prisma storage is enabled', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const service = new PrismaService();
    const testableService = service as TestablePrismaService;
    const connect = jest
      .spyOn(testableService, '$connect')
      .mockResolvedValue(undefined);
    jest.spyOn(testableService, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });
});
