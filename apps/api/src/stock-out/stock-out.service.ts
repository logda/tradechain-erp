import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { paginateItems } from '../common/pagination';
import { buildSequentialDocumentCode } from '@erp/shared';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import {
  resolveStockOutStore,
  type StockOutOrderStoreItem,
} from './stock-out.store';

export type CreateStockOutPayload = {
  sourceBizType: string;
  sourceBizId: number;
  sourceDocNo?: string;
  warehouseId: number;
  locationId: number;
  createdBy: number;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
};

export type StockOutListQuery = {
  page?: string | number;
  pageSize?: string | number;
};

type StockOutInventoryPort = {
  assertAvailable?: (...args: any[]) => Promise<unknown>;
  postOutbound?: (...args: any[]) => Promise<unknown>;
};

type PrismaStockOutDb = PrismaService & {
  businessDocument: {
    create: (...args: any[]) => Promise<unknown>;
    findMany: (...args: any[]) => Promise<unknown>;
    findUnique: (...args: any[]) => Promise<unknown>;
    update: (...args: any[]) => Promise<unknown>;
  };
};

type ConfirmableStockOutRecord = {
  id: number;
  docNo: string;
  status: 'draft' | 'confirmed';
  warehouseId: number;
  locationId: number;
  createdBy: number;
  sourceBizType: string;
  sourceBizId: number;
  sourceDocNo: string;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
  updatedAt?: string;
};

