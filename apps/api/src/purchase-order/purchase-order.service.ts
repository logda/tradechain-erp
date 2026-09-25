import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  PurchaseOrderListItem,
  PurchaseOrderListQuery,
  PurchaseOrderListResponse,
} from '@erp/shared';
import {
  type FormalSession,
  isFormalAdminOrBoss,
} from '../auth/formal-session';
import { purchaseOrderListData } from './purchase-order-list.data';
import { resolvePurchaseOrderStore } from './purchase-order.store';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { ProductService } from '../product/product.service';
import {
  UserManagementService,
  type AssignablePurchaseUserItem,
} from '../user-management/user-management.service';

export type PurchaseOrderItem = {
  salesItemId: number;
  supplierId: number;
  supplierName?: string;
  purchaseOwnerName?: string;
  productId: number;
  sku?: string;
  internalCode?: string;
  productName?: string;
  unit?: string;
  quantity: number;
  packageQuantity?: number;
  unitsPerPackage?: number;
  unitPrice?: number;
  imageUrls?: string[];
  factoryEstimatedDeliveryDate?: string;
  shipTo?: string;
  domesticFreight?: number;
};

export type CreateFromSalesOrderPayload = {
  salesOrderId: number;
  items: PurchaseOrderItem[];
  createdBy: number;
  initialStatus?: string;
  salesOrderNo?: string;
  customerOrderNo?: string;
  storeName?: string;
  orderDate?: string;
  factoryEstimatedDeliveryDate?: string;
  shipTo?: string;
  purchaseOrderAttachments?: PurchaseOrderAttachmentInfo[];
  ownerName?: string;
  session?: FormalSession;
  allowPendingAssignment?: boolean;
};

export type PurchaseOrderLineItem = {
  lineNo: number;
  sourceSalesItemId: number;
  supplierId: number;
  productId: number;
  productStatus?: 'active' | 'inactive' | 'deleted';
  sku: string;
  internalCode?: string;
  productName: string;
  unit: string;
  quantity: number;
  packageQuantity?: number;
  unitsPerPackage?: number;
  unitPrice: number;
  amount: number;
  imageUrls?: string[];
  factoryEstimatedDeliveryDate?: string;
  shipTo?: string;
  domesticFreight?: number;
};

