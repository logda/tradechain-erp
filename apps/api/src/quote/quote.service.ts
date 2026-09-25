import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { QuoteListItem, QuoteListQuery, QuoteListResponse } from '@erp/shared';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDraftDto } from './dto/update-quote-draft.dto';
import { quoteListData } from './quote-list.data';
import { resolveQuoteStore } from './quote.store';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import {
  CounterpartyService,
  type CounterpartyRecord,
} from '../counterparty/counterparty.service';
import { type InquiryListItem } from '../inquiry/inquiry-list.data';
import { resolveInquiryStore } from '../inquiry/inquiry.store';
import { DocumentCodeRuleService } from '../document-code-rule/document-code-rule.service';
import { ProductService } from '../product/product.service';
import {
  type FormalSession,
  filterVisibleFormalItems,
  isFormalAdminOrBoss,
  matchesFormalUser,
} from '../auth/formal-session';
import {
  assertCustomerFeedbackTransition,
  assertQuoteCreationCombination,
  resolveSubmittedStatus,
  resolveWorkflowProgress,
  type CustomerFeedbackResult,
  type ProductSource,
  type QuoteVersionSnapshot,
} from './quote-workflow';

export type QuoteDetailRecord = {
  id: number;
  quoteNo: string;
  documentType?: 'demand' | 'quote';
  productSource?: ProductSource;
  status: string;
  currentVersionNo: number;
  customerId: number;
  customerName?: string;
  customerFullName?: string;
  customerCode?: string;
  customerEntryMode?: 'existing' | 'manual';
  salesUserId: number;
  salesUserName?: string;
  sourceCode: string;
  inquiryDate?: string;
  destination?: string;
  requirements: string;
  quoteAttachments?: QuoteAttachmentInfo[];
  currentProgress?: string;
  submitMode?: 'draft' | 'submit';
  linkedInquiryId?: number;
  linkedInquiryNo?: string;
  linkedInquiryStatus?: string;
  sourceDemandId?: number;
  sourceDemandNo?: string;
  sourceDemandSnapshot?: Omit<QuoteDetailRecord, 'sourceDemandSnapshot'>;
  linkedQuoteId?: number;
  linkedQuoteNo?: string;
  linkedInquiryVersionNo?: number;
  versionHistory?: QuoteVersionSnapshot[];
  customerFeedbackResult?: CustomerFeedbackResult;
  customerFeedbackRemark?: string;
  customerFeedbackBy?: string;
  customerFeedbackAt?: string;
  customerFeedbackHistory?: Array<{
    versionNo: number;
    result: CustomerFeedbackResult;
    remark?: string;
    operatedBy: string;
    operatedAt: string;
  }>;
  linkedSalesOrderId?: number;
  linkedSalesOrderNo?: string;
  createdAt: string;
  items: QuoteLineItem[];
};

export type QuoteLineItem = {
  lineNo: number;
  productSource?: ProductSource;
  productId?: number;
  sku: string;
  productName: string;
  productCategory?: string;
  unit: string;
  quantity: number;
  targetPrice?: number;
  salePrice: number;
  amount: number;
  imageUrls?: string[];
  confirmedSalePrice?: number;
  confirmedSupplierQuoteIndex?: number;
  confirmedSupplierId?: number;
  confirmedSupplierCode?: string;
  confirmedSupplierName?: string;
  confirmedPurchasePrice?: number;
  confirmedProductId?: number;
  samplingInfo?: string;
  cartonQuantity?: number;
  outerCartonSizeCm?: string;
  outerCartonGrossWeightKg?: number;
};

