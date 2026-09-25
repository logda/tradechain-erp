import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  SampleListItem,
  SampleListQuery,
  SampleListResponse,
} from '@erp/shared';
import { buildSequentialDocumentCode } from '@erp/shared';
import {
  type FormalSession,
  filterVisibleFormalItems,
  isFormalAdminOrBoss,
  matchesFormalUser,
} from '../auth/formal-session';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import { sampleOrderListData } from './sample-order-list.data';
import {
  resolveSampleOrderStore,
  type SampleOrderAuditLogRecord,
} from './sample-order.store';
import { resolveQuoteStore } from '../quote/quote.store';

export type SampleOrderVersionHistoryEntry = {
  versionNo: number;
  status: string;
  createdAt: string;
  changeReason?: string;
  replacedVersionNo?: number;
  cancelReason?: string;
};

export type SampleOrderDetailRecord = {
  id: number;
  sampleNo: string;
  currentVersionNo: number;
  currentStatus: string;
  sourceQuoteOrderId: number;
  sourceQuoteVersionNo: number;
  customerId: number;
  customerName: string;
  createdBy: number;
  ownerName: string;
  quoteNo: string;
  sampleRequirements?: string;
  samplingCost?: number | null;
  isReplacement: boolean;
  isCancelled: boolean;
  title: string;
  secondaryStatus?: string;
  createdAt: string;
  importantEnglishTitle?: string;
  orderCode?: string;
  purchaseUnit?: string;
  salesProductCode?: string;
  internalProductCode?: string;
  imageUrls?: string[];
  sampleQuantity?: number;
  estimatedCompletionDate?: string;
  freightForwarder?: string;
  domesticTrackingNo?: string;
  domesticCourierFee?: number | null;
  internationalCourierFee?: number | null;
  estimatedArrivalDate?: string;
  cancelReason?: string;
  replacedVersionNo?: number;
  versionHistory: SampleOrderVersionHistoryEntry[];
};

export type SampleOrderTransitionPayload = {
  sampleOrderId: number;
  currentStatus: string;
  purchaseUnit?: string;
  estimatedCompletionDate?: string;
  freightForwarder?: string;
  domesticTrackingNo?: string;
  domesticCourierFee?: number;
  internationalCourierFee?: number;
  estimatedArrivalDate?: string;
};

export type SaveSampleOrderDraftPayload = {
  sampleOrderId: number;
  currentStatus: string;
  sampleRequirements?: string;
  samplingCost?: number;
  sampleQuantity?: number;
  purchaseUnit?: string;
  estimatedCompletionDate?: string;
};

export type SubmitSampleOrderPayload = SampleOrderTransitionPayload &
  Pick<
    SaveSampleOrderDraftPayload,
    | 'sampleRequirements'
    | 'samplingCost'
    | 'sampleQuantity'
    | 'purchaseUnit'
    | 'estimatedCompletionDate'
  >;

export type CreateSampleOrderVersionPayload = SampleOrderTransitionPayload & {
  currentVersionNo: number;
  createdBy: number;
  sampleRequirements: string;
  changeReason: string;
  samplingCost?: number;
};

export type CancelSampleOrderPayload = SampleOrderTransitionPayload & {
  hasProductionStarted: boolean;
  cancelReason: string;
};

export type CloseNoFollowupSampleOrderPayload = SampleOrderTransitionPayload & {
  closeReason: string;
};

