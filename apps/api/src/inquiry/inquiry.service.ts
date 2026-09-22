import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  inquiryListData,
  type InquiryListItem,
  type InquirySupplierQuote,
  type InquiryStatus,
} from './inquiry-list.data';
import { resolveQuoteStore } from '../quote/quote.store';
import {
  type FormalSession,
  filterVisibleFormalItems,
} from '../auth/formal-session';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import {
  resolveInquiryStore,
  type InquiryAuditLogRecord,
} from './inquiry.store';
import { CounterpartyService } from '../counterparty/counterparty.service';
import type { QuoteDetailRecord } from '../quote/quote.service';

export type InquiryListQuery = {
  keyword?: string;
  docNo?: string;
  quoteNo?: string;
  status?: InquiryStatus | 'all';
  customerName?: string;
  createdBy?: string;
  page?: number;
  pageSize?: number;
};

export type InquiryListResponse = {
  items: InquiryListItem[];
  page: number;
  pageSize: number;
  total: number;
  appliedFilters: {
    keyword: string | null;
    docNo: string | null;
    quoteNo: string | null;
    status: InquiryStatus | 'all';
    customerName: string | null;
    createdBy: string | null;
  };
};

type SubmitPayload = {
  inquiryId: number;
  items: Array<{
    itemId: number;
    supplierQuotes: Array<{
      supplierSourceMode?: 'counterparty' | 'manual';
      supplierId?: number;
      supplierCode?: string;
      supplierName?: string;
      purchasePrice?: number;
      productId?: number;
      productSku?: string;
      productStatus?: 'active' | 'inactive' | 'deleted';
    }>;
  }>;
};

type InquiryItemMutationPayload = {
  itemId: number;
  supplierQuotes?: Array<{
    supplierSourceMode?: 'counterparty' | 'manual';
    supplierId?: number;
    supplierCode?: string;
    supplierName?: string;
    purchasePrice?: number;
    productId?: number;
    productSku?: string;
    productStatus?: 'active' | 'inactive' | 'deleted';
  }>;
  confirmedSalePrice?: number;
  selectedSupplierQuoteIndex?: number;
};

type ConfirmPayload = {
  inquiryId: number;
  items: Array<{
    itemId: number;
    supplierQuoteCount: number;
    confirmedSalePrice: number;
    selectedSupplierQuoteIndex?: number;
  }>;
};

type PrismaBusinessDocumentRecord = {
  id: bigint;
  bizType: string;
  docNo: string;
  status: string;
  ownerUserId: bigint | null;
  counterpartyId: bigint | null;
  payload: InquiryListItem;
  createdBy: bigint | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaQuoteBusinessDocumentRecord = Omit<
  PrismaBusinessDocumentRecord,
  'payload'
> & {
  payload: QuoteDetailRecord;
};

type PrismaInquiryDb = PrismaService & {
  businessDocument: {
    findMany: (...args: any[]) => Promise<unknown>;
    findUnique: (...args: any[]) => Promise<unknown>;
    update: (...args: any[]) => Promise<unknown>;
  };
  operationLog: {
    create: (...args: any[]) => Promise<unknown>;
    findMany: (...args: any[]) => Promise<unknown>;
  };
};

type QuoteImageSourceItem = {
  lineNo: number;
  imageUrls: string[];
};

type QuoteImageSource = {
  id: number;
  quoteNo: string;
  items: QuoteImageSourceItem[];
};

function normalizeSupplierQuotes(
  value: Array<{
    supplierSourceMode?: 'counterparty' | 'manual';
    supplierId?: number;
    supplierCode?: string;
    supplierName?: string;
    purchasePrice?: number;
    productId?: number;
    productSku?: string;
    productStatus?: 'active' | 'inactive' | 'deleted';
  }>,
): InquirySupplierQuote[] {
  return value
    .map(
      (item): InquirySupplierQuote => ({
        supplierSourceMode:
          item.supplierSourceMode === 'manual' ? 'manual' : 'counterparty',
        supplierId:
          Number.isInteger(item.supplierId) && Number(item.supplierId) > 0
            ? Number(item.supplierId)
            : undefined,
        supplierCode: item.supplierCode?.trim() || undefined,
        supplierName: item.supplierName?.trim() ?? '',
        purchasePrice: Number(item.purchasePrice ?? 0),
        productId:
          Number.isInteger(item.productId) && Number(item.productId) > 0
            ? Number(item.productId)
            : undefined,
        productSku: item.productSku?.trim() || undefined,
        productStatus:
          item.productStatus === 'inactive' ||
          item.productStatus === 'deleted' ||
          item.productStatus === 'active'
            ? item.productStatus
            : undefined,
      }),
    )
    .filter(
      (item) =>
        item.supplierName.length > 0 &&
        Number.isFinite(item.purchasePrice) &&
        item.purchasePrice > 0,
    );
}

function normalizeLegacySupplierQuoteIds(value: unknown): InquirySupplierQuote[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => Number.isInteger(item) && Number(item) > 0)
    .map((item) => ({
      supplierSourceMode: 'manual' as const,
      supplierName: `历史供应商 ${Number(item)}`,
      purchasePrice: 0,
    }));
}