type StockOutViewRecord = {
  id: number;
  docNo: string;
  sourceBizType: string;
  sourceBizId: number;
  sourceDocNo: string;
  warehouseId: number;
  warehouseName: string;
  locationId: number;
  locationName: string;
  status: 'draft' | 'confirmed';
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

@Injectable()
export class StockOutService {
  private readonly store = resolveStockOutStore();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
    @Optional()
    @Inject('STOCK_OUT_INVENTORY_PORT')
    private readonly inventoryService?: StockOutInventoryPort,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  async list(query: StockOutListQuery = {}) {
    if (this.shouldUsePrisma()) {
      const prismaDb = this.prisma as PrismaStockOutDb;
      const records = (await prismaDb.businessDocument.findMany({
        where: { bizType: 'stock_out' },
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
      const prismaDb = this.prisma as PrismaStockOutDb;
      const record = (await prismaDb.businessDocument.findUnique({
        where: { id: BigInt(id) },
      })) as Record<string, unknown> | null;

      if (!record || record.bizType !== 'stock_out') {
        throw new NotFoundException('Stock-out order not found');
      }

      return this.mapPrismaRecord(record);
    }

    return this.mapStoreRecord(this.findRequired(id));
  }

  async create(payload: CreateStockOutPayload) {
    if (this.shouldUsePrisma()) {
      const created = (await (this.prisma as PrismaStockOutDb).businessDocument.create({
        data: {
          bizType: 'stock_out',
          docNo: `PENDING-STOCK-OUT-${Date.now()}`,
          status: 'draft',
          payload: {
            sourceBizType: payload.sourceBizType,
            sourceBizId: payload.sourceBizId,
            sourceDocNo: payload.sourceDocNo ?? '',
            warehouseId: payload.warehouseId,
            locationId: payload.locationId,
            createdBy: payload.createdBy,
            items: payload.items.map((item) => ({
              productId: item.productId,
              quantity: Number(item.quantity),
            })),
          },
          createdBy: BigInt(payload.createdBy),
        },
      })) as { id: bigint; docNo: string };
      const docNo = buildSequentialDocumentCode('SO', Number(created.id));
      await (this.prisma as PrismaStockOutDb).businessDocument.update({
        where: { id: created.id },
        data: { docNo },
      });

      return {
        id: Number(created.id),
        docNo,
        status: 'draft',
      };
    }

    const id = this.store.nextId++;
    const now = new Date().toISOString();
    const record: StockOutOrderStoreItem = {
      id,
      docNo: buildSequentialDocumentCode('SO', id),
      sourceBizType: payload.sourceBizType,
      sourceBizId: payload.sourceBizId,
      sourceDocNo: payload.sourceDocNo ?? '',
      warehouseId: payload.warehouseId,
      locationId: payload.locationId,
      status: 'draft',
      createdBy: payload.createdBy,
      createdAt: now,
      updatedAt: now,
      items: payload.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      })),
    };

    this.store.records.push(record);
    return record;
  }

  async confirm(id: number) {
    if (this.shouldUsePrisma()) {
      const prismaDb = this.prisma as PrismaStockOutDb;
      const existing = (await prismaDb.businessDocument.findUnique({
        where: { id: BigInt(id) },
      })) as Record<string, unknown> | null;

      if (!existing || existing.bizType !== 'stock_out') {
        throw new NotFoundException('Stock-out order not found');
      }

      const record = this.mapPrismaRecord(existing);
      const confirmedRecord = await this.confirmWithRecord(record);
      const updated = (await prismaDb.businessDocument.update({
        where: { id: BigInt(id) },
        data: { status: confirmedRecord.status },
      })) as Record<string, unknown>;

      return this.mapPrismaRecord(updated);
    }

    const record = this.findRequired(id);
    return this.confirmWithRecord(record);
  }

  async confirmWithRecord(record: ConfirmableStockOutRecord) {
    if (record.status !== 'draft') {
      throw new BadRequestException('Only draft stock-out orders can be confirmed');
    }

    await this.inventoryService?.assertAvailable?.(
      record.warehouseId,
      record.locationId,
      record.items,
    );
    await this.inventoryService?.postOutbound?.({
      sourceBizType: record.sourceBizType,
      sourceBizId: record.sourceBizId,
      sourceDocNo: record.sourceDocNo,
      warehouseId: record.warehouseId,
      locationId: record.locationId,
      items: record.items,
      createdBy: record.createdBy,
    });

    record.status = 'confirmed';
    record.updatedAt = new Date().toISOString();
    return record;
  }

  private findRequired(id: number) {
    const record = this.store.records.find((item) => item.id === id);

    if (!record) {
      throw new NotFoundException('Stock-out order not found');
    }

    return record;
  }

  private mapStoreRecord(record: StockOutOrderStoreItem): StockOutViewRecord {
    return {
      id: record.id,
      docNo: record.docNo,
      sourceBizType: record.sourceBizType,
      sourceBizId: record.sourceBizId,
      sourceDocNo: record.sourceDocNo,
      warehouseId: record.warehouseId,
      warehouseName: resolveWarehouseName(record.warehouseId),
      locationId: record.locationId,
      locationName: resolveLocationName(record.locationId),
      status: record.status,
      createdBy: record.createdBy,
      createdByName: resolveUserName(record.createdBy),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      items: record.items.map((item) => {
        const productMeta = resolveProductMeta(item.productId);

        return {
          productId: item.productId,
          sku: productMeta.sku,
          productName: productMeta.productName,
          quantity: item.quantity,
        };
      }),
    };
  }

  private mapPrismaRecord(record: Record<string, unknown>): StockOutViewRecord {
    const payload = (record.payload ?? {}) as Record<string, unknown>;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const warehouseId = Number(payload.warehouseId ?? 0);
    const locationId = Number(payload.locationId ?? 0);
    const createdBy = Number(payload.createdBy ?? 0);

    return {
      id: Number(record.id),
      docNo: String(record.docNo ?? ''),
      sourceBizType: String(payload.sourceBizType ?? ''),
      sourceBizId: Number(payload.sourceBizId ?? 0),
      sourceDocNo: String(payload.sourceDocNo ?? ''),
      warehouseId,
      warehouseName: resolveWarehouseName(warehouseId),
      locationId,
      locationName: resolveLocationName(locationId),
      status: String(record.status ?? 'draft') as 'draft' | 'confirmed',
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
