import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import {
  type InventoryBalanceListResponse,
  type InventoryLedgerListResponse,
} from '@erp/shared';
import { paginateItems } from '../common/pagination';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import {
  resolveInventoryStore,
  type InventoryBalanceStoreItem,
} from './inventory.store';

export type InventoryListQuery = {
  page?: string | number;
  pageSize?: string | number;
};

type PrismaInventoryBalanceRecord = {
  id: bigint;
  productId: bigint;
  warehouseId: bigint;
  locationId: bigint;
  onHandQty: number;
  availableQty: number;
  updatedAt: Date;
};

type PrismaInventoryLedgerRecord = {
  id: bigint;
  movementType: string;
  sourceBizType: string;
  sourceBizId: bigint;
  sourceDocNo: string;
  productId: bigint;
  warehouseId: bigint;
  locationId: bigint;
  quantityDelta: number;
  createdBy: string;
  createdAt: Date;
};

type PrismaInventoryDb = PrismaService & {
  inventoryBalance: {
    findMany: (...args: any[]) => Promise<unknown>;
    findUnique?: (...args: any[]) => Promise<unknown>;
    upsert?: (...args: any[]) => Promise<unknown>;
  };
  inventoryLedger: {
    findMany: (...args: any[]) => Promise<unknown>;
    createMany?: (...args: any[]) => Promise<unknown>;
  };
};

type InventoryMovementPayload = {
  sourceBizType: string;
  sourceBizId: number;
  sourceDocNo: string;
  warehouseId: number;
  locationId: number;
  createdBy: number | string;
  items: Array<{
    productId: number;
    sku?: string;
    productName?: string;
    quantity: number;
  }>;
};

type InventoryAvailabilityItem = {
  productId: number;
  quantity: number;
};

function resolveInventorySku(productId: number) {
  if (productId === 1) {
    return 'SKU-LED-001';
  }

  return `SKU-${productId}`;
}

function resolveInventoryProductName(productId: number) {
  if (productId === 1) {
    return '智能 LED 灯带';
  }

  return `Product ${productId}`;
}

function resolveWarehouseName(warehouseId: number) {
  if (warehouseId === 1) {
    return 'Main Warehouse';
  }

  return `Warehouse ${warehouseId}`;
}

function resolveLocationName(locationId: number) {
  if (locationId === 11) {
    return 'A-01';
  }

  return `Location ${locationId}`;
}

function resolveRuntimeSku(
  productId: number,
  existing?: InventoryBalanceStoreItem,
  sku?: string,
) {
  return sku?.trim() || existing?.sku || resolveInventorySku(productId);
}

function resolveRuntimeProductName(
  productId: number,
  existing?: InventoryBalanceStoreItem,
  productName?: string,
) {
  return (
    productName?.trim() ||
    existing?.productName ||
    resolveInventoryProductName(productId)
  );
}

@Injectable()
export class InventoryService {
  private readonly store = resolveInventoryStore();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  async listBalances(
    query: InventoryListQuery = {},
  ): Promise<InventoryBalanceListResponse> {
    if (!this.shouldUsePrisma()) {
      return paginateItems(
        [...this.store.balances].sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        ),
        query.page ?? 1,
        query.pageSize ?? 20,
      );
    }