function normalizeInquiryItems(
  value: unknown,
): InquiryListItem['items'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const candidate = item as Partial<InquiryListItem['items'][number]> & {
      supplierQuoteIds?: unknown;
      supplierQuotes?: unknown;
      imageUrls?: unknown;
      productCategory?: unknown;
    };

    const supplierQuotes = Array.isArray(candidate.supplierQuotes)
      ? normalizeSupplierQuotes(candidate.supplierQuotes)
      : normalizeLegacySupplierQuoteIds(candidate.supplierQuoteIds);

    return {
      itemId:
        Number.isInteger(candidate.itemId) && Number(candidate.itemId) > 0
          ? Number(candidate.itemId)
          : index + 1,
      lineNo:
        Number.isInteger(candidate.lineNo) && Number(candidate.lineNo) > 0
          ? Number(candidate.lineNo)
          : index + 1,
      productId:
        Number.isInteger(candidate.productId) && Number(candidate.productId) > 0
          ? Number(candidate.productId)
          : undefined,
      sku: typeof candidate.sku === 'string' ? candidate.sku : '',
      productName:
        typeof candidate.productName === 'string' ? candidate.productName : '',
      productCategory:
        typeof candidate.productCategory === 'string'
          ? candidate.productCategory
          : undefined,
      unit: typeof candidate.unit === 'string' ? candidate.unit : undefined,
      imageUrls: Array.isArray(candidate.imageUrls)
        ? candidate.imageUrls
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        : [],
      requiredSupplierCount:
        Number.isInteger(candidate.requiredSupplierCount) &&
        Number(candidate.requiredSupplierCount) > 0
          ? Number(candidate.requiredSupplierCount)
          : 2,
      supplierQuotes,
      confirmedSalePrice: Number(candidate.confirmedSalePrice ?? 0),
      confirmedSupplierQuoteIndex:
        Number.isInteger(candidate.confirmedSupplierQuoteIndex) &&
        Number(candidate.confirmedSupplierQuoteIndex) >= 0
          ? Number(candidate.confirmedSupplierQuoteIndex)
          : undefined,
      confirmedSupplierId:
        Number.isInteger(candidate.confirmedSupplierId) &&
        Number(candidate.confirmedSupplierId) > 0
          ? Number(candidate.confirmedSupplierId)
          : undefined,
      confirmedSupplierCode:
        typeof candidate.confirmedSupplierCode === 'string'
          ? candidate.confirmedSupplierCode.trim() || undefined
          : undefined,
      confirmedSupplierName:
        typeof candidate.confirmedSupplierName === 'string'
          ? candidate.confirmedSupplierName.trim() || undefined
          : undefined,
      confirmedPurchasePrice:
        Number.isFinite(Number(candidate.confirmedPurchasePrice))
          ? Number(candidate.confirmedPurchasePrice)
          : undefined,
      confirmedProductId:
        Number.isInteger(candidate.confirmedProductId) &&
        Number(candidate.confirmedProductId) > 0
          ? Number(candidate.confirmedProductId)
          : undefined,
    };
  });
}