export type QuoteAttachmentInfo = {
  key?: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

type QuoteDocumentPayload = QuoteDetailRecord;

type PrismaBusinessDocumentRecord = {
  id: bigint;
  bizType: string;
  docNo: string;
  status: string;
  ownerUserId: bigint | null;
  counterpartyId: bigint | null;
  payload: QuoteDocumentPayload;
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

type PrismaQuoteDb = {
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
  product?: unknown;
};

function normalizeQuoteSourceType(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeQuoteListDocumentType(value: string | undefined) {
  return value === 'demand' || value === 'quote' ? value : undefined;
}

function normalizeTriStateFilter(value: 'all' | 'yes' | 'no' | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

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

function resolveCurrentProgress(detail: {
  status: string;
  currentVersionNo?: number;
  documentType?: 'demand' | 'quote';
}) {
  const explicitProgress = resolveWorkflowProgress(detail.status);
  if (explicitProgress !== detail.status) {
    return explicitProgress;
  }

  if (detail.status === 'draft') {
    return '草稿';
  }

  if (detail.status === 'submitted') {
    return detail.documentType === 'demand' ? '已提交' : '待询价';
  }

  if (
    detail.status === 'pending_boss_confirm' ||
    detail.status === 'pending_boss_confirmation' ||
    detail.status === 'pending_boss_review'
  ) {
    return '待老板确认';
  }

  if (detail.status === 'boss_confirmed') {
    return '老板已确认';
  }

  if (detail.status === 'sample_requested') {
    return '安排打样';
  }

  if (detail.status === 'quoted' && (detail.currentVersionNo ?? 1) > 1) {
    return '再次询价';
  }

  if (detail.status === 'quoted') {
    return '已报价';
  }

  if (detail.status === 'ordered') {
    return '已转销售单';
  }

  return '待报价';
}

function resolveQuoteSubmitMode(value: string | undefined) {
  return value === 'submit' ? 'submit' : 'draft';
}

function normalizeQuoteDocumentType(value: string | undefined) {
  return value === 'demand' ? 'demand' : 'quote';
}

function inferQuoteDocumentTypeFromDocNo(docNo: string | undefined) {
  return docNo?.startsWith('XQ') ? 'demand' : 'quote';
}

function resolveQuoteModuleLabel(documentType: 'demand' | 'quote') {
  return documentType === 'demand' ? '需求单' : '报价单';
}

function isDemandEligibleProductRecord(product: {
  status?: string;
  productStage?: string;
  defaultSalePrice?: number;
  defaultPurchasePrice?: number;
}) {
  return (
    product.status === 'active' &&
    product.productStage === 'formal' &&
    Number(product.defaultSalePrice) > 0
  );
}

function normalizeQuoteProductSource(
  dto: Pick<CreateQuoteDto, 'productSource' | 'items'>,
  fallback?: ProductSource,
): ProductSource {
  if (dto.productSource === 'existing' || dto.productSource === 'candidate') {
    return dto.productSource;
  }

  const items = dto.items ?? [];
  const hasCandidate = items.some((item) => Boolean(item.createCandidateProduct));
  const hasExisting = items.some((item) => !item.createCandidateProduct);
  if (hasCandidate && hasExisting) {
    throw new BadRequestException('同一张单据不能混用产品库产品和手填新产品');
  }

  if (hasCandidate) {
    return 'candidate';
  }

  return fallback ?? 'existing';
}

function normalizeStoredProductSource(
  record: Pick<QuoteDetailRecord, 'productSource' | 'items'>,
): ProductSource {
  if (record.productSource === 'existing' || record.productSource === 'candidate') {
    return record.productSource;
  }

  return record.items.some((item) => !item.productId) ? 'candidate' : 'existing';
}

function resolveProductSalePrice(
  product: Awaited<ReturnType<ProductService['findById']>>,
  quantity: number,
) {
  if (!product) {
    return 0;
  }

  const matchedTier = [...(product.salePriceTiers ?? [])]
    .filter(
      (tier) =>
        tier.status === 'active' &&
        Number.isFinite(Number(tier.minQuantity)) &&
        Number.isFinite(Number(tier.salePrice)) &&
        quantity >= Number(tier.minQuantity),
    )
    .sort((left, right) => Number(right.minQuantity) - Number(left.minQuantity))[0];

  return matchedTier ? Number(matchedTier.salePrice) : Number(product.defaultSalePrice);
}

const procurementSensitiveKeys = new Set([
  'supplierQuotes',
  'supplierId',
  'supplierCode',
  'supplierName',
  'purchasePrice',
  'confirmedSupplierQuoteIndex',
  'confirmedSupplierId',
  'confirmedSupplierCode',
  'confirmedSupplierName',
  'confirmedPurchasePrice',
  'productSizeCm',
  'productMaterial',
  'productPackaging',
  'productWeightG',
  'bulkLeadTimeDays',
]);

function sanitizeProcurementValueForSales(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeProcurementValueForSales);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !procurementSensitiveKeys.has(key))
      .map(([key, entry]) => [key, sanitizeProcurementValueForSales(entry)]),
  );
}

function hideProcurementDetailsFromSales(
  detail: QuoteDetailRecord,
  session?: FormalSession,
): QuoteDetailRecord {
  if (session?.role !== 'sales' && session?.role !== 'sales_manager') {
    return detail;
  }

  return sanitizeProcurementValueForSales(detail) as QuoteDetailRecord;
}

async function validateQuoteItems(
  dto: CreateQuoteDto,
  documentType: 'demand' | 'quote',
  productSource: ProductSource,
  productService: ProductService,
) {
  const items = dto.items ?? [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (productSource === 'candidate') {
      if (!item.createCandidateProduct) {
        throw new BadRequestException(`第 ${index + 1} 行必须填写新产品需求`);
      }
      continue;
    }

    if (item.createCandidateProduct) {
      throw new BadRequestException(`第 ${index + 1} 行必须选择产品库产品`);
    }

    const productId = Number(item.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new BadRequestException(`第 ${index + 1} 行必须选择产品库产品`);
    }

    const product = await productService.findById(productId);
    if (!product || product.status !== 'active') {
      throw new BadRequestException(`第 ${index + 1} 行只能选择产品库中的有效产品`);
    }

    if (documentType === 'demand' && !isDemandEligibleProductRecord(product)) {
      throw new BadRequestException(
        `需求单第 ${index + 1} 行产品必须在产品库中为已启用且有销售价的正式产品`,
      );
    }
  }
}

function buildSubmittedRecord(
  quote: QuoteDetailRecord,
  inquiry?: { id: number; inquiryNo: string },
): QuoteDetailRecord {
  const documentType = quote.documentType ?? inferQuoteDocumentTypeFromDocNo(quote.quoteNo);
  const productSource = normalizeStoredProductSource(quote);
  const status = resolveSubmittedStatus({ documentType, productSource });
  return {
    ...quote,
    documentType,
    productSource,
    submitMode: 'submit',
    status,
    currentProgress: resolveCurrentProgress({
      status,
      currentVersionNo: quote.currentVersionNo,
      documentType,
    }),
    linkedInquiryId: inquiry?.id,
    linkedInquiryNo: inquiry?.inquiryNo,
    linkedInquiryStatus: inquiry ? 'pending_inquiry' : undefined,
  };
}

function buildInquiryItemsFromQuote(
  quote: QuoteDetailRecord,
): InquiryListItem['items'] {
  return quote.items.map((item) => ({
    itemId: item.lineNo,
    lineNo: item.lineNo,
    productId: item.productId,
    sku: item.sku,
    productName: item.productName,
    productCategory: item.productCategory,
    unit: item.unit,
    imageUrls: item.imageUrls ?? [],
    requiredSupplierCount: 2,
    supplierQuotes: [],
    confirmedSalePrice: 0,
  }));
}

function buildInquiryFromQuote(
  quote: QuoteDetailRecord,
  inquiryId: number,
  inquiryNo: string,
): InquiryListItem {
  return {
    id: inquiryId,
    inquiryNo,
    status: 'pending_inquiry',
    sourceQuoteId: quote.id,
    sourceQuoteNo: quote.quoteNo,
    sourceQuoteVersionNo: quote.currentVersionNo ?? 1,
    quoteOrderId: quote.id,
    quoteOrderNo: quote.quoteNo,
    quoteVersionNo: quote.currentVersionNo ?? 1,
    customerName: quote.customerName ?? `客户 ${quote.customerId}`,
    customerFullName: quote.customerFullName,
    customerCode: quote.customerCode,
    customerId: quote.customerId,
    createdBy: quote.salesUserName ?? resolveSalesUserName(quote.salesUserId),
    supplierCount: 0,
    comparisonSummary: '已由报价单生成，等待采购询价。',
    createdAt: quote.createdAt,
    detailHref: `/app/sales/inquiries/${inquiryId}`,
    items: buildInquiryItemsFromQuote(quote),
  };
}

function withLinkedInquiry(
  quote: QuoteDetailRecord,
  inquiry: InquiryListItem,
): QuoteDetailRecord {
  return {
    ...quote,
    status: 'submitted',
    submitMode: 'submit',
    currentProgress: resolveCurrentProgress({
      status: 'submitted',
      currentVersionNo: quote.currentVersionNo,
    }),
    linkedInquiryId: inquiry.id,
    linkedInquiryNo: inquiry.inquiryNo,
    linkedInquiryStatus: inquiry.status,
  };
}

function buildQuoteLineItem(
  item: {
    productSource: ProductSource;
    productId?: number;
    sku: string;
    productName: string;
    productCategory?: string;
    unit: string;
    quantity: number;
    targetPrice?: number;
    salePrice: number;
    imageUrls?: string[];
  },
  index: number,
): QuoteLineItem {
  const quantity = Number(item.quantity);
  const salePrice = Number(item.salePrice);

  return {
    lineNo: index + 1,
    productSource: item.productSource,
    ...(item.productId ? { productId: Number(item.productId) } : {}),
    sku: item.sku,
    productName: item.productName,
    productCategory: item.productCategory,
    unit: item.unit,
    quantity,
    ...(item.targetPrice != null ? { targetPrice: Number(item.targetPrice) } : {}),
    salePrice,
    amount: Number((quantity * salePrice).toFixed(2)),
    imageUrls: Array.isArray(item.imageUrls)
      ? item.imageUrls.filter((entry) => entry.trim()).map((entry) => entry.trim())
      : [],
  };
}

async function normalizeQuoteItems(
  dto: CreateQuoteDto,
  documentType: 'demand' | 'quote',
  productSource: ProductSource,
  productService: ProductService,
): Promise<QuoteLineItem[]> {
  return Promise.all((dto.items ?? []).map(async (item, index) => {
    if (productSource === 'candidate' && item.createCandidateProduct) {
      const candidate = item.createCandidateProduct;
      return buildQuoteLineItem(
        {
          productSource,
          sku: candidate.sku,
          productName: candidate.nameCn,
          productCategory: candidate.category,
          unit: candidate.unit ?? '',
          quantity: Number(item.quantity),
          targetPrice: item.targetPrice != null ? Number(item.targetPrice) : undefined,
          salePrice: documentType === 'demand' ? 0 : Number(item.salePrice),
          imageUrls: item.imageUrls,
        },
        index,
      );
    }

    const product = await productService.findById(Number(item.productId));
    if (!product) {
      throw new BadRequestException(`第 ${index + 1} 行产品不存在`);
    }
    const quantity = Number(item.quantity);
    const salePrice =
      documentType === 'demand'
        ? resolveProductSalePrice(product, quantity)
        : Number.isFinite(Number(item.salePrice))
          ? Number(item.salePrice)
          : Number(product.defaultSalePrice);

    return buildQuoteLineItem(
      {
        productSource,
        productId: product.id,
        sku: product.sku,
        productName: product.nameCn,
        productCategory: product.category,
        unit: product.unit,
        quantity,
        targetPrice: item.targetPrice != null ? Number(item.targetPrice) : undefined,
        salePrice,
        imageUrls: item.imageUrls,
      },
      index,
    );
  }));
}

function normalizeQuoteAttachments(
  attachments: CreateQuoteDto['quoteAttachments'],
): QuoteAttachmentInfo[] {
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
    .filter((attachment): attachment is QuoteAttachmentInfo => attachment !== null);
}

function toQuoteListItem(item: QuoteDetailRecord): QuoteListItem {
  const sourceType = normalizeQuoteSourceType(item.sourceCode) ?? 'unknown';
  const documentType = item.documentType ?? inferQuoteDocumentTypeFromDocNo(item.quoteNo);

  return {
    documentType,
    productSource: normalizeStoredProductSource(item),
    moduleLabel: resolveQuoteModuleLabel(documentType),
    quoteId: item.id,
    docNo: item.quoteNo,
    title: `${item.customerName ?? `客户 ${item.customerId}`} ${resolveQuoteModuleLabel(documentType)}`,
    status: item.status,
    secondaryStatus: item.sourceCode,
    currentVersionNo: item.currentVersionNo,
    customerName: item.customerName ?? `客户 ${item.customerId}`,
    customerFullName: item.customerFullName,
    customerCode: item.customerCode,
    customerId: item.customerId,
    salesUserId: item.salesUserId,
    createdBy: item.salesUserName ?? resolveSalesUserName(item.salesUserId),
    sourceType,
    inquiryDate: item.inquiryDate,
    destination: item.destination,
    requirements: item.requirements,
    items: item.items.map(({ lineNo, productName, quantity, unit }) => ({
      lineNo,
      productName,
      quantity,
      unit,
    })),
    bossConfirmed:
      item.status === 'boss_confirmed' ||
      item.status === 'boss_approved' ||
      item.status === 'pending_customer_feedback' ||
      item.status === 'customer_accepted' ||
      item.status === 'customer_no_follow_up' ||
      item.status === 'repricing_in_progress' ||
      item.status === 'ordered',
    linkedSalesOrderId: item.linkedSalesOrderId,
    linkedSalesOrderNo: item.linkedSalesOrderNo,
    createdAt: item.createdAt,
    detailHref: `/quotes/${item.id}`,
  };
}

async function enrichQuoteListItems(
  items: QuoteListItem[],
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
      } satisfies QuoteListItem;
    }),
  );
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

