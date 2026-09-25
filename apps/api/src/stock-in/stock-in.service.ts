import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { paginateItems } from '../common/pagination';
import { buildSequentialDocumentCode } from '@erp/shared';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import {
  resolveStockInStore,
  type StockInOrderStoreItem,
} from './stock-in.store';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';

export type CreateStockInPayload = {
  sourceBizType: string;
  sourceBizId: number;
  sourceDocNo?: string;
  sourceCurrentStatus?: string;
  warehouseId: number;
  locationId: number;
  createdBy: number;
  items: Array<{
    productId: number;
    sku?: string;
    productName?: string;
    quantity: number;
  }>;
};

export type StockInListQuery = {
  page?: string | number;
  pageSize?: string | number;
};

type PrismaStockInDb = PrismaService & {
  businessDocument: {
    create: (...args: any[]) => Promise<unknown>;
    findMany: (...args: any[]) => Promise<unknown>;
    findUnique: (...args: any[]) => Promise<unknown>;
    update: (...args: any[]) => Promise<unknown>;
  };
  operationLog: {
    create: (...args: any[]) => Promise<unknown>;
  };
};

function resolveProductMeta(productId: number) {
  if (productId === 1) {
    return {
      sku: 'SKU-LED-001',
      productName: '智能 LED 灯带',
    };
  }

  return {
    sku: `SKU-${productId}`,
    productName: `Product ${productId}`,
  };
}

function createStockInDocNo(id: number) {
  return buildSequentialDocumentCode('SI', id);
}

function resolveWarehouseName(warehouseId: number) {
  if (warehouseId === 1) {
    return 'Main Warehouse';
  }

  if (warehouseId === 2) {
    return 'Bonded Warehouse';
  }

  return `Warehouse-${warehouseId}`;
}

function resolveLocationName(locationId: number) {
  if (locationId === 11) {
    return 'A-01';
  }

  if (locationId === 21) {
    return 'B-01';
  }

  return `LOC-${locationId}`;
}

function resolveUserName(userId: number) {
  if (userId === 2002) {
    return 'Leo';
  }

  if (userId === 2001) {
    return 'Zoe';
  }

  if (userId === 2000) {
    return 'Mia';
  }

  if (userId === 9000) {
    return 'Admin';
  }

  return `User-${userId}`;
}

type StockInViewRecord = {
  id: number;
  docNo: string;
  status: 'draft' | 'confirmed';
  sourceBizType: string;
  sourceBizId: number;
  sourceDocNo: string;
  warehouseId: number;
  warehouseName: string;
  locationId: number;
  locationName: string;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    productId: number;
    sku: string;
    productName: string;
    quantity: number;
  }>;
};

@Injectable()
export class StockInService {
  private readonly store = resolveStockInStore();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
    @Optional()
    @Inject(InventoryService)
    private readonly inventoryService?: {
      postInbound?: (...args: any[]) => Promise<unknown>;
    },
    @Optional()
    @Inject(PurchaseOrderService)
    private readonly purchaseOrderService?: Pick<PurchaseOrderService, 'getDetail'>,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  private async assertPurchaseOrderCanCreateStockIn(
    payload: CreateStockInPayload,
  ) {
    if (payload.sourceBizType !== 'purchase_order') {
      return;
    }

    const detail = await this.purchaseOrderService
      ?.getDetail?.(payload.sourceBizId)
      .catch(() => null);
    const currentStatus = detail?.status ?? payload.sourceCurrentStatus;

    if (currentStatus !== 'purchasing') {
      throw new BadRequestException(
        'Only purchasing purchase orders can create stock-in orders',
      );
    }
  }