    const prismaDb = this.prisma as PrismaInventoryDb;
    const balances = (await prismaDb.inventoryBalance.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    })) as PrismaInventoryBalanceRecord[];

    return paginateItems(
      balances.map((balance) => {
        const productId = Number(balance.productId);
        const warehouseId = Number(balance.warehouseId);
        const locationId = Number(balance.locationId);

        return {
          productId,
          sku: resolveInventorySku(productId),
          productName: resolveInventoryProductName(productId),
          warehouseId,
          warehouseName: resolveWarehouseName(warehouseId),
          locationId,
          locationName: resolveLocationName(locationId),
          onHandQty: balance.onHandQty,
          availableQty: balance.availableQty,
          updatedAt: balance.updatedAt.toISOString(),
        };
      }),
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  async listLedger(
    query: InventoryListQuery = {},
  ): Promise<InventoryLedgerListResponse> {
    if (!this.shouldUsePrisma()) {
      return paginateItems(
        [...this.store.ledger].sort((left, right) => right.id - left.id),
        query.page ?? 1,
        query.pageSize ?? 20,
      );
    }

    const prismaDb = this.prisma as PrismaInventoryDb;
    const ledger = (await prismaDb.inventoryLedger.findMany({
      orderBy: [{ createdAt: 'desc' }],
    })) as PrismaInventoryLedgerRecord[];

    return paginateItems(
      ledger.map((item) => {
        const productId = Number(item.productId);
        const warehouseId = Number(item.warehouseId);
        const locationId = Number(item.locationId);

        return {
          id: Number(item.id),
          movementType: item.movementType,
          sourceBizType: item.sourceBizType,
          sourceDocNo: item.sourceDocNo,
          productId,
          sku: resolveInventorySku(productId),
          warehouseName: resolveWarehouseName(warehouseId),
          locationName: resolveLocationName(locationId),
          quantityDelta: item.quantityDelta,
          createdAt: item.createdAt.toISOString(),
        };
      }),
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  async assertAvailable(
    warehouseId: number,
    locationId: number,
    items: InventoryAvailabilityItem[],
  ) {
    for (const item of items) {
      const requiredQuantity = Math.trunc(Number(item.quantity));

      if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
        throw new BadRequestException('Inventory quantity must be greater than 0');
      }

      const availableQty = await this.resolveAvailableQty(
        item.productId,
        warehouseId,
        locationId,
      );

      if (availableQty < requiredQuantity) {
        throw new BadRequestException('Insufficient available inventory');
      }
    }
  }

  async postInbound(payload: InventoryMovementPayload) {
    await this.postMovement(payload, 'stock_in_confirmed', 1);
  }

  async postOutbound(payload: InventoryMovementPayload) {
    await this.assertAvailable(payload.warehouseId, payload.locationId, payload.items);
    await this.postMovement(payload, 'stock_out_confirmed', -1);
  }

  private async resolveAvailableQty(
    productId: number,
    warehouseId: number,
    locationId: number,
  ) {
    if (!this.shouldUsePrisma()) {
      const balance = this.findRuntimeBalance(productId, warehouseId, locationId);
      return balance?.availableQty ?? 0;
    }

    const prismaDb = this.prisma as PrismaInventoryDb;
    const balance = (await prismaDb.inventoryBalance.findUnique?.({
      where: {
        productId_warehouseId_locationId: {
          productId: BigInt(productId),
          warehouseId: BigInt(warehouseId),
          locationId: BigInt(locationId),
        },
      },
    })) as { availableQty?: number } | null | undefined;

    return balance?.availableQty ?? 0;
  }

  private async postMovement(
    payload: InventoryMovementPayload,
    movementType: 'stock_in_confirmed' | 'stock_out_confirmed',
    direction: 1 | -1,
  ) {
    const normalizedItems = payload.items.map((item) => {
      const quantity = Math.trunc(Number(item.quantity));

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException('Inventory quantity must be greater than 0');
      }

      return {
        ...item,
        quantity,
      };
    });

    if (!this.shouldUsePrisma()) {
      const now = new Date().toISOString();

      for (const item of normalizedItems) {
        const balance = this.findOrCreateRuntimeBalance(
          item.productId,
          payload.warehouseId,
          payload.locationId,
          item.sku,
          item.productName,
        );
        const quantityDelta = item.quantity * direction;

        balance.onHandQty += quantityDelta;
        balance.availableQty += quantityDelta;
        balance.updatedAt = now;

        this.store.ledger.push({
          id: this.store.nextLedgerId++,
          movementType,
          sourceBizType: payload.sourceBizType,
          sourceDocNo: payload.sourceDocNo,
          productId: item.productId,
          sku: resolveRuntimeSku(item.productId, balance, item.sku),
          warehouseName: balance.warehouseName,
          locationName: balance.locationName,
          quantityDelta,
          createdAt: now,
        });
      }

      return;
    }

    const prismaDb = this.prisma as PrismaInventoryDb;

    for (const item of normalizedItems) {
      const quantityDelta = item.quantity * direction;
      await prismaDb.inventoryBalance.upsert?.({
        where: {
          productId_warehouseId_locationId: {
            productId: BigInt(item.productId),
            warehouseId: BigInt(payload.warehouseId),
            locationId: BigInt(payload.locationId),
          },
        },
        create: {
          productId: BigInt(item.productId),
          warehouseId: BigInt(payload.warehouseId),
          locationId: BigInt(payload.locationId),
          onHandQty: quantityDelta,
          availableQty: quantityDelta,
        },
        update: {
          onHandQty: { increment: quantityDelta },
          availableQty: { increment: quantityDelta },
        },
      });
    }

    await prismaDb.inventoryLedger.createMany?.({
      data: normalizedItems.map((item) => ({
        movementType,
        sourceBizType: payload.sourceBizType,
        sourceBizId: BigInt(payload.sourceBizId),
        sourceDocNo: payload.sourceDocNo,
        productId: BigInt(item.productId),
        warehouseId: BigInt(payload.warehouseId),
        locationId: BigInt(payload.locationId),
        quantityDelta: item.quantity * direction,
        createdBy: String(payload.createdBy),
      })),
    });
  }

  private findRuntimeBalance(
    productId: number,
    warehouseId: number,
    locationId: number,
  ) {
    return this.store.balances.find(
      (balance) =>
        balance.productId === productId &&
        balance.warehouseId === warehouseId &&
        balance.locationId === locationId,
    );
  }

  private findOrCreateRuntimeBalance(
    productId: number,
    warehouseId: number,
    locationId: number,
    sku?: string,
    productName?: string,
  ) {
    const existing = this.findRuntimeBalance(productId, warehouseId, locationId);

    if (existing) {
      existing.sku = resolveRuntimeSku(productId, existing, sku);
      existing.productName = resolveRuntimeProductName(
        productId,
        existing,
        productName,
      );
      return existing;
    }

    const balance: InventoryBalanceStoreItem = {
      productId,
      sku: resolveRuntimeSku(productId, undefined, sku),
      productName: resolveRuntimeProductName(productId, undefined, productName),
      warehouseId,
      warehouseName: resolveWarehouseName(warehouseId),
      locationId,
      locationName: resolveLocationName(locationId),
      onHandQty: 0,
      availableQty: 0,
      updatedAt: new Date().toISOString(),
    };

    this.store.balances.push(balance);
    return balance;
  }
}
