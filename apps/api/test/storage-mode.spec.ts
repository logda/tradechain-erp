import { resolveStorageMode } from '../src/storage/storage-mode';

describe('resolveStorageMode', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('defaults to runtime storage to keep the demo chain stable', () => {
    delete process.env.ERP_STORAGE_MODE;

    expect(resolveStorageMode()).toBe('runtime');
  });

  it('allows prisma storage mode for formal persistence rollout', () => {
    process.env.ERP_STORAGE_MODE = 'prisma';

    expect(resolveStorageMode()).toBe('prisma');
  });

  it('normalizes whitespace and casing in storage mode values', () => {
    process.env.ERP_STORAGE_MODE = ' PRISMA ';

    expect(resolveStorageMode()).toBe('prisma');
  });

  it('falls back to runtime for unknown storage mode values', () => {
    process.env.ERP_STORAGE_MODE = 'mysql';

    expect(resolveStorageMode()).toBe('runtime');
  });
});