function toInquiryListItem(record: PrismaBusinessDocumentRecord): InquiryListItem {
  const items = normalizeInquiryItems(record.payload.items);

  return {
    ...record.payload,
    id: Number(record.payload.id ?? record.id),
    inquiryNo: record.docNo,
    status: record.status as InquiryStatus,
    supplierCount: countInquirySupplierQuotes(items),
    createdAt: record.payload.createdAt ?? record.createdAt.toISOString(),
    detailHref:
      record.payload.detailHref ?? `/app/sales/inquiries/${Number(record.id)}`,
    items,
  };
}

function normalizeInquiryListItemSummary(item: InquiryListItem): InquiryListItem {
  const items = normalizeInquiryItems(item.items);

  return {
    ...item,
    supplierCount: countInquirySupplierQuotes(items),
    items,
  };
}

async function enrichInquiryListItems(
  items: InquiryListItem[],
  counterpartyService: CounterpartyService,
) {
  return Promise.all(
    items.map(async (item) => {
      const matchedCounterparty = item.customerId
        ? await counterpartyService.findById(item.customerId)
        : null;

      return {
        ...item,
        customerFullName:
          matchedCounterparty?.shortName ?? item.customerFullName,
      } satisfies InquiryListItem;
    }),
  );
}

function toAuditLogRecord(record: {
  id: bigint;
  bizType: string;
  bizId: bigint;
  operationType: string;
  operatorId: bigint | null;
  beforeData: unknown | null;
  afterData: unknown | null;
  createdAt: Date;
}) {
  return {
    id: Number(record.id),
    bizType: record.bizType,
    bizId: Number(record.bizId),
    operationType: record.operationType,
    operatorId: record.operatorId == null ? 0 : Number(record.operatorId),
    beforeData: record.beforeData,
    afterData: record.afterData,
    createdAt: record.createdAt.toISOString(),
  };
}

function snapshotAuditData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeInquiryItems(
  existingItems: InquiryListItem['items'],
  submittedItems: InquiryItemMutationPayload[],
) {
  const submittedItemsMap = new Map(
    submittedItems.map((item) => [item.itemId, item]),
  );

  return existingItems.map((item) => {
    const submittedItem = submittedItemsMap.get(item.itemId);
    if (!submittedItem) {
      return item;
    }

    const supplierQuotes = submittedItem.supplierQuotes
      ? normalizeSupplierQuotes(submittedItem.supplierQuotes)
      : null;
    const confirmedSalePrice =
      submittedItem.confirmedSalePrice === undefined
        ? item.confirmedSalePrice
        : Number(submittedItem.confirmedSalePrice);
    const selectedSupplierQuoteIndex =
      submittedItem.selectedSupplierQuoteIndex === undefined
        ? item.confirmedSupplierQuoteIndex
        : Number(submittedItem.selectedSupplierQuoteIndex);
    const selectedSupplierQuote = findSelectedSupplierQuote(
      {
        ...item,
        ...(supplierQuotes ? { supplierQuotes } : {}),
      },
      selectedSupplierQuoteIndex,
    );

    return {
      ...item,
      ...(supplierQuotes ? { supplierQuotes } : {}),
      confirmedSalePrice,
      ...(selectedSupplierQuote
        ? {
            confirmedSupplierQuoteIndex: selectedSupplierQuoteIndex,
            confirmedSupplierId: selectedSupplierQuote.supplierId,
            confirmedSupplierCode: selectedSupplierQuote.supplierCode,
            confirmedSupplierName: selectedSupplierQuote.supplierName,
            confirmedPurchasePrice: selectedSupplierQuote.purchasePrice,
            confirmedProductId: selectedSupplierQuote.productId,
          }
        : {}),
    };
  });
}

