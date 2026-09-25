import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  PurchaseOrderListResponse,
  SalesOrderListResponse,
  ShipmentBatchListItem,
  ShipmentBatchListQuery,
  ShipmentBatchListResponse,
} from '@erp/shared';
import { buildSequentialDocumentCode } from '@erp/shared';
import { type FormalSession } from '../auth/formal-session';
import { shipmentBatchListData } from './shipment-batch-list.data';
import { resolveShipmentBatchStore } from './shipment-batch.store';
import { PrismaService } from '../storage/prisma.service';
import { CounterpartyService } from '../counterparty/counterparty.service';
import { resolveStorageMode } from '../storage/storage-mode';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';

export type CreatedShipmentBatchRecord = {
  id: number;
  batchNo: string;
  status: string;
  receiptSendStatus: string;
  stockOutStatus?: string;
  stockOutDocNo?: string | null;
  shippedQty: number;
  accumulatedQty: number;
  remainingQty: number;
  shippedAt: string;
  factoryShipDate?: string;
  shippingCode?: string;
  shippingCodeItems?: ShippingCodeItem[];
  destination?: string;
  shippingMark?: string;
  goodsName?: string;
  totalPackages?: number;
  purchasingUnit?: string;
  customerName?: string;
  freightStation?: string;
  warehouseEntryNo?: string;
  arrivalStatus?: string;
  forwarderShipDate?: string;
  estimatedArrivalDate?: string;
  remark?: string;
  createdBy: number;
  salesOrderId: number;
  purchaseOrderId: number;
  purchaseOrderCurrentStatus: string;
  currentBatchCount: number;
  salesOrderLocked: boolean;
  supplierName: string;
  salesOrderNo: string;
  purchaseOrderNo: string;
  title: string;
  createdAt: string;
  hasException: boolean;
  exceptionReason?: string;
  receiptDocUrl?: string;
  receiptSentBy?: number;
  items: ShipmentBatchLineItem[];
};

export type ShipmentBatchLineItem = {
  lineNo: number;
  purchaseLineNo: number;
  sourceSalesItemId: number;
  productId: number;
  sku: string;
  productName: string;
  unit: string;
  shippedQty: number;
  purchaseQty: number;
};

export type ShippingCodeItem = {
  code: string;
  quantity: number;
};

export type CreateShipmentBatchPayload = {
  salesOrderId: number;
  purchaseOrderId: number;
  shippedQty: number;
  accumulatedQty: number;
  remainingQty: number;
  shippedAt: string;
  factoryShipDate?: string;
  shippingCode?: string;
  shippingCodeItems?: Array<{
    code: string;
    quantity: number;
  }>;
  destination?: string;
  shippingMark?: string;
  goodsName?: string;
  totalPackages?: number;
  purchasingUnit?: string;
  customerName?: string;
  freightStation?: string;
  warehouseEntryNo?: string;
  arrivalStatus?: string;
  forwarderShipDate?: string;
  estimatedArrivalDate?: string;
  remark?: string;
  createdBy: number;
  purchaseOrderCurrentStatus: string;
  currentBatchCount: number;
  items?: Array<{
    purchaseLineNo: number;
    sourceSalesItemId: number;
    productId: number;
    sku: string;
    productName: string;
    unit: string;
    shippedQty: number;
    purchaseQty: number;
  }>;
};

type PrismaBusinessDocumentRecord = {
  id: bigint;
  bizType: string;
  docNo: string;
  status: string;
  ownerUserId: bigint | null;
  counterpartyId: bigint | null;
  payload: CreatedShipmentBatchRecord;
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

type PrismaShipmentDb = PrismaService & {
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

const shipmentProgressOrder = [
  'shipped',
  'to_forwarder',
  'forwarder_shipped',
  'arrived',
] as const;

function normalizeTriStateFilter(value: 'all' | 'yes' | 'no' | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

function resolveSupplierName(purchaseOrderId: number) {
  if (purchaseOrderId === 21 || purchaseOrderId === 100) {
    return 'Acme Supply';
  }

  if (purchaseOrderId === 22) {
    return 'Bravo Industrial';
  }

  return `Supplier ${purchaseOrderId}`;
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeShippingCode(value: string | null | undefined) {
  const normalized = value
    ?.split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n');

  return normalized ? normalized : undefined;
}

function normalizeShippingCodeItems(
  value: CreateShipmentBatchPayload['shippingCodeItems'],
): ShippingCodeItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      code: item?.code?.trim() ?? '',
      quantity: Number(item?.quantity),
    }))
    .filter((item) => item.code);
}

function formatShippingCodeItems(items: ShippingCodeItem[]) {
  return items
    .map((item) => `${item.code} x ${item.quantity}`)
    .join('\n');
}

function resolveArrivalStatus(status: string, arrivalStatus?: string) {
  if (status === 'arrived' && (!arrivalStatus || arrivalStatus === '已发')) {
    return '已到货';
  }

  return arrivalStatus;
}

function normalizeOptionalNumber(value: number | null | undefined) {
  if (!Number.isFinite(value) || Number(value) <= 0) {
    return undefined;
  }

  return Number(value);
}

function toCreatedShipmentBatchListItem(
  item: CreatedShipmentBatchRecord,
): ShipmentBatchListItem {
  return {
    moduleLabel: '发货批次',
    docNo: item.batchNo,
    title: item.title,
    status: item.status,
    secondaryStatus: item.status,
    supplierName: item.supplierName,
    salesOrderNo: item.salesOrderNo,
    purchaseOrderNo: item.purchaseOrderNo,
    shippedQty: item.shippedQty,
    remainingQty: item.remainingQty,
    factoryShipDate: item.factoryShipDate,
    shippingCode: item.shippingCode,
    shippingCodeItems: item.shippingCodeItems?.map((entry) => ({ ...entry })),
    destination: item.destination,
    shippingMark: item.shippingMark,
    goodsName: item.goodsName,
    totalPackages: item.totalPackages,
    purchasingUnit: item.purchasingUnit,
    customerName: item.customerName,
    freightStation: item.freightStation,
    warehouseEntryNo: item.warehouseEntryNo,
    arrivalStatus: resolveArrivalStatus(item.status, item.arrivalStatus),
    forwarderShipDate: item.forwarderShipDate,
    estimatedArrivalDate: item.estimatedArrivalDate,
    remark: item.remark,
    receiptSendStatus: item.receiptSendStatus,
    hasException: item.hasException,
    createdAt: item.createdAt,
    detailHref: `/shipment-batches/${item.id}`,
    items: item.items.map((line) => ({
      purchaseLineNo: line.purchaseLineNo,
      shippedQty: line.shippedQty,
      purchaseQty: line.purchaseQty,
    })),
  };
}

