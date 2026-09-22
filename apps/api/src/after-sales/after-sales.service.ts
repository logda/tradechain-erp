import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  AfterSalesListItem,
  AfterSalesListQuery,
  AfterSalesListResponse,
} from '@erp/shared';
import {
  type FormalSession,
  filterVisibleFormalItems,
  isFormalAdminOrBoss,
  matchesFormalUser,
} from '../auth/formal-session';
import { afterSalesListData } from './after-sales-list.data';
import { resolveAfterSalesStore } from './after-sales.store';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import { SalesOrderService } from '../sales-order/sales-order.service';

export type CreatedAfterSalesRecord = {
  id: number;
  afterSalesNo: string;
  status: string;
  financeReviewStatus: string;
  salesOrderId: number;
  purchaseOrderId?: number;
  shipmentBatchId?: number;
  type: string;
  issueDescription: string;
  createdBy: number;
  createdAt: string;
  customerName: string;
  supplierName: string;
  ownerName: string;
  receiptCollectionStatus: string;
  shipmentBatchNo?: string;
  title: string;
  items: CreatedAfterSalesItem[];
};

export type CreatedAfterSalesItem = {
  lineNo: number;
  shipmentLineNo: number;
  purchaseLineNo: number;
  sourceSalesItemId: number;
  productId: number;
  sku: string;
  productName: string;
  unit: string;
  affectedQty: number;
  shipmentQty: number;
};

