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

export type QuoteDetailRecord = {
  id: number;
  quoteNo: string;
  documentType?: 'demand' | 'quote';
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
  linkedSalesOrderId?: number;
  linkedSalesOrderNo?: string;
  createdAt: string;
  items: QuoteLineItem[];
};

export type QuoteLineItem = {
  lineNo: number;
  productId: number;
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

type PrismaQuoteDb = PrismaService & {
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
    Number(product.defaultSalePrice) > 0 &&
    Number(product.defaultPurchasePrice) > 0
  );
}

async function validateDemandQuoteItems(
  dto: CreateQuoteDto,
  documentType: 'demand' | 'quote',
  productService: ProductService,
) {
  if (documentType !== 'demand') {
    return;
  }

  const items = dto.items ?? [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.createCandidateProduct) {
      throw new BadRequestException(`需求单第 ${index + 1} 行只能选择产品库产品`);
    }

    const productId = Number(item.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new BadRequestException(`需求单第 ${index + 1} 行必须选择产品库产品`);
    }

    const product = await productService.findById(productId);
    if (!product || !isDemandEligibleProductRecord(product)) {
      throw new BadRequestException(
        `需求单第 ${index + 1} 行产品必须在产品库中为已启用的正式产品，且同时具备采购价和销售价`,
      );
    }
  }
}

function buildSubmittedQuoteRecord(
  quote: QuoteDetailRecord,
  inquiry: {
    id: number;
    inquiryNo: string;
  },
): QuoteDetailRecord {
  return {
    ...quote,
    submitMode: 'submit',
    status: 'submitted',
    currentProgress: resolveCurrentProgress({
      status: 'submitted',
      currentVersionNo: quote.currentVersionNo,
    }),
    linkedInquiryId: inquiry.id,
    linkedInquiryNo: inquiry.inquiryNo,
    linkedInquiryStatus: 'pending_inquiry',
  };
}