function findUnknownInquiryItemIds(
  existingItems: InquiryListItem['items'],
  submittedItems: Array<{ itemId: number }>,
) {
  const existingItemIds = new Set(existingItems.map((item) => item.itemId));

  return submittedItems
    .map((item) => Number(item.itemId))
    .filter(
      (itemId) =>
        !Number.isInteger(itemId) ||
        itemId <= 0 ||
        !existingItemIds.has(itemId),
    );
}

function findMissingInquiryItemIds(
  existingItems: InquiryListItem['items'],
  submittedItems: Array<{ itemId: number }>,
) {
  const submittedItemIds = new Set(
    submittedItems
      .map((item) => Number(item.itemId))
      .filter((itemId) => Number.isInteger(itemId) && itemId > 0),
  );

  return existingItems
    .map((item) => item.itemId)
    .filter((itemId) => !submittedItemIds.has(itemId));
}

function countInquirySupplierQuotes(items: InquiryListItem['items']) {
  return new Set(
    items.flatMap((item) =>
      item.supplierQuotes.map((quote) =>
        quote.supplierId
          ? `id:${quote.supplierId}`
          : `manual:${quote.supplierName.toLowerCase()}`,
      ),
    ),
  ).size;
}

function resolveLinkedQuoteStatus(status: InquiryStatus) {
  if (status === 'pending_boss_review') {
    return 'pending_boss_confirm';
  }

  if (status === 'boss_confirmed') {
    return 'boss_confirmed';
  }

  return 'submitted';
}

function resolveLinkedQuoteProgress(status: InquiryStatus) {
  if (status === 'pending_boss_review') {
    return '待老板确认';
  }

  if (status === 'boss_confirmed') {
    return '老板已确认';
  }

  return '待询价';
}

function syncQuoteSupplierSelectionFromInquiry(
  quoteItems: QuoteDetailRecord['items'],
  inquiryItems: InquiryListItem['items'],
) {
  return quoteItems.map((quoteItem) => {
    const matchedInquiryItem = inquiryItems.find(
      (item) =>
        item.lineNo === quoteItem.lineNo ||
        item.itemId === quoteItem.productId,
    );

    if (!matchedInquiryItem) {
      return quoteItem;
    }

    return {
      ...quoteItem,
      confirmedSalePrice: Number(matchedInquiryItem.confirmedSalePrice ?? 0),
      confirmedSupplierQuoteIndex: matchedInquiryItem.confirmedSupplierQuoteIndex,
      confirmedSupplierId: matchedInquiryItem.confirmedSupplierId,
      confirmedSupplierCode: matchedInquiryItem.confirmedSupplierCode,
      confirmedSupplierName: matchedInquiryItem.confirmedSupplierName,
      confirmedPurchasePrice: matchedInquiryItem.confirmedPurchasePrice,
      confirmedProductId: matchedInquiryItem.confirmedProductId,
    };
  });
}

function findSelectedSupplierQuote(
  item: InquiryListItem['items'][number],
  selectedIndex: number | undefined,
) {
  if (
    !Number.isInteger(selectedIndex) ||
    selectedIndex === undefined ||
    selectedIndex < 0 ||
    selectedIndex >= item.supplierQuotes.length
  ) {
    return null;
  }

  return item.supplierQuotes[selectedIndex] ?? null;
}

function normalizeImageUrls(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeQuoteImageItems(value: unknown): QuoteImageSourceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const candidate = item as Partial<QuoteImageSourceItem> & {
      imageUrls?: unknown;
    };

    return {
      lineNo:
        Number.isInteger(candidate.lineNo) && Number(candidate.lineNo) > 0
          ? Number(candidate.lineNo)
          : index + 1,
      imageUrls: normalizeImageUrls(candidate.imageUrls),
    };
  });
}

@Injectable()
export class InquiryService {
  private readonly store = resolveInquiryStore();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  private get prismaDb() {
    return this.prisma as PrismaInquiryDb | undefined;
  }

