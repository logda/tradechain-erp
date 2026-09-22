import { Inject, Injectable, Optional } from '@nestjs/common';
import { paginateItems } from '../common/pagination';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import { resolveWarehouseStore } from './warehouse.store';

export type WarehouseListQuery = {
  page?: string | number;
  pageSize?: string | number;
};

type PrismaWarehouseRecord = {
  id: bigint;
  code: string;
  name: string;
  status: string;
  ownerName: string;
  updatedAt: Date;
};

type PrismaWarehouseDb = PrismaService & {
  warehouse: {
    findMany: (...args: any[]) => Promise<unknown>;
  };
  warehouseLocation: {
    findMany: (...args: any[]) => Promise<unknown>;
  };
};

@Injectable()
export class WarehouseService {
  private readonly store = resolveWarehouseStore();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  async list(query: WarehouseListQuery = {}) {
    if (!this.shouldUsePrisma()) {
      return paginateItems(
        this.store.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          status: item.status,
          locationCount: item.locations.length,
          ownerName: item.ownerName,
          updatedAt: item.updatedAt,
        })),
        query.page ?? 1,
        query.pageSize ?? 20,
      );
    }

    const prismaDb = this.prisma as PrismaWarehouseDb;
    const warehouses = (await prismaDb.warehouse.findMany({
      orderBy: [{ code: 'asc' }],
    })) as PrismaWarehouseRecord[];

    const items = await Promise.all(
      warehouses.map(async (warehouse) => {
        const locations = (await prismaDb.warehouseLocation.findMany({
          where: { warehouseId: warehouse.id },
        })) as Array<unknown>;

        return {
          id: Number(warehouse.id),
          code: warehouse.code,
          name: warehouse.name,
          status: warehouse.status,
          locationCount: locations.length,
          ownerName: warehouse.ownerName,
          updatedAt: warehouse.updatedAt.toISOString(),
        };
      }),
    );

    return paginateItems(items, query.page ?? 1, query.pageSize ?? 20);
  }
}