function buildSubmittedDemandQuoteRecord(quote: QuoteDetailRecord): QuoteDetailRecord {
  return {
    ...quote,
    submitMode: 'submit',
    status: 'submitted',
    currentProgress: resolveCurrentProgress({
      status: 'submitted',
      currentVersionNo: quote.currentVersionNo,
      documentType: 'demand',
    }),
    linkedInquiryId: undefined,
    linkedInquiryNo: undefined,
    linkedInquiryStatus: undefined,
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
    productId: number;
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
    productId: Number(item.productId),
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
): Promise<QuoteLineItem[]> {
  return Promise.all((dto.items ?? []).map(async (item, index) => {
    if (item.createCandidateProduct) {
      const candidate = item.createCandidateProduct;
      return buildQuoteLineItem(
        {
          productId: 0,
          sku: candidate.sku,
          productName: candidate.nameCn,
          productCategory: candidate.category,
          unit: candidate.unit ?? '',
          quantity: Number(item.quantity),
          targetPrice: item.targetPrice != null ? Number(item.targetPrice) : undefined,
          salePrice: Number(item.salePrice),
          imageUrls: item.imageUrls,
        },
        index,
      );
    }

    return buildQuoteLineItem(
      {
        productId: Number(item.productId),
        sku: item.sku ?? '',
        productName: item.productName ?? '',
        unit: item.unit ?? '',
        quantity: Number(item.quantity),
        targetPrice: item.targetPrice != null ? Number(item.targetPrice) : undefined,
        salePrice: Number(item.salePrice),
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
    bossConfirmed: item.status === 'boss_confirmed',
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
  return {
    ...record.payload,
    id: Number(record.payload.id ?? record.id),
    quoteNo: record.docNo,
    documentType:
      record.payload.documentType ?? inferQuoteDocumentTypeFromDocNo(record.docNo),
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
    items: Array.isArray(record.payload.items)
      ? record.payload.items.map((item) => ({ ...item }))
      : [],
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
    await validateDemandQuoteItems(
      dto,
      documentType,
      new ProductService(this.prisma),
    );
    const items = await normalizeQuoteItems(dto);
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

      if (submitMode === 'submit' && documentType === 'demand') {
        const submitted = buildSubmittedDemandQuoteRecord(finalPayload);
        await this.prismaDb!.businessDocument.update({
          where: { id: updated.id },
          data: {
            status: 'submitted',
            payload: submitted,
          },
        });
        await this.prismaDb!.operationLog.create({
          data: {
            bizType: 'quote',
            bizId: updated.id,
            operationType: 'submit_demand_quote',
            operatorId: BigInt(dto.salesUserId),
            beforeData: finalPayload,
            afterData: submitted,
          },
        });

        return submitted;
      }

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

    if (submitMode === 'submit' && documentType === 'demand') {
      const submitted = buildSubmittedDemandQuoteRecord(created);
      this.store.upsertQuote(submitted);
      this.store.recordAuditLog({
        bizType: 'quote',
        bizId: submitted.id,
        operationType: 'submit_demand_quote',
        operatorId: submitted.salesUserId,
        beforeData: created,
        afterData: submitted,
      });

      return submitted;
    }

    if (submitMode === 'submit') {
      return this.submitDraftQuote(created.id);
    }

    return created;
  }

  private async createInquiryFromQuote(quote: QuoteDetailRecord) {
    if (this.shouldUsePrisma()) {
      const created = (await this.prismaDb!.businessDocument.create({
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

      await this.prismaDb!.businessDocument.update({
        where: { id: created.id },
        data: {
          docNo: inquiryNo,
          payload,
        },
      });

      await this.prismaDb!.operationLog.create({
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
        throw new BadRequestException('只有草稿报价单才能正式提交');
      }
      if (detail.documentType === 'demand') {
        const submitted = buildSubmittedDemandQuoteRecord(detail);
        await this.prismaDb!.businessDocument.update({
          where: { id: created.id },
          data: {
            status: 'submitted',
            payload: submitted,
          },
        });
        await this.prismaDb!.operationLog.create({
          data: {
            bizType: 'quote',
            bizId: created.id,
            operationType: 'submit_demand_quote',
            operatorId: BigInt(detail.salesUserId),
            beforeData: detail,
            afterData: submitted,
          },
        });

        return submitted;
      }

      const inquiryResult = await this.createInquiryFromQuote(detail);
      const submitted = buildSubmittedQuoteRecord(detail, inquiryResult);

      await this.prismaDb!.businessDocument.update({
        where: { id: created.id },
        data: {
          status: 'submitted',
          payload: submitted,
        },
      });
      await this.prismaDb!.operationLog.create({
        data: {
          bizType: 'quote',
          bizId: created.id,
          operationType: 'submit_quote',
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
      throw new BadRequestException('只有草稿报价单才能正式提交');
    }
    if ((created.documentType ?? 'quote') === 'demand') {
      const submitted = buildSubmittedDemandQuoteRecord(created);
      this.store.upsertQuote(submitted);
      this.store.recordAuditLog({
        bizType: 'quote',
        bizId: submitted.id,
        operationType: 'submit_demand_quote',
        operatorId: submitted.salesUserId,
        beforeData: created,
        afterData: submitted,
      });

      return submitted;
    }

    const inquiryResult = await this.createInquiryFromQuote(created);
    const submitted = buildSubmittedQuoteRecord(created, inquiryResult);

    this.store.upsertQuote(submitted);
    this.store.recordAuditLog({
      bizType: 'quote',
      bizId: submitted.id,
      operationType: 'submit_quote',
      operatorId: submitted.salesUserId,
      beforeData: created,
      afterData: submitted,
    });

    return submitted;
  }

  async updateDraft(id: number, dto: UpdateQuoteDraftDto) {
    const counterpartyService = new CounterpartyService(this.prisma);
    const submitMode = resolveQuoteSubmitMode(dto.submitMode);
    const items = await normalizeQuoteItems(dto);
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
      await validateDemandQuoteItems(
        dto,
        documentType,
        new ProductService(this.prisma),
      );

      const saved: QuoteDetailRecord = {
        ...before,
        documentType,
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

      if (submitMode === 'submit' && documentType === 'demand') {
        const submitted = buildSubmittedDemandQuoteRecord(saved);
        await this.prismaDb!.businessDocument.update({
          where: { id: existing.id },
          data: {
            status: 'submitted',
            payload: submitted,
          },
        });
        await this.prismaDb!.operationLog.create({
          data: {
            bizType: 'quote',
            bizId: existing.id,
            operationType: 'submit_demand_quote',
            operatorId: BigInt(dto.salesUserId),
            beforeData: saved,
            afterData: submitted,
          },
        });

        return submitted;
      }

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
    await validateDemandQuoteItems(
      dto,
      documentType,
      new ProductService(this.prisma),
    );

    const saved: QuoteDetailRecord = {
      ...existing,
      documentType,
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

    if (submitMode === 'submit' && documentType === 'demand') {
      const submitted = buildSubmittedDemandQuoteRecord(saved);
      this.store.upsertQuote(submitted);
      this.store.recordAuditLog({
        bizType: 'quote',
        bizId: submitted.id,
        operationType: 'submit_demand_quote',
        operatorId: submitted.salesUserId,
        beforeData: saved,
        afterData: submitted,
      });

      return submitted;
    }

    if (submitMode === 'submit') {
      return this.submitDraftQuote(saved.id);
    }

    return saved;
  }

  async listAuditLogs() {
    if (this.shouldUsePrisma()) {
      const logs = (await this.prismaDb!.operationLog.findMany({
        where: { bizType: 'quote' },
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

        return {
          ...detail,
          customerFullName:
            matchedCounterparty?.shortName ?? detail.customerFullName,
        };
      }
    }

    const created = this.store.getQuote(id);

    if (created) {
      const listItem = toQuoteListItem(created);
      if (
        session?.role &&
        !isFormalAdminOrBoss(session?.role) &&
        session?.role !== 'sales_manager' &&
        !matchesFormalUser(session ?? {}, listItem)
      ) {
        throw new NotFoundException('报价单不存在');
      }

      const matchedCounterparty = created.customerId
        ? await counterpartyService.findById(created.customerId)
        : null;

      return {
        ...created,
        customerFullName:
          matchedCounterparty?.shortName ?? created.customerFullName,
        currentProgress: resolveCurrentProgress({
          status: created.status,
          currentVersionNo: created.currentVersionNo,
        }),
      };
    }

    const fallback: QuoteDetailRecord = {
      id,
      quoteNo: 'Q202607070001',
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
