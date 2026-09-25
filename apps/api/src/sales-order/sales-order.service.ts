import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  buildSequentialDocumentCode,
  normalizeSalesDocumentSourceMode,
  resolveSalesDocumentSourceMode,
  type SalesOrderListItem,
  SalesOrderListQuery,
  SalesOrderListResponse,
} from '@erp/shared';
import {
  type FormalSession,
  filterVisibleFormalItems,
  isFormalAdminOrBoss,
  matchesFormalUser,
} from '../auth/formal-session';
import { CreateDirectSalesOrderDto } from './dto/create-direct-sales-order.dto';
import { UpdateSalesOrderDraftDto } from './dto/update-sales-order-draft.dto';
import { salesOrderListData } from './sales-order-list.data';
import { resolveSalesOrderStore } from './sales-order.store';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import { resolveQuoteStore } from '../quote/quote.store';
import {
  CounterpartyService,
  type CounterpartyRecord,
} from '../counterparty/counterparty.service';
import { ProductService } from '../product/product.service';
import { isQuoteConvertibleToSales } from '../quote/quote-workflow';

export type ConvertConfirmedQuotePayload = {
  quoteOrderId: number;
  quoteVersionNo: number;
  customerId: number;
  customerName?: string;
  customerFullName?: string;
  customerCode?: string;
  customerEntryMode?: 'existing' | 'manual';
  sourceQuoteNo?: string;
  sourceDocumentType?: 'demand' | 'quote';
  sourceCode?: string;
  inquiryDate?: string;
  destination?: string;
  requirements?: string;
  createdBy: number;
  existingSalesOrderId?: number | null;
  quoteConfirmed?: boolean;
  items?: Array<{
    lineNo: number;
    productId?: number;
    sku: string;
    productName: string;
    unit: string;
    quantity: number;
    salePrice: number;
    amount?: number;
    imageUrls?: string[];
    confirmedSupplierId?: number;
    confirmedSupplierCode?: string;
    confirmedSupplierName?: string;
    confirmedPurchasePrice?: number;
    confirmedProductId?: number;
    cartonQuantity?: number;
    outerCartonSizeCm?: string;
    outerCartonGrossWeightKg?: number;
  }>;
  quoteAttachments?: Array<{
    key?: string;
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
};

export type SalesOrderTransitionPayload = {
  salesOrderId: number;
  currentStatus: string;
};

export type SalesOrderLineItem = {
  lineNo: number;
  sourceQuoteLineNo?: number;
  productId: number;
  sku: string;
  productName: string;
  unit: string;
  quantity: number;
  packageQuantity?: number;
  unitsPerPackage?: number;
  cartonQuantity?: number;
  outerCartonSizeCm?: string;
  outerCartonGrossWeightKg?: number;
  totalQuantity?: number;
  salePrice: number;
  amount: number;
  factoryPicUrls?: string[];
  confirmedSupplierId?: number;
  confirmedSupplierCode?: string;
  confirmedSupplierName?: string;
  confirmedPurchasePrice?: number;
  confirmedProductId?: number;
};

function buildDefaultSalesOrderTitle(
  salesNo: string,
  items: SalesOrderLineItem[] | undefined,
  customerName: string,
): string {
  const productNames = (items ?? [])
    .map((item) => item.productName?.trim())
    .filter((name): name is string => Boolean(name));
  return [salesNo, ...productNames, customerName.trim()].join('-');
}

function resolveDraftSalesOrderTitle(
  existing: SalesOrderRecord,
  submittedTitle: string | undefined,
  items: SalesOrderLineItem[] | undefined,
  customerName: string,
): string {
  const previousDefault = buildDefaultSalesOrderTitle(
    existing.salesNo,
    existing.items,
    existing.customerName,
  );
  const title = submittedTitle?.trim();
  if (title && title !== existing.title) {
    return title;
  }
  return !title || existing.title === previousDefault
    ? buildDefaultSalesOrderTitle(existing.salesNo, items, customerName)
    : existing.title;
}

export type SalesOrderAttachmentInfo = {
  key?: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

export type SalesOrderVersionHistoryEntry = {
  versionNo: number;
  status: string;
  createdAt: string;
  changeReason?: string;
};

export type BaseSalesOrderRecord = {
  id: number;
  salesNo: string;
  status: string;
  currentVersionNo: number;
  purchaseAggregateStatus: string;
  shipmentAggregateStatus: string;
  stockOutStatus?: string;
  stockOutDocNo?: string | null;
  receiptSendStatus: string;
  afterSalesEndStatus: string;
  receiptStatus: string;
  financeStatus: string;
  createdBy: number;
  createdAt: string;
  customerOrderNo?: string;
  orderingUnit?: string;
  storeName?: string;
  orderDate?: string;
  estimatedDeliveryDate?: string;
  shipTo?: string;
  salesOrderAttachment?: string;
  salesOrderRemark?: string;
  salesOrderAttachments?: SalesOrderAttachmentInfo[];
  cancelReason?: string;
  autoVoidedPurchaseOrderIds?: number[];
  versionHistory: SalesOrderVersionHistoryEntry[];
  items?: SalesOrderLineItem[];
  purchaseOwnerName?: string;
  sourceInquiryId?: number;
};

export type CreatedSalesOrderRecord = BaseSalesOrderRecord & {
  sourceMode: 'direct';
  customerId?: number;
  customerName: string;
  customerFullName?: string;
  customerCode?: string;
  customerEntryMode?: 'existing' | 'manual';
  title: string;
  salesUserId: number;
};

export type ConvertedSalesOrderRecord = BaseSalesOrderRecord & {
  sourceMode: 'from_quote';
  customerId: number;
  customerName: string;
  customerFullName?: string;
  customerCode?: string;
  customerEntryMode?: 'existing' | 'manual';
  title: string;
  salesUserId: number;
  sourceQuoteOrderId: number;
  sourceQuoteVersionNo: number;
  sourceQuoteNo?: string;
  sourceDocumentType?: 'demand' | 'quote';
};

export type SalesOrderRecord = CreatedSalesOrderRecord | ConvertedSalesOrderRecord;

type PrismaBusinessDocumentRecord = {
  id: bigint;
  bizType: string;
  docNo: string;
  status: string;
  ownerUserId: bigint | null;
  counterpartyId: bigint | null;
  payload: SalesOrderRecord;
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

type PrismaSalesDb = PrismaService & {
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

type SourceQuoteLineSelection = {
  lineNo?: number;
  productId?: number;
  confirmedSupplierId?: number;
  confirmedSupplierCode?: string;
  confirmedSupplierName?: string;
  confirmedPurchasePrice?: number;
  confirmedProductId?: number;
  cartonQuantity?: number;
  outerCartonSizeCm?: string;
  outerCartonGrossWeightKg?: number;
};

type SourceQuoteDocumentRecord = {
  id?: bigint;
  docNo?: string;
  bizType: string;
  status: string;
  payload?: {
    id?: number;
    quoteNo?: string;
    documentType?: 'demand' | 'quote';
    status?: string;
    currentVersionNo?: number;
    linkedSalesOrderId?: number;
    linkedSalesOrderNo?: string;
    items?: SourceQuoteLineSelection[];
  };
};

type ResubmitPayload = SalesOrderTransitionPayload & {
  changeReason: string;
  hasShipmentBatches: boolean;
};

type CancelPayload = SalesOrderTransitionPayload & {
  hasShipmentBatches: boolean;
  unshippedPurchaseOrderIds: number[];
  cancelReason: string;
};

type SyncOperationalAggregatesPayload = {
  salesOrderId: number;
  purchaseAggregateStatus?: string;
  shipmentAggregateStatus?: string;
  receiptSendStatus?: string;
  afterSalesEndStatus?: string;
  receiptStatus?: string;
  financeStatus?: string;
  operatorId?: number;
  source?: string;
};

function resolveSalesUserName(userId: number) {
  if (userId === 3 || userId === 2001) {
    return 'Zoe';
  }

  if (userId === 4 || userId === 2002) {
    return 'Leo';
  }

  if (userId === 1) {
    return 'Admin';
  }

  return 'Mia';
}

function resolveSalesOrderSourceSummary(
  item: CreatedSalesOrderRecord | ConvertedSalesOrderRecord,
) {
  if (item.sourceMode === 'direct') {
    return 'DIRECT / 直建';
  }

  if (item.sourceDocumentType === 'demand') {
    return 'DEMAND / 需求转单';
  }

  return 'QUOTE / 报价转单';
}

function toSalesOrderListItem(
  item: CreatedSalesOrderRecord | ConvertedSalesOrderRecord,
): SalesOrderListItem {
  return {
    moduleLabel: '销售订单',
    docNo: item.salesNo,
    title: item.title,
    status: item.status,
    secondaryStatus: item.status,
    counterpartyName: item.customerName,
    counterpartyFullName: item.customerFullName,
    customerOrderNo: item.customerOrderNo,
    storeName: item.storeName,
    orderDate: item.orderDate,
    estimatedDeliveryDate: item.estimatedDeliveryDate,
    ownerName: resolveSalesUserName(item.salesUserId),
    createdAt: item.createdAt,
    detailHref: `/sales-orders/${item.id}`,
    createdBy: resolveSalesUserName(item.createdBy),
    approvalStatus: item.status,
    fulfillmentStatus: item.shipmentAggregateStatus,
    receiptStatus: item.receiptStatus,
    financeConfirmStatus: item.financeStatus,
    hasAfterSales: item.afterSalesEndStatus !== 'not_started',
    sourceSummary: resolveSalesOrderSourceSummary(item),
  };
}

function normalizeOptionalPositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeSalesOrderItems(
  items: ConvertConfirmedQuotePayload['items'],
): SalesOrderLineItem[] {
  return (items ?? []).map((item) => {
    const quantity = Number(item.quantity);
    const salePrice = Number(item.salePrice);
    const amount =
      item.amount != null ? Number(item.amount) : Number((quantity * salePrice).toFixed(2));

    return {
      lineNo: Number(item.lineNo),
      sourceQuoteLineNo: Number(item.lineNo),
      productId: Number(item.productId),
      sku: item.sku,
      productName: item.productName,
      unit: item.unit,
      quantity,
      packageQuantity: 1,
      unitsPerPackage: quantity,
      cartonQuantity: item.cartonQuantity,
      outerCartonSizeCm: item.outerCartonSizeCm,
      outerCartonGrossWeightKg: item.outerCartonGrossWeightKg,
      totalQuantity: quantity,
      salePrice,
      amount,
      confirmedSupplierId:
        Number.isFinite(Number(item.confirmedSupplierId)) &&
        Number(item.confirmedSupplierId) > 0
          ? Number(item.confirmedSupplierId)
          : undefined,
      confirmedSupplierCode:
        typeof item.confirmedSupplierCode === 'string'
          ? item.confirmedSupplierCode.trim() || undefined
          : undefined,
      confirmedSupplierName:
        typeof item.confirmedSupplierName === 'string'
          ? item.confirmedSupplierName.trim() || undefined
          : undefined,
      confirmedPurchasePrice:
        Number.isFinite(Number(item.confirmedPurchasePrice)) &&
        Number(item.confirmedPurchasePrice) > 0
          ? Number(item.confirmedPurchasePrice)
          : undefined,
      confirmedProductId:
        Number.isFinite(Number(item.confirmedProductId)) &&
        Number(item.confirmedProductId) > 0
          ? Number(item.confirmedProductId)
          : undefined,
      factoryPicUrls: Array.isArray(
        (item as { factoryPicUrls?: string[] }).factoryPicUrls,
      )
        ? (item as { factoryPicUrls?: string[] }).factoryPicUrls!
            .filter((entry) => entry.trim())
            .map((entry) => entry.trim())
        : Array.isArray(item.imageUrls)
          ? item.imageUrls.filter((entry) => entry.trim()).map((entry) => entry.trim())
        : [],
    };
  });
}

function normalizeDirectSalesOrderItems(
  items: CreateDirectSalesOrderDto['items'],
): SalesOrderLineItem[] {
  return (items ?? [])
    .map((item, index): SalesOrderLineItem | null => {
      const sku = item.sku?.trim() ?? '';
      const productName = item.productName?.trim() ?? '';
      const unit = item.unit?.trim() || '个/pc';
      const packageQuantity = Number(item.packageQuantity ?? item.quantity ?? 0);
      const unitsPerPackage = Number(item.unitsPerPackage ?? 1);
      const providedTotalQuantity = Number(item.totalQuantity ?? item.quantity ?? 0);
      const totalQuantity =
        Number.isFinite(providedTotalQuantity) && providedTotalQuantity > 0
          ? providedTotalQuantity
          : packageQuantity * unitsPerPackage;
      const salePrice = Number(item.salePrice ?? 0);
      const amount =
        item.amount != null
          ? Number(item.amount)
          : Number((totalQuantity * salePrice).toFixed(2));

      if (
        !sku ||
        !productName ||
        !Number.isFinite(totalQuantity) ||
        totalQuantity <= 0
      ) {
        return null;
      }

      return {
        lineNo: Number.isFinite(Number(item.lineNo)) ? Number(item.lineNo) : index + 1,
        productId: Number.isFinite(Number(item.productId)) ? Number(item.productId) : 0,
        sku,
        productName,
        unit,
        quantity: totalQuantity,
        packageQuantity:
          Number.isFinite(packageQuantity) && packageQuantity > 0
            ? packageQuantity
            : totalQuantity,
        unitsPerPackage:
          Number.isFinite(unitsPerPackage) && unitsPerPackage > 0
            ? unitsPerPackage
            : totalQuantity,
        totalQuantity,
        cartonQuantity: item.cartonQuantity,
        outerCartonSizeCm: item.outerCartonSizeCm,
        outerCartonGrossWeightKg: item.outerCartonGrossWeightKg,
        salePrice: Number.isFinite(salePrice) ? salePrice : 0,
        amount: Number.isFinite(amount)
          ? amount
          : Number((totalQuantity * (Number.isFinite(salePrice) ? salePrice : 0)).toFixed(2)),
        factoryPicUrls: Array.isArray(item.factoryPicUrls)
          ? item.factoryPicUrls
              .filter((entry): entry is string => typeof entry === 'string')
              .map((entry) => entry.trim())
              .filter(Boolean)
          : [],
      };
    })
    .filter((item): item is SalesOrderLineItem => item !== null);
}

function normalizeSalesOrderAttachments(
  attachments: CreateDirectSalesOrderDto['salesOrderAttachments'],
): SalesOrderAttachmentInfo[] {
  return (attachments ?? [])
    .map((attachment) => {
      const fileName = attachment.fileName?.trim();
      const mimeType = attachment.mimeType?.trim();
      const url = attachment.url?.trim();
      const size = Number(attachment.size);

      if (!fileName || !mimeType || !url || !Number.isFinite(size) || size < 0) {
        return null;
      }

      return {
        ...(attachment.key?.trim() ? { key: attachment.key.trim() } : {}),
        fileName,
        mimeType,
        size,
        url,
      };
    })
    .filter((attachment): attachment is SalesOrderAttachmentInfo => attachment !== null);
}

async function resolveDirectSalesOrderCustomer(
  dto: CreateDirectSalesOrderDto,
  counterpartyService: CounterpartyService,
) {
  const entryMode = dto.customerEntryMode === 'manual' ? 'manual' : 'existing';

  if (entryMode === 'manual') {
    const customerName = dto.customerName?.trim() ?? '';
    const customerCode = dto.customerCode?.trim().toUpperCase() ?? '';

    if (!customerName) {
      throw new BadRequestException('手填订货单位时，客户名称不能为空');
    }

    return {
      customerId: dto.customerId ?? 0,
      customerName,
      customerCode,
      customerEntryMode: 'manual' as const,
    };
  }

  const customerId = Number(dto.customerId ?? 0);
  const matchedCounterparty = await counterpartyService.findById(customerId);

  if (matchedCounterparty) {
    if (matchedCounterparty.type === 'supplier') {
      throw new BadRequestException('销售单订货单位只能选择客户类往来单位');
    }

    return {
      customerId: matchedCounterparty.id,
      customerName: matchedCounterparty.name,
      customerCode: matchedCounterparty.code,
      customerEntryMode: 'existing' as const,
    };
  }

  return {
    customerId,
    customerName: dto.customerName?.trim() || `客户 ${dto.customerId}`,
    customerCode: dto.customerCode?.trim().toUpperCase() ?? '',
    customerEntryMode: 'existing' as const,
  };
}

function hasOwnField<T extends object>(value: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

async function findOrCreateManualCustomerCounterparty(
  counterpartyService: CounterpartyService,
  payload: {
    customerCode: string;
    customerName: string;
    ownerName: string;
    createdBy: string;
    remark: string;
  },
): Promise<CounterpartyRecord> {
  const customerCode = payload.customerCode.trim().toUpperCase();
  const existingCounterparty = await counterpartyService.findByCode(customerCode);

  if (existingCounterparty) {
    if (
      existingCounterparty.type === 'customer' ||
      existingCounterparty.type === 'both'
    ) {
      return existingCounterparty;
    }

    throw new BadRequestException(
      '该编码已被供应商往来单位占用，请更换客户编码或从客户主数据选择',
    );
  }

  return counterpartyService.create({
    type: 'customer',
    code: customerCode,
    name: payload.customerName,
    shortName: payload.customerName,
    region: '',
    ownerName: payload.ownerName,
    contactName: '',
    phone: '',
    address: '',
    bankName: '',
    bankAccount: '',
    remark: payload.remark,
    createdBy: payload.createdBy,
  });
}

function resolveOptionalDraftText<T extends object>(
  dto: T,
  key: keyof T,
  fallback: string | undefined,
) {
  if (!hasOwnField(dto, key)) {
    return fallback;
  }

  const value = dto[key];
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function createSalesOrderVersionHistoryEntry(payload: {
  versionNo: number;
  status: string;
  createdAt: string;
  changeReason?: string;
}): SalesOrderVersionHistoryEntry {
  return {
    versionNo: payload.versionNo,
    status: payload.status,
    createdAt: payload.createdAt,
    changeReason: payload.changeReason,
  };
}

function isSalesOrderInternalFulfillmentClosed(status: string | undefined) {
  return (
    status === 'to_forwarder' ||
    status === 'forwarder_shipped' ||
    status === 'arrived' ||
    status === 'closed'
  );
}

function canAutoCloseSalesOrderStatus(status: string | undefined) {
  return (
    status === 'purchasing' ||
    status === 'partial_purchasing' ||
    status === 'partial_shipped' ||
    status === 'shipped' ||
    status === 'partial_to_forwarder' ||
    status === 'to_forwarder' ||
    status === 'partial_forwarder_shipped' ||
    status === 'forwarder_shipped' ||
    status === 'partial_arrived' ||
    status === 'arrived'
  );
}

function resolveSalesOrderEffectiveStatus(record: SalesOrderRecord) {
  if (
    canAutoCloseSalesOrderStatus(record.status) &&
    isSalesOrderInternalFulfillmentClosed(record.shipmentAggregateStatus)
  ) {
    return 'closed';
  }

  return record.status;
}

function withSalesOrderEffectiveStatus<T extends SalesOrderRecord>(record: T): T {
  const status = resolveSalesOrderEffectiveStatus(record);
  return status === record.status ? record : ({ ...record, status } as T);
}

function toSalesOrderDocumentPayload(
  record: PrismaBusinessDocumentRecord,
): SalesOrderRecord {
  return {
    ...record.payload,
    id: Number(record.payload.id ?? record.id),
    salesNo: record.docNo,
    status: record.status,
    currentVersionNo: record.payload.currentVersionNo ?? 1,
    purchaseAggregateStatus: record.payload.purchaseAggregateStatus ?? 'not_started',
    shipmentAggregateStatus: record.payload.shipmentAggregateStatus ?? 'not_started',
    stockOutStatus: record.payload.stockOutStatus ?? 'not_started',
    stockOutDocNo: record.payload.stockOutDocNo ?? null,
    receiptSendStatus: record.payload.receiptSendStatus ?? 'pending',
    afterSalesEndStatus: record.payload.afterSalesEndStatus ?? 'not_started',
    receiptStatus: record.payload.receiptStatus ?? 'unpaid',
    financeStatus: record.payload.financeStatus ?? 'pending',
    createdBy: Number(record.payload.createdBy),
    createdAt: record.payload.createdAt ?? record.createdAt.toISOString(),
    versionHistory: Array.isArray(record.payload.versionHistory)
      ? record.payload.versionHistory.map((item) => ({ ...item }))
      : [],
    salesOrderAttachments: Array.isArray(record.payload.salesOrderAttachments)
      ? record.payload.salesOrderAttachments.map((item) => ({ ...item }))
      : [],
    items: Array.isArray(record.payload.items)
      ? record.payload.items.map((item) => ({ ...item }))
      : [],
  } as SalesOrderRecord;
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
export class SalesOrderService {
  private readonly store = resolveSalesOrderStore();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  private get prismaDb() {
    return this.prisma as PrismaSalesDb | undefined;
  }

  async create(dto: CreateDirectSalesOrderDto): Promise<CreatedSalesOrderRecord> {
    const counterpartyService = new CounterpartyService(this.prisma);
    const salesOrderCustomer = await resolveDirectSalesOrderCustomer(
      dto,
      counterpartyService,
    );
    let customerId = salesOrderCustomer.customerId;
    let customerName = salesOrderCustomer.customerName;
    let customerCode = salesOrderCustomer.customerCode;

    if (
      salesOrderCustomer.customerEntryMode === 'manual' &&
      dto.saveManualCustomerToCounterparty
    ) {
      if (!customerCode) {
        throw new BadRequestException('保存到往来单位时，客户编码不能为空');
      }

      const syncedCounterparty = await findOrCreateManualCustomerCounterparty(
        counterpartyService,
        {
          customerCode,
          customerName,
          ownerName: resolveSalesUserName(dto.salesUserId),
          remark: '由正式销售单手填订货单位同步创建',
          createdBy: resolveSalesUserName(dto.salesUserId),
        },
      );

      customerId = syncedCounterparty.id;
      customerName = syncedCounterparty.name;
      customerCode = syncedCounterparty.code;
    }

    const salesOrderRemark =
      dto.salesOrderRemark?.trim() || dto.salesOrderAttachment?.trim() || undefined;
    const salesOrderAttachments = normalizeSalesOrderAttachments(dto.salesOrderAttachments);
    const items = normalizeDirectSalesOrderItems(dto.items);
    const createdAt = new Date().toISOString();

    if (this.shouldUsePrisma()) {
      const payload: CreatedSalesOrderRecord = {
        id: 0,
        salesNo: 'PENDING-SALES',
        status: 'draft',
        currentVersionNo: 1,
        purchaseAggregateStatus: 'not_started',
        shipmentAggregateStatus: 'not_started',
        receiptSendStatus: 'pending',
        afterSalesEndStatus: 'not_started',
        receiptStatus: 'unpaid',
        financeStatus: 'pending',
        versionHistory: [
          createSalesOrderVersionHistoryEntry({
            versionNo: 1,
            status: 'draft',
            createdAt,
          }),
        ],
        sourceMode: 'direct',
        customerId,
        customerName,
        customerCode,
        customerEntryMode: salesOrderCustomer.customerEntryMode,
        orderingUnit: dto.orderingUnit?.trim() || customerName,
        customerOrderNo: dto.customerOrderNo?.trim() || undefined,
        storeName: dto.storeName?.trim() || undefined,
        orderDate: dto.orderDate?.trim() || undefined,
        estimatedDeliveryDate: dto.estimatedDeliveryDate?.trim() || undefined,
        shipTo: dto.shipTo?.trim() || undefined,
        salesOrderAttachment: dto.salesOrderAttachment?.trim() || undefined,
        salesOrderRemark,
        salesOrderAttachments,
        items,
        title: dto.title,
        salesUserId: dto.salesUserId,
        createdBy: dto.createdBy,
        createdAt,
      };
      const created = (await this.prismaDb!.businessDocument.create({
        data: {
          bizType: 'sales_order',
          docNo: `PENDING-SALES-${Date.now()}`,
          status: 'draft',
          ownerUserId: BigInt(dto.salesUserId),
          counterpartyId: customerId > 0 ? BigInt(customerId) : null,
          payload,
          createdBy: BigInt(dto.createdBy),
        },
      })) as PrismaBusinessDocumentRecord;
      const finalPayload: CreatedSalesOrderRecord = {
        ...payload,
        id: Number(created.id),
        salesNo: buildSequentialDocumentCode('S', Number(created.id), createdAt),
        customerOrderNo: dto.customerOrderNo?.trim() || buildSequentialDocumentCode('S', Number(created.id), createdAt),
        title: dto.title?.trim() || buildDefaultSalesOrderTitle(
          buildSequentialDocumentCode('S', Number(created.id), createdAt), items, customerName,
        ),
      };
      const updated = (await this.prismaDb!.businessDocument.update({
        where: { id: created.id },
        data: {
          docNo: finalPayload.salesNo,
          payload: finalPayload,
        },
      })) as PrismaBusinessDocumentRecord;
      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'sales_order',
          bizId: updated.id,
          operationType: 'create_sales_order',
          operatorId: BigInt(dto.createdBy),
          beforeData: undefined,
          afterData: finalPayload,
        },
      });

      if (dto.submitMode === 'submit') {
        await this.submit({
          salesOrderId: finalPayload.id,
          currentStatus: 'draft',
        });

        return {
          ...finalPayload,
          status: 'pending_sales_manager_approval',
          versionHistory: [
            ...finalPayload.versionHistory,
            createSalesOrderVersionHistoryEntry({
              versionNo: finalPayload.currentVersionNo,
              status: 'pending_sales_manager_approval',
              createdAt: new Date().toISOString(),
            }),
          ],
        };
      }

      return finalPayload;
    }

    const id = this.store.nextSalesOrderId();
    const salesNo = buildSequentialDocumentCode('S', id, createdAt);
    const created: CreatedSalesOrderRecord = {
      id,
      salesNo,
      status: 'draft',
      currentVersionNo: 1,
      purchaseAggregateStatus: 'not_started',
      shipmentAggregateStatus: 'not_started',
      receiptSendStatus: 'pending',
      afterSalesEndStatus: 'not_started',
      receiptStatus: 'unpaid',
      financeStatus: 'pending',
      versionHistory: [
        createSalesOrderVersionHistoryEntry({
          versionNo: 1,
          status: 'draft',
          createdAt,
        }),
      ],
      sourceMode: 'direct',
      customerId,
      customerName,
      customerCode,
      customerEntryMode: salesOrderCustomer.customerEntryMode,
      orderingUnit: dto.orderingUnit?.trim() || customerName,
      customerOrderNo: dto.customerOrderNo?.trim() || salesNo,
      storeName: dto.storeName?.trim() || undefined,
      orderDate: dto.orderDate?.trim() || undefined,
      estimatedDeliveryDate: dto.estimatedDeliveryDate?.trim() || undefined,
      shipTo: dto.shipTo?.trim() || undefined,
      salesOrderAttachment: dto.salesOrderAttachment?.trim() || undefined,
      salesOrderRemark,
      salesOrderAttachments,
      items,
      title: dto.title?.trim() || buildDefaultSalesOrderTitle(salesNo, items, customerName),
      salesUserId: dto.salesUserId,
      createdBy: dto.createdBy,
      createdAt,
    };

    this.store.upsertSalesOrder(created);
    this.store.recordAuditLog({
      bizType: 'sales_order',
      bizId: created.id,
      operationType: 'create_sales_order',
      operatorId: dto.createdBy,
      beforeData: null,
      afterData: created,
    });

    if (dto.submitMode === 'submit') {
      await this.submit({
        salesOrderId: created.id,
        currentStatus: 'draft',
      });

      const submitted = this.store.getSalesOrder(created.id);
      return submitted?.sourceMode === 'direct' ? submitted : {
        ...created,
        status: 'pending_sales_manager_approval',
      };
    }

    return created;
  }

  async updateDraft(
    salesOrderId: number,
    dto: UpdateSalesOrderDraftDto,
  ): Promise<SalesOrderRecord> {
    const prismaRecord = this.shouldUsePrisma()
      ? ((await this.prismaDb!.businessDocument.findUnique({
          where: { id: BigInt(salesOrderId) },
        })) as PrismaBusinessDocumentRecord | null)
      : null;
    const existing = this.shouldUsePrisma()
      ? prismaRecord && prismaRecord.bizType === 'sales_order'
        ? toSalesOrderDocumentPayload(prismaRecord)
        : null
      : this.store.getSalesOrder(salesOrderId);

    if (!existing) {
      throw new NotFoundException('销售单不存在');
    }

    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      throw new BadRequestException('只有草稿或已驳回销售单可以继续保存草稿');
    }

    const existingDraftMeta = existing as SalesOrderRecord & {
      customerEntryMode?: 'existing' | 'manual';
      customerCode?: string;
    };
    const effectiveDto = {
      ...dto,
      customerEntryMode: dto.customerEntryMode ?? existingDraftMeta.customerEntryMode,
      customerId: dto.customerId ?? existing.customerId,
      customerName: dto.customerName ?? existing.customerName,
      customerCode: dto.customerCode ?? existingDraftMeta.customerCode,
      orderingUnit: dto.orderingUnit ?? existing.orderingUnit,
      title: dto.title ?? existing.title,
      salesUserId: dto.salesUserId ?? existing.salesUserId,
      createdBy: dto.createdBy ?? existing.createdBy,
    } as UpdateSalesOrderDraftDto;
    const counterpartyService = new CounterpartyService(this.prisma);
    const salesOrderCustomer = await resolveDirectSalesOrderCustomer(
      effectiveDto,
      counterpartyService,
    );
    let customerId = salesOrderCustomer.customerId;
    let customerName = salesOrderCustomer.customerName;
    let customerCode = salesOrderCustomer.customerCode;
    const operatorId = effectiveDto.createdBy;

    if (
      salesOrderCustomer.customerEntryMode === 'manual' &&
      effectiveDto.saveManualCustomerToCounterparty
    ) {
      if (!customerCode) {
        throw new BadRequestException('保存到往来单位时，客户编码不能为空');
      }

      const syncedCounterparty = await findOrCreateManualCustomerCounterparty(
        counterpartyService,
        {
          customerCode,
          customerName,
          ownerName: resolveSalesUserName(effectiveDto.salesUserId),
          remark: '由正式销售单草稿手填订货单位同步创建',
          createdBy: resolveSalesUserName(effectiveDto.salesUserId),
        },
      );

      customerId = syncedCounterparty.id;
      customerName = syncedCounterparty.name;
      customerCode = syncedCounterparty.code;
    }

    const salesOrderRemark =
      hasOwnField(dto, 'salesOrderRemark') || hasOwnField(dto, 'salesOrderAttachment')
        ? dto.salesOrderRemark?.trim() || dto.salesOrderAttachment?.trim() || undefined
        : existing.salesOrderRemark;
    const salesOrderAttachments = Array.isArray(dto.salesOrderAttachments)
      ? normalizeSalesOrderAttachments(dto.salesOrderAttachments)
      : existing.salesOrderAttachments;
    const items = Array.isArray(dto.items)
      ? normalizeDirectSalesOrderItems(dto.items)
      : existing.items;
    const customerOrderNo = hasOwnField(dto, 'customerOrderNo')
      ? dto.customerOrderNo?.trim() || existing.salesNo
      : existing.customerOrderNo || existing.salesNo;
    const title = resolveDraftSalesOrderTitle(existing, dto.title, items, customerName);

    if (this.shouldUsePrisma()) {
      const beforeData = existing;
      const nextPayload = {
        ...beforeData,
        status: beforeData.status,
        customerId,
        customerName,
        customerCode,
        customerEntryMode: salesOrderCustomer.customerEntryMode,
        orderingUnit:
          resolveOptionalDraftText(dto, 'orderingUnit', beforeData.orderingUnit) ||
          customerName,
        customerOrderNo,
        storeName: resolveOptionalDraftText(dto, 'storeName', beforeData.storeName),
        orderDate: resolveOptionalDraftText(dto, 'orderDate', beforeData.orderDate),
        estimatedDeliveryDate: resolveOptionalDraftText(
          dto,
          'estimatedDeliveryDate',
          beforeData.estimatedDeliveryDate,
        ),
        shipTo: resolveOptionalDraftText(dto, 'shipTo', beforeData.shipTo),
        salesOrderAttachment: resolveOptionalDraftText(
          dto,
          'salesOrderAttachment',
          beforeData.salesOrderAttachment,
        ),
        salesOrderRemark,
        salesOrderAttachments,
        items,
        title,
        salesUserId: effectiveDto.salesUserId,
      } as SalesOrderRecord;
      const updated = (await this.prismaDb!.businessDocument.update({
        where: { id: prismaRecord!.id },
        data: {
          status: nextPayload.status,
          ownerUserId: BigInt(effectiveDto.salesUserId),
          counterpartyId: customerId > 0 ? BigInt(customerId) : null,
          payload: nextPayload,
        },
      })) as PrismaBusinessDocumentRecord;

      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'sales_order',
          bizId: updated.id,
          operationType: 'update_sales_order_draft',
          operatorId: BigInt(operatorId),
          beforeData,
          afterData: nextPayload,
        },
      });

      if (dto.submitMode === 'submit') {
        await this.submit({
          salesOrderId,
          currentStatus: beforeData.status,
        });

        return {
          ...nextPayload,
          status: 'pending_sales_manager_approval',
          versionHistory: [
            ...nextPayload.versionHistory,
            createSalesOrderVersionHistoryEntry({
              versionNo: nextPayload.currentVersionNo,
              status: 'pending_sales_manager_approval',
              createdAt: new Date().toISOString(),
            }),
          ],
        } as SalesOrderRecord;
      }

      return nextPayload;
    }

    const beforeData = snapshotAuditData(existing);
    const nextPayload = {
      ...existing,
      status: existing.status,
      customerId,
      customerName,
      customerCode,
      customerEntryMode: salesOrderCustomer.customerEntryMode,
      orderingUnit:
        resolveOptionalDraftText(dto, 'orderingUnit', existing.orderingUnit) ||
        customerName,
      customerOrderNo,
      storeName: resolveOptionalDraftText(dto, 'storeName', existing.storeName),
      orderDate: resolveOptionalDraftText(dto, 'orderDate', existing.orderDate),
      estimatedDeliveryDate: resolveOptionalDraftText(
        dto,
        'estimatedDeliveryDate',
        existing.estimatedDeliveryDate,
      ),
      shipTo: resolveOptionalDraftText(dto, 'shipTo', existing.shipTo),
      salesOrderAttachment: resolveOptionalDraftText(
        dto,
        'salesOrderAttachment',
        existing.salesOrderAttachment,
      ),
      salesOrderRemark,
      salesOrderAttachments,
      items,
      title,
      salesUserId: effectiveDto.salesUserId,
    } as SalesOrderRecord;

    this.store.upsertSalesOrder(nextPayload);
    this.store.recordAuditLog({
      bizType: 'sales_order',
      bizId: salesOrderId,
      operationType: 'update_sales_order_draft',
      operatorId,
      beforeData,
      afterData: nextPayload,
    });

    if (dto.submitMode === 'submit') {
      await this.submit({
        salesOrderId,
        currentStatus: existing.status,
      });

      return this.store.getSalesOrder(salesOrderId) ?? {
        ...nextPayload,
        status: 'pending_sales_manager_approval',
      };
    }

    return nextPayload;
  }

  async list(
    query: SalesOrderListQuery,
    session?: FormalSession,
  ): Promise<SalesOrderListResponse> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const sortBy =
      query.sortBy === 'docNo' || query.sortBy === 'customerName'
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const keyword = query.keyword?.trim().toLowerCase();
    const customerName = query.customerName?.trim().toLowerCase();
    const ownerName = query.ownerName?.trim().toLowerCase();
    const createdBy = query.createdBy?.trim().toLowerCase();
    const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
    const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;
    const sourceMode = normalizeSalesDocumentSourceMode(query.sourceMode);
    const counterpartyService = new CounterpartyService(this.prisma);

    const allItems = this.shouldUsePrisma()
      ? await Promise.all(
          (
            (await this.prismaDb!.businessDocument.findMany({
              where: { bizType: 'sales_order' },
              orderBy: { createdAt: 'desc' },
            })) as PrismaBusinessDocumentRecord[]
          )
            .map(toSalesOrderDocumentPayload)
            .map(withSalesOrderEffectiveStatus)
            .map(async (item) => {
              const matchedCounterparty = item.customerId
                ? await counterpartyService.findById(item.customerId)
                : null;

              return {
                ...toSalesOrderListItem(item),
                counterpartyFullName:
                  matchedCounterparty?.shortName ?? item.customerFullName,
              };
            }),
        )
      : [
          ...(await Promise.all(
            this.store
              .listSalesOrders()
              .map(withSalesOrderEffectiveStatus)
              .map(async (item) => {
                const matchedCounterparty = item.customerId
                  ? await counterpartyService.findById(item.customerId)
                  : null;

                return {
                  ...toSalesOrderListItem(item),
                  counterpartyFullName:
                    matchedCounterparty?.shortName ?? item.customerFullName,
                };
              }),
          )),
          ...salesOrderListData,
        ];

    const filtered = filterVisibleFormalItems(
      allItems,
      session ?? {},
      ['admin', 'boss', 'sales_manager'],
    ).filter((item) => {
      if (
        keyword &&
        ![
          item.docNo,
          item.title,
          item.counterpartyName ?? '',
          item.counterpartyFullName ?? '',
          item.ownerName ?? '',
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
        customerName &&
        ![item.counterpartyName ?? '', item.counterpartyFullName ?? '']
          .join(' ')
          .toLowerCase()
          .includes(customerName)
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

      if (query.receiptStatus && item.receiptStatus !== query.receiptStatus) {
        return false;
      }

      if (
        query.financeConfirmStatus &&
        item.financeConfirmStatus !== query.financeConfirmStatus
      ) {
        return false;
      }

      if (query.hasAfterSales && query.hasAfterSales !== 'all') {
        const expected = query.hasAfterSales === 'yes';
        if (item.hasAfterSales !== expected) {
          return false;
        }
      }

      if (
        sourceMode !== 'all' &&
        resolveSalesDocumentSourceMode(item.sourceSummary) !== sourceMode
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
        sortBy === 'customerName' ? left.counterpartyName ?? '' : left[sortBy];
      const rightValue =
        sortBy === 'customerName' ? right.counterpartyName ?? '' : right[sortBy];

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
        createdBy: query.createdBy ?? null,
        ownerName: query.ownerName ?? null,
        approvalStatus: query.approvalStatus ?? null,
        fulfillmentStatus: query.fulfillmentStatus ?? null,
        receiptStatus: query.receiptStatus ?? null,
        financeConfirmStatus: query.financeConfirmStatus ?? null,
        hasAfterSales: query.hasAfterSales ?? 'all',
        sourceMode,
      },
  };
}

  async convertConfirmedQuote(
    payload: ConvertConfirmedQuotePayload,
  ): Promise<ConvertedSalesOrderRecord> {
    if (payload.quoteConfirmed === false) {
      throw new BadRequestException(
        'Only confirmed quote versions can convert to sales orders',
      );
    }

    if (payload.existingSalesOrderId != null) {
      throw new BadRequestException(
        'A confirmed quote version can only create one sales order',
      );
    }

    await this.assertQuoteVersionNotConverted(
      payload.quoteOrderId,
      payload.quoteVersionNo,
    );

    await this.assertSourceQuoteConvertibleToSales(
      payload.quoteOrderId,
      payload.quoteVersionNo,
      '当前单据状态不可转销售单',
    );
    const sourceItems = await this.loadSourceQuoteLineSelections(payload.quoteOrderId);
    const conversionItems = payload.items?.map((item) => {
      const source = sourceItems.find((entry) => Number(entry.lineNo) === Number(item.lineNo));
      return {
        ...item,
        cartonQuantity: source?.cartonQuantity,
        outerCartonSizeCm: source?.outerCartonSizeCm,
        outerCartonGrossWeightKg: source?.outerCartonGrossWeightKg,
      };
    });
    const createdAt = new Date().toISOString();
    const sourceQuoteNo = payload.sourceQuoteNo?.trim() || undefined;
    const sourceDocumentType =
      payload.sourceDocumentType ?? (sourceQuoteNo?.startsWith('XQ') ? 'demand' : 'quote');

    if (this.shouldUsePrisma()) {
      const apply = async (db: PrismaSalesDb) => {
        const payloadRecord: ConvertedSalesOrderRecord = {
        id: payload.quoteOrderId,
        salesNo: 'PENDING-SALES',
        status: 'draft',
        currentVersionNo: 1,
        purchaseAggregateStatus: 'not_started',
        shipmentAggregateStatus: 'not_started',
        receiptSendStatus: 'pending',
        afterSalesEndStatus: 'not_started',
        receiptStatus: 'unpaid',
        financeStatus: 'pending',
        autoVoidedPurchaseOrderIds: [],
        createdBy: payload.createdBy,
        createdAt,
        versionHistory: [
          createSalesOrderVersionHistoryEntry({
            versionNo: 1,
            status: 'draft',
            createdAt,
          }),
        ],
        sourceQuoteOrderId: payload.quoteOrderId,
        sourceQuoteVersionNo: payload.quoteVersionNo,
        sourceQuoteNo,
        sourceDocumentType,
        sourceMode: 'from_quote',
        customerId: payload.customerId,
        customerName: payload.customerName?.trim() || `客户 ${payload.customerId}`,
        customerFullName: payload.customerFullName?.trim() || undefined,
        customerCode: payload.customerCode?.trim().toUpperCase() || undefined,
        customerEntryMode: payload.customerEntryMode ?? 'existing',
        orderingUnit: payload.customerName?.trim() || `客户 ${payload.customerId}`,
        customerOrderNo: undefined,
        storeName: payload.sourceCode?.trim() || undefined,
        orderDate: payload.inquiryDate?.trim() || undefined,
        shipTo: payload.destination?.trim() || undefined,
        salesOrderRemark: payload.requirements?.trim() || undefined,
        salesOrderAttachments: normalizeSalesOrderAttachments(
          (payload.quoteAttachments ?? []) as CreateDirectSalesOrderDto['salesOrderAttachments'],
        ),
        title: '',
        salesUserId: payload.createdBy,
        items: normalizeSalesOrderItems(conversionItems),
      };
        const created = (await db.businessDocument.create({
        data: {
          bizType: 'sales_order',
          docNo: `PENDING-SALES-${Date.now()}`,
          status: 'draft',
          ownerUserId: BigInt(payload.createdBy),
          counterpartyId: BigInt(payload.customerId),
          payload: payloadRecord,
          createdBy: BigInt(payload.createdBy),
        },
      })) as PrismaBusinessDocumentRecord;
        const finalPayload: ConvertedSalesOrderRecord = {
        ...payloadRecord,
        id: Number(created.id),
        salesNo: buildSequentialDocumentCode('S', Number(created.id), createdAt),
        customerOrderNo: buildSequentialDocumentCode('S', Number(created.id), createdAt),
        title: buildDefaultSalesOrderTitle(
          buildSequentialDocumentCode('S', Number(created.id), createdAt),
          payloadRecord.items,
          payloadRecord.customerName,
        ),
      };
        const updated = (await db.businessDocument.update({
        where: { id: created.id },
        data: {
          docNo: finalPayload.salesNo,
          payload: finalPayload,
        },
      })) as PrismaBusinessDocumentRecord;
        await db.operationLog.create({
        data: {
          bizType: 'sales_order',
          bizId: updated.id,
          operationType: 'convert_quote_to_sales',
          operatorId: BigInt(payload.createdBy),
          beforeData: undefined,
          afterData: finalPayload,
        },
      });

        await this.formalizeCandidateProducts({ ...payload, items: conversionItems }, db);
        await this.markSourceQuoteConvertedToSales(payload, finalPayload, db);

        return finalPayload;
      };
      const transaction = (this.prisma as unknown as {
        $transaction?: <T>(callback: (db: PrismaSalesDb) => Promise<T>) => Promise<T>;
      })?.$transaction;
      return (typeof transaction === 'function'
        ? await transaction.call(this.prisma, apply)
        : await apply(this.prismaDb!)) as ConvertedSalesOrderRecord;
    }

    const id = this.store.nextSalesOrderId();
    const salesNo = buildSequentialDocumentCode('S', id, createdAt);
    const converted: ConvertedSalesOrderRecord = {
      id,
      salesNo,
      status: 'draft',
      currentVersionNo: 1,
      purchaseAggregateStatus: 'not_started',
      shipmentAggregateStatus: 'not_started',
      receiptSendStatus: 'pending',
      afterSalesEndStatus: 'not_started',
      receiptStatus: 'unpaid',
      financeStatus: 'pending',
      autoVoidedPurchaseOrderIds: [],
      createdBy: payload.createdBy,
      createdAt,
      versionHistory: [
        createSalesOrderVersionHistoryEntry({
          versionNo: 1,
          status: 'draft',
          createdAt,
        }),
      ],
      sourceQuoteOrderId: payload.quoteOrderId,
      sourceQuoteVersionNo: payload.quoteVersionNo,
      sourceQuoteNo,
      sourceDocumentType,
      sourceMode: 'from_quote',
      customerId: payload.customerId,
      customerName: payload.customerName?.trim() || `客户 ${payload.customerId}`,
      customerFullName: payload.customerFullName?.trim() || undefined,
      customerCode: payload.customerCode?.trim().toUpperCase() || undefined,
      customerEntryMode: payload.customerEntryMode ?? 'existing',
      orderingUnit: payload.customerName?.trim() || `客户 ${payload.customerId}`,
      customerOrderNo: salesNo,
      storeName: payload.sourceCode?.trim() || undefined,
      orderDate: payload.inquiryDate?.trim() || undefined,
      shipTo: payload.destination?.trim() || undefined,
      salesOrderRemark: payload.requirements?.trim() || undefined,
      salesOrderAttachments: normalizeSalesOrderAttachments(
        (payload.quoteAttachments ?? []) as CreateDirectSalesOrderDto['salesOrderAttachments'],
      ),
      title: buildDefaultSalesOrderTitle(
        salesNo, normalizeSalesOrderItems(conversionItems),
        payload.customerName?.trim() || `客户 ${payload.customerId}`,
      ),
      salesUserId: payload.createdBy,
      items: normalizeSalesOrderItems(conversionItems),
    };

    await this.formalizeCandidateProducts({ ...payload, items: conversionItems });
    this.store.upsertSalesOrder(converted);
    this.store.recordAuditLog({
      bizType: 'sales_order',
      bizId: converted.id,
      operationType: 'convert_quote_to_sales',
      operatorId: payload.createdBy,
      beforeData: null,
      afterData: converted,
    });
    await this.markSourceQuoteConvertedToSales(payload, converted);
    return converted;
  }

  async hydratePurchaseFieldsFromSourceQuote(
    salesOrder: SalesOrderRecord,
  ): Promise<SalesOrderLineItem[]> {
    const items = salesOrder.items ?? [];
    if (
      salesOrder.sourceMode !== 'from_quote' ||
      !Number.isInteger(salesOrder.sourceQuoteOrderId) ||
      salesOrder.sourceQuoteOrderId <= 0 ||
      items.length === 0
    ) {
      return items;
    }

    const quoteItems = await this.loadSourceQuoteLineSelections(
      salesOrder.sourceQuoteOrderId,
    );
    if (quoteItems.length === 0) {
      return items;
    }

    return items.map((item) => {
      const sourceLineNo = item.sourceQuoteLineNo ?? item.lineNo;
      const matchedQuoteItem = quoteItems.find(
        (quoteItem) => Number(quoteItem.lineNo) === Number(sourceLineNo),
      );

      if (!matchedQuoteItem) {
        return item;
      }

      const confirmedSupplierId =
        item.confirmedSupplierId ??
        normalizeOptionalPositiveNumber(matchedQuoteItem.confirmedSupplierId);
      const confirmedSupplierCode =
        item.confirmedSupplierCode ??
        normalizeOptionalString(matchedQuoteItem.confirmedSupplierCode);
      const confirmedSupplierName =
        item.confirmedSupplierName ??
        normalizeOptionalString(matchedQuoteItem.confirmedSupplierName);
      const confirmedPurchasePrice =
        item.confirmedPurchasePrice ??
        normalizeOptionalPositiveNumber(matchedQuoteItem.confirmedPurchasePrice);
      const confirmedProductId =
        item.confirmedProductId ??
        normalizeOptionalPositiveNumber(matchedQuoteItem.confirmedProductId);

      return {
        ...item,
        ...(confirmedSupplierId ? { confirmedSupplierId } : {}),
        ...(confirmedSupplierCode ? { confirmedSupplierCode } : {}),
        ...(confirmedSupplierName ? { confirmedSupplierName } : {}),
        ...(confirmedPurchasePrice ? { confirmedPurchasePrice } : {}),
        ...(confirmedProductId ? { confirmedProductId } : {}),
      };
    });
  }

  private async loadSourceQuoteLineSelections(
    quoteOrderId: number,
    prismaDb = this.prismaDb,
  ): Promise<SourceQuoteLineSelection[]> {
    if (this.shouldUsePrisma()) {
      const record = (await prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(quoteOrderId) },
      })) as SourceQuoteDocumentRecord | null;

      if (!record || record.bizType !== 'quote') {
        return [];
      }

      return Array.isArray(record.payload?.items) ? record.payload.items : [];
    }

    return resolveQuoteStore().getQuote(quoteOrderId)?.items ?? [];
  }

  private async assertSourceQuoteConvertibleToSales(
    quoteOrderId: number,
    quoteVersionNo: number,
    errorMessage: string,
  ) {
    if (this.shouldUsePrisma()) {
      const record = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(quoteOrderId) },
      })) as SourceQuoteDocumentRecord | null;

      const status = record?.payload?.status ?? record?.status;
      const documentType = record?.payload?.documentType ?? 'quote';
      const versionMatches = (record?.payload?.currentVersionNo ?? quoteVersionNo) === quoteVersionNo;
      const isConvertible =
        record?.bizType === 'quote' &&
        versionMatches &&
        isQuoteConvertibleToSales({ documentType, status: status ?? '' });

      if (!isConvertible) {
        throw new BadRequestException(errorMessage);
      }

      return;
    }

    const quote = resolveQuoteStore().getQuote(quoteOrderId);
    const isConvertible =
      quote &&
      quote.currentVersionNo === quoteVersionNo &&
      isQuoteConvertibleToSales({
        documentType: quote.documentType ?? 'quote',
        status: quote.status,
      });

    if (!isConvertible) {
      throw new BadRequestException(errorMessage);
    }
  }

  private async formalizeCandidateProducts(
    payload: ConvertConfirmedQuotePayload,
    prismaDb = this.prismaDb,
  ) {
    const productService = new ProductService(
      (prismaDb ?? this.prisma) as PrismaService | undefined,
    );
    const sourceItems = payload.items?.length
      ? payload.items
      : await this.loadSourceQuoteLineSelections(payload.quoteOrderId, prismaDb);
    const productIds = Array.from(
      new Set(
        sourceItems
          .map((item) => Number(item.productId ?? item.confirmedProductId ?? 0))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );

    for (const productId of productIds) {
      const product = await productService.findById(productId);
      if (product?.productStage === 'quote_candidate') {
        await productService.ensureFormalForSalesOrder(productId, {
          operatedBy: String(payload.createdBy),
        });
      }
    }
  }

  private async markSourceQuoteConvertedToSales(
    payload: ConvertConfirmedQuotePayload,
    salesOrder: { id: number; salesNo: string },
    prismaDb = this.prismaDb,
  ) {
    if (this.shouldUsePrisma()) {
      const record = (await prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(payload.quoteOrderId) },
      })) as SourceQuoteDocumentRecord | null;

      if (!record || record.bizType !== 'quote' || !record.payload) {
        return;
      }

      const beforeData = {
        ...record.payload,
        id: Number(record.payload.id ?? record.id),
        quoteNo: record.payload.quoteNo ?? record.docNo,
      };
      const afterData = {
        ...beforeData,
        status: 'ordered',
        currentProgress: '已转销售单',
        linkedSalesOrderId: salesOrder.id,
        linkedSalesOrderNo: salesOrder.salesNo,
      };

      await prismaDb!.businessDocument.update({
        where: { id: BigInt(payload.quoteOrderId) },
        data: {
          status: 'ordered',
          payload: afterData,
        },
      });
      await prismaDb!.operationLog.create({
        data: {
          bizType: 'quote',
          bizId: BigInt(payload.quoteOrderId),
          operationType: 'convert_demand_quote_to_sales',
          operatorId: BigInt(payload.createdBy),
          beforeData,
          afterData,
        },
      });
      return;
    }

    const quote = resolveQuoteStore().getQuote(payload.quoteOrderId);
    if (!quote) {
      return;
    }

    const convertedQuote = {
      ...quote,
      status: 'ordered',
      currentProgress: '已转销售单',
      linkedSalesOrderId: salesOrder.id,
      linkedSalesOrderNo: salesOrder.salesNo,
    };
    resolveQuoteStore().upsertQuote(convertedQuote);
    resolveQuoteStore().recordAuditLog({
      bizType: 'quote',
      bizId: convertedQuote.id,
      operationType: 'convert_demand_quote_to_sales',
      operatorId: payload.createdBy,
      beforeData: quote,
      afterData: convertedQuote,
    });
  }

  private async assertQuoteVersionNotConverted(
    quoteOrderId: number,
    quoteVersionNo: number,
  ) {
    if (this.shouldUsePrisma()) {
      const records = (await this.prismaDb!.businessDocument.findMany({
        where: { bizType: 'sales_order' },
      })) as PrismaBusinessDocumentRecord[];

      const existing = records
        .map(toSalesOrderDocumentPayload)
        .find(
          (record) =>
            record.sourceMode === 'from_quote' &&
            record.sourceQuoteOrderId === quoteOrderId &&
            record.sourceQuoteVersionNo === quoteVersionNo,
        );

      if (existing) {
        throw new BadRequestException(
          'A confirmed quote version can only create one sales order',
        );
      }

      return;
    }

    const existing = this.store
      .listSalesOrders()
      .find(
        (record) =>
          record.sourceMode === 'from_quote' &&
          record.sourceQuoteOrderId === quoteOrderId &&
          record.sourceQuoteVersionNo === quoteVersionNo,
      );

    if (existing) {
      throw new BadRequestException(
        'A confirmed quote version can only create one sales order',
      );
    }
  }

  async listAuditLogs() {
    if (this.shouldUsePrisma()) {
      const logs = (await this.prismaDb!.operationLog.findMany({
        where: { bizType: 'sales_order' },
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
    const counterpartyService = new CounterpartyService(this.prisma);

    if (this.shouldUsePrisma()) {
      const created = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaBusinessDocumentRecord | null;

      if (created && created.bizType === 'sales_order') {
        const detail = withSalesOrderEffectiveStatus(
          toSalesOrderDocumentPayload(created),
        );
        const listItem = toSalesOrderListItem(detail as CreatedSalesOrderRecord | ConvertedSalesOrderRecord);
        if (
          session?.role &&
          !isFormalAdminOrBoss(session?.role) &&
          session?.role !== 'sales_manager' &&
          !matchesFormalUser(session ?? {}, listItem)
        ) {
          throw new NotFoundException('销售单不存在');
        }

        const matchedCounterparty = detail.customerId
          ? await counterpartyService.findById(detail.customerId)
          : null;

        return {
          ...detail,
          customerFullName:
            matchedCounterparty?.shortName ?? detail.customerFullName,
          stockOutStatus: detail.stockOutStatus ?? 'not_started',
          stockOutDocNo: detail.stockOutDocNo ?? null,
        };
      }
    }

    const created = this.store.getSalesOrder(id);

    if (created) {
      const detail = withSalesOrderEffectiveStatus(created);
      const listItem = toSalesOrderListItem(detail);
      if (
        session?.role &&
        !isFormalAdminOrBoss(session?.role) &&
        session?.role !== 'sales_manager' &&
        !matchesFormalUser(session ?? {}, listItem)
      ) {
        throw new NotFoundException('销售单不存在');
      }

      const matchedCounterparty = detail.customerId
        ? await counterpartyService.findById(detail.customerId)
        : null;

      return {
        ...detail,
        customerFullName:
          matchedCounterparty?.shortName ?? detail.customerFullName,
        stockOutStatus: detail.stockOutStatus ?? 'not_started',
        stockOutDocNo: detail.stockOutDocNo ?? null,
      };
    }

    const fallback: CreatedSalesOrderRecord = {
      id,
      salesNo: 'S202607080001',
      status: 'purchasing',
      currentVersionNo: 1,
      purchaseAggregateStatus: 'purchasing',
      shipmentAggregateStatus: 'purchasing',
      stockOutStatus: 'not_started',
      stockOutDocNo: null,
      receiptSendStatus: 'pending',
      afterSalesEndStatus: 'not_started',
      receiptStatus: 'unpaid',
      financeStatus: 'pending',
      createdBy: 2001,
      createdAt: '2026-07-11T09:45:00.000Z',
      sourceMode: 'direct',
      customerName: 'Acme Trading',
      title: 'Acme 夏季风扇补货',
      customerOrderNo: 'PO-ACME-20260708',
      storeName: '02 Libuys',
      orderDate: '2026-07-08',
      estimatedDeliveryDate: '2026-08-08',
      shipTo: 'SH Boninoe',
      salesUserId: 2001,
      salesOrderAttachments: [],
      autoVoidedPurchaseOrderIds: [],
      versionHistory: [
        createSalesOrderVersionHistoryEntry({
          versionNo: 1,
          status: 'purchasing',
          createdAt: '2026-07-11T09:45:00.000Z',
        }),
      ],
      items: [
        {
          lineNo: 1,
          sourceQuoteLineNo: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          packageQuantity: 20,
          unitsPerPackage: 25,
          totalQuantity: 500,
          salePrice: 15.9,
          amount: 7950,
          factoryPicUrls: [],
        },
      ],
    };
    const fallbackListItem = toSalesOrderListItem(fallback);

    if (
      session?.role &&
      !isFormalAdminOrBoss(session?.role) &&
      session?.role !== 'sales_manager' &&
      !matchesFormalUser(session ?? {}, fallbackListItem)
    ) {
      throw new NotFoundException('销售单不存在');
    }

    return {
      ...fallback,
      stockOutStatus: fallback.stockOutStatus ?? 'not_started',
      stockOutDocNo: fallback.stockOutDocNo ?? null,
    };
  }

  async submit(payload: SalesOrderTransitionPayload) {
    if (payload.currentStatus !== 'draft' && payload.currentStatus !== 'rejected') {
      throw new BadRequestException('Only draft or rejected sales orders can be submitted');
    }

    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(payload.salesOrderId) },
      })) as PrismaBusinessDocumentRecord | null;

      if (!existing || existing.bizType !== 'sales_order') {
        throw new NotFoundException('销售单不存在');
      }

      const beforeData = toSalesOrderDocumentPayload(existing);
      if (beforeData.status !== 'draft' && beforeData.status !== 'rejected') {
        throw new BadRequestException('Only draft or rejected sales orders can be submitted');
      }
      const nextPayload: SalesOrderRecord = {
        ...beforeData,
        status: 'pending_sales_manager_approval',
        versionHistory: [
          ...beforeData.versionHistory,
          createSalesOrderVersionHistoryEntry({
            versionNo: beforeData.currentVersionNo,
            status: 'pending_sales_manager_approval',
            createdAt: new Date().toISOString(),
          }),
        ],
      };
      const updated = (await this.prismaDb!.businessDocument.update({
        where: { id: existing.id },
        data: {
          status: nextPayload.status,
          payload: nextPayload,
        },
      })) as PrismaBusinessDocumentRecord;

      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'sales_order',
          bizId: updated.id,
          operationType: 'submit_sales_order',
          operatorId: BigInt(beforeData.createdBy),
          beforeData,
          afterData: nextPayload,
        },
      });

      return {
        id: payload.salesOrderId,
        status: 'pending_sales_manager_approval',
      };
    }

    const existing = this.store.getSalesOrder(payload.salesOrderId);
    if (existing) {
      if (existing.status !== 'draft' && existing.status !== 'rejected') {
        throw new BadRequestException('Only draft or rejected sales orders can be submitted');
      }
      const beforeData = snapshotAuditData(existing);
      existing.status = 'pending_sales_manager_approval';
      existing.versionHistory = [
        ...existing.versionHistory,
        createSalesOrderVersionHistoryEntry({
          versionNo: existing.currentVersionNo,
          status: 'pending_sales_manager_approval',
          createdAt: new Date().toISOString(),
        }),
      ];
      this.store.upsertSalesOrder(existing);
      this.store.recordAuditLog({
        bizType: 'sales_order',
        bizId: existing.id,
        operationType: 'submit_sales_order',
        operatorId: existing.createdBy,
        beforeData,
        afterData: existing,
      });
    }

    return {
      id: payload.salesOrderId,
      status: 'pending_sales_manager_approval',
    };
  }

  async approve(payload: SalesOrderTransitionPayload & {
    purchaseOwnerName?: string;
    sourceInquiryId?: number;
    deferPurchaseTransfer?: boolean;
  }) {
    if (payload.currentStatus !== 'pending_sales_manager_approval') {
      throw new BadRequestException(
        'Only pending sales manager approval orders can be approved',
      );
    }

    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(payload.salesOrderId) },
      })) as PrismaBusinessDocumentRecord | null;

      if (!existing || existing.bizType !== 'sales_order') {
        throw new NotFoundException('销售单不存在');
      }

      const beforeData = toSalesOrderDocumentPayload(existing);
      if (beforeData.status !== 'pending_sales_manager_approval') {
        throw new BadRequestException('销售单状态已变更，请刷新页面');
      }
      const nextStatus = payload.purchaseOwnerName && !payload.deferPurchaseTransfer ? 'purchasing' : 'pending_purchase_assignment';
      const nextPayload: SalesOrderRecord = {
        ...beforeData,
        status: nextStatus,
        purchaseAggregateStatus: nextStatus,
        shipmentAggregateStatus: 'purchasing',
        purchaseOwnerName: payload.purchaseOwnerName,
        sourceInquiryId: payload.sourceInquiryId,
      };
      const updated = (await this.prismaDb!.businessDocument.update({
        where: { id: existing.id },
        data: {
          status: nextPayload.status,
          payload: nextPayload,
        },
      })) as PrismaBusinessDocumentRecord;

      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'sales_order',
          bizId: updated.id,
          operationType: 'approve_sales_order',
          operatorId: BigInt(beforeData.createdBy),
          beforeData,
          afterData: nextPayload,
        },
      });

      return {
        id: payload.salesOrderId,
        status: nextStatus,
      };
    }

    const existing = this.store.getSalesOrder(payload.salesOrderId);
    if (existing) {
      if (existing.status !== 'pending_sales_manager_approval') {
        throw new BadRequestException('销售单状态已变更，请刷新页面');
      }
      const beforeData = snapshotAuditData(existing);
      existing.status = payload.purchaseOwnerName && !payload.deferPurchaseTransfer ? 'purchasing' : 'pending_purchase_assignment';
      existing.purchaseAggregateStatus = existing.status;
      existing.shipmentAggregateStatus = 'purchasing';
      existing.purchaseOwnerName = payload.purchaseOwnerName;
      existing.sourceInquiryId = payload.sourceInquiryId;
      this.store.upsertSalesOrder(existing);
      this.store.recordAuditLog({
        bizType: 'sales_order',
        bizId: existing.id,
        operationType: 'approve_sales_order',
        operatorId: existing.createdBy,
        beforeData,
        afterData: existing,
      });
    }

    return {
      id: payload.salesOrderId,
      status: payload.purchaseOwnerName && !payload.deferPurchaseTransfer ? 'purchasing' : 'pending_purchase_assignment',
    };
  }

  async listPendingPurchaseAssignments() {
    const orders = this.shouldUsePrisma()
      ? ((await this.prismaDb!.businessDocument.findMany({
          where: { bizType: 'sales_order', status: 'pending_purchase_assignment' },
        })) as PrismaBusinessDocumentRecord[]).map(toSalesOrderDocumentPayload)
      : this.store.listSalesOrders().filter((item) => item.status === 'pending_purchase_assignment');
    return orders.map((item) => ({
      id: item.id,
      salesNo: item.salesNo,
      title: item.title,
      customerName: item.customerName,
      status: item.status,
      purchaseOwnerName: item.purchaseOwnerName,
    }));
  }

  async completePurchaseAssignment(id: number, purchaseOwnerName: string) {
    const ownerName = purchaseOwnerName.trim();
    if (!ownerName) {
      throw new BadRequestException('请选择采购负责人');
    }
    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaBusinessDocumentRecord | null;
      if (!existing || existing.bizType !== 'sales_order') {
        throw new NotFoundException('销售单不存在');
      }
      const beforeData = toSalesOrderDocumentPayload(existing);
      if (beforeData.status !== 'pending_purchase_assignment') {
        throw new BadRequestException('采购负责人已分配，请刷新页面');
      }
      if (beforeData.purchaseOwnerName && beforeData.purchaseOwnerName !== ownerName) {
        throw new BadRequestException('采购负责人必须与来源销售单一致');
      }
      const nextPayload = {
        ...beforeData,
        purchaseOwnerName: ownerName,
        status: 'purchasing',
        purchaseAggregateStatus: 'purchasing',
      };
      await this.prismaDb!.businessDocument.update({
        where: { id: existing.id },
        data: { status: nextPayload.status, payload: nextPayload },
      });
      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'sales_order',
          bizId: existing.id,
          operationType: 'assign_purchase_owner',
          operatorId: BigInt(beforeData.createdBy),
          beforeData,
          afterData: nextPayload,
        },
      });
      return { id, status: nextPayload.status, purchaseOwnerName: ownerName };
    }
    const existing = this.store.getSalesOrder(id);
    if (!existing) {
      throw new NotFoundException('销售单不存在');
    }
    if (existing.status !== 'pending_purchase_assignment') {
      throw new BadRequestException('采购负责人已分配，请刷新页面');
    }
    if (existing.purchaseOwnerName && existing.purchaseOwnerName !== ownerName) {
      throw new BadRequestException('采购负责人必须与来源销售单一致');
    }
    const beforeData = snapshotAuditData(existing);
    existing.purchaseOwnerName = ownerName;
    existing.status = 'purchasing';
    existing.purchaseAggregateStatus = 'purchasing';
    this.store.upsertSalesOrder(existing);
    this.store.recordAuditLog({
      bizType: 'sales_order',
      bizId: existing.id,
      operationType: 'assign_purchase_owner',
      operatorId: existing.createdBy,
      beforeData,
      afterData: existing,
    });
    return { id, status: existing.status, purchaseOwnerName: ownerName };
  }

  async reject(payload: SalesOrderTransitionPayload) {
    if (payload.currentStatus !== 'pending_sales_manager_approval') {
      throw new BadRequestException(
        'Only pending sales manager approval orders can be rejected',
      );
    }

    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(payload.salesOrderId) },
      })) as PrismaBusinessDocumentRecord | null;

      if (!existing || existing.bizType !== 'sales_order') {
        throw new NotFoundException('销售单不存在');
      }

      const beforeData = toSalesOrderDocumentPayload(existing);
      const nextPayload: SalesOrderRecord = {
        ...beforeData,
        status: 'rejected',
      };
      const updated = (await this.prismaDb!.businessDocument.update({
        where: { id: existing.id },
        data: {
          status: nextPayload.status,
          payload: nextPayload,
        },
      })) as PrismaBusinessDocumentRecord;

      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'sales_order',
          bizId: updated.id,
          operationType: 'reject_sales_order',
          operatorId: BigInt(beforeData.createdBy),
          beforeData,
          afterData: nextPayload,
        },
      });

      return {
        id: payload.salesOrderId,
        status: 'rejected',
      };
    }

    const existing = this.store.getSalesOrder(payload.salesOrderId);
    if (existing) {
      const beforeData = snapshotAuditData(existing);
      existing.status = 'rejected';
      this.store.upsertSalesOrder(existing);
      this.store.recordAuditLog({
        bizType: 'sales_order',
        bizId: existing.id,
        operationType: 'reject_sales_order',
        operatorId: existing.createdBy,
        beforeData,
        afterData: existing,
      });
    }

    return {
      id: payload.salesOrderId,
      status: 'rejected',
    };
  }

  async resubmit(payload: ResubmitPayload) {
    if (payload.currentStatus !== 'purchasing') {
      throw new BadRequestException(
        'Only purchasing sales orders can be resubmitted',
      );
    }

    if (payload.hasShipmentBatches) {
      throw new BadRequestException(
        'Cannot resubmit after shipment has started',
      );
    }

    const existing = this.store.getSalesOrder(payload.salesOrderId);
    if (existing) {
      existing.status = 'pending_sales_manager_approval';
      existing.currentVersionNo += 1;
      existing.versionHistory = [
        ...existing.versionHistory,
        createSalesOrderVersionHistoryEntry({
          versionNo: existing.currentVersionNo,
          status: 'pending_sales_manager_approval',
          createdAt: '2026-07-11T10:15:00.000Z',
          changeReason: payload.changeReason,
        }),
      ];
      this.store.upsertSalesOrder(existing);
    }

    return {
      id: payload.salesOrderId,
      status: 'pending_sales_manager_approval',
      nextVersionNo: existing?.currentVersionNo ?? 2,
      changeReason: payload.changeReason,
    };
  }

  async cancel(payload: CancelPayload) {
    if (payload.currentStatus !== 'purchasing') {
      throw new BadRequestException(
        'Only purchasing sales orders can be cancelled',
      );
    }

    if (payload.hasShipmentBatches) {
      throw new BadRequestException('Cannot cancel after shipment has started');
    }

    if (!Array.isArray(payload.unshippedPurchaseOrderIds)) {
      throw new BadRequestException('Unshipped purchase order ids are required');
    }

    const existing = this.store.getSalesOrder(payload.salesOrderId);
    if (existing) {
      existing.status = 'void';
      existing.cancelReason = payload.cancelReason;
      existing.autoVoidedPurchaseOrderIds = payload.unshippedPurchaseOrderIds;
      existing.versionHistory = [
        ...existing.versionHistory,
        createSalesOrderVersionHistoryEntry({
          versionNo: existing.currentVersionNo,
          status: 'void',
          createdAt: '2026-07-11T10:30:00.000Z',
          changeReason: payload.cancelReason,
        }),
      ];
      this.store.upsertSalesOrder(existing);
    }

    return {
      id: payload.salesOrderId,
      status: 'void',
      autoVoidedPurchaseOrderIds: payload.unshippedPurchaseOrderIds,
      cancelReason: payload.cancelReason,
    };
  }

  async updateReceiptStatus(payload: {
    salesOrderId: number;
    receiptStatus: string;
  }) {
    const existing = this.store.getSalesOrder(payload.salesOrderId);
    if (existing) {
      existing.receiptStatus = payload.receiptStatus;
      this.store.upsertSalesOrder(existing);
    }

    return {
      id: payload.salesOrderId,
      receiptStatus: payload.receiptStatus,
    };
  }

  async confirmFinance(payload: {
    salesOrderId: number;
    receiptStatus: string;
    financeStatus: string;
  }) {
    if (
      payload.receiptStatus !== 'deposit_received' &&
      payload.receiptStatus !== 'fully_paid' &&
      payload.receiptStatus !== 'prepaid_deducted'
    ) {
      throw new BadRequestException(
        'Cannot confirm finance before receipt status reaches a paid state',
      );
    }

    const existing = this.store.getSalesOrder(payload.salesOrderId);
    if (existing) {
      existing.financeStatus = 'confirmed';
      this.store.upsertSalesOrder(existing);
    }

    return {
      id: payload.salesOrderId,
      financeStatus: 'confirmed',
    };
  }

  async syncOperationalAggregates(payload: SyncOperationalAggregatesPayload) {
    const applyNext = (record: SalesOrderRecord): SalesOrderRecord => {
      const shipmentAggregateStatus =
        payload.shipmentAggregateStatus ?? record.shipmentAggregateStatus;
      const status =
        canAutoCloseSalesOrderStatus(record.status) &&
        isSalesOrderInternalFulfillmentClosed(shipmentAggregateStatus)
          ? 'closed'
          : record.status;

      return {
        ...record,
        status,
        purchaseAggregateStatus:
          payload.purchaseAggregateStatus ?? record.purchaseAggregateStatus,
        shipmentAggregateStatus,
        receiptSendStatus: payload.receiptSendStatus ?? record.receiptSendStatus,
        afterSalesEndStatus: payload.afterSalesEndStatus ?? record.afterSalesEndStatus,
        receiptStatus: payload.receiptStatus ?? record.receiptStatus,
        financeStatus: payload.financeStatus ?? record.financeStatus,
      };
    };

    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(payload.salesOrderId) },
      })) as PrismaBusinessDocumentRecord | null;

      if (existing && existing.bizType === 'sales_order') {
        const beforeData = toSalesOrderDocumentPayload(existing);
        const nextPayload = applyNext(beforeData);
        const updated = (await this.prismaDb!.businessDocument.update({
          where: { id: existing.id },
          data: {
            status: nextPayload.status,
            payload: nextPayload,
          },
        })) as PrismaBusinessDocumentRecord;

        await this.prismaDb!.operationLog.create({
          data: {
            bizType: 'sales_order',
            bizId: updated.id,
            operationType: 'sync_sales_order_operational_aggregates',
            operatorId: BigInt(payload.operatorId ?? beforeData.createdBy),
            beforeData,
            afterData: {
              ...nextPayload,
              syncSource: payload.source,
            },
          },
        });

        return {
          id: payload.salesOrderId,
          status: nextPayload.status,
          purchaseAggregateStatus: nextPayload.purchaseAggregateStatus,
          shipmentAggregateStatus: nextPayload.shipmentAggregateStatus,
          receiptSendStatus: nextPayload.receiptSendStatus,
          afterSalesEndStatus: nextPayload.afterSalesEndStatus,
          receiptStatus: nextPayload.receiptStatus,
          financeStatus: nextPayload.financeStatus,
        };
      }
    }

    const existing = this.store.getSalesOrder(payload.salesOrderId);

    if (existing) {
      const nextPayload = applyNext(existing);
      this.store.upsertSalesOrder(nextPayload);
      this.store.recordAuditLog({
        bizType: 'sales_order',
        bizId: nextPayload.id,
        operationType: 'sync_sales_order_operational_aggregates',
        operatorId: payload.operatorId ?? nextPayload.createdBy,
        beforeData: snapshotAuditData(existing),
        afterData: snapshotAuditData({
          ...nextPayload,
          syncSource: payload.source,
        }),
      });

      return {
        id: payload.salesOrderId,
        status: nextPayload.status,
        purchaseAggregateStatus: nextPayload.purchaseAggregateStatus,
        shipmentAggregateStatus: nextPayload.shipmentAggregateStatus,
        receiptSendStatus: nextPayload.receiptSendStatus,
        afterSalesEndStatus: nextPayload.afterSalesEndStatus,
        receiptStatus: nextPayload.receiptStatus,
        financeStatus: nextPayload.financeStatus,
      };
    }

    return {
      id: payload.salesOrderId,
      purchaseAggregateStatus: payload.purchaseAggregateStatus,
      shipmentAggregateStatus: payload.shipmentAggregateStatus,
      receiptSendStatus: payload.receiptSendStatus,
      afterSalesEndStatus: payload.afterSalesEndStatus,
      receiptStatus: payload.receiptStatus,
      financeStatus: payload.financeStatus,
    };
  }

  async getCloseValidation(payload: {
    salesOrderId: number;
    shipmentAggregateStatus: string;
    receiptSendStatus: string;
    afterSalesEndStatus: string;
    financeStatus: string;
    receiptStatus: string;
  }) {
    const shipmentDone =
      payload.shipmentAggregateStatus === 'to_forwarder' ||
      payload.shipmentAggregateStatus === 'forwarder_shipped' ||
      payload.shipmentAggregateStatus === 'arrived' ||
      payload.shipmentAggregateStatus === 'closed';
    const receiptPaid =
      payload.receiptStatus === 'deposit_received' ||
      payload.receiptStatus === 'fully_paid' ||
      payload.receiptStatus === 'prepaid_deducted';
    const canClose = shipmentDone;

    return {
      salesOrderId: payload.salesOrderId,
      canClose,
      checks: {
        shipmentDone,
        receiptSent: payload.receiptSendStatus === 'sent',
        afterSalesDone: payload.afterSalesEndStatus === 'closed',
        financeConfirmed: payload.financeStatus === 'confirmed',
        receiptPaid,
      },
    };
  }

  async close(payload: { salesOrderId: number; canClose: boolean }) {
    if (!payload.canClose) {
      throw new BadRequestException('Sales order does not meet close conditions');
    }

    const existing = this.store.getSalesOrder(payload.salesOrderId);
    if (existing) {
      existing.status = 'closed';
      this.store.upsertSalesOrder(existing);
    }

    return {
      id: payload.salesOrderId,
      status: 'closed',
    };
  }
}