type PrismaBusinessDocumentRecord = {
  id: bigint;
  bizType: string;
  docNo: string;
  status: string;
  ownerUserId: bigint | null;
  counterpartyId: bigint | null;
  payload: SampleOrderDetailRecord;
  createdBy: bigint | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaSampleDb = PrismaService & {
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

type SourceQuoteDocumentRecord = {
  docNo?: string;
  bizType: string;
  status: string;
  payload?: {
    status?: string;
    currentVersionNo?: number;
    quoteNo?: string;
    items?: Array<{
      sku?: string;
      productName?: string;
      quantity?: number;
      imageUrls?: string[];
    }>;
  };
};

function normalizeTriStateFilter(value: 'all' | 'yes' | 'no' | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

function createSampleOrderVersionHistoryEntry(payload: {
  versionNo: number;
  status: string;
  createdAt: string;
  changeReason?: string;
  replacedVersionNo?: number;
  cancelReason?: string;
}): SampleOrderVersionHistoryEntry {
  return {
    versionNo: payload.versionNo,
    status: payload.status,
    createdAt: payload.createdAt,
    changeReason: payload.changeReason,
    replacedVersionNo: payload.replacedVersionNo,
    cancelReason: payload.cancelReason,
  };
}

function resolveSampleUserName(userId: number) {
  if (userId === 2001) {
    return 'Zoe';
  }

  if (userId === 2002) {
    return 'Leo';
  }

  if (userId === 2003) {
    return 'Mia';
  }

  if (userId === 2004) {
    return 'Noah';
  }

  if (userId === 2005) {
    return 'Ivy';
  }

  if (userId === 2006) {
    return 'Liam';
  }

  if (userId === 9000) {
    return 'Admin';
  }

  return `User ${userId}`;
}

function resolveSampleCustomerName(customerId: number) {
  if (customerId === 1001) {
    return 'Acme Trading';
  }

  if (customerId === 1002) {
    return 'Bravo Retail';
  }

  return `Customer ${customerId}`;
}

function resolveSampleQuoteNo(quoteOrderId: number) {
  return `Q20260708${String(quoteOrderId).padStart(4, '0')}`;
}

function resolveSampleTitle(customerName: string, title?: string) {
  return title ?? `${customerName} 样品单`;
}

function normalizeSampleText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeSampleNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeSampleImageUrls(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function buildSampleOrderExtendedFields(
  payload: Partial<SampleOrderDetailRecord> & {
    quoteNo?: string;
    sampleNo?: string;
  },
  quoteItem?: {
    sku?: string;
    productName?: string;
    quantity?: number;
    imageUrls?: string[];
  },
) {
  const imageUrls = normalizeSampleImageUrls(
    payload.imageUrls,
    normalizeSampleImageUrls(quoteItem?.imageUrls),
  );

  return {
    importantEnglishTitle: normalizeSampleText(
      payload.importantEnglishTitle,
      quoteItem?.productName ?? '',
    ),
    orderCode: normalizeSampleText(payload.orderCode, payload.quoteNo ?? payload.sampleNo ?? ''),
    purchaseUnit: normalizeSampleText(payload.purchaseUnit),
    salesProductCode: normalizeSampleText(payload.salesProductCode, quoteItem?.sku ?? ''),
    internalProductCode: normalizeSampleText(payload.internalProductCode),
    imageUrls,
    sampleQuantity: normalizeSampleNumber(payload.sampleQuantity, quoteItem?.quantity ?? 0),
    estimatedCompletionDate: normalizeSampleText(payload.estimatedCompletionDate),
    freightForwarder: normalizeSampleText(payload.freightForwarder),
    domesticTrackingNo: normalizeSampleText(payload.domesticTrackingNo),
    domesticCourierFee: normalizeSampleNumber(payload.domesticCourierFee),
    internationalCourierFee: normalizeSampleNumber(payload.internationalCourierFee),
    estimatedArrivalDate: normalizeSampleText(payload.estimatedArrivalDate),
  };
}

function buildSourceQuotePreferredSampleFields(
  payload: Partial<SampleOrderDetailRecord>,
  quoteItem?: {
    sku?: string;
    productName?: string;
    quantity?: number;
    imageUrls?: string[];
  },
) {
  return {
    ...payload,
    importantEnglishTitle: normalizeSampleText(
      quoteItem?.productName,
      payload.importantEnglishTitle ?? '',
    ),
    salesProductCode: normalizeSampleText(quoteItem?.sku, payload.salesProductCode ?? ''),
    internalProductCode: normalizeSampleText(
      quoteItem?.sku,
      payload.internalProductCode ?? '',
    ),
    imageUrls: normalizeSampleImageUrls(quoteItem?.imageUrls, payload.imageUrls ?? []),
  };
}

function mergeSampleOrderExecutionFields(
  record: SampleOrderDetailRecord,
  payload: SampleOrderTransitionPayload,
) {
  return {
    purchaseUnit: normalizeSampleText(payload.purchaseUnit, record.purchaseUnit ?? ''),
    estimatedCompletionDate: normalizeSampleText(
      payload.estimatedCompletionDate,
      record.estimatedCompletionDate ?? '',
    ),
    freightForwarder: normalizeSampleText(payload.freightForwarder, record.freightForwarder ?? ''),
    domesticTrackingNo: normalizeSampleText(
      payload.domesticTrackingNo,
      record.domesticTrackingNo ?? '',
    ),
    domesticCourierFee: normalizeSampleNumber(
      payload.domesticCourierFee,
      record.domesticCourierFee ?? 0,
    ),
    internationalCourierFee: normalizeSampleNumber(
      payload.internationalCourierFee,
      record.internationalCourierFee ?? 0,
    ),
    estimatedArrivalDate: normalizeSampleText(
      payload.estimatedArrivalDate,
      record.estimatedArrivalDate ?? '',
    ),
  };
}

function mergeSampleOrderDraftFields(
  record: SampleOrderDetailRecord,
  payload: SaveSampleOrderDraftPayload,
) {
  return {
    sampleRequirements: normalizeSampleText(
      payload.sampleRequirements,
      record.sampleRequirements ?? '',
    ),
    samplingCost: normalizeSampleNumber(
      payload.samplingCost,
      record.samplingCost ?? 0,
    ),
    sampleQuantity: normalizeSampleNumber(
      payload.sampleQuantity,
      record.sampleQuantity ?? 0,
    ),
    purchaseUnit: normalizeSampleText(payload.purchaseUnit, record.purchaseUnit ?? ''),
    estimatedCompletionDate: normalizeSampleText(
      payload.estimatedCompletionDate,
      record.estimatedCompletionDate ?? '',
    ),
  };
}

function resolveSecondaryStatus(record: SampleOrderDetailRecord) {
  if (record.isCancelled) {
    return 'cancel_recorded';
  }

  if (record.isReplacement) {
    return `replacement_v${record.currentVersionNo}`;
  }

  if (record.currentStatus === 'pending_sampling') {
    return 'quote_confirmed';
  }

  if (record.currentStatus === 'pending_approval') {
    return 'quote_confirmed';
  }

  return record.secondaryStatus ?? record.currentStatus;
}

function toAuditLogRecord(record: {
  id: bigint;
  bizType: string;
  bizId: bigint;
  operationType: string;
  operatorId: bigint;
  beforeData: unknown | null;
  afterData: unknown | null;
  createdAt: Date;
}) {
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

type SampleOrderAuditLogEntry = Omit<
  SampleOrderAuditLogRecord,
  'id' | 'createdAt'
>;

function recordSampleOrderAuditLog(
  store: {
    recordAuditLog(entry: SampleOrderAuditLogEntry): SampleOrderAuditLogRecord;
  },
  entry: SampleOrderAuditLogEntry,
) {
  store.recordAuditLog(entry);
}

function createSampleOrderListItem(record: SampleOrderDetailRecord): SampleListItem {
  return {
    moduleLabel: '样品单',
    docNo: record.sampleNo,
    title: record.title,
    status: record.currentStatus,
    secondaryStatus: resolveSecondaryStatus(record),
    customerName: record.customerName,
    createdBy: resolveSampleUserName(record.createdBy),
    ownerName: record.ownerName,
    quoteNo: record.quoteNo,
    isReplacement: record.isReplacement,
    isCancelled: record.isCancelled,
    createdAt: record.createdAt,
    detailHref: `/samples/${record.id}`,
  };
}

function toSampleOrderDocumentPayload(
  record: PrismaBusinessDocumentRecord,
): SampleOrderDetailRecord {
  const payload = record.payload;
  const customerId = Number(payload.customerId ?? record.counterpartyId ?? 0n);
  const createdBy = Number(payload.createdBy ?? record.createdBy ?? 0n);
  const customerName = payload.customerName ?? resolveSampleCustomerName(customerId);
  const currentVersionNo = payload.currentVersionNo ?? 1;
  const quoteNo = payload.quoteNo ?? resolveSampleQuoteNo(Number(payload.sourceQuoteOrderId ?? 0));
  const sampleNo = record.docNo;
  const extendedFields = buildSampleOrderExtendedFields({
    ...payload,
    quoteNo,
    sampleNo,
  });

  return {
    ...payload,
    id: Number(payload.id ?? record.id),
    sampleNo,
    currentVersionNo,
    currentStatus: record.status,
    sourceQuoteOrderId: Number(payload.sourceQuoteOrderId ?? 0),
    sourceQuoteVersionNo: Number(payload.sourceQuoteVersionNo ?? 0),
    customerId,
    customerName,
    createdBy,
    ownerName: payload.ownerName ?? resolveSampleUserName(createdBy),
    quoteNo,
    sampleRequirements: payload.sampleRequirements ?? '',
    samplingCost: payload.samplingCost ?? null,
    isReplacement: Boolean(payload.isReplacement),
    isCancelled: Boolean(payload.isCancelled),
    title: resolveSampleTitle(customerName, payload.title),
    secondaryStatus: payload.secondaryStatus ?? record.status,
    createdAt: payload.createdAt ?? record.createdAt.toISOString(),
    ...extendedFields,
    cancelReason: payload.cancelReason,
    replacedVersionNo: payload.replacedVersionNo,
    versionHistory: Array.isArray(payload.versionHistory)
      ? payload.versionHistory.map((item) => ({ ...item }))
      : [],
  };
}

function buildSampleOrderFallbackDetail(record: SampleListItem & { id: number }): SampleOrderDetailRecord {
  const customerName = record.customerName;
  const createdBy = record.createdBy === 'Mia' ? 2003 : record.createdBy === 'Noah' ? 2004 : 2005;
  const ownerName = record.ownerName === 'Zoe' ? 'Zoe' : 'Liam';

  return {
    id: record.id,
    sampleNo: record.docNo,
    currentVersionNo: record.status === 'sample_sent' ? 2 : 1,
    currentStatus: record.status,
    sourceQuoteOrderId: record.id + 6,
    sourceQuoteVersionNo: record.status === 'sample_sent' ? 2 : 1,
    customerId: customerName === 'Bravo Retail' ? 1002 : 1001,
    customerName,
    createdBy,
    ownerName,
    quoteNo: record.quoteNo,
    sampleRequirements:
      record.id === 1
        ? '首版样品，需确认风扇外壳和叶片颜色'
        : record.id === 2
          ? '替代插座样品，按新版外壳颜色打样'
          : '灯具样品取消，已记录取消原因',
    samplingCost: record.id === 3 ? 0 : record.id === 2 ? 800 : 1200,
    isReplacement: record.isReplacement,
    isCancelled: record.isCancelled,
    title: record.title,
    secondaryStatus: record.secondaryStatus,
    createdAt: record.createdAt,
    ...buildSampleOrderExtendedFields({
      quoteNo: record.quoteNo,
      sampleNo: record.docNo,
      purchaseUnit: record.id === 2 ? '宁波智造工厂' : '深圳星河工厂',
      salesProductCode: record.id === 2 ? 'SALE-SOCKET-002' : 'SALE-SAMPLE-001',
      internalProductCode: record.id === 2 ? 'SUP002-002' : 'SUP001-001',
      imageUrls: [],
      sampleQuantity: record.id === 2 ? 6 : 3,
      estimatedCompletionDate: record.id === 3 ? '' : '2026-07-28',
      freightForwarder: record.id === 2 ? 'FedEx' : 'DHL',
      domesticTrackingNo: record.id === 2 ? 'SF987654321CN' : '',
      domesticCourierFee: record.id === 2 ? 28 : 0,
      internationalCourierFee: record.id === 2 ? 98 : 0,
      estimatedArrivalDate: record.id === 2 ? '2026-08-05' : '',
    }),
    cancelReason: record.id === 3 ? '客户取消样品需求' : undefined,
    versionHistory:
      record.id === 1
        ? [
            createSampleOrderVersionHistoryEntry({
              versionNo: 1,
              status: 'pending_sampling',
              createdAt: record.createdAt,
              changeReason: '报价确认后进入打样',
            }),
          ]
        : record.id === 2
          ? [
              createSampleOrderVersionHistoryEntry({
                versionNo: 1,
                status: 'pending_approval',
                createdAt: '2026-07-07T10:10:00.000Z',
              }),
              createSampleOrderVersionHistoryEntry({
                versionNo: 2,
                status: 'sample_sent',
                createdAt: record.createdAt,
                changeReason: '客户要求替代版本',
                replacedVersionNo: 1,
              }),
            ]
          : [
              createSampleOrderVersionHistoryEntry({
                versionNo: 1,
                status: 'canceled',
                createdAt: '2026-07-06T15:00:00.000Z',
                cancelReason: '客户取消样品需求',
              }),
            ],
  };
}

const fallbackSampleOrders = new Map<number, SampleOrderDetailRecord>(
  sampleOrderListData.map((item) => {
    const fallback = buildSampleOrderFallbackDetail({
      ...item,
      id: Number(item.detailHref.split('/').pop() ?? 0),
    });
    return [fallback.id, fallback];
  }),
);

function cloneSampleOrder(record: SampleOrderDetailRecord): SampleOrderDetailRecord {
  return {
    ...record,
    imageUrls: [...(record.imageUrls ?? [])],
    versionHistory: record.versionHistory.map((item) => ({ ...item })),
  };
}

@Injectable()
export class SampleOrderService {
  private readonly store = resolveSampleOrderStore();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  private get prismaDb() {
    return this.prisma as PrismaSampleDb | undefined;
  }

  private listRuntimeSampleOrders() {
    const stored = this.store.listSampleOrders();
    const storedIds = new Set(stored.map((item) => item.id));
    const fallback = sampleOrderListData.filter((item) => {
      const id = Number(item.detailHref.split('/').pop() ?? 0);
      return !storedIds.has(id);
    });

    return [
      ...fallback,
      ...stored.map(createSampleOrderListItem),
    ];
  }

  private async listAllSampleOrderDetails() {
    if (this.shouldUsePrisma()) {
      const records = (await this.prismaDb!.businessDocument.findMany({
        where: { bizType: 'sample_order' },
        orderBy: { createdAt: 'desc' },
      })) as PrismaBusinessDocumentRecord[];

      return records.map(toSampleOrderDocumentPayload);
    }

    const stored = this.store.listSampleOrders();
    const storedIds = new Set(stored.map((item) => item.id));
    const fallback = Array.from(fallbackSampleOrders.values()).filter(
      (item) => !storedIds.has(item.id),
    );

    return [
      ...fallback.map(cloneSampleOrder),
      ...stored.map(cloneSampleOrder),
    ];
  }

  private getMutableSampleOrder(id: number) {
    const stored = this.store.getSampleOrder(id);
    if (stored) {
      return stored;
    }

    const fallback = fallbackSampleOrders.get(id);
    if (!fallback) {
      return undefined;
    }

    this.store.upsertSampleOrder(fallback);
    return this.store.getSampleOrder(id);
  }

  private getStoredOrFallbackDetail(id: number) {
    const stored = this.store.getSampleOrder(id);
    if (stored) {
      return stored;
    }

    const fallback = fallbackSampleOrders.get(id);
    if (!fallback) {
      return undefined;
    }

    return cloneSampleOrder(fallback);
  }

  private buildSyntheticSampleOrder(
    id: number,
    status: string,
    currentVersionNo = 1,
    overrides: Partial<SampleOrderDetailRecord> = {},
  ): SampleOrderDetailRecord {
    const customerName = overrides.customerName ?? resolveSampleCustomerName(overrides.customerId ?? 1001);
    const createdBy = overrides.createdBy ?? 2001;
    const ownerName = overrides.ownerName ?? resolveSampleUserName(createdBy);
    const sampleNo = overrides.sampleNo ?? `SP20260711${String(id).padStart(4, '0')}`;
    const sourceQuoteOrderId = overrides.sourceQuoteOrderId ?? 7;
    const sourceQuoteVersionNo = overrides.sourceQuoteVersionNo ?? 1;
    const quoteNo = overrides.quoteNo ?? resolveSampleQuoteNo(sourceQuoteOrderId);
    const sampleOrderBase = {
      ...overrides,
      quoteNo,
      sampleNo,
    };

    return {
      id,
      sampleNo,
      currentVersionNo,
      currentStatus: status,
      sourceQuoteOrderId,
      sourceQuoteVersionNo,
      customerId: overrides.customerId ?? 1001,
      customerName,
      createdBy,
      ownerName,
      quoteNo,
      sampleRequirements: overrides.sampleRequirements ?? '正式页样品要求',
      samplingCost: overrides.samplingCost ?? 0,
      isReplacement: overrides.isReplacement ?? false,
      isCancelled: overrides.isCancelled ?? false,
      title: resolveSampleTitle(customerName, overrides.title),
      secondaryStatus: overrides.secondaryStatus ?? 'quote_confirmed',
      createdAt: overrides.createdAt ?? '2026-07-11T09:00:00.000Z',
      ...buildSampleOrderExtendedFields(sampleOrderBase),
      cancelReason: overrides.cancelReason,
      replacedVersionNo: overrides.replacedVersionNo,
      versionHistory:
        overrides.versionHistory ?? [
          createSampleOrderVersionHistoryEntry({
            versionNo: currentVersionNo,
            status,
            createdAt: overrides.createdAt ?? '2026-07-11T09:00:00.000Z',
          }),
        ],
    };
  }

  private async updateSampleOrderDocument(payload: {
    sampleOrderId: number;
    status: string;
    operationType: string;
    mutate?: (record: SampleOrderDetailRecord) => SampleOrderDetailRecord;
  }) {
    if (!this.shouldUsePrisma()) {
      return undefined;
    }

    const existing = (await this.prismaDb!.businessDocument.findUnique({
      where: { id: BigInt(payload.sampleOrderId) },
    })) as PrismaBusinessDocumentRecord | null;

    if (!existing || existing.bizType !== 'sample_order') {
      return undefined;
    }

    const beforeData = toSampleOrderDocumentPayload(existing);
    const baseNext = {
      ...beforeData,
      currentStatus: payload.status,
      isCancelled: payload.status === 'canceled' ? true : beforeData.isCancelled,
      secondaryStatus:
        payload.status === 'canceled'
          ? 'cancel_recorded'
          : beforeData.secondaryStatus,
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
        bizType: 'sample_order',
        bizId: updated.id,
        operationType: payload.operationType,
        operatorId: existing.createdBy ?? 0n,
        beforeData,
        afterData: nextPayload,
      },
    });

    return nextPayload;
  }

  async list(
    query: SampleListQuery,
    session?: FormalSession,
  ): Promise<SampleListResponse> {
    const usePrisma = this.shouldUsePrisma();
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const sortBy =
      query.sortBy === 'docNo' || query.sortBy === 'customerName'
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const keyword = query.keyword?.trim().toLowerCase();
    const customerName = query.customerName?.trim().toLowerCase();
    const createdBy = query.createdBy?.trim().toLowerCase();
    const ownerName = query.ownerName?.trim().toLowerCase();
    const quoteNo = query.quoteNo?.trim().toLowerCase();
    const isReplacement = normalizeTriStateFilter(query.isReplacement);
    const isCancelled = normalizeTriStateFilter(query.isCancelled);
    const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
    const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;

    const sourceItems = usePrisma
      ? (
          (await this.prismaDb!.businessDocument.findMany({
            where: { bizType: 'sample_order' },
            orderBy: { createdAt: 'desc' },
          })) as PrismaBusinessDocumentRecord[]
        ).map(toSampleOrderDocumentPayload).map(createSampleOrderListItem)
      : this.listRuntimeSampleOrders();

    const filtered = filterVisibleFormalItems(
      sourceItems,
      session ?? {},
      ['admin', 'boss', 'sales_manager', 'purchase_manager'],
    ).filter((item) => {
      if (
        keyword &&
        ![
          item.docNo,
          item.title,
          item.customerName,
          item.ownerName,
          item.quoteNo,
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

      if (createdBy && !item.createdBy.toLowerCase().includes(createdBy)) {
        return false;
      }

      if (ownerName && !item.ownerName.toLowerCase().includes(ownerName)) {
        return false;
      }

      if (!usePrisma && quoteNo && !item.quoteNo.toLowerCase().includes(quoteNo)) {
        return false;
      }

      if (isReplacement !== 'all') {
        const expected = isReplacement === 'yes';
        if (item.isReplacement !== expected) {
          return false;
        }
      }

      if (isCancelled !== 'all') {
        const expected = isCancelled === 'yes';
        if (item.isCancelled !== expected) {
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
        createdBy: query.createdBy ?? null,
        ownerName: query.ownerName ?? null,
        quoteNo: query.quoteNo ?? null,
        isReplacement,
        isCancelled,
      },
    };
  }

  async getSourceQuoteSampleSummary(quoteOrderId: number) {
    const items = await this.listAllSampleOrderDetails();
    const matched = items
      .filter((item) => item.sourceQuoteOrderId === quoteOrderId)
      .sort((left, right) => {
        const createdAtOrder = right.createdAt.localeCompare(left.createdAt);
        return createdAtOrder === 0 ? right.id - left.id : createdAtOrder;
      });

    return {
      quoteOrderId,
      totalSampleCount: matched.length,
      activeSampleCount: matched.filter((item) => !item.isCancelled).length,
      latestSampleNo: matched[0]?.sampleNo ?? null,
    };
  }

  async listAuditLogs() {
    if (this.shouldUsePrisma()) {
      const logs = (await this.prismaDb!.operationLog.findMany({
        where: { bizType: 'sample_order' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })) as Array<{
        id: bigint;
        bizType: string;
        bizId: bigint;
        operationType: string;
        operatorId: bigint;
        beforeData: unknown | null;
        afterData: unknown | null;
        createdAt: Date;
      }>;

      return {
        items: logs.map(toAuditLogRecord),
      };
    }

    return {
      items: this.store.listAuditLogs(),
    };
  }

  async create(dto: {
    quoteOrderId: number;
    quoteVersionNo: number;
    customerId: number;
    createdBy: number;
    sampleRequirements: string;
    samplingCost?: number;
    quoteConfirmed?: boolean;
    importantEnglishTitle?: string;
    orderCode?: string;
    purchaseUnit?: string;
    salesProductCode?: string;
    internalProductCode?: string;
    imageUrls?: string[];
    sampleQuantity?: number;
    estimatedCompletionDate?: string;
    freightForwarder?: string;
    domesticTrackingNo?: string;
    domesticCourierFee?: number;
    internationalCourierFee?: number;
    estimatedArrivalDate?: string;
  }) {
    if (dto.quoteConfirmed !== true) {
      throw new BadRequestException(
        'Only confirmed quote versions can create sample orders',
      );
    }

    await this.assertSourceQuoteBossConfirmed(
      dto.quoteOrderId,
      dto.quoteVersionNo,
      '只有老板已确认的报价单才能创建样品单',
    );

    const customerName = resolveSampleCustomerName(dto.customerId);
    const ownerName = resolveSampleUserName(dto.createdBy);
    let sourceQuoteItem:
      | {
          sku?: string;
          productName?: string;
          quantity?: number;
          imageUrls?: string[];
        }
      | undefined;
    let quoteNo = resolveSampleQuoteNo(dto.quoteOrderId);

    if (this.shouldUsePrisma()) {
      const sourceQuoteRecord = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(dto.quoteOrderId) },
      })) as SourceQuoteDocumentRecord | null;
      sourceQuoteItem = sourceQuoteRecord?.payload?.items?.[0];
      quoteNo = sourceQuoteRecord?.payload?.quoteNo ?? sourceQuoteRecord?.docNo ?? quoteNo;
    } else {
      const sourceQuote = resolveQuoteStore().getQuote(dto.quoteOrderId);
      sourceQuoteItem = sourceQuote?.items[0];
      quoteNo = sourceQuote?.quoteNo ?? quoteNo;
    }

    const sourcePreferredFields = buildSourceQuotePreferredSampleFields(
      {
        ...dto,
        quoteNo,
      },
      sourceQuoteItem,
    );
    const extendedFields = buildSampleOrderExtendedFields(
      sourcePreferredFields,
      sourceQuoteItem,
    );

    if (this.shouldUsePrisma()) {
      const payload: SampleOrderDetailRecord = {
        id: 0,
        sampleNo: 'PENDING-SAMPLE',
        currentVersionNo: 1,
        currentStatus: 'draft',
        sourceQuoteOrderId: dto.quoteOrderId,
        sourceQuoteVersionNo: dto.quoteVersionNo,
        customerId: dto.customerId,
        customerName,
        createdBy: dto.createdBy,
        ownerName,
        quoteNo,
        sampleRequirements: dto.sampleRequirements,
        samplingCost: dto.samplingCost ?? 0,
        isReplacement: false,
        isCancelled: false,
        title: resolveSampleTitle(customerName),
        secondaryStatus: 'draft',
        createdAt: new Date().toISOString(),
        ...extendedFields,
        versionHistory: [
          createSampleOrderVersionHistoryEntry({
            versionNo: 1,
            status: 'draft',
            createdAt: new Date().toISOString(),
          }),
        ],
      };

      const created = (await this.prismaDb!.businessDocument.create({
        data: {
          bizType: 'sample_order',
          docNo: `PENDING-SAMPLE-${Date.now()}`,
          status: 'draft',
          ownerUserId: BigInt(dto.createdBy),
          counterpartyId: BigInt(dto.customerId),
          payload,
          createdBy: BigInt(dto.createdBy),
        },
      })) as PrismaBusinessDocumentRecord;

      const finalPayload: SampleOrderDetailRecord = {
        ...payload,
        id: Number(created.id),
        sampleNo: buildSequentialDocumentCode('SP', Number(created.id)),
      };

      const updated = (await this.prismaDb!.businessDocument.update({
        where: { id: created.id },
        data: {
          docNo: finalPayload.sampleNo,
          payload: finalPayload,
        },
      })) as PrismaBusinessDocumentRecord;

      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'sample_order',
          bizId: updated.id,
          operationType: 'create_sample_order',
          operatorId: BigInt(dto.createdBy),
          beforeData: undefined,
          afterData: finalPayload,
        },
      });

      return finalPayload;
    }

    const id = this.store.nextSampleOrderId();
    const created: SampleOrderDetailRecord = {
      id,
      sampleNo: buildSequentialDocumentCode('SP', id),
      currentVersionNo: 1,
      currentStatus: 'draft',
      sourceQuoteOrderId: dto.quoteOrderId,
      sourceQuoteVersionNo: dto.quoteVersionNo,
      customerId: dto.customerId,
      customerName,
      createdBy: dto.createdBy,
      ownerName,
      quoteNo,
      sampleRequirements: dto.sampleRequirements,
      samplingCost: dto.samplingCost ?? 0,
      isReplacement: false,
      isCancelled: false,
      title: resolveSampleTitle(customerName),
      secondaryStatus: 'draft',
      createdAt: new Date().toISOString(),
      ...extendedFields,
      versionHistory: [
        createSampleOrderVersionHistoryEntry({
          versionNo: 1,
          status: 'draft',
          createdAt: new Date().toISOString(),
        }),
      ],
    };

    this.store.upsertSampleOrder(created);
    recordSampleOrderAuditLog(this.store, {
      bizType: 'sample_order',
      bizId: created.id,
      operationType: 'create_sample_order',
      operatorId: dto.createdBy,
      beforeData: null,
      afterData: snapshotAuditData(created),
    });

    return created;
  }

  private async assertSourceQuoteBossConfirmed(
    quoteOrderId: number,
    quoteVersionNo: number,
    errorMessage: string,
  ) {
    if (this.shouldUsePrisma()) {
      const record = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(quoteOrderId) },
      })) as SourceQuoteDocumentRecord | null;

      if (
        !record ||
        record.bizType !== 'quote' ||
        (record.payload?.status ?? record.status) !== 'boss_confirmed' ||
        (record.payload?.currentVersionNo ?? quoteVersionNo) !== quoteVersionNo
      ) {
        throw new BadRequestException(errorMessage);
      }

      return;
    }

    const quote = resolveQuoteStore().getQuote(quoteOrderId);
    if (
      !quote ||
      quote.status !== 'boss_confirmed' ||
      quote.currentVersionNo !== quoteVersionNo
    ) {
      throw new BadRequestException(errorMessage);
    }
  }

  async getDetail(id: number, session?: FormalSession) {
    if (this.shouldUsePrisma()) {
      const created = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaBusinessDocumentRecord | null;

      if (created && created.bizType === 'sample_order') {
        const detail = toSampleOrderDocumentPayload(created);
        const listItem = createSampleOrderListItem(detail);
        if (
          session?.role &&
          !isFormalAdminOrBoss(session?.role) &&
          session?.role !== 'sales_manager' &&
          session?.role !== 'purchase_manager' &&
          !matchesFormalUser(session ?? {}, listItem)
        ) {
          throw new NotFoundException('样品单不存在');
        }

        return detail;
      }
    }

    const detail = this.getStoredOrFallbackDetail(id);

    if (detail) {
      const listItem = createSampleOrderListItem(detail);
      if (
        session?.role &&
        !isFormalAdminOrBoss(session?.role) &&
        session?.role !== 'sales_manager' &&
        session?.role !== 'purchase_manager' &&
        !matchesFormalUser(session ?? {}, listItem)
      ) {
        throw new NotFoundException('样品单不存在');
      }

      return detail;
    }

    const fallback = this.buildSyntheticSampleOrder(id, 'pending_approval');
    const fallbackListItem = createSampleOrderListItem(fallback);

    if (
      session?.role &&
      !isFormalAdminOrBoss(session?.role) &&
      session?.role !== 'sales_manager' &&
      session?.role !== 'purchase_manager' &&
      !matchesFormalUser(session ?? {}, fallbackListItem)
    ) {
      throw new NotFoundException('样品单不存在');
    }

    return fallback;
  }

  async getVersions(id: number, session?: FormalSession) {
    const detail = await this.getDetail(id, session);
    return detail.versionHistory.map((item) => ({ ...item }));
  }

  async createVersion(payload: CreateSampleOrderVersionPayload) {
    const allowedStatuses = new Set([
      'pending_sampling',
      'sampling',
      'sample_sent',
      'customer_confirmed',
    ]);

    if (!allowedStatuses.has(payload.currentStatus)) {
      throw new BadRequestException(
        'Only active sample orders can create replacement versions',
      );
    }

    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(payload.sampleOrderId) },
      })) as PrismaBusinessDocumentRecord | null;

      if (!existing || existing.bizType !== 'sample_order') {
        const synthetic = this.buildSyntheticSampleOrder(
          payload.sampleOrderId,
          'pending_approval',
          payload.currentVersionNo + 1,
          {
            createdBy: payload.createdBy,
            sampleRequirements: payload.sampleRequirements,
            secondaryStatus: `replacement_v${payload.currentVersionNo + 1}`,
            isReplacement: true,
            replacedVersionNo: payload.currentVersionNo,
          },
        );
        await this.prismaDb!.operationLog.create({
          data: {
            bizType: 'sample_order',
            bizId: BigInt(payload.sampleOrderId),
            operationType: 'create_sample_order_version',
            operatorId: BigInt(payload.createdBy),
            beforeData: null,
            afterData: synthetic,
          },
        });

        return synthetic;
      }

      const beforeData = toSampleOrderDocumentPayload(existing);
      const nextVersionNo = Number(beforeData.currentVersionNo ?? payload.currentVersionNo) + 1;
      const nextPayload: SampleOrderDetailRecord = {
        ...beforeData,
        currentVersionNo: nextVersionNo,
        currentStatus: 'pending_approval',
        sampleRequirements: payload.sampleRequirements,
        samplingCost: payload.samplingCost ?? beforeData.samplingCost ?? 0,
        isReplacement: true,
        secondaryStatus: `replacement_v${nextVersionNo}`,
        replacedVersionNo: payload.currentVersionNo,
        versionHistory: [
          ...beforeData.versionHistory,
          createSampleOrderVersionHistoryEntry({
            versionNo: nextVersionNo,
            status: 'pending_approval',
            createdAt: new Date().toISOString(),
            changeReason: payload.changeReason,
            replacedVersionNo: payload.currentVersionNo,
          }),
        ],
      };

      const updated = (await this.prismaDb!.businessDocument.update({
        where: { id: existing.id },
        data: {
          status: 'pending_approval',
          payload: nextPayload,
        },
      })) as PrismaBusinessDocumentRecord;

      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'sample_order',
          bizId: updated.id,
          operationType: 'create_sample_order_version',
          operatorId: BigInt(payload.createdBy),
          beforeData,
          afterData: nextPayload,
        },
      });

      return nextPayload;
    }

    const existing = this.getMutableSampleOrder(payload.sampleOrderId);
    if (!existing) {
      const synthetic = this.buildSyntheticSampleOrder(
        payload.sampleOrderId,
        'pending_approval',
        payload.currentVersionNo + 1,
        {
          createdBy: payload.createdBy,
          sampleRequirements: payload.sampleRequirements,
          secondaryStatus: `replacement_v${payload.currentVersionNo + 1}`,
          isReplacement: true,
          replacedVersionNo: payload.currentVersionNo,
        },
      );
      recordSampleOrderAuditLog(this.store, {
        bizType: 'sample_order',
        bizId: synthetic.id,
        operationType: 'create_sample_order_version',
        operatorId: payload.createdBy,
        beforeData: null,
        afterData: snapshotAuditData(synthetic),
      });

      return synthetic;
    }

    const nextVersionNo = existing.currentVersionNo + 1;
    const updated = {
      ...existing,
      currentVersionNo: nextVersionNo,
      currentStatus: 'pending_approval',
      sampleRequirements: payload.sampleRequirements,
      samplingCost: payload.samplingCost ?? existing.samplingCost ?? 0,
      isReplacement: true,
      secondaryStatus: `replacement_v${nextVersionNo}`,
      replacedVersionNo: payload.currentVersionNo,
      versionHistory: [
        ...existing.versionHistory,
        createSampleOrderVersionHistoryEntry({
          versionNo: nextVersionNo,
          status: 'pending_approval',
          createdAt: new Date().toISOString(),
          changeReason: payload.changeReason,
          replacedVersionNo: payload.currentVersionNo,
        }),
      ],
    };

    this.store.upsertSampleOrder(updated);
    recordSampleOrderAuditLog(this.store, {
      bizType: 'sample_order',
      bizId: updated.id,
      operationType: 'create_sample_order_version',
      operatorId: payload.createdBy,
      beforeData: snapshotAuditData(existing),
      afterData: snapshotAuditData(updated),
    });
    return updated;
  }

  async submit(payload: SubmitSampleOrderPayload) {
    const allowedStatuses = new Set(['draft', 'pending_approval']);
    if (!allowedStatuses.has(payload.currentStatus)) {
      throw new BadRequestException('Only draft sample orders can be submitted');
    }

    if (this.shouldUsePrisma()) {
      const nextPayload = await this.updateSampleOrderDocument({
        sampleOrderId: payload.sampleOrderId,
        status: 'pending_approval',
        operationType: 'submit_sample_order',
        mutate: (record) => ({
          ...record,
          ...mergeSampleOrderDraftFields(record, payload),
          currentStatus: 'pending_approval',
        }),
      });

      return {
        id: payload.sampleOrderId,
        currentStatus: nextPayload?.currentStatus ?? 'pending_approval',
      };
    }

    const existing = this.getMutableSampleOrder(payload.sampleOrderId);
    if (existing) {
      const updated = {
        ...existing,
        ...mergeSampleOrderDraftFields(existing, payload),
        currentStatus: 'pending_approval',
        versionHistory: [
          ...existing.versionHistory,
          createSampleOrderVersionHistoryEntry({
            versionNo: existing.currentVersionNo,
            status: 'pending_approval',
            createdAt: new Date().toISOString(),
          }),
        ],
      };
      this.store.upsertSampleOrder(updated);
      recordSampleOrderAuditLog(this.store, {
        bizType: 'sample_order',
        bizId: updated.id,
        operationType: 'submit_sample_order',
        operatorId: existing.createdBy,
        beforeData: snapshotAuditData(existing),
        afterData: snapshotAuditData(updated),
      });
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'pending_approval',
    };
  }

  async saveDraft(payload: SaveSampleOrderDraftPayload) {
    if (payload.currentStatus !== 'draft') {
      throw new BadRequestException('Only draft sample orders can be saved');
    }

    if (this.shouldUsePrisma()) {
      const nextPayload = await this.updateSampleOrderDocument({
        sampleOrderId: payload.sampleOrderId,
        status: 'draft',
        operationType: 'save_sample_order_draft',
        mutate: (record) => ({
          ...record,
          ...mergeSampleOrderDraftFields(record, payload),
        }),
      });

      return {
        id: payload.sampleOrderId,
        currentStatus: nextPayload?.currentStatus ?? 'draft',
      };
    }

    const existing = this.getMutableSampleOrder(payload.sampleOrderId);
    if (existing) {
      const updated = {
        ...existing,
        ...mergeSampleOrderDraftFields(existing, payload),
        currentStatus: 'draft',
      };
      this.store.upsertSampleOrder(updated);
      recordSampleOrderAuditLog(this.store, {
        bizType: 'sample_order',
        bizId: updated.id,
        operationType: 'save_sample_order_draft',
        operatorId: existing.createdBy,
        beforeData: snapshotAuditData(existing),
        afterData: snapshotAuditData(updated),
      });
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'draft',
    };
  }

  async approve(payload: SampleOrderTransitionPayload) {
    if (payload.currentStatus !== 'pending_approval') {
      throw new BadRequestException(
        'Only pending approval sample orders can be approved',
      );
    }

    if (this.shouldUsePrisma()) {
      const nextPayload = await this.updateSampleOrderDocument({
        sampleOrderId: payload.sampleOrderId,
        status: 'pending_sampling',
        operationType: 'approve_sample_order',
      });

      return {
        id: payload.sampleOrderId,
        currentStatus: nextPayload?.currentStatus ?? 'pending_sampling',
      };
    }

    const existing = this.getMutableSampleOrder(payload.sampleOrderId);
    if (existing) {
      const updated = {
        ...existing,
        currentStatus: 'pending_sampling',
        versionHistory: [
          ...existing.versionHistory,
          createSampleOrderVersionHistoryEntry({
            versionNo: existing.currentVersionNo,
            status: 'pending_sampling',
            createdAt: new Date().toISOString(),
          }),
        ],
      };
      this.store.upsertSampleOrder(updated);
      recordSampleOrderAuditLog(this.store, {
        bizType: 'sample_order',
        bizId: updated.id,
        operationType: 'approve_sample_order',
        operatorId: existing.createdBy,
        beforeData: snapshotAuditData(existing),
        afterData: snapshotAuditData(updated),
      });
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'pending_sampling',
    };
  }

  async reject(payload: SampleOrderTransitionPayload) {
    if (payload.currentStatus !== 'pending_approval') {
      throw new BadRequestException(
        'Only pending approval sample orders can be rejected',
      );
    }

    if (this.shouldUsePrisma()) {
      const nextPayload = await this.updateSampleOrderDocument({
        sampleOrderId: payload.sampleOrderId,
        status: 'draft',
        operationType: 'reject_sample_order',
      });

      return {
        id: payload.sampleOrderId,
        currentStatus: nextPayload?.currentStatus ?? 'draft',
      };
    }

    const existing = this.getMutableSampleOrder(payload.sampleOrderId);
    if (existing) {
      const updated = {
        ...existing,
        currentStatus: 'draft',
        versionHistory: [
          ...existing.versionHistory,
          createSampleOrderVersionHistoryEntry({
            versionNo: existing.currentVersionNo,
            status: 'draft',
            createdAt: new Date().toISOString(),
          }),
        ],
      };
      this.store.upsertSampleOrder(updated);
      recordSampleOrderAuditLog(this.store, {
        bizType: 'sample_order',
        bizId: updated.id,
        operationType: 'reject_sample_order',
        operatorId: existing.createdBy,
        beforeData: snapshotAuditData(existing),
        afterData: snapshotAuditData(updated),
      });
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'draft',
    };
  }

  async startSampling(payload: SampleOrderTransitionPayload) {
    if (payload.currentStatus !== 'pending_sampling') {
      throw new BadRequestException(
        'Only pending sampling sample orders can start sampling',
      );
    }

    if (this.shouldUsePrisma()) {
      const nextPayload = await this.updateSampleOrderDocument({
        sampleOrderId: payload.sampleOrderId,
        status: 'sampling',
        operationType: 'start_sample_order_sampling',
        mutate: (record) => ({
          ...record,
          ...mergeSampleOrderExecutionFields(record, payload),
        }),
      });

      return {
        id: payload.sampleOrderId,
        currentStatus: nextPayload?.currentStatus ?? 'sampling',
      };
    }

    const existing = this.getMutableSampleOrder(payload.sampleOrderId);
    if (existing) {
      const updated = {
        ...existing,
        ...mergeSampleOrderExecutionFields(existing, payload),
        currentStatus: 'sampling',
        versionHistory: [
          ...existing.versionHistory,
          createSampleOrderVersionHistoryEntry({
            versionNo: existing.currentVersionNo,
            status: 'sampling',
            createdAt: new Date().toISOString(),
          }),
        ],
      };
      this.store.upsertSampleOrder(updated);
      recordSampleOrderAuditLog(this.store, {
        bizType: 'sample_order',
        bizId: updated.id,
        operationType: 'start_sample_order_sampling',
        operatorId: existing.createdBy,
        beforeData: snapshotAuditData(existing),
        afterData: snapshotAuditData(updated),
      });
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'sampling',
    };
  }

  async markSent(payload: SampleOrderTransitionPayload) {
    if (payload.currentStatus !== 'sampling') {
      throw new BadRequestException(
        'Only sampling sample orders can be marked sent',
      );
    }

    if (this.shouldUsePrisma()) {
      const nextPayload = await this.updateSampleOrderDocument({
        sampleOrderId: payload.sampleOrderId,
        status: 'sample_sent',
        operationType: 'mark_sample_order_sent',
        mutate: (record) => ({
          ...record,
          ...mergeSampleOrderExecutionFields(record, payload),
        }),
      });

      return {
        id: payload.sampleOrderId,
        currentStatus: nextPayload?.currentStatus ?? 'sample_sent',
      };
    }

    const existing = this.getMutableSampleOrder(payload.sampleOrderId);
    if (existing) {
      const updated = {
        ...existing,
        ...mergeSampleOrderExecutionFields(existing, payload),
        currentStatus: 'sample_sent',
        versionHistory: [
          ...existing.versionHistory,
          createSampleOrderVersionHistoryEntry({
            versionNo: existing.currentVersionNo,
            status: 'sample_sent',
            createdAt: new Date().toISOString(),
          }),
        ],
      };
      this.store.upsertSampleOrder(updated);
      recordSampleOrderAuditLog(this.store, {
        bizType: 'sample_order',
        bizId: updated.id,
        operationType: 'mark_sample_order_sent',
        operatorId: existing.createdBy,
        beforeData: snapshotAuditData(existing),
        afterData: snapshotAuditData(updated),
      });
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'sample_sent',
    };
  }

  async markCustomerConfirmed(payload: SampleOrderTransitionPayload) {
    if (payload.currentStatus !== 'sample_sent') {
      throw new BadRequestException(
        'Only sent sample orders can be customer confirmed',
      );
    }

    if (this.shouldUsePrisma()) {
      const nextPayload = await this.updateSampleOrderDocument({
        sampleOrderId: payload.sampleOrderId,
        status: 'customer_confirmed',
        operationType: 'confirm_sample_order',
      });

      return {
        id: payload.sampleOrderId,
        currentStatus: nextPayload?.currentStatus ?? 'customer_confirmed',
      };
    }

    const existing = this.getMutableSampleOrder(payload.sampleOrderId);
    if (existing) {
      const updated = {
        ...existing,
        currentStatus: 'customer_confirmed',
        versionHistory: [
          ...existing.versionHistory,
          createSampleOrderVersionHistoryEntry({
            versionNo: existing.currentVersionNo,
            status: 'customer_confirmed',
            createdAt: new Date().toISOString(),
          }),
        ],
      };
      this.store.upsertSampleOrder(updated);
      recordSampleOrderAuditLog(this.store, {
        bizType: 'sample_order',
        bizId: updated.id,
        operationType: 'confirm_sample_order',
        operatorId: existing.createdBy,
        beforeData: snapshotAuditData(existing),
        afterData: snapshotAuditData(updated),
      });
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'customer_confirmed',
    };
  }

  async closeNoFollowup(payload: CloseNoFollowupSampleOrderPayload) {
    if (payload.currentStatus !== 'sample_sent') {
      throw new BadRequestException(
        'Only sent sample orders can be closed as no follow-up',
      );
    }

    if (this.shouldUsePrisma()) {
      const nextPayload = await this.updateSampleOrderDocument({
        sampleOrderId: payload.sampleOrderId,
        status: 'closed_no_followup',
        operationType: 'close_sample_order_no_followup',
        mutate: (record) => ({
          ...record,
          currentStatus: 'closed_no_followup',
          secondaryStatus: 'no_followup_recorded',
          cancelReason: payload.closeReason,
          versionHistory: [
            ...record.versionHistory,
            createSampleOrderVersionHistoryEntry({
              versionNo: record.currentVersionNo,
              status: 'closed_no_followup',
              createdAt: new Date().toISOString(),
              cancelReason: payload.closeReason,
            }),
          ],
        }),
      });

      return {
        id: payload.sampleOrderId,
        currentStatus: nextPayload?.currentStatus ?? 'closed_no_followup',
        closeReason: payload.closeReason,
      };
    }

    const existing = this.getMutableSampleOrder(payload.sampleOrderId);
    if (existing) {
      const updated = {
        ...existing,
        currentStatus: 'closed_no_followup',
        secondaryStatus: 'no_followup_recorded',
        cancelReason: payload.closeReason,
        versionHistory: [
          ...existing.versionHistory,
          createSampleOrderVersionHistoryEntry({
            versionNo: existing.currentVersionNo,
            status: 'closed_no_followup',
            createdAt: new Date().toISOString(),
            cancelReason: payload.closeReason,
          }),
        ],
      };
      this.store.upsertSampleOrder(updated);
      recordSampleOrderAuditLog(this.store, {
        bizType: 'sample_order',
        bizId: updated.id,
        operationType: 'close_sample_order_no_followup',
        operatorId: existing.createdBy,
        beforeData: snapshotAuditData(existing),
        afterData: snapshotAuditData(updated),
      });
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'closed_no_followup',
      closeReason: payload.closeReason,
    };
  }

  async cancel(payload: CancelSampleOrderPayload) {
    if (payload.hasProductionStarted) {
      throw new BadRequestException('Cannot cancel after sampling has started');
    }

    if (this.shouldUsePrisma()) {
      const nextPayload = await this.updateSampleOrderDocument({
        sampleOrderId: payload.sampleOrderId,
        status: 'canceled',
        operationType: 'cancel_sample_order',
        mutate: (record) => ({
          ...record,
          currentStatus: 'canceled',
          isCancelled: true,
          cancelReason: payload.cancelReason,
          secondaryStatus: 'cancel_recorded',
          versionHistory: [
            ...record.versionHistory,
            createSampleOrderVersionHistoryEntry({
              versionNo: record.currentVersionNo,
              status: 'canceled',
              createdAt: new Date().toISOString(),
              cancelReason: payload.cancelReason,
            }),
          ],
        }),
      });

      return {
        id: payload.sampleOrderId,
        currentStatus: nextPayload?.currentStatus ?? 'canceled',
        cancelReason: payload.cancelReason,
      };
    }

    const existing = this.getMutableSampleOrder(payload.sampleOrderId);
    if (existing) {
      const updated = {
        ...existing,
        currentStatus: 'canceled',
        isCancelled: true,
        cancelReason: payload.cancelReason,
        secondaryStatus: 'cancel_recorded',
        versionHistory: [
          ...existing.versionHistory,
          createSampleOrderVersionHistoryEntry({
            versionNo: existing.currentVersionNo,
            status: 'canceled',
            createdAt: new Date().toISOString(),
            cancelReason: payload.cancelReason,
          }),
        ],
      };
      this.store.upsertSampleOrder(updated);
      recordSampleOrderAuditLog(this.store, {
        bizType: 'sample_order',
        bizId: updated.id,
        operationType: 'cancel_sample_order',
        operatorId: existing.createdBy,
        beforeData: snapshotAuditData(existing),
        afterData: snapshotAuditData(updated),
      });
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'canceled',
      cancelReason: payload.cancelReason,
    };
  }
}