  async list(query: StockInListQuery = {}) {
    if (this.shouldUsePrisma()) {
      const prismaDb = this.prisma as PrismaStockInDb;
      const records = (await prismaDb.businessDocument.findMany({
        where: { bizType: 'stock_in' },
        orderBy: { createdAt: 'desc' },
      })) as Array<Record<string, unknown>>;

      return paginateItems(
        records.map((record) => this.mapPrismaRecord(record)),
        query.page ?? 1,
        query.pageSize ?? 20,
      );
    }

    return paginateItems(
      [...this.store.records]
        .sort((left, right) => right.id - left.id)
        .map((record) => this.mapStoreRecord(record)),
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  async detail(id: number) {
    if (this.shouldUsePrisma()) {
      const prismaDb = this.prisma as PrismaStockInDb;
      const record = (await prismaDb.businessDocument.findUnique({
        where: { id: BigInt(id) },
      })) as Record<string, unknown> | null;

      if (!record || record.bizType !== 'stock_in') {
        throw new NotFoundException('Stock-in order not found');
      }

      return this.mapPrismaRecord(record);
    }

    return this.mapStoreRecord(this.findRequired(id));
  }

  async create(payload: CreateStockInPayload) {
    await this.assertPurchaseOrderCanCreateStockIn(payload);

    const normalizedItems = payload.items.map((item) => {
      const productMeta = resolveProductMeta(item.productId);

      return {
        productId: item.productId,
        sku: item.sku ?? productMeta.sku,
        productName: item.productName ?? productMeta.productName,
        quantity: Number(item.quantity),
      };
    });

    if (this.shouldUsePrisma()) {
      const prismaDb = this.prisma as PrismaStockInDb;
      const created = (await prismaDb.businessDocument.create({
        data: {
          bizType: 'stock_in',
          docNo: `PENDING-STOCK-IN-${Date.now()}`,
          status: 'draft',
          payload: {
            sourceBizType: payload.sourceBizType,
            sourceBizId: payload.sourceBizId,
            sourceDocNo: payload.sourceDocNo ?? '',
            sourceCurrentStatus: payload.sourceCurrentStatus ?? '',
            warehouseId: payload.warehouseId,
            locationId: payload.locationId,
            createdBy: payload.createdBy,
            items: normalizedItems,
          },
          createdBy: BigInt(payload.createdBy),
        },
      })) as {
        id: bigint;
        docNo: string;
        createdAt?: Date;
      };
      const docNo = createStockInDocNo(Number(created.id));
      await prismaDb.businessDocument.update({
        where: { id: created.id },
        data: { docNo },
      });

      await prismaDb.operationLog.create({
        data: {
          bizType: 'stock_in',
          bizId: created.id,
          operationType: 'create_stock_in',
          operatorId: BigInt(payload.createdBy),
          afterData: {
            warehouseId: payload.warehouseId,
            locationId: payload.locationId,
            itemCount: normalizedItems.length,
          },
        },
      });

      return {
        id: Number(created.id),
        docNo,
        status: 'draft',
        sourceBizType: payload.sourceBizType,
        sourceBizId: payload.sourceBizId,
        sourceDocNo: payload.sourceDocNo ?? '',
        warehouseId: payload.warehouseId,
        locationId: payload.locationId,
        createdBy: payload.createdBy,
        createdAt: created.createdAt?.toISOString() ?? new Date().toISOString(),
        updatedAt: created.createdAt?.toISOString() ?? new Date().toISOString(),
        items: normalizedItems,
      };
    }

    const id = this.store.nextId++;
    const now = new Date().toISOString();
    const record: StockInOrderStoreItem = {
      id,
      docNo: createStockInDocNo(id),
      sourceBizType: payload.sourceBizType,
      sourceBizId: payload.sourceBizId,
      sourceDocNo: payload.sourceDocNo ?? '',
      warehouseId: payload.warehouseId,
      locationId: payload.locationId,
      status: 'draft',
      createdBy: payload.createdBy,
      createdAt: now,
      updatedAt: now,
      items: normalizedItems,
    };

    this.store.records.push(record);
    return record;
  }

  async confirm(id: number) {
    if (this.shouldUsePrisma()) {
      const prismaDb = this.prisma as PrismaStockInDb;
      const existing = (await prismaDb.businessDocument.findUnique({
        where: { id: BigInt(id) },
      })) as Record<string, unknown> | null;

      if (!existing || existing.bizType !== 'stock_in') {
        throw new NotFoundException('Stock-in order not found');
      }

      const record = this.mapPrismaRecord(existing);

      if (record.status !== 'draft') {
        throw new BadRequestException('Only draft stock-in orders can be confirmed');
      }

      await this.inventoryService?.postInbound?.({
        sourceBizType: record.sourceBizType,
        sourceBizId: record.sourceBizId,
        sourceDocNo: record.sourceDocNo,
        warehouseId: record.warehouseId,
        locationId: record.locationId,
        items: record.items,
        createdBy: record.createdBy,
      } as any);

      const updated = (await prismaDb.businessDocument.update({
        where: { id: BigInt(id) },
        data: { status: 'confirmed' },
      })) as Record<string, unknown>;

      return this.mapPrismaRecord(updated);
    }

    const record = this.findRequired(id);

    if (record.status !== 'draft') {
      throw new BadRequestException('Only draft stock-in orders can be confirmed');
    }

    record.status = 'confirmed';
    record.updatedAt = new Date().toISOString();

    await this.inventoryService?.postInbound?.({
      sourceBizType: record.sourceBizType,
      sourceBizId: record.sourceBizId,
      sourceDocNo: record.sourceDocNo,
      warehouseId: record.warehouseId,
      locationId: record.locationId,
      items: record.items,
      createdBy: record.createdBy,
    } as any);

    return record;
  }

  private findRequired(id: number) {
    const record = this.store.records.find((item) => item.id === id);

    if (!record) {
      throw new NotFoundException('Stock-in order not found');
    }

    return record;
  }

  private mapStoreRecord(record: StockInOrderStoreItem): StockInViewRecord {
    return {
      id: record.id,
      docNo: record.docNo,
      status: record.status,
      sourceBizType: record.sourceBizType,
      sourceBizId: record.sourceBizId,
      sourceDocNo: record.sourceDocNo,
      warehouseId: record.warehouseId,
      warehouseName: resolveWarehouseName(record.warehouseId),
      locationId: record.locationId,
      locationName: resolveLocationName(record.locationId),
      createdBy: record.createdBy,
      createdByName: resolveUserName(record.createdBy),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      items: record.items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
      })),
    };
  }

  private mapPrismaRecord(record: Record<string, unknown>): StockInViewRecord {
    const payload = (record.payload ?? {}) as Record<string, unknown>;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const warehouseId = Number(payload.warehouseId ?? 0);
    const locationId = Number(payload.locationId ?? 0);
    const createdBy = Number(payload.createdBy ?? 0);

    return {
      id: Number(record.id),
      docNo: String(record.docNo ?? ''),
      status: String(record.status ?? 'draft') as 'draft' | 'confirmed',
      sourceBizType: String(payload.sourceBizType ?? ''),
      sourceBizId: Number(payload.sourceBizId ?? 0),
      sourceDocNo: String(payload.sourceDocNo ?? ''),
      warehouseId,
      warehouseName: resolveWarehouseName(warehouseId),
      locationId,
      locationName: resolveLocationName(locationId),
      createdBy,
      createdByName: resolveUserName(createdBy),
      createdAt: new Date(String(record.createdAt ?? new Date().toISOString())).toISOString(),
      updatedAt: new Date(
        String(record.updatedAt ?? record.createdAt ?? new Date().toISOString()),
      ).toISOString(),
      items: items.map((item) => {
        const itemRecord = item as Record<string, unknown>;
        const productId = Number(itemRecord.productId ?? 0);
        const productMeta = resolveProductMeta(productId);

        return {
          productId,
          sku: String(itemRecord.sku ?? productMeta.sku),
          productName: String(itemRecord.productName ?? productMeta.productName),
          quantity: Number(itemRecord.quantity ?? 0),
        };
      }),
    };
  }
}
