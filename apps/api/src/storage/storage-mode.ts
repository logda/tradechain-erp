export type StorageMode = 'runtime' | 'prisma';

export function resolveStorageMode(): StorageMode {
  return process.env.ERP_STORAGE_MODE?.trim().toLowerCase() === 'prisma'
    ? 'prisma'
    : 'runtime';
}