function toQuoteDocumentPayload(
  record: PrismaBusinessDocumentRecord,
): QuoteDetailRecord {
  const items = Array.isArray(record.payload.items)
    ? record.payload.items.map((item) => ({ ...item }))
    : [];
  const productSource = normalizeStoredProductSource({
    productSource: record.payload.productSource,
    items,
  });

  return {
    ...record.payload,
    id: Number(record.payload.id ?? record.id),
    quoteNo: record.docNo,
    documentType:
      record.payload.documentType ?? inferQuoteDocumentTypeFromDocNo(record.docNo),
    productSource,
    status: record.status,
    currentVersionNo: record.payload.currentVersionNo ?? 1,
    customerId: Number(record.payload.customerId),
    customerName: record.payload.customerName ?? `客户 ${record.payload.customerId}`,
    customerCode: record.payload.customerCode ?? '',
    customerEntryMode: record.payload.customerEntryMode ?? 'existing',
    salesUserId: Number(record.payload.salesUserId),
    salesUserName:
      record.payload.salesUserName ?? resolveSalesUserName(Number(record.payload.salesUserId)),
    sourceCode: record.payload.sourceCode ?? 'expo',
    inquiryDate: record.payload.inquiryDate ?? record.createdAt.toISOString().slice(0, 10),
    destination: record.payload.destination ?? '',
    requirements: record.payload.requirements ?? '',
    quoteAttachments: Array.isArray(record.payload.quoteAttachments)
      ? record.payload.quoteAttachments.map((attachment) => ({ ...attachment }))
      : [],
    submitMode: record.payload.submitMode ?? 'draft',
    currentProgress: resolveCurrentProgress({
      status: record.status,
      currentVersionNo: record.payload.currentVersionNo,
      documentType:
        record.payload.documentType ?? inferQuoteDocumentTypeFromDocNo(record.docNo),
    }),
    linkedInquiryId: record.payload.linkedInquiryId,
    linkedInquiryNo: record.payload.linkedInquiryNo,
    linkedInquiryStatus: record.payload.linkedInquiryStatus,
    linkedSalesOrderId: record.payload.linkedSalesOrderId,
    linkedSalesOrderNo: record.payload.linkedSalesOrderNo,
    createdAt: record.payload.createdAt ?? record.createdAt.toISOString(),
    items: items.map((item) => ({
      ...item,
      productSource: item.productSource ?? productSource,
    })),
  };
}