function normalizeShipmentBatchItems(
  payload: CreateShipmentBatchPayload,
): ShipmentBatchLineItem[] {
  if (payload.items?.length) {
    return payload.items.map((item, index) => ({
      lineNo: index + 1,
      purchaseLineNo: Number(item.purchaseLineNo),
      sourceSalesItemId: Number(item.sourceSalesItemId),
      productId: Number(item.productId),
      sku: item.sku,
      productName: item.productName,
      unit: item.unit,
      shippedQty: Number(item.shippedQty),
      purchaseQty: Number(item.purchaseQty),
    }));
  }

  return [
    {
      lineNo: 1,
      purchaseLineNo: 1,
      sourceSalesItemId: 1,
      productId: 501,
      sku: 'SKU-LED-001',
      productName: '智能 LED 灯带',
      unit: 'set',
      shippedQty: payload.shippedQty,
      purchaseQty: payload.accumulatedQty + payload.remainingQty,
    },
  ];
}

function assertShipmentQuantityWithinPurchase(
  payload: CreateShipmentBatchPayload,
  normalizedItems: ShipmentBatchLineItem[],
  shippingCodeItems: ShippingCodeItem[],
  linkedPurchaseOrder?: { items?: Array<{ quantity?: number }> } | null,
  existingShipmentBatches: CreatedShipmentBatchRecord[] = [],
) {
  if (payload.shippedQty <= 0) {
    throw new BadRequestException('Shipped quantity must be greater than zero');
  }

  if (shippingCodeItems.length > 0) {
    const shippingCodeTotalQty = shippingCodeItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    );

    if (shippingCodeItems.some((item) => item.quantity <= 0)) {
      throw new BadRequestException('Shipping code quantity must be greater than zero');
    }

    if (shippingCodeTotalQty !== payload.shippedQty) {
      throw new BadRequestException(
        'Shipping code quantity total must equal shipped quantity',
      );
    }
  }

  const purchaseTotalQty =
    linkedPurchaseOrder?.items?.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    ) ||
    normalizedItems.reduce((sum, item) => sum + (Number(item.purchaseQty) || 0), 0);

  if (purchaseTotalQty > 0 && payload.shippedQty > purchaseTotalQty) {
    throw new BadRequestException(
      'Shipped quantity cannot exceed purchase quantity',
    );
  }

  const previousShippedQty = existingShipmentBatches.reduce(
    (sum, item) => sum + (Number(item.shippedQty) || 0),
    0,
  );

  if (
    existingShipmentBatches.length > 0 &&
    payload.accumulatedQty !== previousShippedQty + payload.shippedQty
  ) {
    throw new BadRequestException(
      'Accumulated quantity must equal previous shipped quantity plus shipped quantity',
    );
  }

  for (const item of normalizedItems) {
    if (item.shippedQty <= 0) {
      throw new BadRequestException(
        'Shipment line shipped quantity must be greater than zero',
      );
    }

    if (item.purchaseQty > 0 && item.shippedQty > item.purchaseQty) {
      throw new BadRequestException(
        'Shipment line shipped quantity cannot exceed purchase line quantity',
      );
    }

    const previousLineShippedQty = existingShipmentBatches.reduce(
      (sum, shipmentBatch) =>
        sum +
        shipmentBatch.items
          .filter((line) => line.purchaseLineNo === item.purchaseLineNo)
          .reduce((lineSum, line) => lineSum + (Number(line.shippedQty) || 0), 0),
      0,
    );

    if (
      item.purchaseQty > 0 &&
      previousLineShippedQty + item.shippedQty > item.purchaseQty
    ) {
      throw new BadRequestException(
        'Shipment line accumulated quantity cannot exceed purchase line quantity',
      );
    }
  }

  const lineShippedQty = normalizedItems.reduce(
    (sum, item) => sum + (Number(item.shippedQty) || 0),
    0,
  );

  if (lineShippedQty !== payload.shippedQty) {
    throw new BadRequestException(
      'Shipment line shipped quantity must equal shipped quantity',
    );
  }

  if (purchaseTotalQty > 0 && payload.accumulatedQty > purchaseTotalQty) {
    throw new BadRequestException(
      'Accumulated quantity cannot exceed purchase quantity',
    );
  }

  if (
    purchaseTotalQty > 0 &&
    payload.accumulatedQty + payload.remainingQty !== purchaseTotalQty
  ) {
    throw new BadRequestException(
      'Accumulated quantity plus remaining quantity must equal purchase quantity',
    );
  }
}