export type PurchaseOrderAttachmentInfo = {
  key?: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

export type PurchaseOrderVersionHistoryEntry = {
  versionNo: number;
  status: string;
  createdAt: string;
  changeReason?: string;
};

export type CreatedPurchaseOrderRecord = {
  id: number;
  purchaseNo: string;
  title?: string;
  sourceSalesOrderId: number;
  supplierId: number;
  supplierName: string;
  ownerName: string;
  lockedPurchaseOwner?: boolean;
  sourceInquiryId?: number;
  currentVersionNo: number;
  status: string;
  itemCount: number;
  createdBy: number;
  createdAt: string;
  salesOrderNo: string;
  customerOrderNo?: string;
  storeName?: string;
  orderDate?: string;
  factoryEstimatedDeliveryDate?: string;
  shipTo?: string;
  domesticFreight?: number;
  purchaseOrderAttachments?: PurchaseOrderAttachmentInfo[];
  currentBatchCount: number;
  cancelReason?: string;
  stockInStatus?: string;
  stockInDocNo?: string | null;
  versionHistory: PurchaseOrderVersionHistoryEntry[];
  items: PurchaseOrderLineItem[];
};

export type PurchaseOrderTransitionPayload = {
  purchaseOrderId: number;
  currentStatus: string;
  session?: FormalSession;
};

type SubmitPurchaseOrderPayload = PurchaseOrderTransitionPayload & { title?: string };

export type PurchaseOrderRecord = CreatedPurchaseOrderRecord;

type PrismaBusinessDocumentRecord = {
  id: bigint;
  bizType: string;
  docNo: string;
  status: string;
  ownerUserId: bigint | null;
  counterpartyId: bigint | null;
  payload: CreatedPurchaseOrderRecord;
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

type PrismaPurchaseDb = PrismaService & {
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

type ResubmitPurchaseOrderPayload = PurchaseOrderTransitionPayload & {
  hasShipmentBatches: boolean;
  sourceSalesOrderId: number;
  supplierId: number;
  changeReason: string;
};

type CancelPurchaseOrderPayload = PurchaseOrderTransitionPayload & {
  hasShipmentBatches: boolean;
  cancelReason: string;
};

type SyncPurchaseShipmentStatusPayload = {
  purchaseOrderId: number;
  status: string;
  operatorId: number;
  source?: string;
};

type SavePurchaseOrderDraftPayload = PurchaseOrderTransitionPayload & {
  ownerName?: string;
  supplierId?: number;
  supplierName?: string;
  itemPricePatches?: Array<{
    lineNo: number;
    unitPrice: number;
  }>;
  session?: FormalSession;
};

const purchaseAggregateProgressOrder = [
  'draft',
  'pending_purchase_claim',
  'pending_purchase_manager_approval',
  'purchasing',
  'partial_shipped',
  'shipped',
  'partial_to_forwarder',
  'to_forwarder',
  'partial_forwarder_shipped',
  'forwarder_shipped',
  'partial_arrived',
  'arrived',
  'partial_exception',
  'exception',
] as const;

function normalizeTriStateFilter(value: 'all' | 'yes' | 'no' | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

function resolveSupplierName(supplierId: number) {
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    return '待补供应商';
  }

  if (supplierId === 1 || supplierId === 3001) {
    return 'Acme Supply';
  }

  if (supplierId === 2 || supplierId === 3002) {
    return 'Bravo Industrial';
  }

  if (supplierId === 3) {
    return 'Global Partner Ltd.';
  }

  if (supplierId === 3009) {
    return 'Delta Alternative';
  }

  return `Supplier ${supplierId}`;
}

function resolveProductMeta(productId: number) {
  if (productId === 501 || productId === 1) {
    return {
      sku: 'SKU-LED-001',
      productName: '智能 LED 灯带',
      unit: 'set',
    };
  }

  if (productId === 503 || productId === 2) {
    return {
      sku: 'SKU-CBL-002',
      productName: 'USB-C 线缆',
      unit: 'pcs',
    };
  }

  return {
    sku: `SKU-${productId}`,
    productName: `Product ${productId}`,
    unit: 'pcs',
  };
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

function resolvePurchaseOwnerName(supplierId: number) {
  if (supplierId === 3002) {
    return 'Leo';
  }

  return 'Leo';
}

function normalizeSupplierName(value: string | undefined) {
  return value?.trim() ?? '';
}

function resolvePurchaseSupplierName(payload: {
  supplierId: number;
  supplierName?: string;
}) {
  const supplierName = normalizeSupplierName(payload.supplierName);
  if (supplierName) {
    return supplierName;
  }

  return resolveSupplierName(payload.supplierId);
}

function hasConfiguredPurchaseSupplier(record: {
  supplierId?: number;
  supplierName?: string;
}) {
  const supplierName = normalizeSupplierName(record.supplierName);

  return (
    (Number.isFinite(record.supplierId) && Number(record.supplierId) > 0) ||
    (supplierName.length > 0 && supplierName !== '待补供应商')
  );
}

function applyPurchaseSupplierPatch(
  record: CreatedPurchaseOrderRecord,
  supplierId: number,
  supplierName?: string,
) {
  const nextSupplierId = Number.isFinite(supplierId) ? Number(supplierId) : 0;
  const nextSupplierName = resolvePurchaseSupplierName({
    supplierId: nextSupplierId,
    supplierName,
  });

  return {
    ...record,
    supplierId: nextSupplierId,
    supplierName: nextSupplierName,
    items: record.items.map((item) => ({
      ...item,
      supplierId: nextSupplierId,
    })),
  } satisfies CreatedPurchaseOrderRecord;
}

function hasCompletedPurchasePrices(record: CreatedPurchaseOrderRecord) {
  return record.items.every(
    (item) => Number.isFinite(item.unitPrice) && Number(item.unitPrice) > 0,
  );
}

function applyPurchaseItemPricePatches(
  record: CreatedPurchaseOrderRecord,
  patches: SavePurchaseOrderDraftPayload['itemPricePatches'],
) {
  if (!patches?.length) {
    return record;
  }

  const priceByLineNo = new Map(
    patches
      .map((patch) => ({
        lineNo: Number(patch.lineNo),
        unitPrice: Number(patch.unitPrice),
      }))
      .filter(
        (patch) =>
          Number.isInteger(patch.lineNo) &&
          patch.lineNo > 0 &&
          Number.isFinite(patch.unitPrice) &&
          patch.unitPrice >= 0,
      )
      .map((patch) => [patch.lineNo, patch.unitPrice]),
  );

  if (priceByLineNo.size === 0) {
    return record;
  }

  return {
    ...record,
    items: record.items.map((item) => {
      const nextUnitPrice = priceByLineNo.get(item.lineNo);
      if (nextUnitPrice === undefined) {
        return item;
      }

      return {
        ...item,
        unitPrice: nextUnitPrice,
        amount: Number((item.quantity * nextUnitPrice).toFixed(2)),
      };
    }),
  } satisfies CreatedPurchaseOrderRecord;
}

function normalizeOwnerName(value: string | undefined) {
  return value?.trim() ?? '';
}

function normalizeFactoryEta(value: string) {
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestException('工厂预计交货日期无效');
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new BadRequestException('工厂预计交货日期无效');
  }
  return date;
}

function normalizeProductCodeSegment(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function buildPurchaseProductSku(input: {
  purchaseNo: string;
  lineNo: number;
  sourceSalesItemId: number;
  productName: string;
  supplierName: string;
}) {
  const productSegment = normalizeProductCodeSegment(input.productName) || 'PRODUCT';
  const supplierSegment = normalizeProductCodeSegment(input.supplierName) || 'SUPPLIER';
  const purchaseSegment = normalizeProductCodeSegment(input.purchaseNo) || 'PURCHASE';
  const suffix = `${String(input.lineNo).padStart(2, '0')}-${String(
    input.sourceSalesItemId,
  ).padStart(3, '0')}-${Date.now().toString().slice(-5)}`;

  return `PRD-${purchaseSegment.slice(0, 6)}-${productSegment.slice(0, 6)}-${supplierSegment.slice(0, 6)}-${suffix}`;
}

function buildPurchaseProductName(input: {
  salesItemName?: string;
  purchaseItemName?: string;
  salesNo: string;
  lineNo: number;
}) {
  return (
    input.salesItemName?.trim() ||
    input.purchaseItemName?.trim() ||
    `采购入库产品 ${input.salesNo}-${input.lineNo}`
  );
}

function buildPurchaseOrderTitle(
  salesOrderNo: string,
  items: PurchaseOrderLineItem[],
  supplierName: string,
) {
  const names = items.map((item) => item.productName.trim()).filter(Boolean).join('、') || '产品';
  const maxProductChars = 24;
  const productPart = Array.from(names).length > maxProductChars
    ? `${Array.from(names).slice(0, maxProductChars - 1).join('')}等`
    : names;
  return `${salesOrderNo}-${productPart}-${supplierName}`;
}

function refreshGeneratedPurchaseTitle(
  previous: CreatedPurchaseOrderRecord,
  next: CreatedPurchaseOrderRecord,
) {
  if (previous.title === buildPurchaseOrderTitle(previous.salesOrderNo, previous.items, previous.supplierName)) {
    next.title = buildPurchaseOrderTitle(next.salesOrderNo, next.items, next.supplierName);
  }
  return next;
}

function toSyntheticPurchaseUser(name: string): AssignablePurchaseUserItem {
  return {
    id: 0,
    username: name.toLowerCase(),
    realName: name,
    roleCode: 'purchase_manager',
    status: 'active',
  };
}

function toCreatedPurchaseOrderListItem(
  item: CreatedPurchaseOrderRecord,
): PurchaseOrderListItem {
  const firstProductName = item.items[0]?.productName;

  return {
    moduleLabel: '采购单',
    docNo: item.purchaseNo,
    title: item.title?.trim() || (firstProductName
      ? `${firstProductName} 销售拆单采购`
      : `${item.supplierName} 销售拆单采购`),
    status: item.status,
    secondaryStatus: item.status,
    supplierName: item.supplierName,
    ownerName: item.ownerName,
    factoryEstimatedDeliveryDate: item.factoryEstimatedDeliveryDate,
    createdAt: item.createdAt,
    detailHref: `/purchase-orders/${item.id}`,
    createdBy: resolveUserName(item.createdBy),
    approvalStatus: item.status,
    fulfillmentStatus: 'not_started',
    salesOrderNo: item.salesOrderNo,
    isResubmitted: false,
  };
}

function updateCreatedPurchaseOrder(
  record: CreatedPurchaseOrderRecord,
  patch: Partial<CreatedPurchaseOrderRecord>,
) {
  Object.assign(record, patch);
  return record;
}

function normalizePurchaseOrderItems(
  items: PurchaseOrderItem[],
): PurchaseOrderLineItem[] {
  return items.map((item, index) => {
    const productMeta = resolveProductMeta(item.productId);
    const quantity = Number(item.quantity);
    const packageQuantity = Number(item.packageQuantity ?? item.quantity ?? 0);
    const unitsPerPackage = Number(item.unitsPerPackage ?? 1);
    const unitPrice = Number(item.unitPrice ?? 0);
    const domesticFreight = Number(item.domesticFreight ?? 0);
    const imageUrls = Array.isArray(item.imageUrls)
      ? item.imageUrls.filter((entry) => entry.trim()).map((entry) => entry.trim())
      : [];

    return {
      lineNo: index + 1,
      sourceSalesItemId: item.salesItemId,
      supplierId: item.supplierId,
      productId: item.productId,
      productStatus: item.productId > 0 ? 'active' : undefined,
      sku: item.sku ?? productMeta.sku,
      internalCode: item.internalCode?.trim() || String(item.productId || ''),
      productName: item.productName ?? productMeta.productName,
      unit: item.unit ?? productMeta.unit,
      quantity,
      packageQuantity:
        Number.isFinite(packageQuantity) && packageQuantity > 0
          ? packageQuantity
          : undefined,
      unitsPerPackage:
        Number.isFinite(unitsPerPackage) && unitsPerPackage > 0
          ? unitsPerPackage
          : undefined,
      unitPrice,
      amount: Number((quantity * unitPrice).toFixed(2)),
      imageUrls,
      factoryEstimatedDeliveryDate: item.factoryEstimatedDeliveryDate?.trim() || undefined,
      shipTo: item.shipTo?.trim() || undefined,
      domesticFreight:
        Number.isFinite(domesticFreight) && domesticFreight > 0
          ? domesticFreight
          : undefined,
    };
  });
}

function resolvePurchaseOrderProductGroupKey(item: PurchaseOrderItem) {
  if (item.productId > 0) {
    return `product:${item.productId}`;
  }

  const sku = item.sku?.trim();
  if (sku) {
    return `sku:${sku}`;
  }

  return `sales-item:${item.salesItemId}`;
}

function createPurchaseOrderVersionHistoryEntry(payload: {
  versionNo: number;
  status: string;
  createdAt: string;
  changeReason?: string;
}): PurchaseOrderVersionHistoryEntry {
  return {
    versionNo: payload.versionNo,
    status: payload.status,
    createdAt: payload.createdAt,
    changeReason: payload.changeReason,
  };
}

function toPurchaseDocumentPayload(
  record: PrismaBusinessDocumentRecord,
): CreatedPurchaseOrderRecord {
  return {
    ...record.payload,
    id: Number(record.payload.id ?? record.id),
    purchaseNo: record.docNo,
    status: record.status,
    currentVersionNo: record.payload.currentVersionNo ?? 1,
    itemCount: record.payload.itemCount ?? record.payload.items?.length ?? 0,
    createdAt: record.payload.createdAt ?? record.createdAt.toISOString(),
    stockInStatus: record.payload.stockInStatus ?? 'not_started',
    stockInDocNo: record.payload.stockInDocNo ?? null,
    versionHistory: Array.isArray(record.payload.versionHistory)
      ? record.payload.versionHistory.map((item) => ({ ...item }))
      : [],
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

function canSeePurchaseOrder(
  session: FormalSession | undefined,
  item: { ownerName?: string | null },
) {
  if (!session?.role && !session?.user) {
    return true;
  }

  if (
    isFormalAdminOrBoss(session?.role) ||
    session?.role === 'purchase_manager'
  ) {
    return true;
  }

  return (
    typeof item.ownerName === 'string' &&
    typeof session?.user === 'string' &&
    item.ownerName.trim() === session.user.trim()
  );
}

function normalizePurchaseAggregateBaseStatus(status: string) {
  return status.startsWith('partial_') ? status.replace(/^partial_/, '') : status;
}

function toPartialPurchaseAggregateStatus(status: string) {
  const normalized = normalizePurchaseAggregateBaseStatus(status);
  if (normalized === 'exception') {
    return 'partial_exception';
  }

  if (
    normalized === 'shipped' ||
    normalized === 'to_forwarder' ||
    normalized === 'forwarder_shipped' ||
    normalized === 'arrived'
  ) {
    return `partial_${normalized}`;
  }

  return 'partial_purchasing';
}

function resolvePurchaseAggregateStatus(records: CreatedPurchaseOrderRecord[]) {
  const activeRecords = records.filter((record) => record.status !== 'void');
  if (activeRecords.length === 0) {
    return records.length > 0 ? 'void' : 'not_started';
  }

  if (activeRecords.some((record) => normalizePurchaseAggregateBaseStatus(record.status) === 'exception')) {
    return activeRecords.every(
      (record) => normalizePurchaseAggregateBaseStatus(record.status) === 'exception',
    )
      ? 'exception'
      : 'partial_exception';
  }

  const highest = activeRecords.reduce((current, record) => {
    const currentIndex = purchaseAggregateProgressOrder.indexOf(
      current as (typeof purchaseAggregateProgressOrder)[number],
    );
    const nextIndex = purchaseAggregateProgressOrder.indexOf(
      record.status as (typeof purchaseAggregateProgressOrder)[number],
    );

    return nextIndex > currentIndex ? record.status : current;
  }, activeRecords[0]?.status ?? 'not_started');
  const allSame = activeRecords.every((record) => record.status === highest);

  return allSame ? highest : toPartialPurchaseAggregateStatus(highest);
}

@Injectable()
export class PurchaseOrderService {
  private readonly store = resolvePurchaseOrderStore();
  private readonly activeSalesTransfers = new Map<number, Promise<{ purchaseOrders: CreatedPurchaseOrderRecord[] }>>();
  private readonly activeOwnerAssignments = new Map<number, Promise<{ ownerName: string; lockedPurchaseOwner: boolean }>>();
  private readonly activeEtaUpdates = new Set<number>();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
    @Optional()
    @Inject(SalesOrderService)
    private readonly salesOrderService?: Pick<
      SalesOrderService,
      'syncOperationalAggregates' | 'getDetail'
    >,
    @Optional()
    @Inject(UserManagementService)
    private readonly userManagementService?: Pick<
      UserManagementService,
      'listAssignablePurchaseUsers'
    >,
    @Optional()
    @Inject(ProductService)
    private readonly productService?: Pick<
      ProductService,
      'create' | 'activate'
    >,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  private get prismaDb() {
    return this.prisma as PrismaPurchaseDb | undefined;
  }

  async listAssignablePurchaseOwners(session?: FormalSession) {
    const directory =
      (await this.userManagementService?.listAssignablePurchaseUsers()) ?? [
        {
          id: 2002,
          username: 'leo',
          realName: 'Leo',
          roleCode: 'purchase' as const,
          status: 'active' as const,
        },
      ];
    const activeDirectory = directory.filter((item) => item.status === 'active');
    const selfName = normalizeOwnerName(session?.user);

    if (!session?.role) {
      return activeDirectory;
    }

    if (session.role === 'purchase') {
      const matchedSelf = activeDirectory.find(
        (item) =>
          item.realName === selfName ||
          item.username.toLowerCase() === selfName.toLowerCase(),
      );
      return matchedSelf ? [matchedSelf] : selfName ? [toSyntheticPurchaseUser(selfName)] : [];
    }

    if (session.role === 'purchase_manager') {
      const items = [...activeDirectory];
      if (
        selfName &&
        !items.some(
          (item) =>
            item.realName === selfName ||
            item.username.toLowerCase() === selfName.toLowerCase(),
        )
      ) {
        items.unshift(toSyntheticPurchaseUser(selfName));
      }
      return items;
    }

    if (session.role === 'admin' || session.role === 'boss') {
      const items = [...activeDirectory];
      if (
        selfName &&
        !items.some(
          (item) =>
            item.realName === selfName ||
            item.username.toLowerCase() === selfName.toLowerCase(),
        )
      ) {
        items.unshift(toSyntheticPurchaseUser(selfName));
      }
      return items;
    }

    return [];
  }

  private async resolveAllowedPurchaseOwnerName(payload: {
    requestedOwnerName?: string;
    fallbackOwnerName?: string;
    session?: FormalSession;
  }) {
    const requestedOwnerName = normalizeOwnerName(payload.requestedOwnerName);
    const fallbackOwnerName = normalizeOwnerName(payload.fallbackOwnerName);

    if (!payload.session?.role) {
      return requestedOwnerName || fallbackOwnerName || 'Leo';
    }

    const allowedOwners = await this.listAssignablePurchaseOwners(payload.session);
    const selectedOwnerName = requestedOwnerName || fallbackOwnerName || allowedOwners[0]?.realName || '';

    if (!selectedOwnerName) {
      throw new BadRequestException('请选择采购负责人');
    }

    const matchedOwner = allowedOwners.find(
      (item) =>
        item.realName === selectedOwnerName ||
        item.username.toLowerCase() === selectedOwnerName.toLowerCase(),
    );

    if (!matchedOwner) {
      throw new BadRequestException('当前角色不能选择该采购负责人');
    }

    return matchedOwner.realName;
  }

  private async loadSourceSalesOrderDetail(salesOrderId: number) {
    if (!this.salesOrderService?.getDetail) {
      return null;
    }

    try {
      return await this.salesOrderService.getDetail(salesOrderId);
    } catch {
      return null;
    }
  }

  private async needsExistingDirectOwnerAssignment(record: CreatedPurchaseOrderRecord) {
    if (record.lockedPurchaseOwner ||
        (record.status !== 'pending_purchase_claim' && record.status !== 'draft')) {
      return false;
    }
    const source = await this.loadSourceSalesOrderDetail(record.sourceSalesOrderId);
    return source?.sourceMode === 'direct';
  }

  async assignExistingDirectPurchaseOwner(payload: {
    purchaseOrderId: number;
    ownerName: string;
    currentStatus?: string;
    session?: FormalSession;
  }) {
    const active = this.activeOwnerAssignments.get(payload.purchaseOrderId);
    if (active) throw new BadRequestException('采购负责人正在分配，请刷新页面');
    const assignment = this.assignExistingDirectPurchaseOwnerOnce(payload);
    this.activeOwnerAssignments.set(payload.purchaseOrderId, assignment);
    try {
      return await assignment;
    } finally {
      this.activeOwnerAssignments.delete(payload.purchaseOrderId);
    }
  }

  private async assignExistingDirectPurchaseOwnerOnce(payload: {
    purchaseOrderId: number;
    ownerName: string;
    currentStatus?: string;
    session?: FormalSession;
  }) {
    const owners = await this.listAssignablePurchaseOwners(payload.session);
    const requestedOwnerName = normalizeOwnerName(payload.ownerName);
    const owner = owners.find((item) => item.id > 0 && item.realName === requestedOwnerName);
    if (!owner) throw new BadRequestException('请选择有效的采购负责人');

    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(payload.purchaseOrderId) },
      })) as PrismaBusinessDocumentRecord | null;
      if (!existing || existing.bizType !== 'purchase_order') {
        throw new NotFoundException('采购单不存在');
      }
      const beforeData = toPurchaseDocumentPayload(existing);
      if (payload.currentStatus && beforeData.status !== payload.currentStatus) {
        throw new BadRequestException('采购单状态已变更，请刷新页面');
      }
      if (!(await this.needsExistingDirectOwnerAssignment(beforeData))) {
        throw new BadRequestException('采购负责人已分配或当前采购单不需分配');
      }
      const nextPayload = { ...beforeData, ownerName: owner.realName, lockedPurchaseOwner: true };
      await this.prismaDb!.businessDocument.update({
        where: { id: existing.id },
        data: { ownerUserId: BigInt(owner.id), payload: nextPayload },
      });
      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'purchase_order', bizId: existing.id,
          operationType: 'assign_purchase_owner', operatorId: existing.createdBy ?? 0n,
          beforeData, afterData: nextPayload,
        },
      });
      return { ownerName: owner.realName, lockedPurchaseOwner: true };
    }

    const existing = this.store.getPurchaseOrder(payload.purchaseOrderId);
    if (!existing) throw new NotFoundException('采购单不存在');
    if (payload.currentStatus && existing.status !== payload.currentStatus) {
      throw new BadRequestException('采购单状态已变更，请刷新页面');
    }
    if (!(await this.needsExistingDirectOwnerAssignment(existing))) {
      throw new BadRequestException('采购负责人已分配或当前采购单不需分配');
    }
    const beforeData = snapshotAuditData(existing);
    existing.ownerName = owner.realName;
    existing.lockedPurchaseOwner = true;
    this.store.upsertPurchaseOrder(existing);
    this.store.recordAuditLog({
      bizType: 'purchase_order', bizId: existing.id,
      operationType: 'assign_purchase_owner', operatorId: existing.createdBy,
      beforeData, afterData: existing,
    });
    return { ownerName: owner.realName, lockedPurchaseOwner: true };
  }

  private async ensureSubmittedPurchaseProducts(record: CreatedPurchaseOrderRecord) {
    const productService = this.productService;
    if (!productService?.create || record.items.length === 0) {
      return record;
    }

    const sourceSalesOrder = await this.loadSourceSalesOrderDetail(record.sourceSalesOrderId);
    const salesItemsByLineNo = new Map(
      (sourceSalesOrder?.items ?? []).map((item) => [item.lineNo, item]),
    );
    let changed = false;

    const items = await Promise.all(
      record.items.map(async (item) => {
        if (item.productId > 0) {
          return {
            ...item,
            productStatus: item.productStatus ?? 'active',
          };
        }

        const salesItem = salesItemsByLineNo.get(item.sourceSalesItemId);
        const productName = buildPurchaseProductName({
          salesItemName: salesItem?.productName,
          purchaseItemName: item.productName,
          salesNo: record.purchaseNo,
          lineNo: item.lineNo,
        });
        const unit = salesItem?.unit?.trim() || item.unit?.trim() || '';
        const sku = normalizeOwnerName(item.sku)
          ? item.sku.trim()
          : buildPurchaseProductSku({
              purchaseNo: record.purchaseNo,
              lineNo: item.lineNo,
              sourceSalesItemId: item.sourceSalesItemId,
              productName,
              supplierName: record.supplierName,
            });

        const createdProduct = await productService.create({
          sku,
          salesCode: sku,
          purchaseCode: item.internalCode?.trim() || '',
          purchaseCodeMode: 'manual',
          productStage: 'formal',
          pricingMode: 'fixed',
          brand: '',
          factoryName: record.supplierName,
          model: '',
          spec: '',
          singleWeight: undefined,
          cartonSpec: '',
          cartonQuantity: undefined,
          cartonWeight: undefined,
          defaultSupplierCode: '',
          nameCn: productName,
          nameEn: salesItem?.productName?.trim() || '',
          category: 'electronics',
          unit,
          currency: 'USD',
          defaultSalePrice: Number(salesItem?.salePrice ?? item.unitPrice ?? 0),
          defaultPurchasePrice: Number(item.unitPrice ?? 0),
          salePriceTiers: [],
          ownerName: record.ownerName,
          createdBy: record.ownerName,
          status: 'inactive',
        });

        changed = true;

        return {
          ...item,
          productId: createdProduct.id,
          productStatus: createdProduct.status,
          sku: createdProduct.sku,
          productName: createdProduct.nameCn,
          unit: createdProduct.unit || unit,
          internalCode: item.internalCode?.trim() || createdProduct.purchaseCode || `P-${createdProduct.id}`,
        };
      }),
    );

    return changed ? { ...record, items } : record;
  }

  private async activateSubmittedPurchaseProducts(record: CreatedPurchaseOrderRecord) {
    const productService = this.productService;
    if (!productService?.activate || record.items.length === 0) {
      return record;
    }

    const items = await Promise.all(
      record.items.map(async (item) => {
        if (
          !item.productId ||
          item.productId <= 0 ||
          item.productStatus === 'active'
        ) {
          return item;
        }

        const activatedProduct = await productService.activate(item.productId, {
          operatedBy: record.ownerName,
          reason: '采购审批通过后启用产品',
        });

        return {
          ...item,
          productStatus: activatedProduct.status,
          sku: activatedProduct.sku,
          productName: activatedProduct.nameCn,
          unit: activatedProduct.unit,
        };
      }),
    );

    return { ...record, items };
  }

  private async syncSourceSalesOrderPurchaseStatus(payload: {
    salesOrderId: number;
    purchaseAggregateStatus: string;
    operatorId: number;
  }) {
    await this.salesOrderService?.syncOperationalAggregates({
      salesOrderId: payload.salesOrderId,
      purchaseAggregateStatus: payload.purchaseAggregateStatus,
      operatorId: payload.operatorId,
      source: 'purchase_order',
    });
  }

  private async resolveSourceSalesOrderPurchaseAggregateStatus(
    salesOrderId: number,
  ) {
    const records = this.shouldUsePrisma()
      ? (
          (await this.prismaDb!.businessDocument.findMany({
            where: { bizType: 'purchase_order' },
          })) as PrismaBusinessDocumentRecord[]
        )
          .map(toPurchaseDocumentPayload)
          .filter((record) => record.sourceSalesOrderId === salesOrderId)
      : this.store
          .listPurchaseOrders()
          .filter((record) => record.sourceSalesOrderId === salesOrderId);

    return resolvePurchaseAggregateStatus(records);
  }

  async listActiveLinkedPurchaseOrders(payload: {
    salesOrderId: number;
    salesOrderNo: string;
  }) {
    const runtimeRecords = this.shouldUsePrisma()
      ? (
          (await this.prismaDb!.businessDocument.findMany({
            where: { bizType: 'purchase_order' },
          })) as PrismaBusinessDocumentRecord[]
        ).map(toPurchaseDocumentPayload)
      : this.store.listPurchaseOrders();
    const previewRecords = this.shouldUsePrisma()
      ? []
      : purchaseOrderListData.map((item) => ({
          id: Number(item.detailHref.split('/').filter(Boolean).at(-1) ?? 0),
          purchaseNo: item.docNo,
          status: item.status,
          sourceSalesOrderId: 0,
          salesOrderNo: item.salesOrderNo,
        }));

    return [...runtimeRecords, ...previewRecords]
      .filter((record) => {
        const matchesSource =
          record.sourceSalesOrderId === payload.salesOrderId ||
          record.salesOrderNo === payload.salesOrderNo;

        return matchesSource && record.status !== 'void';
      })
      .map((record) => ({
        id: record.id,
        purchaseNo: record.purchaseNo,
        status: record.status,
      }));
  }

  async list(
    query: PurchaseOrderListQuery,
    session?: FormalSession,
  ): Promise<PurchaseOrderListResponse> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const sortBy =
      query.sortBy === 'docNo' || query.sortBy === 'supplierName'
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const keyword = query.keyword?.trim().toLowerCase();
    const supplierName = query.supplierName?.trim().toLowerCase();
    const ownerName = query.ownerName?.trim().toLowerCase();
    const createdBy = query.createdBy?.trim().toLowerCase();
    const salesOrderNo = query.salesOrderNo?.trim().toLowerCase();
    const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
    const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;
    const isResubmitted = normalizeTriStateFilter(query.isResubmitted);

    const allItems = this.shouldUsePrisma()
      ? (
          (await this.prismaDb!.businessDocument.findMany({
            where: { bizType: 'purchase_order' },
            orderBy: { createdAt: 'desc' },
          })) as PrismaBusinessDocumentRecord[]
        ).map(toPurchaseDocumentPayload).map(toCreatedPurchaseOrderListItem)
      : [
          ...this.store.listPurchaseOrders().map(toCreatedPurchaseOrderListItem),
          ...purchaseOrderListData,
        ];

    const filtered = allItems.filter((item) => {
      if (!canSeePurchaseOrder(session, item)) {
        return false;
      }

      if (
        keyword &&
        ![
          item.docNo,
          item.title,
          item.supplierName ?? '',
          item.ownerName ?? '',
          item.salesOrderNo,
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

      if (
        query.status &&
        item.approvalStatus !== query.status &&
        item.fulfillmentStatus !== query.status
      ) {
        return false;
      }

      if (
        supplierName &&
        !(item.supplierName ?? '').toLowerCase().includes(supplierName)
      ) {
        return false;
      }

      if (createdBy && !item.createdBy.toLowerCase().includes(createdBy)) {
        return false;
      }

      if (ownerName && !(item.ownerName ?? '').toLowerCase().includes(ownerName)) {
        return false;
      }

      if (query.approvalStatus && item.approvalStatus !== query.approvalStatus) {
        return false;
      }

      if (
        query.fulfillmentStatus &&
        item.fulfillmentStatus !== query.fulfillmentStatus
      ) {
        return false;
      }

      if (
        salesOrderNo &&
        !item.salesOrderNo.toLowerCase().includes(salesOrderNo)
      ) {
        return false;
      }

      if (isResubmitted !== 'all') {
        const expected = isResubmitted === 'yes';
        if (item.isResubmitted !== expected) {
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
        sortBy === 'supplierName' ? left.supplierName ?? '' : left[sortBy];
      const rightValue =
        sortBy === 'supplierName' ? right.supplierName ?? '' : right[sortBy];

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
        createdBy: query.createdBy ?? null,
        ownerName: query.ownerName ?? null,
        approvalStatus: query.approvalStatus ?? null,
        fulfillmentStatus: query.fulfillmentStatus ?? null,
        salesOrderNo: query.salesOrderNo ?? null,
        isResubmitted,
      },
    };
  }

  async createFromSalesOrder(payload: CreateFromSalesOrderPayload) {
    const active = this.activeSalesTransfers.get(payload.salesOrderId);
    if (active) return active;
    const transfer = this.createFromSalesOrderOnce(payload);
    this.activeSalesTransfers.set(payload.salesOrderId, transfer);
    try {
      return await transfer;
    } finally {
      this.activeSalesTransfers.delete(payload.salesOrderId);
    }
  }

  private async createFromSalesOrderOnce(payload: CreateFromSalesOrderPayload) {
    const groupedByProduct = new Map<string, PurchaseOrderItem[]>();
    payload.items.forEach((item) => {
      const groupKey = resolvePurchaseOrderProductGroupKey(item);
      const currentItems = groupedByProduct.get(groupKey) ?? [];
      currentItems.push(item);
      groupedByProduct.set(groupKey, currentItems);
    });
    const sourceSalesOrder = await this.loadSourceSalesOrderDetail(payload.salesOrderId);
    if (this.salesOrderService?.getDetail && !sourceSalesOrder) {
      throw new NotFoundException('来源销售单不存在');
    }
    if (sourceSalesOrder) {
      if (sourceSalesOrder.status !== 'purchasing' &&
          !(payload.allowPendingAssignment && sourceSalesOrder.status === 'pending_purchase_assignment')) {
        throw new BadRequestException('销售单尚未进入采购转换节点');
      }
      if (sourceSalesOrder.purchaseOwnerName &&
          sourceSalesOrder.purchaseOwnerName !== payload.ownerName) {
        throw new BadRequestException('采购负责人必须与来源销售单一致');
      }
      if (sourceSalesOrder.purchaseOwnerName && payload.session?.user &&
          sourceSalesOrder.purchaseOwnerName !== payload.session.user) {
        throw new BadRequestException('仅指定采购负责人可将销售单转为采购单');
      }
      if (sourceSalesOrder.status === 'pending_purchase_assignment' && !payload.ownerName) {
        throw new BadRequestException('请先指定采购负责人');
      }
    }
    const salesOrderNo = sourceSalesOrder?.salesNo || payload.salesOrderNo?.trim() ||
      `S20260708${String(payload.salesOrderId).padStart(4, '0')}`;
    const customerOrderNo = sourceSalesOrder?.customerOrderNo?.trim() ||
      payload.customerOrderNo?.trim() || undefined;
    if (!salesOrderNo.startsWith('S')) {
      throw new BadRequestException('来源销售单号无效');
    }
    const purchaseNoBase = `C${salesOrderNo.slice(1)}`;
    const existingPurchaseOrders = this.shouldUsePrisma()
      ? ((await this.prismaDb!.businessDocument.findMany({
          where: { bizType: 'purchase_order' },
        })) as PrismaBusinessDocumentRecord[]).map(toPurchaseDocumentPayload)
      : this.store.listPurchaseOrders();
    const alreadyCreated = existingPurchaseOrders.filter(
      (record) => record.sourceSalesOrderId === payload.salesOrderId && record.status !== 'void',
    );
    if (alreadyCreated.length > 0) {
      if (payload.ownerName && alreadyCreated.some((record) => record.ownerName !== payload.ownerName)) {
        throw new BadRequestException('采购单已由其他负责人创建，不能重复分配');
      }
      const createdGroups = new Set(alreadyCreated.map((record) => {
        const firstItem = record.items?.[0];
        return firstItem ? resolvePurchaseOrderProductGroupKey({
          salesItemId: firstItem.sourceSalesItemId,
          supplierId: firstItem.supplierId,
          productId: firstItem.productId,
          sku: firstItem.sku,
          quantity: firstItem.quantity,
        }) : '';
      }));
      if (createdGroups.has('') || alreadyCreated.length !== createdGroups.size) {
        throw new BadRequestException('来源销售单已有不完整采购单，请先核对');
      }
      for (const groupKey of createdGroups) groupedByProduct.delete(groupKey);
      if (groupedByProduct.size === 0) return { purchaseOrders: alreadyCreated };
    }
    const existingCodes = existingPurchaseOrders
      .filter((record) => record.sourceSalesOrderId === payload.salesOrderId)
      .map((record) => record.purchaseNo);
    let nextSuffix = Math.max(0, ...existingCodes.map((code) => {
      const match = code.match(new RegExp(`^${purchaseNoBase}-(\\d+)$`));
      return match ? Number(match[1]) : 0;
    }));
    const useSuffix = existingCodes.length > 0;
    const initialStatus =
      payload.initialStatus === 'pending_purchase_claim'
        ? 'pending_purchase_claim'
        : 'draft';

    const splitCount = groupedByProduct.size + alreadyCreated.length;
    const nextPurchaseNo = () => splitCount > 1 || useSuffix
      ? `${purchaseNoBase}-${++nextSuffix}`
      : purchaseNoBase;

    if (this.shouldUsePrisma()) {
      const purchaseOrders: CreatedPurchaseOrderRecord[] = [...alreadyCreated];

      for (const [groupKey, items] of groupedByProduct.entries()) {
        const supplierId = items[0]?.supplierId ?? 0;
        const supplierName = resolvePurchaseSupplierName({
          supplierId,
          supplierName: items[0]?.supplierName,
        });
        const ownerName = await this.resolveAllowedPurchaseOwnerName({
          requestedOwnerName: payload.ownerName,
          fallbackOwnerName:
            items[0]?.purchaseOwnerName || resolvePurchaseOwnerName(supplierId),
          session: payload.session,
        });
        const ownerUserId = (await this.listAssignablePurchaseOwners()).find(
          (owner) => owner.realName === ownerName && owner.id > 0,
        )?.id;
        const basePayload: CreatedPurchaseOrderRecord = {
          id: 0,
          purchaseNo: 'PENDING-PURCHASE',
          sourceSalesOrderId: payload.salesOrderId,
          supplierId,
          supplierName,
          ownerName,
          lockedPurchaseOwner: Boolean(sourceSalesOrder),
          sourceInquiryId: sourceSalesOrder?.sourceInquiryId,
          currentVersionNo: 1,
          status: initialStatus,
          itemCount: items.length,
          createdBy: payload.createdBy,
          createdAt: '2026-07-11T10:00:00.000Z',
          salesOrderNo,
          customerOrderNo,
          storeName: payload.storeName?.trim() || undefined,
          orderDate: payload.orderDate?.trim() || undefined,
          factoryEstimatedDeliveryDate:
            payload.factoryEstimatedDeliveryDate?.trim() || undefined,
          shipTo: payload.shipTo?.trim() || undefined,
          domesticFreight: undefined,
          purchaseOrderAttachments: Array.isArray(payload.purchaseOrderAttachments)
            ? payload.purchaseOrderAttachments.map((item) => ({ ...item }))
            : [],
          currentBatchCount: 0,
          versionHistory: [
            createPurchaseOrderVersionHistoryEntry({
              versionNo: 1,
              status: initialStatus,
              createdAt: '2026-07-11T10:00:00.000Z',
            }),
          ],
          items: normalizePurchaseOrderItems(items),
        };
        const created = (await this.prismaDb!.businessDocument.create({
          data: {
            bizType: 'purchase_order',
            docNo: `PENDING-PURCHASE-${Date.now()}-${groupKey}`,
            status: initialStatus,
            ownerUserId: BigInt(ownerUserId ?? payload.createdBy),
            counterpartyId: supplierId > 0 ? BigInt(supplierId) : null,
            payload: basePayload,
            createdBy: BigInt(payload.createdBy),
          },
        })) as PrismaBusinessDocumentRecord;
        const finalPayload: CreatedPurchaseOrderRecord = {
          ...basePayload,
          id: Number(created.id),
          purchaseNo: nextPurchaseNo(),
          title: buildPurchaseOrderTitle(salesOrderNo, basePayload.items, supplierName),
        };
        const updated = (await this.prismaDb!.businessDocument.update({
          where: { id: created.id },
          data: {
            docNo: finalPayload.purchaseNo,
            payload: finalPayload,
          },
        })) as PrismaBusinessDocumentRecord;
        await this.prismaDb!.operationLog.create({
          data: {
            bizType: 'purchase_order',
            bizId: updated.id,
            operationType: 'create_purchase_order',
            operatorId: BigInt(payload.createdBy),
            beforeData: undefined,
            afterData: finalPayload,
          },
        });
        purchaseOrders.push(finalPayload);
      }

      await this.syncSourceSalesOrderPurchaseStatus({
        salesOrderId: payload.salesOrderId,
        purchaseAggregateStatus: 'purchasing',
        operatorId: payload.createdBy,
      });

      return { purchaseOrders };
    }

    const purchaseOrders: CreatedPurchaseOrderRecord[] = [...alreadyCreated];

    for (const [, items] of groupedByProduct.entries()) {
      const supplierId = items[0]?.supplierId ?? 0;
      const supplierName = resolvePurchaseSupplierName({
        supplierId,
        supplierName: items[0]?.supplierName,
      });
      const ownerName = await this.resolveAllowedPurchaseOwnerName({
        requestedOwnerName: payload.ownerName,
        fallbackOwnerName:
          items[0]?.purchaseOwnerName || resolvePurchaseOwnerName(supplierId),
        session: payload.session,
      });
      const id = this.store.nextPurchaseOrderId();
      const createdRecord: CreatedPurchaseOrderRecord = {
          id,
          purchaseNo: nextPurchaseNo(),
          sourceSalesOrderId: payload.salesOrderId,
          supplierId,
          supplierName,
          ownerName,
          lockedPurchaseOwner: Boolean(sourceSalesOrder),
          sourceInquiryId: sourceSalesOrder?.sourceInquiryId,
          currentVersionNo: 1,
          status: initialStatus,
          itemCount: items.length,
          createdBy: payload.createdBy,
          createdAt: '2026-07-11T10:00:00.000Z',
          salesOrderNo,
          customerOrderNo,
          storeName: payload.storeName?.trim() || undefined,
          orderDate: payload.orderDate?.trim() || undefined,
          factoryEstimatedDeliveryDate:
            payload.factoryEstimatedDeliveryDate?.trim() || undefined,
          shipTo: payload.shipTo?.trim() || undefined,
          domesticFreight: undefined,
          purchaseOrderAttachments: Array.isArray(payload.purchaseOrderAttachments)
            ? payload.purchaseOrderAttachments.map((item) => ({ ...item }))
            : [],
          currentBatchCount: 0,
          versionHistory: [
            createPurchaseOrderVersionHistoryEntry({
              versionNo: 1,
              status: initialStatus,
              createdAt: '2026-07-11T10:00:00.000Z',
            }),
          ],
          items: normalizePurchaseOrderItems(items),
        };

      createdRecord.title = buildPurchaseOrderTitle(salesOrderNo, createdRecord.items, supplierName);

      this.store.upsertPurchaseOrder(createdRecord);
      this.store.recordAuditLog({
        bizType: 'purchase_order',
        bizId: createdRecord.id,
        operationType: 'create_purchase_order',
        operatorId: payload.createdBy,
        beforeData: null,
        afterData: createdRecord,
      });
      purchaseOrders.push(createdRecord);
    }

    await this.syncSourceSalesOrderPurchaseStatus({
      salesOrderId: payload.salesOrderId,
      purchaseAggregateStatus: initialStatus,
      operatorId: payload.createdBy,
    });

    return { purchaseOrders };
  }

  async listAuditLogs() {
    if (this.shouldUsePrisma()) {
      const logs = (await this.prismaDb!.operationLog.findMany({
        where: { bizType: 'purchase_order' },
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

      if (created && created.bizType === 'purchase_order') {
        const detail = toPurchaseDocumentPayload(created);
        const listItem = toCreatedPurchaseOrderListItem(detail);
        if (!canSeePurchaseOrder(session, listItem)) {
          throw new NotFoundException('采购单不存在');
        }

        return {
          ...detail,
          needsPurchaseAssignment: await this.needsExistingDirectOwnerAssignment(detail),
          stockInStatus: detail.stockInStatus ?? 'not_started',
          stockInDocNo: detail.stockInDocNo ?? null,
        };
      }
    }

    const created = this.store.getPurchaseOrder(id);

    if (created) {
      const listItem = toCreatedPurchaseOrderListItem(created);
      if (
        !canSeePurchaseOrder(session, listItem)
      ) {
        throw new NotFoundException('采购单不存在');
      }

      return {
        ...created,
        needsPurchaseAssignment: await this.needsExistingDirectOwnerAssignment(created),
        stockInStatus: created.stockInStatus ?? 'not_started',
        stockInDocNo: created.stockInDocNo ?? null,
      };
    }

    const fallback: CreatedPurchaseOrderRecord = {
      id,
      purchaseNo: 'P202607080001',
      status: 'draft',
      currentVersionNo: 1,
      sourceSalesOrderId: 88,
      supplierId: 3001,
      supplierName: 'Acme Supply',
      itemCount: 1,
      salesOrderNo: 'S202607080001',
      customerOrderNo: 'PO-ACME-20260708',
      storeName: '02 Libuys',
      orderDate: '2026-07-08',
      factoryEstimatedDeliveryDate: '2026-08-08',
      shipTo: 'SH Boninoe',
      purchaseOrderAttachments: [],
      ownerName: 'Leo',
      createdBy: 2002,
      createdAt: '2026-07-11T10:30:00.000Z',
      currentBatchCount: 0,
      stockInStatus: 'not_started',
      stockInDocNo: null,
      versionHistory: [
        createPurchaseOrderVersionHistoryEntry({
          versionNo: 1,
          status: 'draft',
          createdAt: '2026-07-11T10:30:00.000Z',
        }),
      ],
      items: [
        {
          lineNo: 1,
          sourceSalesItemId: 1,
          supplierId: 3001,
          productId: 501,
          sku: 'SKU-LED-001',
          internalCode: '501',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          packageQuantity: 20,
          unitsPerPackage: 25,
          unitPrice: 12.5,
          amount: 6250,
          imageUrls: [],
          factoryEstimatedDeliveryDate: '2026-08-08',
          shipTo: 'SH Boninoe',
        },
      ],
    };
    const fallbackListItem = toCreatedPurchaseOrderListItem({
      ...fallback,
      ownerName: 'Leo',
      currentVersionNo: 1,
      itemCount: 1,
      salesOrderNo: 'S202607080001',
      currentBatchCount: 0,
      versionHistory: fallback.versionHistory ?? [],
    });

    if (
      !canSeePurchaseOrder(session, fallbackListItem)
    ) {
      throw new NotFoundException('采购单不存在');
    }

    return {
      ...fallback,
      needsPurchaseAssignment: await this.needsExistingDirectOwnerAssignment(fallback),
      stockInStatus: fallback.stockInStatus ?? 'not_started',
      stockInDocNo: fallback.stockInDocNo ?? null,
    };
  }

  private assertPurchaseOwnerForMutation(
    record: CreatedPurchaseOrderRecord,
    session?: FormalSession,
  ) {
    if (session?.user &&
        record.ownerName !== session.user?.trim()) {
      throw new BadRequestException('仅指定采购负责人可处理此采购单');
    }
  }

  async updateFactoryEstimatedDeliveryDate(payload: {
    purchaseOrderId: number;
    currentStatus: string;
    factoryEstimatedDeliveryDate: string;
    session?: FormalSession;
  }) {
    if (this.activeEtaUpdates.has(payload.purchaseOrderId)) {
      throw new BadRequestException('交期正在更新，请刷新页面');
    }
    this.activeEtaUpdates.add(payload.purchaseOrderId);
    try {
      return await this.updateFactoryEstimatedDeliveryDateOnce(payload);
    } finally {
      this.activeEtaUpdates.delete(payload.purchaseOrderId);
    }
  }

  private async updateFactoryEstimatedDeliveryDateOnce(payload: {
    purchaseOrderId: number;
    currentStatus: string;
    factoryEstimatedDeliveryDate: string;
    session?: FormalSession;
  }) {
    const date = normalizeFactoryEta(payload.factoryEstimatedDeliveryDate);
    const existing = this.shouldUsePrisma()
      ? (await this.prismaDb!.businessDocument.findUnique({ where: { id: BigInt(payload.purchaseOrderId) } })) as PrismaBusinessDocumentRecord | null
      : null;
    const record = existing?.bizType === 'purchase_order'
      ? toPurchaseDocumentPayload(existing)
      : this.shouldUsePrisma() ? undefined : this.store.getPurchaseOrder(payload.purchaseOrderId);
    if (!record) throw new NotFoundException('采购单不存在');
    this.assertPurchaseOwnerForMutation(record, payload.session);
    if (record.status !== payload.currentStatus) {
      throw new BadRequestException('采购单状态已变更，请刷新页面');
    }
    if (record.status !== 'purchasing' || record.currentBatchCount > 0) {
      throw new BadRequestException('仅审批通过后、发货前可修改交期');
    }
    if (record.factoryEstimatedDeliveryDate === date &&
        record.items.every((item) => item.factoryEstimatedDeliveryDate === date)) {
      throw new BadRequestException('交期与当前日期相同');
    }
    const nextRecord = {
      ...record,
      factoryEstimatedDeliveryDate: date,
      items: record.items.map((item) => ({ ...item, factoryEstimatedDeliveryDate: date })),
    };
    if (existing) {
      await this.prismaDb!.businessDocument.update({
        where: { id: existing.id, status: record.status },
        data: { payload: nextRecord },
      });
      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'purchase_order', bizId: existing.id,
          operationType: 'update_factory_eta', operatorId: existing.createdBy ?? 0n,
          beforeData: record, afterData: nextRecord,
        },
      });
    } else {
      this.store.upsertPurchaseOrder(nextRecord);
      this.store.recordAuditLog({
        bizType: 'purchase_order', bizId: record.id,
        operationType: 'update_factory_eta', operatorId: record.createdBy,
        beforeData: record, afterData: nextRecord,
      });
    }
    return { id: record.id, factoryEstimatedDeliveryDate: date, status: record.status };
  }

  async submit(payload: SubmitPurchaseOrderPayload) {
    if (
      payload.currentStatus !== 'draft' &&
      payload.currentStatus !== 'pending_purchase_claim'
    ) {
      throw new BadRequestException(
        'Only draft or pending purchase claim orders can be submitted',
      );
    }

    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(payload.purchaseOrderId) },
      })) as PrismaBusinessDocumentRecord | null;
      if (existing?.bizType === 'purchase_order') {
        const detail = toPurchaseDocumentPayload(existing);
        if (await this.needsExistingDirectOwnerAssignment(detail)) {
          throw new BadRequestException('请先分配采购负责人');
        }
        this.assertPurchaseOwnerForMutation(detail, payload.session);
        if (detail.status !== payload.currentStatus) {
          throw new BadRequestException('采购单状态已变更，请刷新页面');
        }
        if (!hasConfiguredPurchaseSupplier(detail)) {
          throw new BadRequestException('请先补充供应商后再提交采购审批');
        }
        if (!hasCompletedPurchasePrices(detail)) {
          throw new BadRequestException('请先补充采购价后再提交采购审批');
        }
        if (payload.title !== undefined && !payload.title.trim()) {
          throw new BadRequestException('请填写采购单标题');
        }
      }

      if (existing?.bizType === 'purchase_order') {
        const submittedPayload = await this.ensureSubmittedPurchaseProducts(
          toPurchaseDocumentPayload(existing),
        );
        await this.updatePurchaseOrderStatus({
          purchaseOrderId: payload.purchaseOrderId,
          status: 'pending_purchase_manager_approval',
          operationType: 'submit_purchase_order',
          mutate: () => ({
            ...submittedPayload,
            title: payload.title?.trim() || submittedPayload.title,
            status: 'pending_purchase_manager_approval',
          }),
        });
      } else {
        await this.updatePurchaseOrderStatus({
          purchaseOrderId: payload.purchaseOrderId,
          status: 'pending_purchase_manager_approval',
          operationType: 'submit_purchase_order',
        });
      }

      return {
        id: payload.purchaseOrderId,
        status: 'pending_purchase_manager_approval',
      };
    }

    const created = this.store.getPurchaseOrder(payload.purchaseOrderId);
    if (created) {
      if (await this.needsExistingDirectOwnerAssignment(created)) {
        throw new BadRequestException('请先分配采购负责人');
      }
      this.assertPurchaseOwnerForMutation(created, payload.session);
      if (created.status !== payload.currentStatus) {
        throw new BadRequestException('采购单状态已变更，请刷新页面');
      }
      if (!hasConfiguredPurchaseSupplier(created)) {
        throw new BadRequestException('请先补充供应商后再提交采购审批');
      }
      if (!hasCompletedPurchasePrices(created)) {
        throw new BadRequestException('请先补充采购价后再提交采购审批');
      }
      if (payload.title !== undefined && !payload.title.trim()) {
        throw new BadRequestException('请填写采购单标题');
      }

      const beforeData = snapshotAuditData(created);
      const submittedPayload = await this.ensureSubmittedPurchaseProducts(created);
      updateCreatedPurchaseOrder(submittedPayload, {
        title: payload.title?.trim() || submittedPayload.title,
        status: 'pending_purchase_manager_approval',
      });
      updateCreatedPurchaseOrder(created, submittedPayload);
      this.store.upsertPurchaseOrder(created);
      this.store.recordAuditLog({
        bizType: 'purchase_order',
        bizId: created.id,
        operationType: 'submit_purchase_order',
        operatorId: created.createdBy,
        beforeData,
        afterData: submittedPayload,
      });
    }

    return {
      id: payload.purchaseOrderId,
      status: 'pending_purchase_manager_approval',
    };
  }

  async saveDraft(payload: SavePurchaseOrderDraftPayload) {
    if (
      payload.currentStatus !== 'draft' &&
      payload.currentStatus !== 'pending_purchase_claim'
    ) {
      throw new BadRequestException(
        'Only draft or pending purchase claim orders can be saved',
      );
    }

    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(payload.purchaseOrderId) },
      })) as PrismaBusinessDocumentRecord | null;

      if (!existing || existing.bizType !== 'purchase_order') {
        throw new NotFoundException('采购单不存在');
      }

      const beforeData = toPurchaseDocumentPayload(existing);
      if (await this.needsExistingDirectOwnerAssignment(beforeData)) {
        throw new BadRequestException('请先分配采购负责人');
      }
      if (
        beforeData.status !== 'draft' &&
        beforeData.status !== 'pending_purchase_claim'
      ) {
        throw new BadRequestException(
          'Only draft or pending purchase claim orders can be saved',
        );
      }

      const ownerName = await this.resolveAllowedPurchaseOwnerName({
        requestedOwnerName: payload.ownerName,
        fallbackOwnerName: beforeData.ownerName,
        session: payload.session,
      });
      if (ownerName !== beforeData.ownerName) {
        throw new BadRequestException('采购负责人不可通过保存草稿修改');
      }
      this.assertPurchaseOwnerForMutation(beforeData, payload.session);
      const supplierId =
        payload.supplierId === undefined
          ? beforeData.supplierId
          : Number(payload.supplierId);
      const supplierName =
        payload.supplierId === undefined && payload.supplierName === undefined
          ? beforeData.supplierName
          : payload.supplierName;
      const nextPayload = refreshGeneratedPurchaseTitle(beforeData, applyPurchaseItemPricePatches(
        applyPurchaseSupplierPatch({
          ...beforeData,
          ownerName,
        }, supplierId, supplierName),
        payload.itemPricePatches,
      ));
      const updated = (await this.prismaDb!.businessDocument.update({
        where: { id: existing.id },
        data: {
          status: beforeData.status,
          ownerUserId: BigInt((await this.listAssignablePurchaseOwners()).find(
            (owner) => owner.realName === ownerName && owner.id > 0,
          )?.id ?? Number(existing.ownerUserId ?? existing.createdBy ?? 0n)),
          counterpartyId: nextPayload.supplierId > 0 ? BigInt(nextPayload.supplierId) : null,
          payload: nextPayload,
        },
      })) as PrismaBusinessDocumentRecord;

      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'purchase_order',
          bizId: updated.id,
          operationType: 'save_purchase_order_draft',
          operatorId: existing.createdBy ?? 0n,
          beforeData,
          afterData: nextPayload,
        },
      });

      return {
        id: payload.purchaseOrderId,
        status: beforeData.status,
        ownerName,
        supplierId: nextPayload.supplierId,
        supplierName: nextPayload.supplierName,
      };
    }

    const created = this.store.getPurchaseOrder(payload.purchaseOrderId);
    if (created) {
      if (await this.needsExistingDirectOwnerAssignment(created)) {
        throw new BadRequestException('请先分配采购负责人');
      }
      if (
        created.status !== 'draft' &&
        created.status !== 'pending_purchase_claim'
      ) {
        throw new BadRequestException(
          'Only draft or pending purchase claim orders can be saved',
        );
      }

      const beforeData = snapshotAuditData(created);
      const ownerName = await this.resolveAllowedPurchaseOwnerName({
        requestedOwnerName: payload.ownerName,
        fallbackOwnerName: created.ownerName,
        session: payload.session,
      });
      if (ownerName !== created.ownerName) {
        throw new BadRequestException('采购负责人不可通过保存草稿修改');
      }
      this.assertPurchaseOwnerForMutation(created, payload.session);
      const supplierId =
        payload.supplierId === undefined
          ? created.supplierId
          : Number(payload.supplierId);
      const supplierName =
        payload.supplierId === undefined && payload.supplierName === undefined
          ? created.supplierName
          : payload.supplierName;
      updateCreatedPurchaseOrder(
        created,
        refreshGeneratedPurchaseTitle(beforeData, applyPurchaseItemPricePatches(
          applyPurchaseSupplierPatch(
            {
              ...created,
              ownerName,
            },
            supplierId,
            supplierName,
          ),
          payload.itemPricePatches,
        )),
      );
      this.store.upsertPurchaseOrder(created);
      this.store.recordAuditLog({
        bizType: 'purchase_order',
        bizId: created.id,
        operationType: 'save_purchase_order_draft',
        operatorId: created.createdBy,
        beforeData,
        afterData: created,
      });

      return {
        id: payload.purchaseOrderId,
        status: created.status,
        ownerName,
        supplierId: created.supplierId,
        supplierName: created.supplierName,
      };
    }

    return {
      id: payload.purchaseOrderId,
      status: payload.currentStatus,
      ownerName: payload.ownerName,
      supplierId: payload.supplierId,
      supplierName: payload.supplierName,
    };
  }

  async approve(payload: PurchaseOrderTransitionPayload) {
    if (payload.currentStatus !== 'pending_purchase_manager_approval') {
      throw new BadRequestException(
        'Only pending purchase manager approval orders can be approved',
      );
    }

    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(payload.purchaseOrderId) },
      })) as PrismaBusinessDocumentRecord | null;
      if (existing?.bizType === 'purchase_order') {
        const detail = toPurchaseDocumentPayload(existing);
        if (!hasConfiguredPurchaseSupplier(detail)) {
          throw new BadRequestException('请先补充供应商后再通过采购审批');
        }
        if (!hasCompletedPurchasePrices(detail)) {
          throw new BadRequestException('请先补充采购价后再通过采购审批');
        }
      }

      const activatedPayload =
        existing?.bizType === 'purchase_order'
          ? await this.activateSubmittedPurchaseProducts(
              toPurchaseDocumentPayload(existing),
            )
          : null;
      const updated =
        existing?.bizType === 'purchase_order'
          ? await this.updatePurchaseOrderStatus({
              purchaseOrderId: payload.purchaseOrderId,
              status: 'purchasing',
              operationType: 'approve_purchase_order',
              mutate: () => ({
                ...activatedPayload!,
                status: 'purchasing',
              }),
            })
          : await this.updatePurchaseOrderStatus({
              purchaseOrderId: payload.purchaseOrderId,
              status: 'purchasing',
              operationType: 'approve_purchase_order',
            });
      if (updated) {
        await this.syncSourceSalesOrderPurchaseStatus({
          salesOrderId: updated.sourceSalesOrderId,
          purchaseAggregateStatus: 'approved',
          operatorId: updated.createdBy,
        });
      }

      return {
        id: payload.purchaseOrderId,
        status: 'purchasing',
      };
    }

    const created = this.store.getPurchaseOrder(payload.purchaseOrderId);
    if (created) {
      if (!hasConfiguredPurchaseSupplier(created)) {
        throw new BadRequestException('请先补充供应商后再通过采购审批');
      }
      if (!hasCompletedPurchasePrices(created)) {
        throw new BadRequestException('请先补充采购价后再通过采购审批');
      }

      const beforeData = snapshotAuditData(created);
      const activatedPayload = await this.activateSubmittedPurchaseProducts(created);
      updateCreatedPurchaseOrder(activatedPayload, { status: 'purchasing' });
      updateCreatedPurchaseOrder(created, activatedPayload);
      this.store.upsertPurchaseOrder(created);
      this.store.recordAuditLog({
        bizType: 'purchase_order',
        bizId: created.id,
        operationType: 'approve_purchase_order',
        operatorId: created.createdBy,
        beforeData,
        afterData: activatedPayload,
      });
      await this.syncSourceSalesOrderPurchaseStatus({
        salesOrderId: created.sourceSalesOrderId,
        purchaseAggregateStatus: 'approved',
        operatorId: created.createdBy,
      });
    }

    return {
      id: payload.purchaseOrderId,
      status: 'purchasing',
    };
  }

  async reject(payload: PurchaseOrderTransitionPayload) {
    if (payload.currentStatus !== 'pending_purchase_manager_approval') {
      throw new BadRequestException(
        'Only pending purchase manager approval orders can be rejected',
      );
    }

    if (this.shouldUsePrisma()) {
      await this.updatePurchaseOrderStatus({
        purchaseOrderId: payload.purchaseOrderId,
        status: 'draft',
        operationType: 'reject_purchase_order',
      });

      return {
        id: payload.purchaseOrderId,
        status: 'draft',
      };
    }

    const created = this.store.getPurchaseOrder(payload.purchaseOrderId);
    if (created) {
      const beforeData = snapshotAuditData(created);
      updateCreatedPurchaseOrder(created, { status: 'draft' });
      this.store.upsertPurchaseOrder(created);
      this.store.recordAuditLog({
        bizType: 'purchase_order',
        bizId: created.id,
        operationType: 'reject_purchase_order',
        operatorId: created.createdBy,
        beforeData,
        afterData: created,
      });
    }

    return {
      id: payload.purchaseOrderId,
      status: 'draft',
    };
  }

  async resubmit(payload: ResubmitPurchaseOrderPayload) {
    if (payload.currentStatus !== 'purchasing') {
      throw new BadRequestException(
        'Only purchasing purchase orders can be resubmitted',
      );
    }

    if (payload.hasShipmentBatches) {
      throw new BadRequestException(
        'Cannot resubmit after shipment has started',
      );
    }

    if (this.shouldUsePrisma()) {
      const updated = await this.updatePurchaseOrderStatus({
        purchaseOrderId: payload.purchaseOrderId,
        status: 'pending_purchase_manager_approval',
        operationType: 'resubmit_purchase_order',
        mutate: (record) => ({
          ...record,
          supplierId: payload.supplierId,
          supplierName: resolveSupplierName(payload.supplierId),
          currentVersionNo: record.currentVersionNo + 1,
          versionHistory: [
            ...record.versionHistory,
            createPurchaseOrderVersionHistoryEntry({
              versionNo: record.currentVersionNo + 1,
              status: 'pending_purchase_manager_approval',
              createdAt: '2026-07-11T10:45:00.000Z',
              changeReason: payload.changeReason,
            }),
          ],
        }),
      });

      return {
        id: payload.purchaseOrderId,
        status: 'pending_purchase_manager_approval',
        nextVersionNo: updated?.currentVersionNo ?? 2,
        sourceSalesOrderId: payload.sourceSalesOrderId,
        supplierId: payload.supplierId,
        changeReason: payload.changeReason,
      };
    }

    const created = this.store.getPurchaseOrder(payload.purchaseOrderId);
    if (created) {
      const beforeData = snapshotAuditData(created);
      updateCreatedPurchaseOrder(created, {
        status: 'pending_purchase_manager_approval',
        currentVersionNo: created.currentVersionNo + 1,
        versionHistory: [
          ...created.versionHistory,
          createPurchaseOrderVersionHistoryEntry({
            versionNo: created.currentVersionNo + 1,
            status: 'pending_purchase_manager_approval',
            createdAt: '2026-07-11T10:45:00.000Z',
            changeReason: payload.changeReason,
          }),
        ],
      });
      this.store.upsertPurchaseOrder(created);
      this.store.recordAuditLog({
        bizType: 'purchase_order',
        bizId: created.id,
        operationType: 'resubmit_purchase_order',
        operatorId: created.createdBy,
        beforeData,
        afterData: created,
      });
    }

    return {
      id: payload.purchaseOrderId,
      status: 'pending_purchase_manager_approval',
      nextVersionNo: created?.currentVersionNo ?? 2,
      sourceSalesOrderId: payload.sourceSalesOrderId,
      supplierId: payload.supplierId,
      changeReason: payload.changeReason,
    };
  }

  async cancel(payload: CancelPurchaseOrderPayload) {
    if (payload.currentStatus !== 'purchasing') {
      throw new BadRequestException(
        'Only purchasing purchase orders can be cancelled',
      );
    }

    if (payload.hasShipmentBatches) {
      throw new BadRequestException('Cannot cancel after shipment has started');
    }

    if (this.shouldUsePrisma()) {
      await this.updatePurchaseOrderStatus({
        purchaseOrderId: payload.purchaseOrderId,
        status: 'void',
        operationType: 'cancel_purchase_order',
        mutate: (record) => ({
          ...record,
          cancelReason: payload.cancelReason,
          versionHistory: [
            ...record.versionHistory,
            createPurchaseOrderVersionHistoryEntry({
              versionNo: record.currentVersionNo,
              status: 'void',
              createdAt: '2026-07-11T10:30:00.000Z',
              changeReason: payload.cancelReason,
            }),
          ],
        }),
      });

      return {
        id: payload.purchaseOrderId,
        status: 'void',
        cancelReason: payload.cancelReason,
      };
    }

    const created = this.store.getPurchaseOrder(payload.purchaseOrderId);
    if (created) {
      const beforeData = snapshotAuditData(created);
      updateCreatedPurchaseOrder(created, {
        status: 'void',
        cancelReason: payload.cancelReason,
        versionHistory: [
          ...created.versionHistory,
          createPurchaseOrderVersionHistoryEntry({
            versionNo: created.currentVersionNo,
            status: 'void',
            createdAt: '2026-07-11T10:30:00.000Z',
            changeReason: payload.cancelReason,
          }),
        ],
      });
      this.store.upsertPurchaseOrder(created);
      this.store.recordAuditLog({
        bizType: 'purchase_order',
        bizId: created.id,
        operationType: 'cancel_purchase_order',
        operatorId: created.createdBy,
        beforeData,
        afterData: created,
      });
    }

    return {
      id: payload.purchaseOrderId,
      status: 'void',
      cancelReason: payload.cancelReason,
    };
  }

  async syncShipmentFulfillmentStatus(
    payload: SyncPurchaseShipmentStatusPayload,
  ) {
    if (this.shouldUsePrisma()) {
      const updated = await this.updatePurchaseOrderStatus({
        purchaseOrderId: payload.purchaseOrderId,
        status: payload.status,
        operationType: 'sync_purchase_order_shipment_status',
      });
      if (updated) {
        if (this.salesOrderService) {
          await this.syncSourceSalesOrderPurchaseStatus({
            salesOrderId: updated.sourceSalesOrderId,
            purchaseAggregateStatus:
              await this.resolveSourceSalesOrderPurchaseAggregateStatus(
                updated.sourceSalesOrderId,
              ),
            operatorId: payload.operatorId,
          });
        }
      }

      return {
        id: payload.purchaseOrderId,
        status: payload.status,
      };
    }

    const created = this.store.getPurchaseOrder(payload.purchaseOrderId);
    if (created) {
      const beforeData = snapshotAuditData(created);
      updateCreatedPurchaseOrder(created, { status: payload.status });
      this.store.upsertPurchaseOrder(created);
      this.store.recordAuditLog({
        bizType: 'purchase_order',
        bizId: created.id,
        operationType: 'sync_purchase_order_shipment_status',
        operatorId: payload.operatorId,
        beforeData,
        afterData: {
          ...created,
          syncSource: payload.source,
        },
      });
      if (this.salesOrderService) {
        await this.syncSourceSalesOrderPurchaseStatus({
          salesOrderId: created.sourceSalesOrderId,
          purchaseAggregateStatus:
            await this.resolveSourceSalesOrderPurchaseAggregateStatus(
              created.sourceSalesOrderId,
            ),
          operatorId: payload.operatorId,
        });
      }
    }

    return {
      id: payload.purchaseOrderId,
      status: payload.status,
    };
  }

  private async updatePurchaseOrderStatus(payload: {
    purchaseOrderId: number;
    status: string;
    operationType: string;
    mutate?: (record: CreatedPurchaseOrderRecord) => CreatedPurchaseOrderRecord;
  }) {
    const existing = (await this.prismaDb!.businessDocument.findUnique({
      where: { id: BigInt(payload.purchaseOrderId) },
    })) as PrismaBusinessDocumentRecord | null;

    if (!existing || existing.bizType !== 'purchase_order') {
      return undefined;
    }

    const beforeData = toPurchaseDocumentPayload(existing);
    const baseNext = {
      ...beforeData,
      status: payload.status,
    };
    const nextPayload = payload.mutate ? payload.mutate(baseNext) : baseNext;
    const updated = (await this.prismaDb!.businessDocument.update({
      where: { id: existing.id },
      data: {
        status: payload.status,
        payload: nextPayload,
      },
    })) as PrismaBusinessDocumentRecord;

    await this.prismaDb!.operationLog.create({
      data: {
        bizType: 'purchase_order',
        bizId: updated.id,
        operationType: payload.operationType,
        operatorId: existing.createdBy ?? 0n,
        beforeData,
        afterData: nextPayload,
      },
    });

    return nextPayload;
  }
}