type PrismaBusinessDocumentRecord = {
  id: bigint;
  bizType: string;
  docNo: string;
  status: string;
  ownerUserId: bigint | null;
  counterpartyId: bigint | null;
  payload: CreatedAfterSalesRecord;
  createdBy: bigint | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaOperationLogRecord = {
  id: bigint;
  bizType: string;
  bizId: bigint;
  operationType: string;
  operatorId: bigint;
  beforeData: unknown | null;
  afterData: unknown | null;
  createdAt: Date;
};

type PrismaAfterSalesDb = PrismaService & {
  businessDocument: {
    findMany: (...args: any[]) => Promise<unknown>;
    findUnique: (...args: any[]) => Promise<unknown>;
    create: (...args: any[]) => Promise<unknown>;
    update: (...args: any[]) => Promise<unknown>;
  };
  operationLog: {
    create: (...args: any[]) => Promise<unknown>;
    findMany: (...args: any[]) => Promise<unknown>;
  };
};

function normalizeAfterSalesType(value: string | undefined) {
  if (
    value === 'customer_complaint' ||
    value === 'return' ||
    value === 'refund' ||
    value === 'rework'
  ) {
    return value;
  }

  return undefined;
}

function resolveCustomerName(salesOrderId: number) {
  if (salesOrderId === 9 || salesOrderId === 88) {
    return 'Acme Trading';
  }

  if (salesOrderId === 12) {
    return 'Bravo Retail';
  }

  return `Customer ${salesOrderId}`;
}

function resolveSupplierName(purchaseOrderId: number | undefined) {
  if (purchaseOrderId === 21 || purchaseOrderId === 100) {
    return 'Acme Supply';
  }

  if (purchaseOrderId === 22) {
    return 'Bravo Industrial';
  }

  if (!purchaseOrderId) {
    return '待定供应商';
  }

  return `Supplier ${purchaseOrderId}`;
}

function resolveUserName(userId: number) {
  if (userId === 2001) {
    return 'Zoe';
  }

  if (userId === 2002) {
    return 'Leo';
  }

  return 'Mia';
}

function resolveShipmentBatchNo(shipmentBatchId: number | undefined) {
  if (!shipmentBatchId) {
    return undefined;
  }

  return `SH20260711${String(shipmentBatchId).padStart(4, '0')}`;
}

function resolveAfterSalesTitle(type: string, customerName: string) {
  if (type === 'customer_complaint') {
    return `${customerName} 客诉跟进`;
  }

  if (type === 'return') {
    return `${customerName} 退货处理`;
  }

  if (type === 'refund') {
    return `${customerName} 退款处理`;
  }

  return `${customerName} 返工处理`;
}

function normalizeAfterSalesItems(
  items:
    | Array<{
        lineNo?: number;
        shipmentLineNo?: number;
        purchaseLineNo?: number;
        sourceSalesItemId?: number;
        productId?: number;
        sku?: string;
        productName?: string;
        unit?: string;
        affectedQty?: number;
        shipmentQty?: number;
      }>
    | undefined,
): CreatedAfterSalesItem[] {
  if (!items?.length) {
    return [];
  }

  return items.map((item, index) => ({
    lineNo: item.lineNo ?? index + 1,
    shipmentLineNo: item.shipmentLineNo ?? item.lineNo ?? index + 1,
    purchaseLineNo: item.purchaseLineNo ?? item.lineNo ?? index + 1,
    sourceSalesItemId: item.sourceSalesItemId ?? 0,
    productId: item.productId ?? 0,
    sku: item.sku?.trim() || `AFTER-SALES-${index + 1}`,
    productName: item.productName?.trim() || '售后商品',
    unit: item.unit?.trim() || 'unit',
    affectedQty: Number.isFinite(item.affectedQty as number)
      ? Number(item.affectedQty)
      : Number(item.shipmentQty ?? 0),
    shipmentQty: Number.isFinite(item.shipmentQty as number)
      ? Number(item.shipmentQty)
      : Number(item.affectedQty ?? 0),
  }));
}

function toCreatedAfterSalesListItem(
  item: CreatedAfterSalesRecord,
): AfterSalesListItem {
  return {
    moduleLabel: '售后单',
    docNo: item.afterSalesNo,
    title: item.title,
    status: item.status,
    secondaryStatus: item.type,
    createdAt: item.createdAt,
    detailHref: `/after-sales/${item.id}`,
    customerName: item.customerName,
    supplierName: item.supplierName,
    createdBy: resolveUserName(item.createdBy),
    ownerName: item.ownerName,
    type: normalizeAfterSalesType(item.type) ?? 'customer_complaint',
    financeReviewStatus: item.financeReviewStatus,
    receiptCollectionStatus: item.receiptCollectionStatus,
    shipmentBatchNo: item.shipmentBatchNo,
  };
}

function canViewAfterSalesListItem(
  session: FormalSession | undefined,
  item: AfterSalesListItem,
) {
  return !(
    session?.role &&
    !isFormalAdminOrBoss(session.role) &&
    session.role !== 'purchase_manager' &&
    !matchesFormalUser(session, item)
  );
}

function toFallbackAfterSalesRecord(
  id: number,
  item?: AfterSalesListItem,
): CreatedAfterSalesRecord {
  return {
    id,
    afterSalesNo: item?.docNo ?? 'AS202607080001',
    status: item?.status ?? 'pending_submit',
    financeReviewStatus: item?.financeReviewStatus ?? 'pending',
    salesOrderId: 88,
    purchaseOrderId: 21,
    shipmentBatchId: 1,
    type: item?.type ?? 'refund',
    issueDescription: item?.title ?? '退款处理',
    createdBy: item?.createdBy === 'Leo' ? 2002 : 2001,
    createdAt: item?.createdAt ?? '2026-07-11T12:00:00.000Z',
    customerName: item?.customerName ?? 'Acme Trading',
    supplierName: item?.supplierName ?? 'Acme Supply',
    ownerName: item?.ownerName ?? 'Zoe',
    receiptCollectionStatus: item?.receiptCollectionStatus ?? 'unpaid',
    shipmentBatchNo: item?.shipmentBatchNo,
    title: item?.title ?? 'Acme 风扇批量退款',
    items: [],
  };
}

function toAfterSalesDocumentPayload(
  record: PrismaBusinessDocumentRecord,
): CreatedAfterSalesRecord {
  return {
    ...record.payload,
    id: Number(record.payload.id ?? record.id),
    afterSalesNo: record.docNo,
    status: record.status,
    financeReviewStatus: record.payload.financeReviewStatus ?? 'pending',
    createdAt: record.payload.createdAt ?? record.createdAt.toISOString(),
    items: Array.isArray(record.payload.items)
      ? record.payload.items.map((item) => ({ ...item }))
      : [],
  };
}

function toAuditLogRecord(record: PrismaOperationLogRecord) {
  return {
    id: Number(record.id),
    bizType: record.bizType,
    bizId: Number(record.bizId),
    operationType: record.operationType,
    operatorId: Number(record.operatorId),
    beforeData: record.beforeData,
    afterData: record.afterData,
    createdAt: record.createdAt.toISOString(),
  };
}

function snapshotAuditData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

@Injectable()
export class AfterSalesService {
  private readonly store = resolveAfterSalesStore();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
    @Optional()
    @Inject(SalesOrderService)
    private readonly salesOrderService?: Pick<
      SalesOrderService,
      'syncOperationalAggregates'
    >,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  private get prismaDb() {
    return this.prisma as PrismaAfterSalesDb | undefined;
  }

  private async updateAfterSalesStatus(payload: {
    afterSalesOrderId: number;
    status: string;
    operationType: string;
    mutate?: (record: CreatedAfterSalesRecord) => Partial<CreatedAfterSalesRecord>;
  }) {
    const existing = (await this.prismaDb!.businessDocument.findUnique({
      where: { id: BigInt(payload.afterSalesOrderId) },
    })) as PrismaBusinessDocumentRecord | null;

    if (!existing || existing.bizType !== 'after_sales') {
      return undefined;
    }

    const beforeData = toAfterSalesDocumentPayload(existing);
    const baseNext = {
      ...beforeData,
      status: payload.status,
    };
    const nextPayload = {
      ...baseNext,
      ...(payload.mutate ? payload.mutate(baseNext) : {}),
    } as CreatedAfterSalesRecord;
    const updated = (await this.prismaDb!.businessDocument.update({
      where: { id: existing.id },
      data: {
        status: payload.status,
        payload: nextPayload,
      },
    })) as PrismaBusinessDocumentRecord;

    await this.prismaDb!.operationLog.create({
      data: {
        bizType: 'after_sales',
        bizId: updated.id,
        operationType: payload.operationType,
        operatorId: existing.createdBy ?? 0n,
        beforeData,
        afterData: nextPayload,
      },
    });

    return nextPayload;
  }

  private async syncSourceSalesOrderAfterSalesStatus(payload: {
    salesOrderId: number;
    afterSalesEndStatus?: string;
    financeStatus?: string;
    operatorId: number;
  }) {
    await this.salesOrderService?.syncOperationalAggregates({
      salesOrderId: payload.salesOrderId,
      afterSalesEndStatus: payload.afterSalesEndStatus,
      financeStatus: payload.financeStatus,
      operatorId: payload.operatorId,
      source: 'after_sales',
    });
  }

  async list(
    query: AfterSalesListQuery,
    session?: FormalSession,
  ): Promise<AfterSalesListResponse> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const sortBy =
      query.sortBy === 'docNo' || query.sortBy === 'customerName'
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const keyword = query.keyword?.trim().toLowerCase();
    const customerName = query.customerName?.trim().toLowerCase();
    const supplierName = query.supplierName?.trim().toLowerCase();
    const createdBy = query.createdBy?.trim().toLowerCase();
    const ownerName = query.ownerName?.trim().toLowerCase();
    const shipmentBatchNo = query.shipmentBatchNo?.trim().toLowerCase();
    const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
    const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;
    const type = normalizeAfterSalesType(query.type);

    const allItems = this.shouldUsePrisma()
      ? (
          (await this.prismaDb!.businessDocument.findMany({
            where: { bizType: 'after_sales' },
            orderBy: { createdAt: 'desc' },
          })) as PrismaBusinessDocumentRecord[]
        ).map(toAfterSalesDocumentPayload).map(toCreatedAfterSalesListItem)
      : [
          ...this.store.listAfterSalesOrders().map(toCreatedAfterSalesListItem),
          ...afterSalesListData,
        ];

    const filtered = filterVisibleFormalItems(
      allItems,
      session ?? {},
      ['admin', 'boss', 'purchase_manager'],
    ).filter((item) => {
      if (
        keyword &&
        ![
          item.docNo,
          item.title,
          item.customerName,
          item.supplierName,
          item.shipmentBatchNo ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      ) {
        return false;
      }

      if (query.docNo && item.docNo !== query.docNo) {
        return false;
      }

      if (query.status && item.status !== query.status) {
        return false;
      }

      if (customerName && !item.customerName.toLowerCase().includes(customerName)) {
        return false;
      }

      if (supplierName && !item.supplierName.toLowerCase().includes(supplierName)) {
        return false;
      }

      if (createdBy && !item.createdBy.toLowerCase().includes(createdBy)) {
        return false;
      }

      if (ownerName && !item.ownerName.toLowerCase().includes(ownerName)) {
        return false;
      }

      if (type && item.type !== type) {
        return false;
      }

      if (
        query.financeReviewStatus &&
        item.financeReviewStatus !== query.financeReviewStatus
      ) {
        return false;
      }

      if (
        query.receiptCollectionStatus &&
        item.receiptCollectionStatus !== query.receiptCollectionStatus
      ) {
        return false;
      }

      if (
        shipmentBatchNo &&
        !(item.shipmentBatchNo ?? '').toLowerCase().includes(shipmentBatchNo)
      ) {
        return false;
      }

      if (dateFrom && item.createdAt < dateFrom) {
        return false;
      }

      if (dateTo && item.createdAt > dateTo) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((left, right) => {
      const leftValue =
        sortBy === 'customerName' ? left.customerName : left[sortBy];
      const rightValue =
        sortBy === 'customerName' ? right.customerName : right[sortBy];

      if (leftValue === rightValue) {
        return 0;
      }

      const result = leftValue > rightValue ? 1 : -1;
      return sortOrder === 'asc' ? result : result * -1;
    });

    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    return {
      items,
      page,
      pageSize,
      total: filtered.length,
      appliedFilters: {
        keyword: query.keyword ?? null,
        docNo: query.docNo ?? null,
        status: query.status ?? null,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        customerName: query.customerName ?? null,
        supplierName: query.supplierName ?? null,
        createdBy: query.createdBy ?? null,
        ownerName: query.ownerName ?? null,
        type: type ?? null,
        financeReviewStatus: query.financeReviewStatus ?? null,
        receiptCollectionStatus: query.receiptCollectionStatus ?? null,
        shipmentBatchNo: query.shipmentBatchNo ?? null,
      },
    };
  }

  async create(payload: {
    salesOrderId: number;
    purchaseOrderId?: number;
    shipmentBatchId?: number;
    customerName?: string;
    supplierName?: string;
    type: string;
    issueDescription: string;
    createdBy: number;
    items?: Array<{
      lineNo?: number;
      shipmentLineNo?: number;
      purchaseLineNo?: number;
      sourceSalesItemId?: number;
      productId?: number;
      sku?: string;
      productName?: string;
      unit?: string;
      affectedQty?: number;
      shipmentQty?: number;
    }>;
  }) {
    if (this.shouldUsePrisma()) {
      const id = 0;
      const customerName =
        payload.customerName?.trim() || resolveCustomerName(payload.salesOrderId);
      const supplierName =
        payload.supplierName?.trim() || resolveSupplierName(payload.purchaseOrderId);
      const shipmentBatchNo = resolveShipmentBatchNo(payload.shipmentBatchId);
      const items = normalizeAfterSalesItems(payload.items);
      const basePayload: CreatedAfterSalesRecord = {
        id,
        afterSalesNo: 'PENDING-AFTER-SALES',
        status: 'pending_submit',
        financeReviewStatus: 'pending',
        salesOrderId: payload.salesOrderId,
        purchaseOrderId: payload.purchaseOrderId,
        shipmentBatchId: payload.shipmentBatchId,
        type: payload.type,
        issueDescription: payload.issueDescription,
        createdBy: payload.createdBy,
        createdAt: '2026-07-11T12:00:00.000Z',
        customerName,
        supplierName,
        ownerName: resolveUserName(payload.createdBy),
        receiptCollectionStatus: 'unpaid',
        shipmentBatchNo,
        title: resolveAfterSalesTitle(payload.type, customerName),
        items,
      };
      const created = (await this.prismaDb!.businessDocument.create({
        data: {
          bizType: 'after_sales',
          docNo: `PENDING-AFTER-SALES-${Date.now()}`,
          status: 'pending_submit',
          ownerUserId: BigInt(payload.createdBy),
          counterpartyId: payload.purchaseOrderId != null ? BigInt(payload.purchaseOrderId) : null,
          payload: basePayload,
          createdBy: BigInt(payload.createdBy),
        },
      })) as PrismaBusinessDocumentRecord;
      const finalPayload: CreatedAfterSalesRecord = {
        ...basePayload,
        id: Number(created.id),
        afterSalesNo: `AS20260711${String(Number(created.id)).padStart(4, '0')}`,
      };
      const updated = (await this.prismaDb!.businessDocument.update({
        where: { id: created.id },
        data: {
          docNo: finalPayload.afterSalesNo,
          payload: finalPayload,
        },
      })) as PrismaBusinessDocumentRecord;
      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'after_sales',
          bizId: updated.id,
          operationType: 'create_after_sales',
          operatorId: BigInt(payload.createdBy),
          beforeData: undefined,
          afterData: finalPayload,
        },
      });

      return {
        id: finalPayload.id,
        afterSalesNo: finalPayload.afterSalesNo,
        status: finalPayload.status,
        financeReviewStatus: finalPayload.financeReviewStatus,
        ...payload,
        items: finalPayload.items,
      };
    }

    const id = this.store.nextAfterSalesId();
    const customerName =
      payload.customerName?.trim() || resolveCustomerName(payload.salesOrderId);
    const supplierName =
      payload.supplierName?.trim() || resolveSupplierName(payload.purchaseOrderId);
    const shipmentBatchNo = resolveShipmentBatchNo(payload.shipmentBatchId);
    const items = normalizeAfterSalesItems(payload.items);
    const created: CreatedAfterSalesRecord = {
      id,
      afterSalesNo: `AS20260711${String(id).padStart(4, '0')}`,
      status: 'pending_submit',
      financeReviewStatus: 'pending',
      salesOrderId: payload.salesOrderId,
      purchaseOrderId: payload.purchaseOrderId,
      shipmentBatchId: payload.shipmentBatchId,
      type: payload.type,
      issueDescription: payload.issueDescription,
      createdBy: payload.createdBy,
      createdAt: '2026-07-11T12:00:00.000Z',
      customerName,
      supplierName,
      ownerName: resolveUserName(payload.createdBy),
      receiptCollectionStatus: 'unpaid',
      shipmentBatchNo,
      title: resolveAfterSalesTitle(payload.type, customerName),
      items,
    };

    this.store.upsertAfterSalesOrder(created);
    this.store.recordAuditLog({
      bizType: 'after_sales',
      bizId: created.id,
      operationType: 'create_after_sales',
      operatorId: payload.createdBy,
      beforeData: null,
      afterData: created,
    });

    return {
      id: created.id,
      afterSalesNo: created.afterSalesNo,
      status: created.status,
      financeReviewStatus: created.financeReviewStatus,
      ...payload,
      items: created.items,
    };
  }

  async listAuditLogs() {
    if (this.shouldUsePrisma()) {
      const logs = (await this.prismaDb!.operationLog.findMany({
        where: { bizType: 'after_sales' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })) as PrismaOperationLogRecord[];

      return {
        items: logs.map(toAuditLogRecord),
      };
    }

    return {
      items: this.store.listAuditLogs(),
    };
  }

  async getDetail(id: number, session?: FormalSession) {
    if (this.shouldUsePrisma()) {
      const created = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaBusinessDocumentRecord | null;

      if (created && created.bizType === 'after_sales') {
        const detail = toAfterSalesDocumentPayload(created);
        const listItem = toCreatedAfterSalesListItem(detail);
        if (!canViewAfterSalesListItem(session, listItem)) {
          throw new NotFoundException('售后单不存在');
        }

        return {
          id: detail.id,
          afterSalesNo: detail.afterSalesNo,
          status: detail.status,
          financeReviewStatus: detail.financeReviewStatus,
          salesOrderId: detail.salesOrderId,
          purchaseOrderId: detail.purchaseOrderId,
          shipmentBatchId: detail.shipmentBatchId,
          type: detail.type,
          issueDescription: detail.issueDescription,
          items: detail.items,
        };
      }
    }

    const created = this.store.getAfterSalesOrder(id);

    if (created) {
      const listItem = toCreatedAfterSalesListItem(created);
      if (!canViewAfterSalesListItem(session, listItem)) {
        throw new NotFoundException('售后单不存在');
      }

      return {
        id: created.id,
        afterSalesNo: created.afterSalesNo,
        status: created.status,
        financeReviewStatus: created.financeReviewStatus,
        salesOrderId: created.salesOrderId,
        purchaseOrderId: created.purchaseOrderId,
        shipmentBatchId: created.shipmentBatchId,
        type: created.type,
        issueDescription: created.issueDescription,
        items: created.items,
      };
    }

    const staticListItem = afterSalesListData.find(
      (item) => item.detailHref === `/after-sales/${id}`,
    );
    const fallbackRecord = toFallbackAfterSalesRecord(id, staticListItem);
    const fallbackListItem =
      staticListItem ?? toCreatedAfterSalesListItem(fallbackRecord);

    if (!canViewAfterSalesListItem(session, fallbackListItem)) {
      throw new NotFoundException('售后单不存在');
    }

    return {
      id: fallbackRecord.id,
      afterSalesNo: fallbackRecord.afterSalesNo,
      status: fallbackRecord.status,
      financeReviewStatus: fallbackRecord.financeReviewStatus,
      salesOrderId: fallbackRecord.salesOrderId,
      purchaseOrderId: fallbackRecord.purchaseOrderId,
      shipmentBatchId: fallbackRecord.shipmentBatchId,
      type: fallbackRecord.type,
      issueDescription: fallbackRecord.issueDescription,
      items: fallbackRecord.items,
    };
  }

  async submit(payload: { afterSalesOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_submit') {
      throw new BadRequestException(
        'Only pending submit after-sales orders can be submitted',
      );
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateAfterSalesStatus({
        afterSalesOrderId: payload.afterSalesOrderId,
        status: 'pending_approval',
        operationType: 'submit_after_sales',
      });

      if (updated) {
        await this.syncSourceSalesOrderAfterSalesStatus({
          salesOrderId: updated.salesOrderId,
          afterSalesEndStatus: 'pending_approval',
          operatorId: updated.createdBy,
        });
      }

      return {
        id: payload.afterSalesOrderId,
        status: 'pending_approval',
      };
    }

    const created = this.store.getAfterSalesOrder(payload.afterSalesOrderId);
    if (created) {
      const beforeData = snapshotAuditData(created);
      created.status = 'pending_approval';
      this.store.upsertAfterSalesOrder(created);
      this.store.recordAuditLog({
        bizType: 'after_sales',
        bizId: created.id,
        operationType: 'submit_after_sales',
        operatorId: created.createdBy,
        beforeData,
        afterData: created,
      });
      await this.syncSourceSalesOrderAfterSalesStatus({
        salesOrderId: created.salesOrderId,
        afterSalesEndStatus: 'pending_approval',
        operatorId: created.createdBy,
      });
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'pending_approval',
    };
  }

  async approve(payload: { afterSalesOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_approval') {
      throw new BadRequestException(
        'Only pending approval after-sales orders can be approved',
      );
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateAfterSalesStatus({
        afterSalesOrderId: payload.afterSalesOrderId,
        status: 'processing',
        operationType: 'approve_after_sales',
      });

      if (updated) {
        await this.syncSourceSalesOrderAfterSalesStatus({
          salesOrderId: updated.salesOrderId,
          afterSalesEndStatus: 'processing',
          operatorId: updated.createdBy,
        });
      }

      return {
        id: payload.afterSalesOrderId,
        status: 'processing',
      };
    }

    const created = this.store.getAfterSalesOrder(payload.afterSalesOrderId);
    if (created) {
      const beforeData = snapshotAuditData(created);
      created.status = 'processing';
      this.store.upsertAfterSalesOrder(created);
      this.store.recordAuditLog({
        bizType: 'after_sales',
        bizId: created.id,
        operationType: 'approve_after_sales',
        operatorId: created.createdBy,
        beforeData,
        afterData: created,
      });
      await this.syncSourceSalesOrderAfterSalesStatus({
        salesOrderId: created.salesOrderId,
        afterSalesEndStatus: 'processing',
        operatorId: created.createdBy,
      });
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'processing',
    };
  }

  async reject(payload: { afterSalesOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_approval') {
      throw new BadRequestException(
        'Only pending approval after-sales orders can be rejected',
      );
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateAfterSalesStatus({
        afterSalesOrderId: payload.afterSalesOrderId,
        status: 'pending_submit',
        operationType: 'reject_after_sales',
      });

      if (updated) {
        await this.syncSourceSalesOrderAfterSalesStatus({
          salesOrderId: updated.salesOrderId,
          afterSalesEndStatus: 'pending_submit',
          operatorId: updated.createdBy,
        });
      }

      return {
        id: payload.afterSalesOrderId,
        status: 'pending_submit',
      };
    }

    const created = this.store.getAfterSalesOrder(payload.afterSalesOrderId);
    if (created) {
      const beforeData = snapshotAuditData(created);
      created.status = 'pending_submit';
      this.store.upsertAfterSalesOrder(created);
      this.store.recordAuditLog({
        bizType: 'after_sales',
        bizId: created.id,
        operationType: 'reject_after_sales',
        operatorId: created.createdBy,
        beforeData,
        afterData: created,
      });
      await this.syncSourceSalesOrderAfterSalesStatus({
        salesOrderId: created.salesOrderId,
        afterSalesEndStatus: 'pending_submit',
        operatorId: created.createdBy,
      });
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'pending_submit',
    };
  }

  async startProcessing(payload: {
    afterSalesOrderId: number;
    currentStatus: string;
  }) {
    if (payload.currentStatus !== 'processing') {
      throw new BadRequestException(
        'Only processing after-sales orders can enter finance review',
      );
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateAfterSalesStatus({
        afterSalesOrderId: payload.afterSalesOrderId,
        status: 'finance_reviewing',
        operationType: 'start_after_sales_processing',
      });

      if (updated) {
        await this.syncSourceSalesOrderAfterSalesStatus({
          salesOrderId: updated.salesOrderId,
          afterSalesEndStatus: 'finance_reviewing',
          operatorId: updated.createdBy,
        });
      }

      return {
        id: payload.afterSalesOrderId,
        status: 'finance_reviewing',
      };
    }

    const created = this.store.getAfterSalesOrder(payload.afterSalesOrderId);
    if (created) {
      const beforeData = snapshotAuditData(created);
      created.status = 'finance_reviewing';
      this.store.upsertAfterSalesOrder(created);
      this.store.recordAuditLog({
        bizType: 'after_sales',
        bizId: created.id,
        operationType: 'start_after_sales_processing',
        operatorId: created.createdBy,
        beforeData,
        afterData: created,
      });
      await this.syncSourceSalesOrderAfterSalesStatus({
        salesOrderId: created.salesOrderId,
        afterSalesEndStatus: 'finance_reviewing',
        operatorId: created.createdBy,
      });
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'finance_reviewing',
    };
  }

  async confirmFinance(payload: {
    afterSalesOrderId: number;
    currentStatus: string;
    financeReviewStatus: string;
  }) {
    if (payload.currentStatus !== 'finance_reviewing') {
      throw new BadRequestException(
        'Only finance-reviewing after-sales orders can confirm finance',
      );
    }

    if (payload.financeReviewStatus !== 'pending') {
      throw new BadRequestException(
        'Only pending finance review can be confirmed',
      );
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateAfterSalesStatus({
        afterSalesOrderId: payload.afterSalesOrderId,
        status: 'finance_reviewing',
        operationType: 'confirm_after_sales_finance',
        mutate: (record) => ({
          ...record,
          financeReviewStatus: 'confirmed',
        }),
      });

      if (updated) {
        await this.syncSourceSalesOrderAfterSalesStatus({
          salesOrderId: updated.salesOrderId,
          afterSalesEndStatus: 'finance_reviewing',
          financeStatus: 'confirmed',
          operatorId: updated.createdBy,
        });
      }

      return {
        id: payload.afterSalesOrderId,
        financeReviewStatus: 'confirmed',
      };
    }

    const created = this.store.getAfterSalesOrder(payload.afterSalesOrderId);
    if (created) {
      const beforeData = snapshotAuditData(created);
      created.financeReviewStatus = 'confirmed';
      this.store.upsertAfterSalesOrder(created);
      this.store.recordAuditLog({
        bizType: 'after_sales',
        bizId: created.id,
        operationType: 'confirm_after_sales_finance',
        operatorId: created.createdBy,
        beforeData,
        afterData: created,
      });
      await this.syncSourceSalesOrderAfterSalesStatus({
        salesOrderId: created.salesOrderId,
        afterSalesEndStatus: 'finance_reviewing',
        financeStatus: 'confirmed',
        operatorId: created.createdBy,
      });
    }

    return {
      id: payload.afterSalesOrderId,
      financeReviewStatus: 'confirmed',
    };
  }

  async finish(payload: { afterSalesOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'finance_reviewing') {
      throw new BadRequestException(
        'Only finance-reviewing after-sales orders can finish',
      );
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateAfterSalesStatus({
        afterSalesOrderId: payload.afterSalesOrderId,
        status: 'finished',
        operationType: 'finish_after_sales',
      });

      if (updated) {
        await this.syncSourceSalesOrderAfterSalesStatus({
          salesOrderId: updated.salesOrderId,
          afterSalesEndStatus: 'finished',
          operatorId: updated.createdBy,
        });
      }

      return {
        id: payload.afterSalesOrderId,
        status: 'finished',
      };
    }

    const created = this.store.getAfterSalesOrder(payload.afterSalesOrderId);
    if (created) {
      const beforeData = snapshotAuditData(created);
      created.status = 'finished';
      this.store.upsertAfterSalesOrder(created);
      this.store.recordAuditLog({
        bizType: 'after_sales',
        bizId: created.id,
        operationType: 'finish_after_sales',
        operatorId: created.createdBy,
        beforeData,
        afterData: created,
      });
      await this.syncSourceSalesOrderAfterSalesStatus({
        salesOrderId: created.salesOrderId,
        afterSalesEndStatus: 'finished',
        operatorId: created.createdBy,
      });
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'finished',
    };
  }

  async close(payload: {
    afterSalesOrderId: number;
    currentStatus: string;
    financeReviewStatus: string;
  }) {
    if (payload.currentStatus !== 'finished') {
      throw new BadRequestException('Only finished after-sales orders can be closed');
    }

    if (payload.financeReviewStatus !== 'confirmed') {
      throw new BadRequestException(
        'Finance review must be confirmed before closing after sales',
      );
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateAfterSalesStatus({
        afterSalesOrderId: payload.afterSalesOrderId,
        status: 'closed',
        operationType: 'close_after_sales',
      });

      if (updated) {
        await this.syncSourceSalesOrderAfterSalesStatus({
          salesOrderId: updated.salesOrderId,
          afterSalesEndStatus: 'closed',
          financeStatus: 'confirmed',
          operatorId: updated.createdBy,
        });
      }

      return {
        id: payload.afterSalesOrderId,
        status: 'closed',
      };
    }

    const created = this.store.getAfterSalesOrder(payload.afterSalesOrderId);
    if (created) {
      const beforeData = snapshotAuditData(created);
      created.status = 'closed';
      this.store.upsertAfterSalesOrder(created);
      this.store.recordAuditLog({
        bizType: 'after_sales',
        bizId: created.id,
        operationType: 'close_after_sales',
        operatorId: created.createdBy,
        beforeData,
        afterData: created,
      });
      await this.syncSourceSalesOrderAfterSalesStatus({
        salesOrderId: created.salesOrderId,
        afterSalesEndStatus: 'closed',
        financeStatus: 'confirmed',
        operatorId: created.createdBy,
      });
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'closed',
    };
  }
}