async function resolveQuoteCustomer(
  dto: CreateQuoteDto,
  counterpartyService: CounterpartyService,
) {
  const entryMode = dto.customerEntryMode ?? 'existing';

  if (entryMode === 'manual') {
    const customerName = dto.customerName?.trim() ?? '';
    const customerCode = dto.customerCode?.trim().toUpperCase() ?? '';

    if (!customerName) {
      throw new BadRequestException('手填客户时，客户名称不能为空');
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
      throw new BadRequestException('报价单客户只能选择客户类往来单位');
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

@Injectable()
export class QuoteService {
  private readonly store = resolveQuoteStore();
  private readonly documentCodeRuleService: DocumentCodeRuleService;

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
    @Optional()
    @Inject(DocumentCodeRuleService)
    documentCodeRuleService?: DocumentCodeRuleService,
  ) {
    this.documentCodeRuleService =
      documentCodeRuleService ?? new DocumentCodeRuleService(this.prisma);
  }

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  private get prismaDb() {
    return this.prisma as PrismaQuoteDb | undefined;
  }

  async list(
    query: QuoteListQuery,
    session?: FormalSession,
  ): Promise<QuoteListResponse> {
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
    const documentType = normalizeQuoteListDocumentType(query.documentType);
    const sourceType = normalizeQuoteSourceType(query.sourceType);
    const bossConfirmed = normalizeTriStateFilter(query.bossConfirmed);
    const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
    const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;

    const sourceItems = this.shouldUsePrisma()
      ? (
          (await this.prismaDb!.businessDocument.findMany({
            where: { bizType: 'quote' },
            orderBy: { createdAt: 'desc' },
          })) as PrismaBusinessDocumentRecord[]
        ).map(toQuoteDocumentPayload).map(toQuoteListItem)
      : [...quoteListData, ...this.store.listQuotes().map(toQuoteListItem)];
    const counterpartyService = new CounterpartyService(this.prisma);
    const enrichedSourceItems = await enrichQuoteListItems(
      sourceItems,
      counterpartyService,
    );

    const filtered = filterVisibleFormalItems(
      enrichedSourceItems,
      session ?? {},
      ['admin', 'boss', 'sales_manager'],
    ).filter((item) => {
      if (item.documentType === 'demand' && item.status === 'converted_to_quote') {
        return false;
      }
      if (
        keyword &&
        ![
          item.docNo,
          item.title,
          item.customerName,
          item.customerFullName ?? '',
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

      if (documentType && (item.documentType ?? 'quote') !== documentType) {
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

      if (sourceType && item.sourceType !== sourceType) {
        return false;
      }

      if (bossConfirmed !== 'all') {
        const expected = bossConfirmed === 'yes';
        if (item.bossConfirmed !== expected) {
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
        documentType: documentType ?? null,
        customerName: query.customerName ?? null,
        createdBy: query.createdBy ?? null,
        sourceType: sourceType ?? null,
        bossConfirmed,
      },
    };
  }

  async create(dto: CreateQuoteDto) {
    const counterpartyService = new CounterpartyService(this.prisma);
    const submitMode = resolveQuoteSubmitMode(dto.submitMode);
    const documentType = normalizeQuoteDocumentType(dto.documentType);
    const productSource = normalizeQuoteProductSource(dto);
    assertQuoteCreationCombination({ documentType, productSource });
    const productService = new ProductService(this.prisma);
    await validateQuoteItems(
      dto,
      documentType,
      productSource,
      productService,
    );
    const items = await normalizeQuoteItems(
      dto,
      documentType,
      productSource,
      productService,
    );
    const salesUserName = resolveSalesUserName(dto.salesUserId);
    const quoteCustomer = await resolveQuoteCustomer(dto, counterpartyService);
    const quoteNo =
      documentType === 'demand'
        ? await this.documentCodeRuleService.generateDemandNo()
        : await this.documentCodeRuleService.generateQuoteNo();
    const createdAt = new Date().toISOString();
    let customerId = quoteCustomer.customerId;
    let customerName = quoteCustomer.customerName;
    let customerCode = quoteCustomer.customerCode;

    if (
      quoteCustomer.customerEntryMode === 'manual' &&
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
          ownerName: salesUserName,
          remark: '由正式报价单手填客户同步创建',
          createdBy: salesUserName,
        },
      );

      customerId = syncedCounterparty.id;
      customerName = syncedCounterparty.name;
      customerCode = syncedCounterparty.code;
    }

    if (this.shouldUsePrisma()) {
      const payload: QuoteDetailRecord = {
        id: 0,
        quoteNo,
        documentType,
        productSource,
        status: 'draft',
        currentVersionNo: 1,
        customerId,
        customerName,
        customerCode,
        customerEntryMode: quoteCustomer.customerEntryMode,
        salesUserId: dto.salesUserId,
        salesUserName,
        sourceCode: dto.sourceCode,
        inquiryDate: dto.inquiryDate ?? new Date().toISOString().slice(0, 10),
        destination: dto.destination?.trim() ?? '',
        requirements: dto.requirements,
        quoteAttachments: normalizeQuoteAttachments(dto.quoteAttachments),
        submitMode,
        currentProgress: resolveCurrentProgress({
          status: 'draft',
          currentVersionNo: 1,
        }),
        createdAt,
        items,
      };
      const created = (await this.prismaDb!.businessDocument.create({
        data: {
          bizType: 'quote',
          docNo: `PENDING-QUOTE-${Date.now()}`,
          status: 'draft',
          ownerUserId: BigInt(dto.salesUserId),
          counterpartyId: customerId > 0 ? BigInt(customerId) : null,
          payload,
          createdBy: BigInt(dto.salesUserId),
        },
      })) as PrismaBusinessDocumentRecord;

      const finalPayload: QuoteDetailRecord = {
        ...payload,
        id: Number(created.id),
        quoteNo,
      };
      const updated = (await this.prismaDb!.businessDocument.update({
        where: { id: created.id },
        data: {
          docNo: finalPayload.quoteNo,
          payload: finalPayload,
        },
      })) as PrismaBusinessDocumentRecord;
      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'quote',
          bizId: updated.id,
          operationType: 'create_quote',
          operatorId: BigInt(dto.salesUserId),
          beforeData: undefined,
          afterData: finalPayload,
        },
      });

      if (submitMode === 'submit') {
        return this.submitDraftQuote(finalPayload.id);
      }

      return {
        ...finalPayload,
        submitMode,
      };
    }

    const id = this.store.nextQuoteId();
    const created: QuoteDetailRecord = {
      id,
      quoteNo,
      documentType,
      productSource,
      status: 'draft',
      currentVersionNo: 1,
      customerId,
      customerName,
      customerCode,
      customerEntryMode: quoteCustomer.customerEntryMode,
      salesUserId: dto.salesUserId,
      salesUserName,
      sourceCode: dto.sourceCode,
      inquiryDate: dto.inquiryDate ?? '2026-07-18',
      destination: dto.destination?.trim() ?? '',
      requirements: dto.requirements,
      quoteAttachments: normalizeQuoteAttachments(dto.quoteAttachments),
      submitMode,
      currentProgress: resolveCurrentProgress({
        status: 'draft',
        currentVersionNo: 1,
      }),
      createdAt,
      items,
    };

    this.store.upsertQuote(created);
    this.store.recordAuditLog({
      bizType: 'quote',
      bizId: created.id,
      operationType: 'create_quote',
      operatorId: dto.salesUserId,
      beforeData: null,
      afterData: created,
    });

    if (submitMode === 'submit') {
      return this.submitDraftQuote(created.id);
    }

    return created;
  }

  private async createInquiryFromQuote(
    quote: QuoteDetailRecord,
    prismaDb = this.prismaDb,
  ) {
    if (this.shouldUsePrisma()) {
      const created = (await prismaDb!.businessDocument.create({
        data: {
          bizType: 'quote_inquiry',
          docNo: `PENDING-INQUIRY-${Date.now()}`,
          status: 'pending_inquiry',
          ownerUserId: BigInt(quote.salesUserId),
          counterpartyId: null,
          payload: buildInquiryFromQuote(quote, 0, 'PENDING-INQUIRY'),
          createdBy: BigInt(quote.salesUserId),
        },
      })) as PrismaBusinessDocumentRecord;

      const inquiryNo = `IQ20260708${String(Number(created.id)).padStart(4, '0')}`;
      const payload = buildInquiryFromQuote(
        quote,
        Number(created.id),
        inquiryNo,
      );

      await prismaDb!.businessDocument.update({
        where: { id: created.id },
        data: {
          docNo: inquiryNo,
          payload,
        },
      });

      await prismaDb!.operationLog.create({
        data: {
          bizType: 'quote_inquiry',
          bizId: created.id,
          operationType: 'create_quote_inquiry',
          operatorId: BigInt(quote.salesUserId),
          beforeData: null,
          afterData: payload,
        },
      });

      return {
        id: Number(created.id),
        inquiryNo,
      };
    }

    const inquiryStore = resolveInquiryStore();
    const inquiryId = inquiryStore.nextInquiryId();
    const inquiryNo = `IQ20260708${String(inquiryId).padStart(4, '0')}`;
    const inquiry = buildInquiryFromQuote(quote, inquiryId, inquiryNo);

    inquiryStore.upsertInquiry(inquiry);
    inquiryStore.recordAuditLog({
      bizType: 'quote_inquiry',
      bizId: inquiry.id,
      operationType: 'create_quote_inquiry',
      operatorId: quote.salesUserId,
      beforeData: null,
      afterData: inquiry,
    });

    return {
      id: inquiry.id,
      inquiryNo: inquiry.inquiryNo,
    };
  }

  async submitDraftQuote(id: number) {
    if (this.shouldUsePrisma()) {
      const created = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaBusinessDocumentRecord | null;

      if (!created || created.bizType !== 'quote') {
        throw new NotFoundException('报价单不存在');
      }

      const detail = toQuoteDocumentPayload(created);
      if (detail.status !== 'draft') {
        if (
          detail.status === 'pending_boss_approval' ||
          detail.status === 'inquiry_in_progress' ||
          detail.status === 'pending_boss_price_confirmation'
        ) {
          return detail;
        }
        throw new BadRequestException('只有草稿报价单才能正式提交');
      }
      const productSource = normalizeStoredProductSource(detail);
      const inquiryResult =
        detail.documentType === 'demand' && productSource === 'candidate'
          ? await this.createInquiryFromQuote(detail)
          : undefined;
      const submitted = buildSubmittedRecord(detail, inquiryResult);
      const operationType =
        detail.documentType === 'demand'
          ? productSource === 'candidate'
            ? 'submit_candidate_demand_for_inquiry'
            : 'submit_demand_for_boss_approval'
          : 'submit_quote_for_boss_price_confirmation';

      await this.prismaDb!.businessDocument.update({
        where: { id: created.id },
        data: {
          status: submitted.status,
          payload: submitted,
        },
      });
      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'quote',
          bizId: created.id,
          operationType,
          operatorId: BigInt(detail.salesUserId),
          beforeData: detail,
          afterData: submitted,
        },
      });

      return submitted;
    }

    const created = this.store.getQuote(id);
    if (!created) {
      throw new NotFoundException('报价单不存在');
    }

    if (created.status !== 'draft') {
      if (
        created.status === 'pending_boss_approval' ||
        created.status === 'inquiry_in_progress' ||
        created.status === 'pending_boss_price_confirmation'
      ) {
        return this.getDetail(id);
      }
      throw new BadRequestException('只有草稿报价单才能正式提交');
    }
    const documentType = created.documentType ?? inferQuoteDocumentTypeFromDocNo(created.quoteNo);
    const productSource = normalizeStoredProductSource(created);
    const inquiryResult =
      documentType === 'demand' && productSource === 'candidate'
        ? await this.createInquiryFromQuote(created)
        : undefined;
    const submitted = buildSubmittedRecord(created, inquiryResult);
    const operationType =
      documentType === 'demand'
        ? productSource === 'candidate'
          ? 'submit_candidate_demand_for_inquiry'
          : 'submit_demand_for_boss_approval'
        : 'submit_quote_for_boss_price_confirmation';

    this.store.upsertQuote(submitted);
    this.store.recordAuditLog({
      bizType: 'quote',
      bizId: submitted.id,
      operationType,
      operatorId: submitted.salesUserId,
      beforeData: created,
      afterData: submitted,
    });

    return submitted;
  }

  async approveDemand(id: number, session?: FormalSession) {
    const existing = await this.getDetail(id);
    const productSource = normalizeStoredProductSource(existing);
    if (existing.documentType !== 'demand' || productSource !== 'existing') {
      throw new BadRequestException('只有产品库产品需求单可以执行需求审批');
    }
    if (existing.status === 'boss_approved') {
      return existing;
    }
    if (existing.status !== 'pending_boss_approval') {
      throw new BadRequestException('当前需求单状态不能审批');
    }

    const approved: QuoteDetailRecord = {
      ...existing,
      status: 'boss_approved',
      currentProgress: resolveWorkflowProgress('boss_approved'),
    };
    await this.saveQuoteTransition({
      before: existing,
      after: approved,
      operationType: 'approve_demand',
      operatorId: existing.salesUserId,
      operatorName: session?.user,
    });
    return approved;
  }

  async confirmQuotePrice(
    id: number,
    payload: {
      currentVersionNo: number;
      items: Array<{ lineNo: number; confirmedSalePrice: number }>;
    },
    session?: FormalSession,
  ) {
    const existing = await this.getDetail(id);
    if (
      existing.documentType !== 'quote' ||
      normalizeStoredProductSource(existing) !== 'existing'
    ) {
      throw new BadRequestException('只有产品库报价单可以直接确认售价');
    }
    if (existing.status === 'pending_customer_feedback') {
      return existing;
    }
    if (existing.status !== 'pending_boss_price_confirmation') {
      throw new BadRequestException('当前报价单状态不能确认售价');
    }
    if (Number(payload.currentVersionNo) !== existing.currentVersionNo) {
      throw new BadRequestException('报价版本已更新，请刷新后重试');
    }

    const priceByLine = new Map(
      (payload.items ?? []).map((item) => [
        Number(item.lineNo),
        Number(item.confirmedSalePrice),
      ]),
    );
    const items = existing.items.map((item) => {
      const confirmedSalePrice = priceByLine.get(item.lineNo);
      if (!confirmedSalePrice || !Number.isFinite(confirmedSalePrice) || confirmedSalePrice <= 0) {
        throw new BadRequestException(`第 ${item.lineNo} 行最终售价必须大于 0`);
      }
      return {
        ...item,
        confirmedSalePrice,
        salePrice: confirmedSalePrice,
        amount: Number((item.quantity * confirmedSalePrice).toFixed(2)),
      };
    });

    const confirmed: QuoteDetailRecord = {
      ...existing,
      status: 'pending_customer_feedback',
      currentProgress: resolveWorkflowProgress('pending_customer_feedback'),
      items,
      versionHistory: [
        {
          versionNo: existing.currentVersionNo,
          status: 'pending_customer_feedback',
          confirmedAt: new Date().toISOString(),
          confirmedBy: session?.user?.trim() || '老板',
          items: items.map((item) => ({ ...item })),
        },
      ],
    };
    await this.saveQuoteTransition({
      before: existing,
      after: confirmed,
      operationType: 'boss_confirm_quote_price',
      operatorId: existing.salesUserId,
      operatorName: session?.user,
    });
    return confirmed;
  }

  async recordCustomerFeedback(
    id: number,
    payload: {
      currentVersionNo: number;
      result: CustomerFeedbackResult;
      remark?: string;
    },
    session?: FormalSession,
  ) {
    if (
      session?.role !== 'sales' &&
      session?.role !== 'sales_manager' &&
      session?.role !== 'admin' &&
      session?.role !== 'boss'
    ) {
      throw new BadRequestException('只有销售或老板可以记录客户反馈');
    }
    const existing = await this.getDetail(id);
    if (existing.documentType !== 'quote') {
      throw new BadRequestException('只有报价单可以记录客户反馈');
    }
    if (Number(payload.currentVersionNo) !== existing.currentVersionNo) {
      throw new BadRequestException('报价版本已更新，请刷新后重试');
    }
    if (
      existing.status === 'repricing_in_progress' &&
      payload.result === 'price_issue' &&
      existing.linkedInquiryVersionNo === existing.currentVersionNo + 1
    ) {
      return existing;
    }
    assertCustomerFeedbackTransition({
      status: existing.status,
      result: payload.result,
    });

    const operatedAt = new Date().toISOString();
    const operatedBy = session.user?.trim() || '销售';
    const status =
      payload.result === 'accepted'
        ? 'customer_accepted'
        : payload.result === 'no_follow_up'
          ? 'customer_no_follow_up'
          : 'repricing_in_progress';
    const feedbackEntry = {
      versionNo: existing.currentVersionNo,
      result: payload.result,
      ...(payload.remark?.trim() ? { remark: payload.remark.trim() } : {}),
      operatedBy,
      operatedAt,
    };
    const persistFeedback = async (prismaDb?: PrismaQuoteDb) => {
      const inquiryResult = payload.result === 'price_issue'
        ? await this.createInquiryFromQuote(
            {
              ...existing,
              currentVersionNo: existing.currentVersionNo + 1,
            },
            prismaDb ?? this.prismaDb,
          )
        : undefined;
      const updated: QuoteDetailRecord = {
        ...existing,
        status,
        currentProgress: resolveWorkflowProgress(status),
        customerFeedbackResult: payload.result,
        customerFeedbackRemark: payload.remark?.trim() ?? '',
        customerFeedbackBy: operatedBy,
        customerFeedbackAt: operatedAt,
        customerFeedbackHistory: [
          ...(existing.customerFeedbackHistory ?? []),
          feedbackEntry,
        ],
        ...(inquiryResult
          ? {
              linkedInquiryId: inquiryResult.id,
              linkedInquiryNo: inquiryResult.inquiryNo,
              linkedInquiryStatus: 'pending_inquiry',
              linkedInquiryVersionNo: existing.currentVersionNo + 1,
            }
          : {}),
      };
      await this.saveQuoteTransition(
        {
          before: existing,
          after: updated,
          operationType: 'record_customer_feedback',
          operatorId: existing.salesUserId,
          operatorName: operatedBy,
        },
        prismaDb,
      );
      return updated;
    };

    if (payload.result === 'price_issue' && this.shouldUsePrisma()) {
      const transaction = (this.prisma as unknown as {
        $transaction?: <T>(callback: (db: PrismaQuoteDb) => Promise<T>) => Promise<T>;
      })?.$transaction;
      if (typeof transaction === 'function') {
        return await transaction.call(this.prisma, persistFeedback) as QuoteDetailRecord;
      }
    }

    return persistFeedback();
  }

  async completeInquiryPricing(
    inquiry: InquiryListItem,
    operator = '老板',
    prismaDb = this.prismaDb,
  ): Promise<{
    linkedQuoteId?: number;
    linkedQuoteNo?: string;
    currentVersionNo?: number;
    status?: string;
  }> {
    const sourceDemandId = Number(inquiry.sourceQuoteId ?? inquiry.quoteOrderId);
    const sourceDemand = await this.getDetail(sourceDemandId);

    if (sourceDemand.documentType === 'quote') {
      return this.applyRepricingFromInquiry(
        sourceDemand,
        inquiry,
        operator,
        prismaDb,
      );
    }
    if (
      sourceDemand.documentType !== 'demand' ||
      normalizeStoredProductSource(sourceDemand) !== 'candidate'
    ) {
      return {};
    }
    if (sourceDemand.linkedQuoteId) {
      return {
        linkedQuoteId: sourceDemand.linkedQuoteId,
        linkedQuoteNo: sourceDemand.linkedQuoteNo,
      };
    }

    const productService = new ProductService(
      (prismaDb ?? this.prisma) as PrismaService | undefined,
    );
    const linkedItems: QuoteLineItem[] = [];
    for (const inquiryItem of inquiry.items) {
      const sourceItem = sourceDemand.items.find(
        (item) => item.lineNo === inquiryItem.lineNo,
      );
      if (!sourceItem) {
        throw new BadRequestException(`询价第 ${inquiryItem.lineNo} 行找不到来源需求`);
      }
      const selectedIndex = inquiryItem.confirmedSupplierQuoteIndex;
      const selectedSupplier =
        selectedIndex === undefined
          ? undefined
          : inquiryItem.supplierQuotes[selectedIndex];
      if (!selectedSupplier || inquiryItem.confirmedSalePrice <= 0) {
        throw new BadRequestException(`询价第 ${inquiryItem.lineNo} 行尚未完成老板定价`);
      }

      const product = await productService.findOrCreateQuoteCandidate({
        sku: inquiryItem.sku?.trim() || `SKU-${sourceDemand.quoteNo}-${inquiryItem.lineNo}`,
        nameCn: inquiryItem.productName,
        category: inquiryItem.productCategory ?? sourceItem.productCategory ?? 'electronics',
        unit: inquiryItem.unit ?? sourceItem.unit,
        confirmedSalePrice: inquiryItem.confirmedSalePrice,
        confirmedPurchasePrice: selectedSupplier.purchasePrice,
        supplierCode: selectedSupplier.supplierCode,
        cartonQuantity: selectedSupplier.cartonQuantity,
        outerCartonSizeCm: selectedSupplier.outerCartonSizeCm,
        outerCartonGrossWeightKg: selectedSupplier.outerCartonGrossWeightKg,
        operator,
      });
      linkedItems.push({
        ...sourceItem,
        productSource: 'existing',
        productId: product.id,
        sku: product.sku,
        productName: product.nameCn,
        productCategory: product.category,
        unit: product.unit,
        salePrice: inquiryItem.confirmedSalePrice,
        confirmedSalePrice: inquiryItem.confirmedSalePrice,
        confirmedSupplierQuoteIndex: selectedIndex,
        confirmedSupplierId: selectedSupplier.supplierId,
        confirmedSupplierCode: selectedSupplier.supplierCode,
        confirmedSupplierName: selectedSupplier.supplierName,
        confirmedPurchasePrice: selectedSupplier.purchasePrice,
        confirmedProductId: product.id,
        samplingInfo: selectedSupplier.samplingInfo,
        cartonQuantity: selectedSupplier.cartonQuantity,
        outerCartonSizeCm: selectedSupplier.outerCartonSizeCm,
        outerCartonGrossWeightKg: selectedSupplier.outerCartonGrossWeightKg,
        amount: Number(
          (sourceItem.quantity * inquiryItem.confirmedSalePrice).toFixed(2),
        ),
      });
    }

    const quoteNo = await this.documentCodeRuleService.generateQuoteNo();
    const quoteBase: QuoteDetailRecord = {
      ...sourceDemand,
      id: 0,
      quoteNo,
      documentType: 'quote',
      productSource: 'existing',
      status: 'pending_customer_feedback',
      currentVersionNo: 1,
      currentProgress: resolveWorkflowProgress('pending_customer_feedback'),
      submitMode: 'submit',
      sourceDemandId: sourceDemand.id,
      sourceDemandNo: sourceDemand.quoteNo,
      sourceDemandSnapshot: {
        ...sourceDemand,
        items: sourceDemand.items.map((item) => ({ ...item })),
        quoteAttachments: sourceDemand.quoteAttachments?.map((attachment) => ({ ...attachment })),
      },
      linkedInquiryId: inquiry.id,
      linkedInquiryNo: inquiry.inquiryNo,
      linkedInquiryStatus: inquiry.status,
      linkedQuoteId: undefined,
      linkedQuoteNo: undefined,
      linkedSalesOrderId: undefined,
      linkedSalesOrderNo: undefined,
      createdAt: new Date().toISOString(),
      items: linkedItems,
      versionHistory: [
        {
          versionNo: 1,
          status: 'pending_customer_feedback',
          confirmedAt: new Date().toISOString(),
          confirmedBy: operator,
          sourceInquiryId: inquiry.id,
          items: linkedItems.map((item) => ({ ...item })),
        },
      ],
    };

    if (this.shouldUsePrisma()) {
      const created = (await prismaDb!.businessDocument.create({
        data: {
          bizType: 'quote',
          docNo: quoteNo,
          status: quoteBase.status,
          ownerUserId: BigInt(quoteBase.salesUserId),
          counterpartyId:
            quoteBase.customerId > 0 ? BigInt(quoteBase.customerId) : null,
          payload: quoteBase,
          createdBy: BigInt(quoteBase.salesUserId),
        },
      })) as PrismaBusinessDocumentRecord;
      const linkedQuote: QuoteDetailRecord = {
        ...quoteBase,
        id: Number(created.id),
      };
      const convertedDemand: QuoteDetailRecord = {
        ...sourceDemand,
        status: 'converted_to_quote',
        currentProgress: resolveWorkflowProgress('converted_to_quote'),
        linkedInquiryStatus: inquiry.status,
        linkedQuoteId: linkedQuote.id,
        linkedQuoteNo: linkedQuote.quoteNo,
      };
      await prismaDb!.businessDocument.update({
        where: { id: created.id },
        data: { payload: linkedQuote },
      });
      await prismaDb!.businessDocument.update({
        where: { id: BigInt(sourceDemand.id) },
        data: { status: convertedDemand.status, payload: convertedDemand },
      });
      await prismaDb!.operationLog.create({
        data: {
          bizType: 'quote',
          bizId: created.id,
          operationType: 'create_quote_from_inquiry',
          operatorId: BigInt(sourceDemand.salesUserId),
          beforeData: null,
          afterData: linkedQuote,
        },
      });
      await prismaDb!.operationLog.create({
        data: {
          bizType: 'quote',
          bizId: BigInt(sourceDemand.id),
          operationType: 'convert_demand_to_quote',
          operatorId: BigInt(sourceDemand.salesUserId),
          beforeData: sourceDemand,
          afterData: convertedDemand,
        },
      });
      return { linkedQuoteId: linkedQuote.id, linkedQuoteNo: linkedQuote.quoteNo };
    }

    const linkedQuote: QuoteDetailRecord = {
      ...quoteBase,
      id: this.store.nextQuoteId(),
    };
    const convertedDemand: QuoteDetailRecord = {
      ...sourceDemand,
      status: 'converted_to_quote',
      currentProgress: resolveWorkflowProgress('converted_to_quote'),
      linkedInquiryStatus: inquiry.status,
      linkedQuoteId: linkedQuote.id,
      linkedQuoteNo: linkedQuote.quoteNo,
    };
    this.store.upsertQuote(linkedQuote);
    this.store.upsertQuote(convertedDemand);
    this.store.recordAuditLog({
      bizType: 'quote',
      bizId: linkedQuote.id,
      operationType: 'create_quote_from_inquiry',
      operatorId: sourceDemand.salesUserId,
      beforeData: null,
      afterData: linkedQuote,
    });
    this.store.recordAuditLog({
      bizType: 'quote',
      bizId: sourceDemand.id,
      operationType: 'convert_demand_to_quote',
      operatorId: sourceDemand.salesUserId,
      beforeData: sourceDemand,
      afterData: convertedDemand,
    });
    return { linkedQuoteId: linkedQuote.id, linkedQuoteNo: linkedQuote.quoteNo };
  }

  private async applyRepricingFromInquiry(
    quote: QuoteDetailRecord,
    inquiry: InquiryListItem,
    operator: string,
    prismaDb = this.prismaDb,
  ) {
    if (
      inquiry.quoteVersionNo <= quote.currentVersionNo &&
      quote.status === 'pending_customer_feedback'
    ) {
      return {
        linkedQuoteId: quote.id,
        linkedQuoteNo: quote.quoteNo,
        currentVersionNo: quote.currentVersionNo,
        status: quote.status,
      };
    }
    if (
      quote.status !== 'repricing_in_progress' ||
      inquiry.quoteVersionNo !== quote.currentVersionNo + 1
    ) {
      return {};
    }

    const productService = new ProductService(
      (prismaDb ?? this.prisma) as PrismaService | undefined,
    );
    const items = await Promise.all(quote.items.map(async (item) => {
      const inquiryItem = inquiry.items.find(
        (entry) => entry.lineNo === item.lineNo,
      );
      if (!inquiryItem || inquiryItem.confirmedSalePrice <= 0) {
        throw new BadRequestException(`询价第 ${item.lineNo} 行尚未完成老板定价`);
      }
      const selectedIndex = inquiryItem.confirmedSupplierQuoteIndex;
      const selectedSupplier =
        selectedIndex === undefined
          ? undefined
          : inquiryItem.supplierQuotes[selectedIndex];
      if (!selectedSupplier) {
        throw new BadRequestException(`询价第 ${item.lineNo} 行尚未选择最终供应商`);
      }
      if (item.productId) {
        await productService.applyConfirmedInquiryValues(item.productId, {
          confirmedSalePrice: inquiryItem.confirmedSalePrice,
          confirmedPurchasePrice: selectedSupplier.purchasePrice,
          cartonQuantity: selectedSupplier.cartonQuantity,
          outerCartonSizeCm: selectedSupplier.outerCartonSizeCm,
          outerCartonGrossWeightKg: selectedSupplier.outerCartonGrossWeightKg,
          operator,
        });
      }
      return {
        ...item,
        salePrice: inquiryItem.confirmedSalePrice,
        confirmedSalePrice: inquiryItem.confirmedSalePrice,
        confirmedSupplierQuoteIndex: selectedIndex,
        confirmedSupplierId: selectedSupplier.supplierId,
        confirmedSupplierCode: selectedSupplier.supplierCode,
        confirmedSupplierName: selectedSupplier.supplierName,
        confirmedPurchasePrice: selectedSupplier.purchasePrice,
        confirmedProductId: item.productId,
        samplingInfo: selectedSupplier.samplingInfo,
        cartonQuantity: selectedSupplier.cartonQuantity,
        outerCartonSizeCm: selectedSupplier.outerCartonSizeCm,
        outerCartonGrossWeightKg: selectedSupplier.outerCartonGrossWeightKg,
        amount: Number((item.quantity * inquiryItem.confirmedSalePrice).toFixed(2)),
      };
    }));
    const versionSnapshot: QuoteVersionSnapshot = {
      versionNo: inquiry.quoteVersionNo,
      status: 'pending_customer_feedback',
      confirmedAt: new Date().toISOString(),
      confirmedBy: operator,
      sourceInquiryId: inquiry.id,
      items: items.map((item) => ({ ...item })),
    };
    const updated: QuoteDetailRecord = {
      ...quote,
      status: 'pending_customer_feedback',
      currentVersionNo: inquiry.quoteVersionNo,
      currentProgress: resolveWorkflowProgress('pending_customer_feedback'),
      linkedInquiryId: inquiry.id,
      linkedInquiryNo: inquiry.inquiryNo,
      linkedInquiryStatus: inquiry.status,
      linkedInquiryVersionNo: inquiry.quoteVersionNo,
      customerFeedbackResult: undefined,
      customerFeedbackRemark: undefined,
      customerFeedbackBy: undefined,
      customerFeedbackAt: undefined,
      items,
      versionHistory: [
        ...(quote.versionHistory ?? []).filter(
          (entry) => entry.versionNo !== inquiry.quoteVersionNo,
        ),
        versionSnapshot,
      ].sort((left, right) => left.versionNo - right.versionNo),
    };
    await this.saveQuoteTransition({
      before: quote,
      after: updated,
      operationType: 'advance_quote_version',
      operatorId: quote.salesUserId,
      operatorName: operator,
    }, prismaDb);
    return {
      linkedQuoteId: updated.id,
      linkedQuoteNo: updated.quoteNo,
      currentVersionNo: updated.currentVersionNo,
      status: updated.status,
    };
  }

  private async saveQuoteTransition(payload: {
    before: QuoteDetailRecord;
    after: QuoteDetailRecord;
    operationType: string;
    operatorId: number;
    operatorName?: string;
  }, prismaDb?: PrismaQuoteDb) {
    const afterData = payload.operatorName
      ? { ...payload.after, lastOperatedBy: payload.operatorName }
      : payload.after;
    if (this.shouldUsePrisma()) {
      const apply = async (db: PrismaQuoteDb) => {
        await db.businessDocument.update({
          where: { id: BigInt(payload.after.id) },
          data: { status: payload.after.status, payload: payload.after },
        });
        await db.operationLog.create({
          data: {
            bizType: 'quote',
            bizId: BigInt(payload.after.id),
            operationType: payload.operationType,
            operatorId: BigInt(payload.operatorId),
            beforeData: payload.before,
            afterData,
          },
        });
      };
      if (prismaDb) {
        await apply(prismaDb);
        return;
      }
      const transaction = (this.prisma as unknown as {
        $transaction?: (callback: (db: PrismaQuoteDb) => Promise<unknown>) => Promise<unknown>;
      })?.$transaction;
      if (typeof transaction === 'function') {
        await transaction.call(this.prisma, (db: PrismaQuoteDb) => apply(db));
      } else {
        await apply(this.prismaDb!);
      }
      return;
    }

    this.store.upsertQuote(payload.after);
    this.store.recordAuditLog({
      bizType: 'quote',
      bizId: payload.after.id,
      operationType: payload.operationType,
      operatorId: payload.operatorId,
      beforeData: payload.before,
      afterData,
    });
  }

  async updateDraft(id: number, dto: UpdateQuoteDraftDto) {
    const counterpartyService = new CounterpartyService(this.prisma);
    const submitMode = resolveQuoteSubmitMode(dto.submitMode);
    const requestedProductSource = normalizeQuoteProductSource(dto);
    if (dto.documentType) {
      assertQuoteCreationCombination({
        documentType: normalizeQuoteDocumentType(dto.documentType),
        productSource: requestedProductSource,
      });
    }
    const salesUserName = resolveSalesUserName(dto.salesUserId);
    const quoteCustomer = await resolveQuoteCustomer(dto, counterpartyService);
    let customerId = quoteCustomer.customerId;
    let customerName = quoteCustomer.customerName;
    let customerCode = quoteCustomer.customerCode;

    if (
      quoteCustomer.customerEntryMode === 'manual' &&
      dto.saveManualCustomerToCounterparty &&
      customerId <= 0
    ) {
      if (!customerCode) {
        throw new BadRequestException('保存到往来单位时，客户编码不能为空');
      }

      const syncedCounterparty = await findOrCreateManualCustomerCounterparty(
        counterpartyService,
        {
          customerCode,
          customerName,
          ownerName: salesUserName,
          remark: '由正式报价单草稿手填客户同步创建',
          createdBy: salesUserName,
        },
      );

      customerId = syncedCounterparty.id;
      customerName = syncedCounterparty.name;
      customerCode = syncedCounterparty.code;
    }

    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaBusinessDocumentRecord | null;

      if (!existing || existing.bizType !== 'quote') {
        throw new NotFoundException('报价单不存在');
      }

      const before = toQuoteDocumentPayload(existing);
      if (before.status !== 'draft') {
        throw new BadRequestException('只有草稿报价单才能保存草稿');
      }
      const documentType = normalizeQuoteDocumentType(
        dto.documentType ?? before.documentType,
      );
      const productSource = normalizeQuoteProductSource(
        dto,
        normalizeStoredProductSource(before),
      );
      assertQuoteCreationCombination({ documentType, productSource });
      const productService = new ProductService(this.prisma);
      await validateQuoteItems(
        dto,
        documentType,
        productSource,
        productService,
      );
      const items = await normalizeQuoteItems(
        dto,
        documentType,
        productSource,
        productService,
      );

      const saved: QuoteDetailRecord = {
        ...before,
        documentType,
        productSource,
        status: 'draft',
        customerId,
        customerName,
        customerCode,
        customerEntryMode: quoteCustomer.customerEntryMode,
        salesUserId: dto.salesUserId,
        salesUserName,
        sourceCode: dto.sourceCode,
        inquiryDate: dto.inquiryDate ?? before.inquiryDate,
        destination: dto.destination?.trim() ?? '',
        requirements: dto.requirements,
        quoteAttachments: normalizeQuoteAttachments(dto.quoteAttachments),
        submitMode,
        currentProgress: resolveCurrentProgress({
          status: 'draft',
          currentVersionNo: before.currentVersionNo,
        }),
        items,
      };

      await this.prismaDb!.businessDocument.update({
        where: { id: existing.id },
        data: {
          status: 'draft',
          ownerUserId: BigInt(dto.salesUserId),
          counterpartyId: customerId > 0 ? BigInt(customerId) : null,
          payload: saved,
        },
      });
      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'quote',
          bizId: existing.id,
          operationType: 'update_quote_draft',
          operatorId: BigInt(dto.salesUserId),
          beforeData: before,
          afterData: saved,
        },
      });

      if (submitMode === 'submit') {
        return this.submitDraftQuote(id);
      }

      return saved;
    }

    const existing = this.store.getQuote(id);
    if (!existing) {
      throw new NotFoundException('报价单不存在');
    }

    if (existing.status !== 'draft') {
      throw new BadRequestException('只有草稿报价单才能保存草稿');
    }
    const documentType = normalizeQuoteDocumentType(
      dto.documentType ?? existing.documentType,
    );
    const productSource = normalizeQuoteProductSource(
      dto,
      normalizeStoredProductSource(existing),
    );
    assertQuoteCreationCombination({ documentType, productSource });
    const productService = new ProductService(this.prisma);
    await validateQuoteItems(
      dto,
      documentType,
      productSource,
      productService,
    );
    const items = await normalizeQuoteItems(
      dto,
      documentType,
      productSource,
      productService,
    );

    const saved: QuoteDetailRecord = {
      ...existing,
      documentType,
      productSource,
      status: 'draft',
      customerId,
      customerName,
      customerCode,
      customerEntryMode: quoteCustomer.customerEntryMode,
      salesUserId: dto.salesUserId,
      salesUserName,
      sourceCode: dto.sourceCode,
      inquiryDate: dto.inquiryDate ?? existing.inquiryDate,
      destination: dto.destination?.trim() ?? '',
      requirements: dto.requirements,
      quoteAttachments: normalizeQuoteAttachments(dto.quoteAttachments),
      submitMode,
      currentProgress: resolveCurrentProgress({
        status: 'draft',
        currentVersionNo: existing.currentVersionNo,
      }),
      items,
    };

    this.store.upsertQuote(saved);
    this.store.recordAuditLog({
      bizType: 'quote',
      bizId: saved.id,
      operationType: 'update_quote_draft',
      operatorId: dto.salesUserId,
      beforeData: existing,
      afterData: saved,
    });

    if (submitMode === 'submit') {
      return this.submitDraftQuote(saved.id);
    }

    return saved;
  }

  async listAuditLogs(session?: FormalSession) {
    if (this.shouldUsePrisma()) {
      const logs = (await this.prismaDb!.operationLog.findMany({
        where: { bizType: 'quote' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })) as PrismaOperationLogRecord[];

      return {
        items: logs.map(toAuditLogRecord).map((log) =>
          session?.role === 'sales' || session?.role === 'sales_manager'
            ? (sanitizeProcurementValueForSales(log) as typeof log)
            : log,
        ),
      };
    }

    return {
      items: this.store.listAuditLogs().map((log) =>
        session?.role === 'sales' || session?.role === 'sales_manager'
          ? (sanitizeProcurementValueForSales(log) as typeof log)
          : log,
      ),
    };
  }

  async getDetail(id: number, session?: FormalSession) {
    const counterpartyService = new CounterpartyService(this.prisma);

    if (this.shouldUsePrisma()) {
      const created = (await this.prismaDb!.businessDocument.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaBusinessDocumentRecord | null;

      if (created && created.bizType === 'quote') {
        const detail = toQuoteDocumentPayload(created);
        const listItem = toQuoteListItem(detail);
        if (
          session?.role &&
          !isFormalAdminOrBoss(session?.role) &&
          session?.role !== 'sales_manager' &&
          !matchesFormalUser(session ?? {}, listItem)
        ) {
          throw new NotFoundException('报价单不存在');
        }

        const matchedCounterparty = detail.customerId
          ? await counterpartyService.findById(detail.customerId)
          : null;

        return hideProcurementDetailsFromSales({
          ...detail,
          customerFullName:
            matchedCounterparty?.shortName ?? detail.customerFullName,
        }, session);
      }
    }

    const created = this.store.getQuote(id);

    if (created) {
      const productSource = normalizeStoredProductSource(created);
      const normalizedCreated: QuoteDetailRecord = {
        ...created,
        productSource,
        items: created.items.map((item) => ({
          ...item,
          productSource: item.productSource ?? productSource,
        })),
      };
      const listItem = toQuoteListItem(normalizedCreated);
      if (
        session?.role &&
        !isFormalAdminOrBoss(session?.role) &&
        session?.role !== 'sales_manager' &&
        !matchesFormalUser(session ?? {}, listItem)
      ) {
        throw new NotFoundException('报价单不存在');
      }

      const matchedCounterparty = normalizedCreated.customerId
        ? await counterpartyService.findById(normalizedCreated.customerId)
        : null;

      return hideProcurementDetailsFromSales({
        ...normalizedCreated,
        customerFullName:
          matchedCounterparty?.shortName ?? normalizedCreated.customerFullName,
        currentProgress: resolveCurrentProgress({
          status: normalizedCreated.status,
          currentVersionNo: normalizedCreated.currentVersionNo,
        }),
      }, session);
    }

    const fallback: QuoteDetailRecord = {
      id,
      quoteNo: 'Q202607070001',
      documentType: 'quote',
      productSource: 'existing',
      status: 'draft',
      currentVersionNo: 1,
      customerId: 1001,
      customerName: 'Acme Trading',
      customerCode: 'CUST-ACME',
      customerEntryMode: 'existing',
      salesUserId: 2001,
      salesUserName: 'Zoe',
      sourceCode: 'expo',
      inquiryDate: '2026-07-11',
      destination: '',
      requirements: 'Need 500 units',
      quoteAttachments: [],
      currentProgress: '草稿',
      createdAt: '2026-07-11T09:00:00.000Z',
      items: [
        {
          lineNo: 1,
          productSource: 'existing',
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          targetPrice: 0,
          salePrice: 15.9,
          amount: 7950,
          imageUrls: [],
        },
      ],
    };
    const fallbackListItem = toQuoteListItem({
      ...fallback,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: fallback.requirements,
      createdAt: '2026-07-11T09:00:00.000Z',
    });

    if (
      session?.role &&
      !isFormalAdminOrBoss(session?.role) &&
      session?.role !== 'sales_manager' &&
      !matchesFormalUser(session ?? {}, fallbackListItem)
    ) {
      throw new NotFoundException('报价单不存在');
    }

    return fallback;
  }
}