  private ensureRuntimeSeeded() {
    if (this.store.listInquiries().length > 0) {
      return;
    }

    inquiryListData.forEach((item) => {
      this.store.upsertInquiry(item);
    });
  }

  private async loadExistingInquiry(inquiryId: number) {
    if (this.shouldUsePrisma()) {
      const record = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(inquiryId) },
      })) as PrismaBusinessDocumentRecord | null;

      return record ? toInquiryListItem(record) : undefined;
    }

    this.ensureRuntimeSeeded();
    const inquiry = this.store.getInquiry(inquiryId);
    return inquiry ? normalizeInquiryListItemSummary(inquiry) : undefined;
  }

  private async loadEnrichedInquiryItems() {
    const sourceItems = this.shouldUsePrisma()
      ? (
          (await this.prismaDb!.businessDocument.findMany({
            where: { bizType: 'quote_inquiry' },
            orderBy: { createdAt: 'desc' },
          })) as PrismaBusinessDocumentRecord[]
        ).map(toInquiryListItem)
      : (this.ensureRuntimeSeeded(), this.store.listInquiries().map(normalizeInquiryListItemSummary));
    const counterpartyService = new CounterpartyService(this.prisma);
    const hydratedItems = await this.hydrateInquiryImageItems(sourceItems);

    return enrichInquiryListItems(hydratedItems, counterpartyService);
  }

  private async loadSourceQuoteImages(
    inquiry: InquiryListItem,
  ): Promise<QuoteImageSource | null> {
    const quoteId = inquiry.sourceQuoteId ?? inquiry.quoteOrderId;

    if (!Number.isInteger(quoteId) || quoteId <= 0) {
      return null;
    }

    if (this.shouldUsePrisma()) {
      const record = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(quoteId) },
      })) as PrismaBusinessDocumentRecord | null;

      if (!record || record.bizType !== 'quote') {
        return null;
      }

      const payload = record.payload as {
        id?: number;
        items?: unknown;
      };

      return {
        id: Number(payload.id ?? record.id),
        quoteNo: record.docNo,
        items: normalizeQuoteImageItems(payload.items),
      };
    }

    const quote = resolveQuoteStore().getQuote(quoteId);
    if (!quote) {
      return null;
    }

    return {
      id: quote.id,
      quoteNo: quote.quoteNo,
      items: normalizeQuoteImageItems(quote.items),
    };
  }

  private async hydrateInquiryImageItems(items: InquiryListItem[]) {
    return Promise.all(
      items.map(async (item) => {
        if (item.items.every((entry) => normalizeImageUrls(entry.imageUrls).length > 0)) {
          return item;
        }

        const sourceQuote = await this.loadSourceQuoteImages(item);
        if (!sourceQuote) {
          return item;
        }

        return {
          ...item,
          items: item.items.map((entry) => {
            if (normalizeImageUrls(entry.imageUrls).length > 0) {
              return entry;
            }

            const sourceItem = sourceQuote.items.find(
              (candidate) => candidate.lineNo === entry.lineNo,
            );

            return {
              ...entry,
              imageUrls: sourceItem?.imageUrls ?? [],
            };
          }),
        } satisfies InquiryListItem;
      }),
    );
  }

  async getById(id: number, session?: FormalSession) {
    const items = await this.loadEnrichedInquiryItems();
    const visibleItems = filterVisibleFormalItems(
      items,
      session ?? {},
      ['admin', 'boss', 'purchase_manager', 'purchase'],
    );
    const matched = visibleItems.find((item) => item.id === id);

    if (!matched) {
      throw new NotFoundException('询价单不存在');
    }

    return matched;
  }

  async list(
    query: InquiryListQuery,
    session?: FormalSession,
  ): Promise<InquiryListResponse> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const keyword = query.keyword?.trim().toLowerCase();
    const quoteNo = query.quoteNo?.trim().toLowerCase();
    const customerName = query.customerName?.trim().toLowerCase();
    const createdBy = query.createdBy?.trim().toLowerCase();

    const enrichedSourceItems = await this.loadEnrichedInquiryItems();

    const filtered = filterVisibleFormalItems(
      enrichedSourceItems,
      session ?? {},
      ['admin', 'boss', 'purchase_manager', 'purchase'],
    ).filter((item) => {
      if (
        keyword &&
        ![
          item.inquiryNo,
          item.quoteOrderNo,
          item.customerName,
          item.customerFullName ?? '',
          item.comparisonSummary,
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      ) {
        return false;
      }

      if (query.docNo && item.inquiryNo !== query.docNo) {
        return false;
      }

      if (quoteNo && !item.quoteOrderNo.toLowerCase().includes(quoteNo)) {
        return false;
      }

      if (query.status && query.status !== 'all' && item.status !== query.status) {
        return false;
      }

      if (
        customerName &&
        ![item.customerName, item.customerFullName ?? '']
          .join(' ')
          .toLowerCase()
          .includes(customerName)
      ) {
        return false;
      }

      if (createdBy && !item.createdBy.toLowerCase().includes(createdBy)) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
    const start = (page - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      page,
      pageSize,
      total: filtered.length,
      appliedFilters: {
        keyword: query.keyword ?? null,
        docNo: query.docNo ?? null,
        quoteNo: query.quoteNo ?? null,
        status: query.status ?? 'all',
        customerName: query.customerName ?? null,
        createdBy: query.createdBy ?? null,
      },
    };
  }

  async listAuditLogs() {
    if (this.shouldUsePrisma()) {
      const logs = (await this.prismaDb!.operationLog.findMany({
        where: { bizType: 'quote_inquiry' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })) as Array<{
        id: bigint;
        bizType: string;
        bizId: bigint;
        operationType: string;
        operatorId: bigint | null;
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

  async submitForComparison(payload: SubmitPayload, session?: FormalSession) {
    if (!Array.isArray(payload.items)) {
      throw new BadRequestException('Inquiry items must be an array');
    }

    const inquiry = await this.loadExistingInquiry(payload.inquiryId);
    const existingStatus = inquiry?.status;

    if (!existingStatus) {
      throw new NotFoundException('询价单不存在');
    }

    if (inquiry.items.length === 0 || payload.items.length === 0) {
      throw new BadRequestException('询价单至少需要 1 行明细');
    }

    if (existingStatus === 'boss_confirmed') {
      throw new BadRequestException('只有待询价状态的询价单才能提交比价');
    }

    const unknownItemIds = findUnknownInquiryItemIds(inquiry.items, payload.items);
    if (unknownItemIds.length > 0) {
      throw new BadRequestException('询价明细不存在或已失效');
    }

    const missingItemIds = findMissingInquiryItemIds(inquiry.items, payload.items);
    if (missingItemIds.length > 0) {
      throw new BadRequestException('每个询价明细都需要提交供应商报价');
    }

    const nextItems = mergeInquiryItems(inquiry.items, payload.items);
    const invalidItem = payload.items.find(
      (item) =>
        normalizeSupplierQuotes(item.supplierQuotes).length < 2,
    );
    const incompleteItem = nextItems.find(
      (item) =>
        item.supplierQuotes.length <
        Math.max(Number(item.requiredSupplierCount ?? 2), 2),
    );

    if (invalidItem || incompleteItem) {
      throw new BadRequestException('每个询价明细至少需要 2 条供应商报价');
    }

    const operatorName = session?.user?.trim() || '采购';

    if (this.shouldUsePrisma()) {
      await this.updateInquiryStatus({
        inquiryId: payload.inquiryId,
        status: 'pending_boss_review',
        operationType: 'submit_inquiry_for_comparison',
        items: payload.items,
        operatorName,
      });
    } else {
      const existing = this.store.getInquiry(payload.inquiryId);
      await this.updateRuntimeInquiryStatus(
        payload.inquiryId,
        'pending_boss_review',
        payload.items,
        operatorName,
      );
      if (existing) {
        this.store.recordAuditLog({
          bizType: 'quote_inquiry',
          bizId: existing.id,
          operationType: 'submit_inquiry_for_comparison',
          operatorId: Number(existing.createdBy ?? 0),
          beforeData: snapshotAuditData(existing),
          afterData: snapshotAuditData(this.store.getInquiry(payload.inquiryId) ?? existing),
        });
      }
    }

    return {
      id: payload.inquiryId,
      status: 'pending_boss_review',
    };
  }

  async confirmByBoss(payload: ConfirmPayload, session?: FormalSession) {
    if (!Array.isArray(payload.items)) {
      throw new BadRequestException('Inquiry items must be an array');
    }

    const inquiry = await this.loadExistingInquiry(payload.inquiryId);
    const existingStatus = inquiry?.status;

    if (!existingStatus) {
      throw new NotFoundException('询价单不存在');
    }

    if (inquiry.items.length === 0 || payload.items.length === 0) {
      throw new BadRequestException('询价单至少需要 1 行明细');
    }

    if (existingStatus !== 'pending_boss_review') {
      throw new BadRequestException('只有待老板确认状态的询价单才能老板确认');
    }

    const unknownItemIds = findUnknownInquiryItemIds(inquiry.items, payload.items);
    if (unknownItemIds.length > 0) {
      throw new BadRequestException('询价明细不存在或已失效');
    }

    const missingItemIds = findMissingInquiryItemIds(inquiry.items, payload.items);
    if (missingItemIds.length > 0) {
      throw new BadRequestException('每个询价明细都需要确认售价');
    }

    const nextItems = mergeInquiryItems(inquiry.items, payload.items);
    const incompleteItem = nextItems.find(
      (item) =>
        item.supplierQuotes.length <
          Math.max(Number(item.requiredSupplierCount ?? 2), 2) ||
        item.confirmedSalePrice <= 0,
    );

    if (incompleteItem) {
      throw new BadRequestException(
        'Boss confirmation requires complete item pricing',
      );
    }

    const missingSelectedSupplierItem = nextItems.find(
      (item) =>
        !findSelectedSupplierQuote(item, item.confirmedSupplierQuoteIndex),
    );

    if (missingSelectedSupplierItem) {
      throw new BadRequestException('每个询价明细都需要选择最终供应商');
    }

    const operatorName = session?.user?.trim() || '老板';

    if (this.shouldUsePrisma()) {
      await this.updateInquiryStatus({
        inquiryId: payload.inquiryId,
        status: 'boss_confirmed',
        operationType: 'boss_confirm_inquiry',
        items: payload.items,
        operatorName,
      });
    } else {
      const existing = this.store.getInquiry(payload.inquiryId);
      await this.updateRuntimeInquiryStatus(
        payload.inquiryId,
        'boss_confirmed',
        payload.items,
        operatorName,
      );
      if (existing) {
        this.store.recordAuditLog({
          bizType: 'quote_inquiry',
          bizId: existing.id,
          operationType: 'boss_confirm_inquiry',
          operatorId: Number(existing.createdBy ?? 0),
          beforeData: snapshotAuditData(existing),
          afterData: snapshotAuditData(
            this.store.getInquiry(payload.inquiryId) ?? existing,
          ),
        });
      }
    }

    return {
      id: payload.inquiryId,
      status: 'boss_confirmed',
    };
  }

  private async updateInquiryStatus(payload: {
    inquiryId: number;
    status: InquiryStatus;
    operationType: string;
    items?: InquiryItemMutationPayload[];
    operatorName?: string;
  }) {
    const existing = (await this.prismaDb!.businessDocument.findUnique({
      where: { id: BigInt(payload.inquiryId) },
    })) as PrismaBusinessDocumentRecord | null;

    if (!existing || existing.bizType !== 'quote_inquiry') {
      return;
    }

    const existingPayload = toInquiryListItem(existing);
    const nextItems = payload.items
      ? mergeInquiryItems(existingPayload.items, payload.items)
      : existingPayload.items;
    const nextPayloadBase: InquiryListItem = {
      ...existingPayload,
      status: payload.status,
      supplierCount: countInquirySupplierQuotes(nextItems),
      comparisonSummary:
        payload.status === 'boss_confirmed'
          ? '老板已确认售价。'
          : '比价已提交，等待老板确认最终售价。',
      items: nextItems,
    };
    const nextPayload = nextPayloadBase;
    const updated = (await this.prismaDb!.businessDocument.update({
      where: { id: existing.id },
      data: {
        status: payload.status,
        payload: nextPayload,
      },
    })) as PrismaBusinessDocumentRecord;

    await this.prismaDb!.operationLog.create({
      data: {
        bizType: 'quote_inquiry',
        bizId: updated.id,
        operationType: payload.operationType,
        operatorId: existing.createdBy ?? 0n,
        beforeData: toInquiryListItem(existing),
        afterData: nextPayload,
      },
    });

    await this.syncLinkedQuoteFromInquiry(nextPayload);
  }

  private async updateRuntimeInquiryStatus(
    inquiryId: number,
    status: InquiryStatus,
    items?: InquiryItemMutationPayload[],
    operatorName = 'system',
  ) {
    this.ensureRuntimeSeeded();

    const existing = this.store.getInquiry(inquiryId);
    if (!existing) {
      return;
    }

    const nextItems = items ? mergeInquiryItems(existing.items, items) : existing.items;
    const nextPayloadBase: InquiryListItem = {
      ...existing,
      status,
      supplierCount: countInquirySupplierQuotes(nextItems),
      comparisonSummary:
        status === 'boss_confirmed'
          ? '老板已确认售价。'
          : '比价已提交，等待老板确认最终售价。',
      items: nextItems,
    };
    const nextPayload = nextPayloadBase;

    this.store.upsertInquiry(nextPayload);

    await this.syncLinkedQuoteFromInquiry(nextPayload);
  }

  private async syncLinkedQuoteFromInquiry(inquiry: InquiryListItem) {
    const quoteId = inquiry.sourceQuoteId ?? inquiry.quoteOrderId;

    if (!Number.isInteger(quoteId) || quoteId <= 0) {
      return;
    }

    const quoteStatus = resolveLinkedQuoteStatus(inquiry.status);
    const nextProgress = resolveLinkedQuoteProgress(inquiry.status);

    if (this.shouldUsePrisma()) {
      const quoteRecord = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(quoteId) },
      })) as PrismaQuoteBusinessDocumentRecord | null;

      if (!quoteRecord || quoteRecord.bizType !== 'quote') {
        return;
      }

      const nextPayload: QuoteDetailRecord = {
        ...quoteRecord.payload,
        id: Number(quoteRecord.payload.id ?? quoteRecord.id),
        quoteNo: quoteRecord.docNo,
        status: quoteStatus,
        submitMode: 'submit',
        currentProgress: nextProgress,
        linkedInquiryId: inquiry.id,
        linkedInquiryNo: inquiry.inquiryNo,
        linkedInquiryStatus: inquiry.status,
        items: syncQuoteSupplierSelectionFromInquiry(
          quoteRecord.payload.items ?? [],
          inquiry.items,
        ),
      };

      await this.prismaDb!.businessDocument.update({
        where: { id: quoteRecord.id },
        data: {
          status: quoteStatus,
          payload: nextPayload,
        },
      });
      return;
    }

    const quoteStore = resolveQuoteStore();
    const quote = quoteStore.getQuote(quoteId);

    if (!quote) {
      return;
    }

    quoteStore.upsertQuote({
      ...quote,
      status: quoteStatus,
      submitMode: 'submit',
      currentProgress: nextProgress,
      linkedInquiryId: inquiry.id,
      linkedInquiryNo: inquiry.inquiryNo,
      linkedInquiryStatus: inquiry.status,
      items: syncQuoteSupplierSelectionFromInquiry(quote.items, inquiry.items),
    });
  }
}