function toShipmentDocumentPayload(
  record: PrismaBusinessDocumentRecord,
): CreatedShipmentBatchRecord {
  return {
    ...record.payload,
    id: Number(record.payload.id ?? record.id),
    batchNo: record.docNo,
    status: record.status,
    arrivalStatus: resolveArrivalStatus(
      record.status,
      record.payload.arrivalStatus,
    ),
    receiptSendStatus: record.payload.receiptSendStatus ?? 'pending',
    stockOutStatus: record.payload.stockOutStatus ?? 'not_started',
    stockOutDocNo: record.payload.stockOutDocNo ?? null,
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

function toPartialShipmentStatus(status: string) {
  if (status === 'exception') {
    return 'partial_exception';
  }

  if (
    status === 'shipped' ||
    status === 'to_forwarder' ||
    status === 'forwarder_shipped' ||
    status === 'arrived'
  ) {
    return `partial_${status}`;
  }

  return status;
}

function resolveShipmentRecordFulfillmentStatus(record: {
  status: string;
  remainingQty: number;
}) {
  return record.remainingQty > 0
    ? toPartialShipmentStatus(record.status)
    : record.status;
}

function resolveShipmentAggregateStatus(records: CreatedShipmentBatchRecord[]) {
  if (records.length === 0) {
    return 'not_started';
  }

  if (records.some((record) => record.status === 'exception' || record.hasException)) {
    return records.every((record) => record.status === 'exception' || record.hasException)
      ? 'exception'
      : 'partial_exception';
  }

  const highest = records.reduce((current, record) => {
    const currentIndex = shipmentProgressOrder.indexOf(
      current as (typeof shipmentProgressOrder)[number],
    );
    const nextIndex = shipmentProgressOrder.indexOf(
      record.status as (typeof shipmentProgressOrder)[number],
    );

    return nextIndex > currentIndex ? record.status : current;
  }, records[0]?.status ?? 'shipped');
  const hasRemaining = records.every((record) => record.remainingQty > 0);
  const allSame = records.every((record) => record.status === highest);

  return hasRemaining || !allSame ? toPartialShipmentStatus(highest) : highest;
}

function resolveShipmentAggregateStatusWithLinkedPurchaseOrders(
  records: CreatedShipmentBatchRecord[],
  linkedPurchaseOrders: Array<{ id: number; status: string }>,
) {
  const shipmentAggregateStatus = resolveShipmentAggregateStatus(records);

  if (shipmentAggregateStatus === 'not_started' || linkedPurchaseOrders.length === 0) {
    return shipmentAggregateStatus;
  }

  const shippedPurchaseOrderIds = new Set(
    records.map((record) => record.purchaseOrderId),
  );
  const hasUnshippedPurchaseOrder = linkedPurchaseOrders.some(
    (record) => !shippedPurchaseOrderIds.has(record.id),
  );

  return hasUnshippedPurchaseOrder
    ? toPartialShipmentStatus(shipmentAggregateStatus)
    : shipmentAggregateStatus;
}

@Injectable()
export class ShipmentBatchService {
  private readonly store = resolveShipmentBatchStore();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
    @Optional()
    @Inject(SalesOrderService)
    private readonly salesOrderService?: Pick<
      SalesOrderService,
      'getDetail' | 'list' | 'syncOperationalAggregates'
    >,
    @Optional()
    @Inject(PurchaseOrderService)
    private readonly purchaseOrderService?: Pick<
      PurchaseOrderService,
      | 'getDetail'
      | 'list'
      | 'listActiveLinkedPurchaseOrders'
      | 'syncShipmentFulfillmentStatus'
    >,
    @Optional()
    @Inject(CounterpartyService)
    private readonly counterpartyService?: Pick<CounterpartyService, 'markSupplierCooperated'>,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  private get prismaDb() {
    return this.prisma as PrismaShipmentDb | undefined;
  }

  private async syncSourceSalesOrderShipmentStatus(payload: {
    salesOrderId: number;
    shipmentAggregateStatus?: string;
    receiptSendStatus?: string;
    operatorId: number;
  }) {
    await this.salesOrderService?.syncOperationalAggregates({
      salesOrderId: payload.salesOrderId,
      shipmentAggregateStatus: payload.shipmentAggregateStatus,
      receiptSendStatus: payload.receiptSendStatus,
      operatorId: payload.operatorId,
      source: 'shipment_batch',
    });
  }

  private async resolveSourceSalesOrderShipmentAggregateStatus(payload: {
    salesOrderId: number;
    salesOrderNo: string;
    currentPurchaseOrder?: {
      id: number;
      status: string;
    };
  }) {
    const records = this.shouldUsePrisma()
      ? (
          (await this.prismaDb!.businessDocument.findMany({
            where: { bizType: 'shipment_batch' },
          })) as PrismaBusinessDocumentRecord[]
        )
          .map(toShipmentDocumentPayload)
          .filter((record) => record.salesOrderId === payload.salesOrderId)
      : this.store
          .listShipmentBatches()
          .filter((record) => record.salesOrderId === payload.salesOrderId);

    const linkedPurchaseOrders =
      await this.purchaseOrderService
        ?.listActiveLinkedPurchaseOrders?.({
          salesOrderId: payload.salesOrderId,
          salesOrderNo: payload.salesOrderNo,
        })
        .catch(() => []);

    const effectiveLinkedPurchaseOrders = (linkedPurchaseOrders ?? []).map(
      (purchaseOrder) =>
        payload.currentPurchaseOrder &&
        purchaseOrder.id === payload.currentPurchaseOrder.id
          ? {
              ...purchaseOrder,
              status: payload.currentPurchaseOrder.status,
            }
          : purchaseOrder,
    );

    return resolveShipmentAggregateStatusWithLinkedPurchaseOrders(
      records,
      effectiveLinkedPurchaseOrders,
    );
  }

  private async resolvePurchaseOrderShipmentAggregateStatus(payload: {
    purchaseOrderId: number;
    currentRecord: CreatedShipmentBatchRecord;
  }) {
    const records = this.shouldUsePrisma()
      ? (
          (await this.prismaDb!.businessDocument.findMany({
            where: { bizType: 'shipment_batch' },
          })) as PrismaBusinessDocumentRecord[]
        )
          .map(toShipmentDocumentPayload)
          .filter((record) => record.purchaseOrderId === payload.purchaseOrderId)
      : this.store
          .listShipmentBatches()
          .filter((record) => record.purchaseOrderId === payload.purchaseOrderId);
    const hasCurrentRecord = records.some((record) => record.id === payload.currentRecord.id);
    const effectiveRecords = hasCurrentRecord ? records : [...records, payload.currentRecord];

    return resolveShipmentAggregateStatus(effectiveRecords);
  }

  private async syncPurchaseAndSalesShipmentStatus(payload: {
    record: CreatedShipmentBatchRecord;
    operatorId: number;
  }) {
    const purchaseOrderStatus =
      await this.resolvePurchaseOrderShipmentAggregateStatus({
        purchaseOrderId: payload.record.purchaseOrderId,
        currentRecord: payload.record,
      });
    await this.purchaseOrderService?.syncShipmentFulfillmentStatus({
      purchaseOrderId: payload.record.purchaseOrderId,
      status: purchaseOrderStatus,
      operatorId: payload.operatorId,
      source: 'shipment_batch',
    });
    if (this.salesOrderService) {
      await this.syncSourceSalesOrderShipmentStatus({
        salesOrderId: payload.record.salesOrderId,
        shipmentAggregateStatus:
          await this.resolveSourceSalesOrderShipmentAggregateStatus({
            salesOrderId: payload.record.salesOrderId,
            salesOrderNo: payload.record.salesOrderNo,
            currentPurchaseOrder: {
              id: payload.record.purchaseOrderId,
              status: purchaseOrderStatus,
            },
          }),
        operatorId: payload.operatorId,
      });
    }

    return purchaseOrderStatus;
  }

  private async resolvePurchaseOrderCurrentStatus(
    payload: CreateShipmentBatchPayload,
  ) {
    const detail = await this.purchaseOrderService
      ?.getDetail?.(payload.purchaseOrderId)
      .catch(() => null);

    return detail?.status ?? payload.purchaseOrderCurrentStatus;
  }

  private async filterVisibleShipmentBatches(
    items: ShipmentBatchListItem[],
    session?: FormalSession,
  ) {
    if (!session?.role) {
      return items;
    }

    if (
      session.role === 'admin' ||
      session.role === 'boss' ||
      session.role === 'sales_manager' ||
      session.role === 'purchase_manager'
    ) {
      return items;
    }

    if (session.role === 'sales' && this.salesOrderService?.list) {
      const visibleSalesOrders = (await this.salesOrderService
        .list({ page: 1, pageSize: 1000 }, session)
        .catch(() => ({ items: [] }))) as Pick<SalesOrderListResponse, 'items'>;
      const visibleSalesOrderNos = new Set(
        visibleSalesOrders.items.map((item) => item.docNo),
      );

      return items.filter((item) => visibleSalesOrderNos.has(item.salesOrderNo));
    }

    if (session.role === 'purchase' && this.purchaseOrderService?.list) {
      const visiblePurchaseOrders = (await this.purchaseOrderService
        .list({ page: 1, pageSize: 1000 }, session)
        .catch(() => ({ items: [] }))) as Pick<PurchaseOrderListResponse, 'items'>;
      const visiblePurchaseOrderNos = new Set(
        visiblePurchaseOrders.items.map((item) => item.docNo),
      );

      return items.filter((item) =>
        visiblePurchaseOrderNos.has(item.purchaseOrderNo),
      );
    }

    return items;
  }

  private async canSeeShipmentBatch(
    item: ShipmentBatchListItem,
    session?: FormalSession,
  ) {
    const visibleItems = await this.filterVisibleShipmentBatches([item], session);
    return visibleItems.length > 0;
  }

  async list(
    query: ShipmentBatchListQuery,
    session?: FormalSession,
  ): Promise<ShipmentBatchListResponse> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const sortBy =
      query.sortBy === 'docNo' || query.sortBy === 'supplierName'
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const keyword = query.keyword?.trim().toLowerCase();
    const supplierName = query.supplierName?.trim().toLowerCase();
    const salesOrderNo = query.salesOrderNo?.trim().toLowerCase();
    const purchaseOrderNo = query.purchaseOrderNo?.trim().toLowerCase();
    const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
    const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;
    const hasException = normalizeTriStateFilter(query.hasException);

    const allItems = this.shouldUsePrisma()
      ? (
          (await this.prismaDb!.businessDocument.findMany({
            where: { bizType: 'shipment_batch' },
            orderBy: { createdAt: 'desc' },
          })) as PrismaBusinessDocumentRecord[]
        ).map(toShipmentDocumentPayload).map(toCreatedShipmentBatchListItem)
      : [
          ...this.store.listShipmentBatches().map(toCreatedShipmentBatchListItem),
          ...shipmentBatchListData,
        ];

    const visibleItems = await this.filterVisibleShipmentBatches(allItems, session);

    const filtered = visibleItems.filter((item) => {
      if (
        keyword &&
        ![
          item.docNo,
          item.title,
          item.supplierName,
          item.salesOrderNo,
          item.purchaseOrderNo,
          item.shippingCode,
          item.customerName,
          item.goodsName,
          item.purchasingUnit,
          item.freightStation,
          item.destination,
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

      if (supplierName && !item.supplierName.toLowerCase().includes(supplierName)) {
        return false;
      }

      if (salesOrderNo && !item.salesOrderNo.toLowerCase().includes(salesOrderNo)) {
        return false;
      }

      if (
        purchaseOrderNo &&
        !item.purchaseOrderNo.toLowerCase().includes(purchaseOrderNo)
      ) {
        return false;
      }

      if (
        query.receiptSendStatus &&
        item.receiptSendStatus !== query.receiptSendStatus
      ) {
        return false;
      }

      if (hasException !== 'all') {
        const expected = hasException === 'yes';
        if (item.hasException !== expected) {
          return false;
        }
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
        sortBy === 'supplierName' ? left.supplierName : left[sortBy];
      const rightValue =
        sortBy === 'supplierName' ? right.supplierName : right[sortBy];

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
        supplierName: query.supplierName ?? null,
        salesOrderNo: query.salesOrderNo ?? null,
        purchaseOrderNo: query.purchaseOrderNo ?? null,
        receiptSendStatus: query.receiptSendStatus ?? null,
        hasException,
      },
    };
  }

  async create(payload: CreateShipmentBatchPayload) {
    const purchaseOrderCurrentStatus =
      await this.resolvePurchaseOrderCurrentStatus(payload);
    const linkedPurchaseOrder = await this.purchaseOrderService
      ?.getDetail?.(payload.purchaseOrderId)
      .catch(() => null);
    const salesOrderNo =
      linkedPurchaseOrder?.salesOrderNo ??
      `S20260708${String(payload.salesOrderId).padStart(4, '0')}`;
    const purchaseOrderNo =
      linkedPurchaseOrder?.purchaseNo ??
      `P20260711${String(payload.purchaseOrderId).padStart(4, '0')}`;
    const supplierName =
      linkedPurchaseOrder?.supplierName ?? resolveSupplierName(payload.purchaseOrderId);
    const linkedSalesOrder = await this.salesOrderService
      ?.getDetail?.(payload.salesOrderId)
      .catch(() => null);
    const normalizedItems = normalizeShipmentBatchItems(payload);
    const existingPurchaseShipmentBatches = this.shouldUsePrisma()
      ? (
          (await this.prismaDb!.businessDocument.findMany({
            where: { bizType: 'shipment_batch' },
          })) as PrismaBusinessDocumentRecord[]
        )
          .map(toShipmentDocumentPayload)
          .filter((record) => record.purchaseOrderId === payload.purchaseOrderId)
      : this.store
          .listShipmentBatches()
          .filter((record) => record.purchaseOrderId === payload.purchaseOrderId);
    const normalizedShippingCodeItems = normalizeShippingCodeItems(
      payload.shippingCodeItems,
    );
    const goodsName =
      normalizeOptionalText(payload.goodsName) ??
      normalizeOptionalText(
        normalizedItems.map((item) => item.productName).filter(Boolean).join('、'),
      );
    const totalPackages =
      normalizeOptionalNumber(payload.totalPackages) ??
      normalizeOptionalNumber(
        linkedPurchaseOrder?.items?.reduce(
          (sum: number, item: { packageQuantity?: number }) =>
            sum + (Number(item.packageQuantity) || 0),
          0,
        ),
      );
    const shipmentLedgerFields = {
      factoryShipDate:
        normalizeOptionalText(payload.factoryShipDate) ??
        normalizeOptionalText(payload.shippedAt.split('T')[0]),
      shippingCode:
        normalizedShippingCodeItems.length > 0
          ? formatShippingCodeItems(normalizedShippingCodeItems)
          : normalizeShippingCode(payload.shippingCode),
      shippingCodeItems:
        normalizedShippingCodeItems.length > 0
          ? normalizedShippingCodeItems
          : undefined,
      destination:
        normalizeOptionalText(payload.destination) ??
        normalizeOptionalText(linkedPurchaseOrder?.shipTo),
      shippingMark: normalizeOptionalText(payload.shippingMark),
      goodsName,
      totalPackages,
      purchasingUnit:
        normalizeOptionalText(payload.purchasingUnit) ??
        normalizeOptionalText(supplierName),
      customerName:
        normalizeOptionalText(payload.customerName) ??
        normalizeOptionalText(linkedSalesOrder?.customerName),
      freightStation: normalizeOptionalText(payload.freightStation),
      warehouseEntryNo: normalizeOptionalText(payload.warehouseEntryNo),
      arrivalStatus: normalizeOptionalText(payload.arrivalStatus) ?? '已发',
      forwarderShipDate: normalizeOptionalText(payload.forwarderShipDate),
      estimatedArrivalDate:
        normalizeOptionalText(payload.estimatedArrivalDate) ??
        normalizeOptionalText(linkedPurchaseOrder?.factoryEstimatedDeliveryDate),
      remark: normalizeOptionalText(payload.remark),
    };

    const canCreateShipmentForPurchaseStatus = [
      'purchasing',
      'partial_shipped',
      'partial_to_forwarder',
      'partial_forwarder_shipped',
      'partial_arrived',
    ].includes(purchaseOrderCurrentStatus);

    if (!canCreateShipmentForPurchaseStatus) {
      throw new BadRequestException(
        'Only purchasing purchase orders can create shipment batches',
      );
    }

    if (payload.accumulatedQty < payload.shippedQty) {
      throw new BadRequestException(
        'Accumulated quantity cannot be less than shipped quantity',
      );
    }

    if (payload.remainingQty < 0) {
      throw new BadRequestException('Remaining quantity cannot be negative');
    }

    assertShipmentQuantityWithinPurchase(
      payload,
      normalizedItems,
      normalizedShippingCodeItems,
      linkedPurchaseOrder,
      existingPurchaseShipmentBatches,
    );

    if (!shipmentLedgerFields.shippingCode) {
      throw new BadRequestException('Shipping code is required for shipped batches');
    }

    if (this.shouldUsePrisma()) {
      const basePayload: CreatedShipmentBatchRecord = {
        id: 0,
        batchNo: 'PENDING-SHIPMENT',
        status: 'shipped',
        receiptSendStatus: 'pending',
        shippedQty: payload.shippedQty,
        accumulatedQty: payload.accumulatedQty,
        remainingQty: payload.remainingQty,
        shippedAt: payload.shippedAt,
        ...shipmentLedgerFields,
        createdBy: payload.createdBy,
        salesOrderId: payload.salesOrderId,
        purchaseOrderId: payload.purchaseOrderId,
        purchaseOrderCurrentStatus: payload.purchaseOrderCurrentStatus,
        currentBatchCount: payload.currentBatchCount,
        salesOrderLocked: payload.currentBatchCount === 0,
        supplierName,
        salesOrderNo,
        purchaseOrderNo,
        title: `${supplierName} 首批发货`,
        createdAt: payload.shippedAt,
        hasException: false,
        items: normalizedItems,
      };
      const created = (await this.prismaDb!.businessDocument.create({
        data: {
          bizType: 'shipment_batch',
          docNo: `PENDING-SHIPMENT-${Date.now()}`,
          status: 'shipped',
          ownerUserId: BigInt(payload.createdBy),
          counterpartyId: BigInt(payload.purchaseOrderId),
          payload: basePayload,
          createdBy: BigInt(payload.createdBy),
        },
      })) as PrismaBusinessDocumentRecord;
      const finalPayload: CreatedShipmentBatchRecord = {
        ...basePayload,
        id: Number(created.id),
        batchNo: buildSequentialDocumentCode('SH', Number(created.id)),
      };
      const updated = (await this.prismaDb!.businessDocument.update({
        where: { id: created.id },
        data: {
          docNo: finalPayload.batchNo,
          payload: finalPayload,
        },
      })) as PrismaBusinessDocumentRecord;
      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'shipment_batch',
          bizId: updated.id,
          operationType: 'create_shipment_batch',
          operatorId: BigInt(payload.createdBy),
          beforeData: undefined,
          afterData: finalPayload,
        },
      });
      const purchaseOrderStatus = await this.syncPurchaseAndSalesShipmentStatus({
        record: finalPayload,
        operatorId: finalPayload.createdBy,
      });
      if (linkedPurchaseOrder) {
        await this.counterpartyService?.markSupplierCooperated({ supplierId: linkedPurchaseOrder.supplierId, supplierName, ownerName: linkedPurchaseOrder.ownerName, shipmentId: finalPayload.id });
      }

      return {
        id: finalPayload.id,
        batchNo: finalPayload.batchNo,
        status: finalPayload.status,
        shippedQty: finalPayload.shippedQty,
        accumulatedQty: finalPayload.accumulatedQty,
        remainingQty: finalPayload.remainingQty,
        shippedAt: finalPayload.shippedAt,
        purchaseOrderStatus,
        salesOrderLocked: finalPayload.salesOrderLocked,
        createdBy: finalPayload.createdBy,
        salesOrderId: finalPayload.salesOrderId,
        items: finalPayload.items,
      };
    }

    const id = this.store.nextShipmentBatchId();
    const created: CreatedShipmentBatchRecord = {
      id,
      batchNo: buildSequentialDocumentCode('SH', id),
      status: 'shipped',
      receiptSendStatus: 'pending',
      shippedQty: payload.shippedQty,
      accumulatedQty: payload.accumulatedQty,
      remainingQty: payload.remainingQty,
      shippedAt: payload.shippedAt,
      ...shipmentLedgerFields,
      createdBy: payload.createdBy,
      salesOrderId: payload.salesOrderId,
      purchaseOrderId: payload.purchaseOrderId,
      purchaseOrderCurrentStatus: payload.purchaseOrderCurrentStatus,
      currentBatchCount: payload.currentBatchCount,
      salesOrderLocked: payload.currentBatchCount === 0,
      supplierName,
      salesOrderNo,
      purchaseOrderNo,
      title: `${supplierName} 首批发货`,
      createdAt: payload.shippedAt,
      hasException: false,
      items: normalizedItems,
    };

    this.store.upsertShipmentBatch(created);
    this.store.recordAuditLog({
      bizType: 'shipment_batch',
      bizId: created.id,
      operationType: 'create_shipment_batch',
      operatorId: payload.createdBy,
      beforeData: null,
      afterData: created,
    });
    const purchaseOrderStatus = await this.syncPurchaseAndSalesShipmentStatus({
      record: created,
      operatorId: created.createdBy,
    });
    if (linkedPurchaseOrder) {
      await this.counterpartyService?.markSupplierCooperated({ supplierId: linkedPurchaseOrder.supplierId, supplierName, ownerName: linkedPurchaseOrder.ownerName, shipmentId: created.id });
    }

    return {
      id: created.id,
      batchNo: created.batchNo,
      status: created.status,
      shippedQty: created.shippedQty,
      accumulatedQty: created.accumulatedQty,
      remainingQty: created.remainingQty,
      shippedAt: created.shippedAt,
      shippingCode: created.shippingCode,
      shippingCodeItems: created.shippingCodeItems?.map((entry) => ({ ...entry })),
      purchaseOrderStatus,
      salesOrderLocked: created.salesOrderLocked,
      createdBy: created.createdBy,
      salesOrderId: created.salesOrderId,
      items: created.items,
    };
  }

  async listAuditLogs() {
    if (this.shouldUsePrisma()) {
      const logs = (await this.prismaDb!.operationLog.findMany({
        where: { bizType: 'shipment_batch' },
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

      if (created && created.bizType === 'shipment_batch') {
        const detail = toShipmentDocumentPayload(created);
        if (
          !(await this.canSeeShipmentBatch(
            toCreatedShipmentBatchListItem(detail),
            session,
          ))
        ) {
          throw new NotFoundException('发货批次不存在');
        }

        return {
          id: detail.id,
          batchNo: detail.batchNo,
          status: detail.status,
          receiptSendStatus: detail.receiptSendStatus,
          stockOutStatus: detail.stockOutStatus ?? 'not_started',
          stockOutDocNo: detail.stockOutDocNo ?? null,
          factoryShipDate: detail.factoryShipDate,
          shippingCode: detail.shippingCode,
          shippingCodeItems: detail.shippingCodeItems?.map((entry) => ({ ...entry })),
          destination: detail.destination,
          shippingMark: detail.shippingMark,
          goodsName: detail.goodsName,
          totalPackages: detail.totalPackages,
          purchasingUnit: detail.purchasingUnit,
          customerName: detail.customerName,
          freightStation: detail.freightStation,
          warehouseEntryNo: detail.warehouseEntryNo,
          arrivalStatus: detail.arrivalStatus,
          forwarderShipDate: detail.forwarderShipDate,
          estimatedArrivalDate: detail.estimatedArrivalDate,
          remark: detail.remark,
          salesOrderId: detail.salesOrderId,
          purchaseOrderId: detail.purchaseOrderId,
          receiptDocUrl: detail.receiptDocUrl,
          receiptSentBy: detail.receiptSentBy,
          hasException: detail.hasException,
          exceptionReason: detail.exceptionReason,
          items: detail.items,
        };
      }
    }

    const created = this.store.getShipmentBatch(id);

    if (created) {
      if (
        !(await this.canSeeShipmentBatch(
          toCreatedShipmentBatchListItem(created),
          session,
        ))
      ) {
        throw new NotFoundException('发货批次不存在');
      }

      return {
        id: created.id,
        batchNo: created.batchNo,
        status: created.status,
        receiptSendStatus: created.receiptSendStatus,
        stockOutStatus: created.stockOutStatus ?? 'not_started',
        stockOutDocNo: created.stockOutDocNo ?? null,
        factoryShipDate: created.factoryShipDate,
        shippingCode: created.shippingCode,
        shippingCodeItems: created.shippingCodeItems?.map((entry) => ({ ...entry })),
        destination: created.destination,
        shippingMark: created.shippingMark,
        goodsName: created.goodsName,
        totalPackages: created.totalPackages,
        purchasingUnit: created.purchasingUnit,
        customerName: created.customerName,
        freightStation: created.freightStation,
        warehouseEntryNo: created.warehouseEntryNo,
        arrivalStatus: resolveArrivalStatus(created.status, created.arrivalStatus),
        forwarderShipDate: created.forwarderShipDate,
        estimatedArrivalDate: created.estimatedArrivalDate,
        remark: created.remark,
        salesOrderId: created.salesOrderId,
        purchaseOrderId: created.purchaseOrderId,
        receiptDocUrl: created.receiptDocUrl,
        receiptSentBy: created.receiptSentBy,
        hasException: created.hasException,
        exceptionReason: created.exceptionReason,
        items: created.items,
      };
    }

    const fallback = {
      id,
      batchNo: 'SH202607080001',
      status: 'shipped',
      receiptSendStatus: 'pending',
      stockOutStatus: 'not_started',
      stockOutDocNo: null,
      factoryShipDate: '2026-07-08',
      shippingCode: 'SHIP-ACME-001',
      destination: 'SH Boninoe',
      shippingMark: 'ACME-02',
      goodsName: '智能 LED 灯带',
      totalPackages: 20,
      purchasingUnit: 'Acme Supply',
      customerName: 'Acme Trading',
      freightStation: '上海货运站',
      warehouseEntryNo: 'WH-IN-001',
      arrivalStatus: '已发',
      forwarderShipDate: '2026-07-12',
      estimatedArrivalDate: '2026-08-08',
      remark: '示例发货批次',
      salesOrderId: 88,
      purchaseOrderId: 21,
      receiptDocUrl: 'https://files.example.com/receipt-001.pdf',
      receiptSentBy: 2002,
      hasException: false,
      exceptionReason: undefined,
      items: [
        {
          lineNo: 1,
          purchaseLineNo: 1,
          sourceSalesItemId: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          shippedQty: 40,
          purchaseQty: 500,
        },
      ],
    };

    const fallbackListItem = toCreatedShipmentBatchListItem({
      id,
      batchNo: 'SH202607080001',
      status: 'shipped',
      receiptSendStatus: 'pending',
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-11T12:00:00.000Z',
      factoryShipDate: '2026-07-08',
      shippingCode: 'SHIP-ACME-001',
      destination: 'SH Boninoe',
      shippingMark: 'ACME-02',
      goodsName: '智能 LED 灯带',
      totalPackages: 20,
      purchasingUnit: 'Acme Supply',
      customerName: 'Acme Trading',
      freightStation: '上海货运站',
      warehouseEntryNo: 'WH-IN-001',
      arrivalStatus: '已发',
      forwarderShipDate: '2026-07-12',
      estimatedArrivalDate: '2026-08-08',
      remark: '示例发货批次',
      createdBy: 2001,
      salesOrderId: 88,
      purchaseOrderId: 21,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 1,
      salesOrderLocked: true,
      supplierName: 'Acme Supply',
      salesOrderNo: 'S202607080001',
      purchaseOrderNo: 'P202607080001',
      title: 'Acme Supply 首批发货',
      createdAt: '2026-07-11T12:00:00.000Z',
      hasException: false,
      items: [],
    });

    if (!(await this.canSeeShipmentBatch(fallbackListItem, session))) {
      throw new NotFoundException('发货批次不存在');
    }

    return fallback;
  }

  async markToForwarder(payload: {
    shipmentBatchId: number;
    currentStatus: string;
    operatorId?: number;
  }) {
    if (payload.currentStatus !== 'shipped') {
      throw new BadRequestException('Only shipped batches can be moved to forwarder');
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateShipmentBatchStatus({
        shipmentBatchId: payload.shipmentBatchId,
        expectedStatus: 'shipped',
        status: 'to_forwarder',
        operationType: 'mark_shipment_to_forwarder',
        operatorId: payload.operatorId,
      });
      const operatorId = payload.operatorId ?? updated?.createdBy;
      if (updated && operatorId !== undefined) {
        await this.syncPurchaseAndSalesShipmentStatus({
          record: updated,
          operatorId,
        });
      }

      return {
        id: payload.shipmentBatchId,
        status: 'to_forwarder',
      };
    }

    const created = this.store.getShipmentBatch(payload.shipmentBatchId);
    this.assertShipmentStatus(created, 'shipped');
    if (created) {
      const operatorId = payload.operatorId ?? created.createdBy;
      const beforeData = snapshotAuditData(created);
      created.status = 'to_forwarder';
      this.store.upsertShipmentBatch(created);
      this.store.recordAuditLog({
        bizType: 'shipment_batch',
        bizId: created.id,
        operationType: 'mark_shipment_to_forwarder',
        operatorId,
        beforeData,
        afterData: created,
      });
      await this.syncPurchaseAndSalesShipmentStatus({
        record: created,
        operatorId,
      });
    }

    return {
      id: payload.shipmentBatchId,
      status: 'to_forwarder',
    };
  }

  async markForwarderShipped(payload: {
    shipmentBatchId: number;
    currentStatus: string;
    operatorId?: number;
  }) {
    if (payload.currentStatus !== 'to_forwarder') {
      throw new BadRequestException(
        'Only to-forwarder batches can be marked forwarder shipped',
      );
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateShipmentBatchStatus({
        shipmentBatchId: payload.shipmentBatchId,
        expectedStatus: 'to_forwarder',
        status: 'forwarder_shipped',
        operationType: 'mark_shipment_forwarder_shipped',
        operatorId: payload.operatorId,
      });
      const operatorId = payload.operatorId ?? updated?.createdBy;
      if (updated && operatorId !== undefined) {
        await this.syncPurchaseAndSalesShipmentStatus({
          record: updated,
          operatorId,
        });
      }

      return {
        id: payload.shipmentBatchId,
        status: 'forwarder_shipped',
      };
    }

    const created = this.store.getShipmentBatch(payload.shipmentBatchId);
    this.assertShipmentStatus(created, 'to_forwarder');
    if (created) {
      const operatorId = payload.operatorId ?? created.createdBy;
      const beforeData = snapshotAuditData(created);
      created.status = 'forwarder_shipped';
      this.store.upsertShipmentBatch(created);
      this.store.recordAuditLog({
        bizType: 'shipment_batch',
        bizId: created.id,
        operationType: 'mark_shipment_forwarder_shipped',
        operatorId,
        beforeData,
        afterData: created,
      });
      await this.syncPurchaseAndSalesShipmentStatus({
        record: created,
        operatorId,
      });
    }

    return {
      id: payload.shipmentBatchId,
      status: 'forwarder_shipped',
    };
  }

  async markArrived(payload: {
    shipmentBatchId: number;
    currentStatus: string;
    operatorId?: number;
  }) {
    if (payload.currentStatus !== 'forwarder_shipped') {
      throw new BadRequestException(
        'Only forwarder-shipped batches can be marked arrived',
      );
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateShipmentBatchStatus({
        shipmentBatchId: payload.shipmentBatchId,
        expectedStatus: 'forwarder_shipped',
        status: 'arrived',
        operationType: 'mark_shipment_arrived',
        operatorId: payload.operatorId,
        mutate: (record) => ({
          ...record,
          arrivalStatus: '已到货',
        }),
      });
      const operatorId = payload.operatorId ?? updated?.createdBy;
      if (updated && operatorId !== undefined) {
        await this.syncPurchaseAndSalesShipmentStatus({
          record: updated,
          operatorId,
        });
      }

      return {
        id: payload.shipmentBatchId,
        status: 'arrived',
      };
    }

    const created = this.store.getShipmentBatch(payload.shipmentBatchId);
    this.assertShipmentStatus(created, 'forwarder_shipped');
    if (created) {
      const operatorId = payload.operatorId ?? created.createdBy;
      const beforeData = snapshotAuditData(created);
      created.status = 'arrived';
      created.arrivalStatus = '已到货';
      this.store.upsertShipmentBatch(created);
      this.store.recordAuditLog({
        bizType: 'shipment_batch',
        bizId: created.id,
        operationType: 'mark_shipment_arrived',
        operatorId,
        beforeData,
        afterData: created,
      });
      await this.syncPurchaseAndSalesShipmentStatus({
        record: created,
        operatorId,
      });
    }

    return {
      id: payload.shipmentBatchId,
      status: 'arrived',
    };
  }

  async markException(payload: {
    shipmentBatchId: number;
    currentStatus: string;
    reason: string;
    operatorId?: number;
  }) {
    if (payload.currentStatus === 'arrived' || payload.currentStatus === 'exception') {
      throw new BadRequestException('Arrived batches cannot be marked exception');
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateShipmentBatchStatus({
        shipmentBatchId: payload.shipmentBatchId,
        expectedStatus: payload.currentStatus,
        status: 'exception',
        operationType: 'mark_shipment_exception',
        operatorId: payload.operatorId,
        mutate: (record) => ({
          ...record,
          hasException: true,
          exceptionReason: payload.reason,
        }),
      });
      const operatorId = payload.operatorId ?? updated?.createdBy;
      if (updated && operatorId !== undefined) {
        await this.syncPurchaseAndSalesShipmentStatus({
          record: updated,
          operatorId,
        });
      }

      return {
        id: payload.shipmentBatchId,
        status: 'exception',
        reason: payload.reason,
      };
    }

    const created = this.store.getShipmentBatch(payload.shipmentBatchId);
    this.assertShipmentStatus(created, payload.currentStatus);
    if (created) {
      const operatorId = payload.operatorId ?? created.createdBy;
      const beforeData = snapshotAuditData(created);
      created.status = 'exception';
      created.hasException = true;
      created.exceptionReason = payload.reason;
      this.store.upsertShipmentBatch(created);
      this.store.recordAuditLog({
        bizType: 'shipment_batch',
        bizId: created.id,
        operationType: 'mark_shipment_exception',
        operatorId,
        beforeData,
        afterData: created,
      });
      await this.syncPurchaseAndSalesShipmentStatus({
        record: created,
        operatorId,
      });
    }

    return {
      id: payload.shipmentBatchId,
      status: 'exception',
      reason: payload.reason,
    };
  }

  async uploadReceipt(payload: {
    shipmentBatchId: number;
    receiptDocUrl: string;
    operatorId?: number;
  }) {
    if (!payload.receiptDocUrl) {
      throw new BadRequestException('Receipt document url is required');
    }

    if (this.shouldUsePrisma()) {
      await this.updateShipmentBatchStatus({
        shipmentBatchId: payload.shipmentBatchId,
        operationType: 'upload_shipment_receipt',
        operatorId: payload.operatorId,
        mutate: (record) => ({
          ...record,
          receiptSendStatus: 'pending',
          receiptDocUrl: payload.receiptDocUrl,
        }),
      });

      return {
        id: payload.shipmentBatchId,
        receiptDocUrl: payload.receiptDocUrl,
        receiptSendStatus: 'pending',
      };
    }

    const created = this.store.getShipmentBatch(payload.shipmentBatchId);
    if (created) {
      const operatorId = payload.operatorId ?? created.createdBy;
      const beforeData = snapshotAuditData(created);
      created.receiptSendStatus = 'pending';
      created.receiptDocUrl = payload.receiptDocUrl;
      this.store.upsertShipmentBatch(created);
      this.store.recordAuditLog({
        bizType: 'shipment_batch',
        bizId: created.id,
        operationType: 'upload_shipment_receipt',
        operatorId,
        beforeData,
        afterData: created,
      });
    }

    return {
      id: payload.shipmentBatchId,
      receiptDocUrl: payload.receiptDocUrl,
      receiptSendStatus: 'pending',
    };
  }

  async sendReceipt(payload: {
    shipmentBatchId: number;
    receiptDocUrl: string | null;
    sentBy: number;
    operatorId?: number;
  }) {
    if (!payload.receiptDocUrl) {
      throw new BadRequestException('Receipt document is required before sending');
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updateShipmentBatchStatus({
        shipmentBatchId: payload.shipmentBatchId,
        requireUnsentReceipt: true,
        operationType: 'send_shipment_receipt',
        operatorId: payload.operatorId ?? payload.sentBy,
        mutate: (record) => ({
          ...record,
          receiptSendStatus: 'sent',
          receiptDocUrl: payload.receiptDocUrl ?? undefined,
          receiptSentBy: payload.sentBy,
        }),
      });
      if (updated) {
        await this.syncSourceSalesOrderShipmentStatus({
          salesOrderId: updated.salesOrderId,
          receiptSendStatus: 'sent',
          operatorId: payload.operatorId ?? payload.sentBy,
        });
      }

      return {
        id: payload.shipmentBatchId,
        receiptSendStatus: 'sent',
        receiptSentBy: payload.sentBy,
      };
    }

    const created = this.store.getShipmentBatch(payload.shipmentBatchId);
    if (created?.receiptSendStatus === 'sent') {
      throw new BadRequestException('Receipt has already been sent');
    }
    if (created) {
      const operatorId = payload.operatorId ?? payload.sentBy;
      const beforeData = snapshotAuditData(created);
      created.receiptSendStatus = 'sent';
      created.receiptDocUrl = payload.receiptDocUrl;
      created.receiptSentBy = payload.sentBy;
      this.store.upsertShipmentBatch(created);
      this.store.recordAuditLog({
        bizType: 'shipment_batch',
        bizId: created.id,
        operationType: 'send_shipment_receipt',
        operatorId,
        beforeData,
        afterData: created,
      });
      await this.syncSourceSalesOrderShipmentStatus({
        salesOrderId: created.salesOrderId,
        receiptSendStatus: 'sent',
        operatorId: payload.operatorId ?? payload.sentBy,
      });
    }

    return {
      id: payload.shipmentBatchId,
      receiptSendStatus: 'sent',
      receiptSentBy: payload.sentBy,
    };
  }

  private async updateShipmentBatchStatus(payload: {
    shipmentBatchId: number;
    expectedStatus?: string;
    requireUnsentReceipt?: boolean;
    status?: string;
    operationType: string;
    operatorId?: number;
    mutate?: (record: CreatedShipmentBatchRecord) => Partial<CreatedShipmentBatchRecord>;
  }) {
    const existing = (await this.prismaDb!.businessDocument.findUnique({
      where: { id: BigInt(payload.shipmentBatchId) },
    })) as PrismaBusinessDocumentRecord | null;

    if (!existing || existing.bizType !== 'shipment_batch') {
      return undefined;
    }

    const beforeData = toShipmentDocumentPayload(existing);
    if (payload.requireUnsentReceipt && beforeData.receiptSendStatus === 'sent') {
      throw new BadRequestException('Receipt has already been sent');
    }
    if (payload.expectedStatus) {
      this.assertShipmentStatus(beforeData, payload.expectedStatus);
    }
    const baseNext = {
      ...beforeData,
      status: payload.status ?? beforeData.status,
    };
    const nextPayload = {
      ...baseNext,
      ...(payload.mutate ? payload.mutate(baseNext) : {}),
    } as CreatedShipmentBatchRecord;
    const updated = (await this.prismaDb!.businessDocument.update({
      where: { id: existing.id, ...(payload.expectedStatus ? { status: payload.expectedStatus } : {}) },
      data: {
        status: nextPayload.status,
        payload: nextPayload,
      },
    })) as PrismaBusinessDocumentRecord;

    await this.prismaDb!.operationLog.create({
      data: {
        bizType: 'shipment_batch',
        bizId: updated.id,
        operationType: payload.operationType,
        operatorId:
          payload.operatorId !== undefined
            ? BigInt(payload.operatorId)
            : existing.createdBy ?? 0n,
        beforeData,
        afterData: nextPayload,
      },
    });

    return nextPayload;
  }

  private assertShipmentStatus(
    record: CreatedShipmentBatchRecord | undefined,
    expectedStatus: string,
  ) {
    if (!record) throw new NotFoundException('Shipment batch not found');
    if (record.status !== expectedStatus) {
      throw new BadRequestException('Shipment batch status has changed; refresh before retrying');
    }
  }
}
