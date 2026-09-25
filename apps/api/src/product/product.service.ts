import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  buildProductCodePreview,
  normalizeProductCodeRule,
  validateProductCodeRule,
  type ProductCodeRule,
  type ProductCodeRuleKind,
  type ProductCodeRuleSegment,
} from '@erp/shared';
import { paginateItems } from '../common/pagination';
import { resolveCounterpartyStore } from '../counterparty/counterparty.store';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import {
  resolveProductCodeRuleStore,
  type ProductCodeRuleRecord,
} from './product-code-rule.store';
import { resolveProductStore, type ProductCustomFieldRecord } from './product.store';

const productCategories = ['electronics', 'consumables', 'service'] as const;
const productStatuses = ['active', 'inactive', 'deleted'] as const;
const purchaseCodeModes = ['manual', 'generated'] as const;
const productStages = ['quote_candidate', 'formal'] as const;
const pricingModes = ['fixed', 'tiered'] as const;
const factorySourceModes = ['manual', 'supplier'] as const;

type ProductCategory = (typeof productCategories)[number];
type ProductStatus = (typeof productStatuses)[number];
type PurchaseCodeMode = (typeof purchaseCodeModes)[number];
type ProductStage = (typeof productStages)[number];
type PricingMode = (typeof pricingModes)[number];
type FactorySourceMode = (typeof factorySourceModes)[number];

export type ProductSalePriceTierRecord = {
  id: number;
  minQuantity: number;
  salePrice: number;
  currency: string;
  status: 'active' | 'inactive';
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type ProductSalePriceTierInput = {
  id?: number;
  minQuantity: number;
  salePrice: number;
  currency?: string;
  status?: string;
};

export type ProductRecord = {
  id: number;
  sku: string;
  salesCode: string;
  purchaseCode: string;
  purchaseCodeMode: PurchaseCodeMode;
  productStage: ProductStage;
  pricingMode: PricingMode;
  brand: string;
  factoryName: string;
  model: string;
  spec: string;
  singleWeight: number | null;
  cartonSpec: string;
  cartonQuantity: number | null;
  cartonWeight: number | null;
  defaultSupplierCode: string;
  nameCn: string;
  nameEn: string;
  category: ProductCategory;
  unit: string;
  currency: string;
  defaultSalePrice: number;
  defaultPurchasePrice: number;
  salePriceTiers: ProductSalePriceTierRecord[];
  customValues?: Record<string, string>;
  ownerName: string;
  status: ProductStatus;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  deactivatedReason?: string;
};

export type ProductPurchaseSupplierMeta = {
  productId: number;
  sku: string;
  purchaseCode: string;
  productName: string;
  unit: string;
  defaultPurchasePrice: number;
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  purchaseOwnerName: string;
};

export type ListProductsQuery = {
  keyword?: string;
  status?: string;
  category?: string;
  ownerName?: string;
  productStage?: string;
  pricingMode?: string;
  page?: string | number;
  pageSize?: string | number;
};

export type UpdateProductCodeRulePayload = {
  strategy: ProductCodeRule['strategy'];
  serialLength: number;
  serialScope: ProductCodeRule['serialScope'];
  segments: ProductCodeRuleSegment[];
  updatedBy: string;
};

export type CreateProductPayload = {
  sku: string;
  salesCode?: string;
  salesCodeMode?: 'manual' | 'generated';
  purchaseCode?: string;
  purchaseCodeMode?: string;
  factorySourceMode?: string;
  productStage?: string;
  pricingMode?: string;
  brand?: string;
  factoryName?: string;
  model?: string;
  spec?: string;
  singleWeight?: number;
  cartonSpec?: string;
  cartonQuantity?: number;
  cartonWeight?: number;
  defaultSupplierCode?: string;
  nameCn: string;
  nameEn: string;
  category: string;
  unit: string;
  currency: string;
  defaultSalePrice: number;
  defaultPurchasePrice: number;
  salePriceTiers?: ProductSalePriceTierInput[];
  customValues?: Record<string, string>;
  ownerName: string;
  createdBy: string;
  status?: string;
};

export type FindOrCreateQuoteCandidatePayload = {
  sku: string;
  nameCn: string;
  category: string;
  unit: string;
  confirmedSalePrice: number;
  confirmedPurchasePrice: number;
  supplierCode?: string;
  operator: string;
};

export type UpdateProductPayload = Partial<
  Omit<
    Pick<
      ProductRecord,
      | 'sku'
      | 'salesCode'
      | 'purchaseCode'
      | 'purchaseCodeMode'
      | 'productStage'
      | 'pricingMode'
      | 'brand'
      | 'factoryName'
      | 'model'
      | 'spec'
      | 'singleWeight'
      | 'cartonSpec'
      | 'cartonQuantity'
      | 'cartonWeight'
      | 'defaultSupplierCode'
      | 'nameCn'
      | 'nameEn'
      | 'category'
      | 'unit'
      | 'currency'
      | 'defaultSalePrice'
      | 'defaultPurchasePrice'
      | 'ownerName'
      | 'salePriceTiers'
      | 'customValues'
    >,
    'factorySourceMode'
  >
> &
  {
    salePriceTiers?: ProductSalePriceTierInput[];
    customValues?: Record<string, string>;
  } & {
  factorySourceMode?: string;
  updatedBy: string;
};

const categoryLabels: Record<ProductCategory, string> = {
  electronics: 'electronics / 电子类',
  consumables: 'consumables / 耗材类',
  service: 'service / 服务类',
};

const productStageLabels: Record<ProductStage, string> = {
  quote_candidate: '报价候选产品',
  formal: '正式产品',
};

type DecimalLike = number | string | { toNumber: () => number };

type PrismaProductRecord = {
  id: bigint;
  sku: string;
  salesCode: string | null;
  purchaseCode: string | null;
  purchaseCodeMode: string;
  productStage: string;
  pricingMode: string;
  brand: string | null;
  factoryName: string | null;
  model: string | null;
  spec: string | null;
  singleWeight: DecimalLike | null;
  cartonSpec: string | null;
  cartonQuantity: number | null;
  cartonWeight: DecimalLike | null;
  defaultSupplierCode: string | null;
  nameCn: string;
  nameEn: string;
  category: string;
  unit: string;
  currency: string;
  defaultSalePrice: DecimalLike;
  defaultPurchasePrice: DecimalLike;
  customValues?: unknown;
  ownerName: string;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date;
  deactivatedAt: Date | null;
  deactivatedBy: string | null;
  deactivatedReason: string | null;
  salePriceTiers?: PrismaProductSalePriceTierRecord[];
};

type PrismaProductSalePriceTierRecord = {
  id: bigint;
  minQuantity: number;
  salePrice: DecimalLike;
  currency: string;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
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

const productSalePriceTiersInclude = {
  salePriceTiers: {
    orderBy: { minQuantity: 'asc' as const },
  },
};

function normalizeText(value: string | undefined) {
  return value?.trim() ?? '';
}

function readCustomValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function normalizeCustomValues(value: Record<string, string> | undefined, fields: ProductCustomFieldRecord[]) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('自定义字段格式不正确');
  const byId = new Map(fields.map((field) => [String(field.id), field]));
  const result: Record<string, string> = {};
  for (const [id, raw] of Object.entries(value)) {
    const field = byId.get(id);
    if (!field) throw new BadRequestException('自定义字段已删除或不存在');
    if (typeof raw !== 'string') throw new BadRequestException(`${field.name}格式不正确`);
    const text = raw.trim();
    if (field.type === 'number' && text && !/^-?\d+(?:\.\d+)?$/.test(text)) throw new BadRequestException(`${field.name}必须填写数字`);
    if (field.type === 'date' && text && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`)) || new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) !== text)) throw new BadRequestException(`${field.name}必须填写日期`);
    result[id] = text;
  }
  return result;
}

function publicProduct(record: ProductRecord, fields: ProductCustomFieldRecord[]) {
  const ids = new Set(fields.map((field) => String(field.id)));
  return { ...record, customValues: Object.fromEntries(Object.entries(record.customValues ?? {}).filter(([id]) => ids.has(id))) };
}

function normalizeSku(value: string) {
  return value.trim().toUpperCase();
}

function normalizeSupplierCode(value: string) {
  return value.trim().toUpperCase();
}

function isProductCategory(value: string | undefined): value is ProductCategory {
  return productCategories.includes(value as ProductCategory);
}

function isProductStatus(value: string | undefined): value is ProductStatus {
  return productStatuses.includes(value as ProductStatus);
}

function normalizeProductStatus(value: string | undefined): ProductStatus {
  return value === 'inactive' || value === 'deleted' ? value : 'active';
}

function isPrismaUniqueConstraintError(
  error: unknown,
): error is { code: string; meta?: { target?: string | string[] } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function resolveProductUniqueConstraintMessage(error: {
  meta?: { target?: string | string[] };
}) {
  const target = Array.isArray(error.meta?.target)
    ? error.meta?.target.join(',')
    : error.meta?.target ?? '';
  const normalizedTarget = String(target);

  if (normalizedTarget.includes('salesCode')) {
    return '销售编码已存在';
  }

  if (normalizedTarget.includes('purchaseCode')) {
    return '采购编码已存在';
  }

  if (normalizedTarget.includes('sku')) {
    return 'SKU 已存在';
  }

  return '商品编码已存在';
}

function isPurchaseCodeMode(value: string | undefined): value is PurchaseCodeMode {
  return purchaseCodeModes.includes(value as PurchaseCodeMode);
}

function isProductStage(value: string | undefined): value is ProductStage {
  return productStages.includes(value as ProductStage);
}

function isPricingMode(value: string | undefined): value is PricingMode {
  return pricingModes.includes(value as PricingMode);
}

function normalizeSalePriceTiers(
  tiers: ProductSalePriceTierInput[] | undefined,
  currency: string,
) {
  return (tiers ?? [])
    .map((tier) => ({
      id: Number(tier.id) || 0,
      minQuantity: Number(tier.minQuantity),
      salePrice: Number(tier.salePrice),
      currency: normalizeText(tier.currency) || currency || 'USD',
      status:
        tier.status === 'inactive'
          ? ('inactive' as const)
          : ('active' as const),
    }))
    .filter(
      (tier) =>
        Number.isFinite(tier.minQuantity) &&
        Number.isFinite(tier.salePrice) &&
        tier.minQuantity > 0,
    )
    .sort((left, right) => left.minQuantity - right.minQuantity)
    .map((tier, index) => ({
      ...tier,
      id: index + 1,
    })) satisfies ProductSalePriceTierRecord[];
}

function isFactorySourceMode(value: string | undefined): value is FactorySourceMode {
  return factorySourceModes.includes(value as FactorySourceMode);
}

function toNumber(value: DecimalLike) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  return value.toNumber();
}

function toOptionalNumber(value: DecimalLike | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return toNumber(value);
}

function normalizeOptionalFiniteNumber(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new BadRequestException(message);
  }

  return numberValue;
}

function normalizePriceOrZero(value: unknown, message: string) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new BadRequestException(message);
  }

  return numberValue;
}

function normalizeCodeRuleSegments(segments: ProductCodeRuleSegment[]) {
  return [...segments]
    .map((segment) => ({
      ...segment,
      value: typeof segment.value === 'string' ? normalizeText(segment.value).toUpperCase() : undefined,
    }))
    .sort((left, right) => left.order - right.order);
}

function usesSupplierScopedSerial(scope: ProductCodeRule['serialScope']) {
  return scope.startsWith('per_supplier');
}

function usesYearlySerial(scope: ProductCodeRule['serialScope']) {
  return scope.endsWith('_year') || scope.endsWith('_month');
}

function usesMonthlySerial(scope: ProductCodeRule['serialScope']) {
  return scope.endsWith('_month');
}

function buildCodeRuleCreatedAtRange(scope: ProductCodeRule['serialScope'], now: Date) {
  if (usesMonthlySerial(scope)) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    return {
      gte: new Date(Date.UTC(year, month, 1)),
      lt: new Date(Date.UTC(year, month + 1, 1)),
    };
  }

  if (usesYearlySerial(scope)) {
    const year = now.getUTCFullYear();
    return {
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }

  return null;
}

function isDateWithinRange(value: string, range: { gte: Date; lt: Date } | null) {
  if (!range) {
    return true;
  }

  const current = new Date(value);
  return current >= range.gte && current < range.lt;
}

function toProductRecord(record: PrismaProductRecord): ProductRecord {
  return {
    id: Number(record.id),
    sku: record.sku,
    salesCode: record.salesCode ?? '',
    purchaseCode: record.purchaseCode ?? '',
    purchaseCodeMode: isPurchaseCodeMode(record.purchaseCodeMode)
      ? record.purchaseCodeMode
      : 'manual',
    productStage: isProductStage(record.productStage) ? record.productStage : 'formal',
    pricingMode: isPricingMode(record.pricingMode) ? record.pricingMode : 'fixed',
    brand: record.brand ?? '',
    factoryName: record.factoryName ?? '',
    model: record.model ?? '',
    spec: record.spec ?? '',
    singleWeight: toOptionalNumber(record.singleWeight),
    cartonSpec: record.cartonSpec ?? '',
    cartonQuantity: record.cartonQuantity ?? null,
    cartonWeight: toOptionalNumber(record.cartonWeight),
    defaultSupplierCode: record.defaultSupplierCode ?? '',
    nameCn: record.nameCn,
    nameEn: record.nameEn,
    category: isProductCategory(record.category) ? record.category : 'electronics',
    unit: record.unit,
    currency: record.currency,
    defaultSalePrice: toNumber(record.defaultSalePrice),
    defaultPurchasePrice: toNumber(record.defaultPurchasePrice),
    customValues: readCustomValues(record.customValues),
    salePriceTiers: Array.isArray(record.salePriceTiers)
      ? record.salePriceTiers.map((tier) => ({
          id: Number(tier.id),
          minQuantity: tier.minQuantity,
          salePrice: toNumber(tier.salePrice),
          currency: tier.currency,
          status: tier.status === 'inactive' ? 'inactive' : 'active',
          createdBy: tier.createdBy,
          createdAt: tier.createdAt.toISOString(),
          updatedBy: tier.updatedBy ?? undefined,
          updatedAt: tier.updatedAt.toISOString(),
        }))
      : [],
    ownerName: record.ownerName,
    status: normalizeProductStatus(record.status),
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    ...(record.updatedAt ? { updatedAt: record.updatedAt.toISOString() } : {}),
    ...(record.updatedBy ? { updatedBy: record.updatedBy } : {}),
    ...(record.deactivatedAt
      ? { deactivatedAt: record.deactivatedAt.toISOString() }
      : {}),
    ...(record.deactivatedBy ? { deactivatedBy: record.deactivatedBy } : {}),
    ...(record.deactivatedReason
      ? { deactivatedReason: record.deactivatedReason }
      : {}),
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

@Injectable()
export class ProductService {
  private readonly store = resolveProductStore();
  private readonly counterpartyStore = resolveCounterpartyStore();
  private readonly productCodeRuleStore = resolveProductCodeRuleStore();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  private get prismaProductDelegate(): any {
    return this.prisma?.product;
  }

  async listCustomFields(): Promise<ProductCustomFieldRecord[]> {
    if (this.shouldUsePrisma()) {
      const rows = await this.prisma!.productCustomField.findMany({
        where: { deletedAt: null }, orderBy: { id: 'asc' },
      });
      return rows.map((row) => ({ id: Number(row.id), name: row.name, type: row.type as ProductCustomFieldRecord['type'], createdBy: row.createdBy, createdAt: row.createdAt.toISOString() }));
    }
    return this.store.listCustomFields().filter((item) => !item.deletedAt);
  }

  async createCustomField(payload: { name: string; type: string; createdBy: string }) {
    const name = normalizeText(payload.name);
    if (!name || name.length > 64) throw new BadRequestException('字段名称不能为空且不能超过 64 字');
    if (payload.type !== 'text' && payload.type !== 'number' && payload.type !== 'date') throw new BadRequestException('字段类型不合法');
    if (this.shouldUsePrisma()) {
      const row = await this.prisma!.$transaction(async (tx) => {
        const active = await tx.productCustomField.findMany({ where: { deletedAt: null } });
        if (active.length >= 10) throw new BadRequestException('自定义字段数量已达上限（10 个）');
        if (active.some((field) => field.name === name)) throw new ConflictException('自定义字段名称已存在');
        return tx.productCustomField.create({ data: { name, type: payload.type, createdBy: payload.createdBy } });
      }, { isolationLevel: 'Serializable' });
      await this.prisma!.operationLog.create({ data: { bizType: 'product', bizId: row.id, operationType: 'create_product_custom_field', operatorId: 0n, afterData: { name, type: payload.type } } });
      return { id: Number(row.id), name: row.name, type: row.type, createdBy: row.createdBy, createdAt: row.createdAt.toISOString() };
    }
    const active = this.store.listCustomFields().filter((field) => !field.deletedAt);
    if (active.length >= 10) throw new BadRequestException('自定义字段数量已达上限（10 个）');
    if (active.some((field) => field.name === name)) throw new ConflictException('自定义字段名称已存在');
    const field: ProductCustomFieldRecord = { id: this.store.nextCustomFieldId(), name, type: payload.type, createdBy: payload.createdBy, createdAt: new Date().toISOString() };
    this.store.saveCustomFields([...this.store.listCustomFields(), field]);
    this.store.recordAuditLog({ bizType: 'product', bizId: field.id, operationType: 'create_product_custom_field', operatorId: 0, beforeData: null, afterData: { name, type: payload.type } });
    return field;
  }

  async deleteCustomField(id: number) {
    if (this.shouldUsePrisma()) {
      const existing = await this.prisma!.productCustomField.findUnique({ where: { id: BigInt(id) } });
      if (!existing) throw new NotFoundException('自定义字段不存在');
      if (!existing.deletedAt) {
        await this.prisma!.productCustomField.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date() } });
        await this.prisma!.operationLog.create({ data: { bizType: 'product', bizId: BigInt(id), operationType: 'delete_product_custom_field', operatorId: 0n, beforeData: { name: existing.name, type: existing.type }, afterData: { deleted: true } } });
      }
      return { id, deleted: true };
    }
    const fields = this.store.listCustomFields();
    const existing = fields.find((field) => field.id === id);
    if (!existing) throw new NotFoundException('自定义字段不存在');
    if (!existing.deletedAt) {
      existing.deletedAt = new Date().toISOString();
      this.store.saveCustomFields(fields);
      this.store.recordAuditLog({ bizType: 'product', bizId: id, operationType: 'delete_product_custom_field', operatorId: 0, beforeData: { name: existing.name, type: existing.type }, afterData: { deleted: true } });
    }
    return { id, deleted: true };
  }

  async present(record: ProductRecord) {
    return publicProduct(record, await this.listCustomFields());
  }

  private assertProductNotDeleted(
    record: Pick<ProductRecord, 'status'> | Pick<PrismaProductRecord, 'status'>,
    message = '已删除商品不可操作',
  ) {
    if (normalizeProductStatus(record.status) === 'deleted') {
      throw new BadRequestException(message);
    }
  }

  async getCodeRule() {
    return this.productCodeRuleStore.getRule();
  }

  async getCodeRules() {
    return this.productCodeRuleStore.getRules();
  }

  async updateCodeRule(payload: UpdateProductCodeRulePayload) {
    return this.updateCodeRuleByKind('purchase', payload);
  }

  async updateCodeRuleByKind(
    kind: ProductCodeRuleKind,
    payload: UpdateProductCodeRulePayload,
  ) {
    const nextRule: ProductCodeRuleRecord = normalizeProductCodeRule({
      strategy: 'composed_segments',
      serialLength: Number(payload.serialLength),
      serialScope: payload.serialScope,
      segments: normalizeCodeRuleSegments(payload.segments ?? []),
      updatedAt: new Date().toISOString(),
      updatedBy: normalizeText(payload.updatedBy) || 'system',
    } as ProductCodeRuleRecord);

    const validation = validateProductCodeRule(nextRule, { kind });
    if (!validation.ok) {
      throw new BadRequestException(validation.error);
    }

    return this.productCodeRuleStore.updateRuleByKind(kind, nextRule);
  }

  async findById(id: number): Promise<ProductRecord | undefined> {
    if (this.shouldUsePrisma()) {
      const record = (await this.prismaProductDelegate.findUnique({
        include: productSalePriceTiersInclude,
        where: { id: BigInt(id) },
      })) as unknown as PrismaProductRecord | null;

      return record ? toProductRecord(record) : undefined;
    }

    return this.store.getProduct(id);
  }

  async list(query: ListProductsQuery = {}, audience: 'sales' | 'full' = 'full') {
    const customFields = await this.listCustomFields();
    const keyword = normalizeText(query.keyword).toLowerCase();
    const status = isProductStatus(query.status) ? query.status : null;
    const category = isProductCategory(query.category) ? query.category : null;
    const ownerName = normalizeText(query.ownerName).toLowerCase();
    const productStage = isProductStage(query.productStage) ? query.productStage : null;
    const pricingMode = isPricingMode(query.pricingMode) ? query.pricingMode : null;

    const sourceItems = this.shouldUsePrisma()
      ? ((await this.prismaProductDelegate.findMany({
          include: productSalePriceTiersInclude,
          orderBy: { sku: 'asc' },
        })) as unknown as PrismaProductRecord[]).map(toProductRecord)
      : this.store.listProducts();

    const items = sourceItems
      .filter((item) => {
        if (!status && item.status === 'deleted') {
          return false;
        }

        if (status && item.status !== status) {
          return false;
        }

        if (category && item.category !== category) {
          return false;
        }

        if (productStage && item.productStage !== productStage) {
          return false;
        }

        if (pricingMode && item.pricingMode !== pricingMode) {
          return false;
        }

        if (
          keyword &&
          ![
            item.sku,
            item.salesCode,
            ...(audience === 'sales' ? [] : [item.purchaseCode]),
            item.nameCn,
            item.nameEn,
            categoryLabels[item.category],
            item.unit,
            ...(audience === 'sales' ? [] : [item.defaultSupplierCode]),
          ]
            .join(' ')
            .toLowerCase()
            .includes(keyword)
        ) {
          return false;
        }

        if (ownerName && item.ownerName.toLowerCase() !== ownerName) {
          return false;
        }

        return true;
      })
      .sort((left, right) => left.sku.localeCompare(right.sku));

    return paginateItems(items.map((raw) => {
      const item = publicProduct(raw, customFields);
      if (audience !== 'sales') return item;
      const { purchaseCode: _purchaseCode, purchaseCodeMode: _purchaseCodeMode, defaultPurchasePrice, defaultSupplierCode: _defaultSupplierCode, factoryName: _factoryName, ...visible } = item;
      const { customValues: _customValues, ...salesVisible } = visible;
      return { ...salesVisible, quoteEligible: item.defaultSalePrice > 0 && defaultPurchasePrice > 0 };
    }), query.page ?? 1, query.pageSize ?? 20);
  }

  async resolvePurchaseSupplierForLine(input: {
    productId?: number;
    sku?: string;
  }): Promise<ProductPurchaseSupplierMeta | null> {
    const product = await this.findProductByIdOrSku({
      productId: input.productId,
      sku: input.sku,
    });
    const supplierCode = normalizeText(product?.defaultSupplierCode);

    if (!product || !supplierCode) {
      return null;
    }

    const supplier = await this.findSupplierCounterpartyByCode(supplierCode);

    if (!supplier) {
      return null;
    }

    return {
      productId: product.id,
      sku: product.sku,
      purchaseCode: product.purchaseCode,
      productName: product.nameCn || product.nameEn,
      unit: product.unit,
      defaultPurchasePrice: product.defaultPurchasePrice,
      supplierId: supplier.id,
      supplierCode: supplier.code,
      supplierName: supplier.name,
      purchaseOwnerName: supplier.ownerName,
    };
  }

  async create(payload: CreateProductPayload) {
    const customValues = normalizeCustomValues(payload.customValues, await this.listCustomFields());
    const sku = normalizeSku(payload.sku);
    const nameCn = normalizeText(payload.nameCn);
    const nameEn = normalizeText(payload.nameEn);
    const ownerName = normalizeText(payload.ownerName);
    const category = normalizeText(payload.category);
    const unit = normalizeText(payload.unit);
    const currency = normalizeText(payload.currency) || 'USD';
    let salesCode = normalizeText(payload.salesCode);
    const salesCodeMode =
      payload.salesCodeMode === 'generated' ? 'generated' : 'manual';
    const purchaseCode = normalizeText(payload.purchaseCode);
    const defaultSupplierCode = normalizeText(payload.defaultSupplierCode);
    const singleWeight = normalizeOptionalFiniteNumber(
      payload.singleWeight,
      '单个重量必须是有效数字',
    );
    const cartonQuantity = normalizeOptionalFiniteNumber(
      payload.cartonQuantity,
      '装箱数量必须是有效数字',
    );
    const cartonWeight = normalizeOptionalFiniteNumber(
      payload.cartonWeight,
      '装箱重量必须是有效数字',
    );
    const defaultSalePrice = normalizePriceOrZero(
      payload.defaultSalePrice,
      '默认销售价必须是有效数字',
    );
    const defaultPurchasePrice = normalizePriceOrZero(
      payload.defaultPurchasePrice,
      '默认采购价必须是有效数字',
    );
    const factorySourceMode = isFactorySourceMode(payload.factorySourceMode)
      ? payload.factorySourceMode
      : null;
    const purchaseCodeMode = isPurchaseCodeMode(payload.purchaseCodeMode)
      ? payload.purchaseCodeMode
      : 'manual';
    const productStage = isProductStage(payload.productStage)
      ? payload.productStage
      : 'quote_candidate';
    const pricingMode = isPricingMode(payload.pricingMode)
      ? payload.pricingMode
      : 'fixed';
    const productStatus = normalizeProductStatus(payload.status);
    const salePriceTiers = normalizeSalePriceTiers(payload.salePriceTiers, currency);

    if (!sku || !nameCn) {
      throw new BadRequestException('SKU 和中文名不能为空');
    }

    if (!isProductCategory(category)) {
      throw new BadRequestException('商品分类不合法');
    }

    if (salesCodeMode === 'generated') {
      salesCode = await this.generateSalesCodeByRule(category, defaultSupplierCode);
    }

    if (productStage === 'formal' && !salesCode) {
      throw new BadRequestException('销售编码不能为空');
    }

    const rule = this.productCodeRuleStore.getRuleByKind('purchase');
    const ruleNeedsSupplierCode = rule.segments.some(
      (segment) => segment.enabled && segment.key === 'supplier_code',
    );
    if (purchaseCodeMode === 'generated' && !purchaseCode && ruleNeedsSupplierCode && !defaultSupplierCode) {
      throw new BadRequestException(
        '自动生成采购编码需要单位编码。请选择供应商自动带出，或切换为手工填写采购编码。',
      );
    }

    const supplierCounterparty = await this.assertSupplierCodeValid(
      defaultSupplierCode,
      factorySourceMode,
    );
    const resolvedFactoryName =
      factorySourceMode === 'supplier'
        ? supplierCounterparty?.name ?? ''
        : normalizeText(payload.factoryName);

    const normalizedPurchaseCode =
      purchaseCodeMode === 'generated' && !purchaseCode
        ? await this.generatePurchaseCodeByRule({
            defaultSupplierCode,
            category,
          })
        : purchaseCode;

    if (this.shouldUsePrisma()) {
      await this.assertPrismaSkuUnique(sku);
      let record: PrismaProductRecord;
      try {
        record = (await this.prismaProductDelegate.create({
          include: productSalePriceTiersInclude,
          data: {
            sku,
            salesCode: salesCode || null,
            purchaseCode: normalizedPurchaseCode || null,
            purchaseCodeMode,
            productStage,
            pricingMode,
            brand: normalizeText(payload.brand) || null,
            factoryName: resolvedFactoryName || null,
            model: normalizeText(payload.model) || null,
            spec: normalizeText(payload.spec) || null,
            singleWeight,
            cartonSpec: normalizeText(payload.cartonSpec) || null,
            cartonQuantity,
            cartonWeight,
            defaultSupplierCode: defaultSupplierCode || null,
            nameCn,
            nameEn,
            category,
            unit,
            currency,
            defaultSalePrice,
            defaultPurchasePrice,
            customValues,
            ownerName,
            status: productStatus,
            createdBy: normalizeText(payload.createdBy) || 'system',
            salePriceTiers: salePriceTiers.length
              ? {
                  create: salePriceTiers.map((tier) => ({
                    minQuantity: tier.minQuantity,
                    salePrice: tier.salePrice,
                    currency: tier.currency,
                    status: tier.status,
                    createdBy: normalizeText(payload.createdBy) || 'system',
                  })),
                }
              : undefined,
          },
        })) as unknown as PrismaProductRecord;
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          throw new BadRequestException(resolveProductUniqueConstraintMessage(error));
        }
        throw error;
      }
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'product',
          bizId: record.id,
          operationType: 'create_product',
          operatorId: 0n,
          beforeData: undefined,
          afterData: {
            sku: record.sku,
            nameCn: record.nameCn,
            nameEn: record.nameEn,
            category: record.category,
            ownerName: record.ownerName,
            status: record.status,
          },
        },
      });

      return this.present(toProductRecord(record));
    }

    this.assertSkuUnique(sku);
    const record: ProductRecord = {
      id: this.store.nextProductId(),
      sku,
      salesCode,
      purchaseCode: normalizedPurchaseCode,
      purchaseCodeMode,
      productStage,
      pricingMode,
      brand: normalizeText(payload.brand),
      factoryName: resolvedFactoryName,
      model: normalizeText(payload.model),
      spec: normalizeText(payload.spec),
      singleWeight,
      cartonSpec: normalizeText(payload.cartonSpec),
      cartonQuantity,
      cartonWeight,
      defaultSupplierCode,
      nameCn,
      nameEn,
      category,
      unit,
      currency,
      defaultSalePrice,
      defaultPurchasePrice,
      customValues,
      salePriceTiers,
      ownerName,
      status: productStatus,
      createdAt: new Date().toISOString(),
      createdBy: normalizeText(payload.createdBy) || 'system',
    };

    this.store.saveProducts([...this.store.listProducts(), record]);
    this.store.recordAuditLog({
      bizType: 'product',
      bizId: record.id,
      operationType: 'create_product',
      operatorId: 0,
      beforeData: null,
      afterData: {
        sku: record.sku,
        nameCn: record.nameCn,
        nameEn: record.nameEn,
        category: record.category,
        ownerName: record.ownerName,
        status: record.status,
      },
    });
    return this.present(record);
  }

  async findOrCreateQuoteCandidate(
    payload: FindOrCreateQuoteCandidatePayload,
  ): Promise<ProductRecord> {
    const sku = normalizeSku(payload.sku);
    const existing = await this.findProductByIdOrSku({ sku });

    if (existing) {
      this.assertProductNotDeleted(existing, '已删除商品不能作为报价候选产品');
      if (
        existing.nameCn !== normalizeText(payload.nameCn) ||
        existing.category !== normalizeText(payload.category)
      ) {
        throw new BadRequestException('SKU 已存在，但产品名称或分类不一致');
      }
      return existing;
    }

    return this.create({
      sku,
      salesCode: '',
      purchaseCode: '',
      purchaseCodeMode: 'manual',
      productStage: 'quote_candidate',
      pricingMode: 'fixed',
      nameCn: payload.nameCn,
      nameEn: '',
      category: payload.category,
      unit: payload.unit,
      currency: 'USD',
      defaultSalePrice: payload.confirmedSalePrice,
      defaultPurchasePrice: payload.confirmedPurchasePrice,
      ownerName: normalizeText(payload.operator) || 'system',
      createdBy: normalizeText(payload.operator) || 'system',
      status: 'active',
    });
  }

  async update(id: number, payload: UpdateProductPayload) {
    const customFields = payload.customValues !== undefined ? await this.listCustomFields() : [];
    if (this.shouldUsePrisma()) {
      const existing = (await this.prismaProductDelegate.findUnique({
        include: productSalePriceTiersInclude,
        where: { id: BigInt(id) },
      })) as unknown as PrismaProductRecord | null;

      if (!existing) {
        throw new NotFoundException('商品不存在');
      }

      this.assertProductNotDeleted(existing, '已删除商品不可编辑');

      const data: Record<string, unknown> = {
        updatedBy: normalizeText(payload.updatedBy) || 'system',
      };
      if (payload.customValues !== undefined) {
        data.customValues = { ...readCustomValues(existing.customValues), ...normalizeCustomValues(payload.customValues, customFields) };
      }

      if (payload.sku !== undefined) {
        const sku = normalizeSku(payload.sku);
        if (!sku) {
          throw new BadRequestException('SKU 不能为空');
        }
        await this.assertPrismaSkuUnique(sku, id);
        data.sku = sku;
      }

      if (payload.nameCn !== undefined) {
        const nameCn = normalizeText(payload.nameCn);
        if (!nameCn) {
          throw new BadRequestException('中文名不能为空');
        }
        data.nameCn = nameCn;
      }

      if (payload.nameEn !== undefined) {
        const nameEn = normalizeText(payload.nameEn);
        if (!nameEn) {
          throw new BadRequestException('英文名不能为空');
        }
        data.nameEn = nameEn;
      }

      const nextPricingMode =
        payload.pricingMode !== undefined
          ? normalizeText(payload.pricingMode)
          : existing.pricingMode;
      if (payload.pricingMode !== undefined) {
        if (!isPricingMode(nextPricingMode)) {
          throw new BadRequestException('定价方式不合法');
        }
        data.pricingMode = nextPricingMode;
      }

      if (payload.category !== undefined) {
        const category = normalizeText(payload.category);
        if (!isProductCategory(category)) {
          throw new BadRequestException('商品分类不合法');
        }
        data.category = category;
      }

      if (payload.unit !== undefined) {
        data.unit = normalizeText(payload.unit);
      }

      if (payload.currency !== undefined) {
        data.currency = normalizeText(payload.currency) || 'USD';
      }

      if (payload.defaultSalePrice !== undefined) {
        data.defaultSalePrice = Number(payload.defaultSalePrice);
      }

      if (payload.defaultPurchasePrice !== undefined) {
        data.defaultPurchasePrice = Number(payload.defaultPurchasePrice);
      }

      if (payload.salePriceTiers !== undefined || nextPricingMode === 'fixed') {
        const normalizedSalePriceTiers =
          nextPricingMode === 'tiered'
            ? normalizeSalePriceTiers(
                payload.salePriceTiers,
                payload.currency !== undefined
                  ? normalizeText(payload.currency) || 'USD'
                  : existing.currency,
              )
            : [];
        data.salePriceTiers = {
          deleteMany: {},
          ...(normalizedSalePriceTiers.length
            ? {
                create: normalizedSalePriceTiers.map((tier) => ({
                  minQuantity: tier.minQuantity,
                  salePrice: tier.salePrice,
                  currency: tier.currency,
                  status: tier.status,
                  createdBy: normalizeText(payload.updatedBy) || 'system',
                })),
              }
            : {}),
        };
      }

      if (payload.ownerName !== undefined) {
        data.ownerName = normalizeText(payload.ownerName);
      }

      const factorySourceMode = isFactorySourceMode(payload.factorySourceMode)
        ? payload.factorySourceMode
        : null;

      if (payload.defaultSupplierCode !== undefined || factorySourceMode === 'supplier') {
        const nextDefaultSupplierCode =
          payload.defaultSupplierCode !== undefined
            ? normalizeText(payload.defaultSupplierCode)
            : existing.defaultSupplierCode ?? '';
        const supplierCounterparty = await this.assertSupplierCodeValid(
          nextDefaultSupplierCode,
          factorySourceMode,
        );

        data.defaultSupplierCode = nextDefaultSupplierCode || null;
        if (factorySourceMode === 'supplier') {
          data.factoryName = supplierCounterparty?.name ?? null;
        }
      }

      if (payload.factoryName !== undefined && factorySourceMode !== 'supplier') {
        data.factoryName = normalizeText(payload.factoryName) || null;
      }

      let updated: PrismaProductRecord;
      try {
        updated = (await this.prismaProductDelegate.update({
          include: productSalePriceTiersInclude,
          where: { id: BigInt(id) },
          data,
        })) as unknown as PrismaProductRecord;
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          throw new BadRequestException(resolveProductUniqueConstraintMessage(error));
        }
        throw error;
      }
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'product',
          bizId: updated.id,
          operationType: 'update_product',
          operatorId: 0n,
          beforeData: toProductRecord(existing),
          afterData: toProductRecord(updated),
        },
      });

      return this.present(toProductRecord(updated));
    }

    const record = this.store.getProduct(id);

    if (!record) {
      throw new NotFoundException('商品不存在');
    }

    this.assertProductNotDeleted(record, '已删除商品不可编辑');

    const beforeRecord = { ...record };
    if (payload.customValues !== undefined) {
      record.customValues = { ...record.customValues, ...normalizeCustomValues(payload.customValues, customFields) };
    }

    if (payload.sku !== undefined) {
      const sku = normalizeSku(payload.sku);
      if (!sku) {
        throw new BadRequestException('SKU 不能为空');
      }
      this.assertSkuUnique(sku, id);
      record.sku = sku;
    }

    if (payload.nameCn !== undefined) {
      const nameCn = normalizeText(payload.nameCn);
      if (!nameCn) {
        throw new BadRequestException('中文名不能为空');
      }
      record.nameCn = nameCn;
    }

    if (payload.nameEn !== undefined) {
      const nameEn = normalizeText(payload.nameEn);
      if (!nameEn) {
        throw new BadRequestException('英文名不能为空');
      }
      record.nameEn = nameEn;
    }

    if (payload.category !== undefined) {
      const category = normalizeText(payload.category);
      if (!isProductCategory(category)) {
        throw new BadRequestException('商品分类不合法');
      }
      record.category = category;
    }

    const nextPricingMode =
      payload.pricingMode !== undefined
        ? normalizeText(payload.pricingMode)
        : record.pricingMode;
    if (payload.pricingMode !== undefined) {
      if (!isPricingMode(nextPricingMode)) {
        throw new BadRequestException('定价方式不合法');
      }
      record.pricingMode = nextPricingMode;
    }

    if (payload.unit !== undefined) {
      record.unit = normalizeText(payload.unit);
    }

    if (payload.currency !== undefined) {
      record.currency = normalizeText(payload.currency) || 'USD';
    }

    if (payload.defaultSalePrice !== undefined) {
      record.defaultSalePrice = Number(payload.defaultSalePrice);
    }

    if (payload.defaultPurchasePrice !== undefined) {
      record.defaultPurchasePrice = Number(payload.defaultPurchasePrice);
    }

    if (payload.salePriceTiers !== undefined || nextPricingMode === 'fixed') {
      record.salePriceTiers =
        nextPricingMode === 'tiered'
          ? normalizeSalePriceTiers(
              payload.salePriceTiers,
              payload.currency !== undefined
                ? normalizeText(payload.currency) || 'USD'
                : record.currency,
            )
          : [];
    }

    if (payload.ownerName !== undefined) {
      record.ownerName = normalizeText(payload.ownerName);
    }

    const factorySourceMode = isFactorySourceMode(payload.factorySourceMode)
      ? payload.factorySourceMode
      : null;
    if (payload.defaultSupplierCode !== undefined || factorySourceMode === 'supplier') {
      const nextDefaultSupplierCode =
        payload.defaultSupplierCode !== undefined
          ? normalizeText(payload.defaultSupplierCode)
          : record.defaultSupplierCode;
      const supplierCounterparty = await this.assertSupplierCodeValid(
        nextDefaultSupplierCode,
        factorySourceMode,
      );

      record.defaultSupplierCode = nextDefaultSupplierCode;
      if (factorySourceMode === 'supplier') {
        record.factoryName = supplierCounterparty?.name ?? '';
      }
    }

    if (payload.factoryName !== undefined && factorySourceMode !== 'supplier') {
      record.factoryName = normalizeText(payload.factoryName);
    }

    record.updatedAt = new Date().toISOString();
    record.updatedBy = normalizeText(payload.updatedBy) || 'system';

    this.store.saveProducts(
      this.store.listProducts().map((item) => (item.id === id ? record : item)),
    );
    this.store.recordAuditLog({
      bizType: 'product',
      bizId: record.id,
      operationType: 'update_product',
      operatorId: 0,
      beforeData: beforeRecord,
      afterData: record,
    });

    return this.present(record);
  }

  async deactivate(
    id: number,
    payload: {
      operatedBy: string;
      reason: string;
    },
  ) {
    if (this.shouldUsePrisma()) {
      const record = (await this.prismaProductDelegate.findUnique({
        include: productSalePriceTiersInclude,
        where: { id: BigInt(id) },
      })) as unknown as PrismaProductRecord | null;

      if (!record) {
        throw new NotFoundException('商品不存在');
      }

      this.assertProductNotDeleted(record);

      if (record.status === 'inactive') {
        return this.present(toProductRecord(record));
      }

      const updated = (await this.prismaProductDelegate.update({
        include: productSalePriceTiersInclude,
        where: { id: record.id },
        data: {
          status: 'inactive',
          deactivatedAt: new Date(),
          deactivatedBy: normalizeText(payload.operatedBy) || 'system',
          deactivatedReason: normalizeText(payload.reason) || '停用商品',
        },
      })) as unknown as PrismaProductRecord;
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'product',
          bizId: updated.id,
          operationType: 'deactivate_product',
          operatorId: 0n,
          beforeData: {
            status: record.status,
            deactivatedAt: record.deactivatedAt?.toISOString() ?? null,
            deactivatedBy: record.deactivatedBy,
            deactivatedReason: record.deactivatedReason,
          },
          afterData: {
            status: updated.status,
            deactivatedAt: updated.deactivatedAt?.toISOString() ?? null,
            deactivatedBy: updated.deactivatedBy,
            deactivatedReason: updated.deactivatedReason,
          },
        },
      });

      return this.present(toProductRecord(updated));
    }

    const record = this.store.getProduct(id);

    if (!record) {
      throw new NotFoundException('商品不存在');
    }

    this.assertProductNotDeleted(record);

    if (record.status === 'inactive') {
      return this.present(record);
    }

    const beforeRecord = { ...record };
    record.status = 'inactive';
    record.deactivatedAt = new Date().toISOString();
    record.deactivatedBy = normalizeText(payload.operatedBy) || 'system';
    record.deactivatedReason = normalizeText(payload.reason) || '停用商品';

    this.store.saveProducts(
      this.store.listProducts().map((item) => (item.id === id ? record : item)),
    );
    this.store.recordAuditLog({
      bizType: 'product',
      bizId: record.id,
      operationType: 'deactivate_product',
      operatorId: 0,
      beforeData: beforeRecord,
      afterData: record,
    });

    return this.present(record);
  }

  async activate(
    id: number,
    payload: {
      operatedBy: string;
      reason: string;
    },
  ) {
    if (this.shouldUsePrisma()) {
      const record = (await this.prismaProductDelegate.findUnique({
        include: productSalePriceTiersInclude,
        where: { id: BigInt(id) },
      })) as unknown as PrismaProductRecord | null;

      if (!record) {
        throw new NotFoundException('商品不存在');
      }

      this.assertProductNotDeleted(record, '已删除商品不可启用');

      if (record.status === 'active') {
        return this.present(toProductRecord(record));
      }

      const updated = (await this.prismaProductDelegate.update({
        include: productSalePriceTiersInclude,
        where: { id: record.id },
        data: {
          status: 'active',
          deactivatedAt: null,
          deactivatedBy: null,
          deactivatedReason: null,
        },
      })) as unknown as PrismaProductRecord;
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'product',
          bizId: updated.id,
          operationType: 'activate_product',
          operatorId: 0n,
          beforeData: {
            status: record.status,
            deactivatedAt: record.deactivatedAt?.toISOString() ?? null,
            deactivatedBy: record.deactivatedBy,
            deactivatedReason: record.deactivatedReason,
          },
          afterData: {
            status: updated.status,
            operatedBy: normalizeText(payload.operatedBy) || 'system',
            reason: normalizeText(payload.reason) || '重新启用商品',
          },
        },
      });

      return this.present(toProductRecord(updated));
    }

    const record = this.store.getProduct(id);

    if (!record) {
      throw new NotFoundException('商品不存在');
    }

    this.assertProductNotDeleted(record, '已删除商品不可启用');

    if (record.status === 'active') {
      return this.present(record);
    }

    const beforeRecord = { ...record };
    record.status = 'active';
    delete record.deactivatedAt;
    delete record.deactivatedBy;
    delete record.deactivatedReason;

    this.store.saveProducts(
      this.store.listProducts().map((item) => (item.id === id ? record : item)),
    );
    this.store.recordAuditLog({
      bizType: 'product',
      bizId: record.id,
      operationType: 'activate_product',
      operatorId: 0,
      beforeData: beforeRecord,
      afterData: {
        ...record,
        operatedBy: normalizeText(payload.operatedBy) || 'system',
        reason: normalizeText(payload.reason) || '重新启用商品',
      },
    });

    return this.present(record);
  }

  async deleteProduct(
    id: number,
    payload: {
      operatedBy: string;
      reason: string;
    },
  ) {
    if (this.shouldUsePrisma()) {
      const record = (await this.prismaProductDelegate.findUnique({
        include: productSalePriceTiersInclude,
        where: { id: BigInt(id) },
      })) as unknown as PrismaProductRecord | null;

      if (!record) {
        throw new NotFoundException('商品不存在');
      }

      if (normalizeProductStatus(record.status) === 'deleted') {
        return this.present(toProductRecord(record));
      }

      const updated = (await this.prismaProductDelegate.update({
        include: productSalePriceTiersInclude,
        where: { id: record.id },
        data: {
          status: 'deleted',
          deactivatedAt: new Date(),
          deactivatedBy: normalizeText(payload.operatedBy) || 'system',
          deactivatedReason: normalizeText(payload.reason) || '删除商品',
        },
      })) as unknown as PrismaProductRecord;
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'product',
          bizId: updated.id,
          operationType: 'delete_product',
          operatorId: 0n,
          beforeData: {
            status: record.status,
            deactivatedAt: record.deactivatedAt?.toISOString() ?? null,
            deactivatedBy: record.deactivatedBy,
            deactivatedReason: record.deactivatedReason,
          },
          afterData: {
            status: updated.status,
            deactivatedAt: updated.deactivatedAt?.toISOString() ?? null,
            deactivatedBy: updated.deactivatedBy,
            deactivatedReason: updated.deactivatedReason,
          },
        },
      });

      return this.present(toProductRecord(updated));
    }

    const record = this.store.getProduct(id);

    if (!record) {
      throw new NotFoundException('商品不存在');
    }

    if (record.status === 'deleted') {
      return this.present(record);
    }

    const beforeRecord = { ...record };
    record.status = 'deleted';
    record.deactivatedAt = new Date().toISOString();
    record.deactivatedBy = normalizeText(payload.operatedBy) || 'system';
    record.deactivatedReason = normalizeText(payload.reason) || '删除商品';

    this.store.saveProducts(
      this.store.listProducts().map((item) => (item.id === id ? record : item)),
    );
    this.store.recordAuditLog({
      bizType: 'product',
      bizId: record.id,
      operationType: 'delete_product',
      operatorId: 0,
      beforeData: beforeRecord,
      afterData: record,
    });

    return this.present(record);
  }

  async convertToFormal(
    id: number,
    payload: {
      operatedBy: string;
    },
  ) {
    return this.ensureFormalForSalesOrder(id, payload);
  }

  async ensureFormalForSalesOrder(
    id: number,
    payload: {
      operatedBy: string;
    },
  ) {
    if (this.shouldUsePrisma()) {
      const record = (await this.prismaProductDelegate.findUnique({
        include: productSalePriceTiersInclude,
        where: { id: BigInt(id) },
      })) as unknown as PrismaProductRecord | null;

      if (!record) {
        throw new NotFoundException('商品不存在');
      }

      this.assertProductNotDeleted(record);

      const normalized = toProductRecord(record);
      if (normalized.productStage === 'formal') {
        return this.present(normalized);
      }
      const salesCode =
        normalized.salesCode ||
        (await this.generateSalesCodeByRule(normalized.category, normalized.defaultSupplierCode));
      this.assertFormalProductReady({ ...normalized, salesCode });

      const updated = (await this.prismaProductDelegate.update({
        include: productSalePriceTiersInclude,
        where: { id: BigInt(id) },
        data: {
          productStage: 'formal',
          salesCode,
          updatedBy: normalizeText(payload.operatedBy) || 'system',
        },
      })) as unknown as PrismaProductRecord;
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'product',
          bizId: updated.id,
          operationType: 'convert_product_to_formal',
          operatorId: 0n,
          beforeData: {
            productStage: normalized.productStage,
            salesCode: normalized.salesCode,
          },
          afterData: {
            productStage: 'formal',
            salesCode,
            operatedBy: normalizeText(payload.operatedBy) || 'system',
          },
        },
      });

      return this.present(toProductRecord(updated));
    }

    const record = this.store.getProduct(id);

    if (!record) {
      throw new NotFoundException('商品不存在');
    }

    this.assertProductNotDeleted(record);

    if (record.productStage === 'formal') {
      return this.present(record);
    }
    const salesCode =
      record.salesCode || (await this.generateSalesCodeByRule(record.category, record.defaultSupplierCode));
    this.assertFormalProductReady({ ...record, salesCode });

    const updated: ProductRecord = {
      ...record,
      productStage: 'formal',
      salesCode,
      updatedBy: normalizeText(payload.operatedBy) || 'system',
      updatedAt: new Date().toISOString(),
    };

    this.store.saveProducts(
      this.store.listProducts().map((item) => (item.id === id ? updated : item)),
    );
    this.store.recordAuditLog({
      bizType: 'product',
      bizId: id,
      operationType: 'convert_product_to_formal',
      operatorId: 0,
      beforeData: {
        productStage: record.productStage,
        salesCode: record.salesCode,
      },
      afterData: {
        productStage: updated.productStage,
        salesCode: updated.salesCode,
        operatedBy: updated.updatedBy,
      },
    });

    return this.present(updated);
  }

  async listAuditLogs() {
    const activeIds = new Set((await this.listCustomFields()).map((field) => String(field.id)));
    const hideDeletedValues = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      const object = value as Record<string, unknown>;
      if (!('customValues' in object)) return value;
      return { ...object, customValues: Object.fromEntries(Object.entries(readCustomValues(object.customValues)).filter(([id]) => activeIds.has(id))) };
    };
    if (this.shouldUsePrisma()) {
      const logs = (await this.prisma!.operationLog.findMany({
        where: { bizType: 'product' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })) as PrismaOperationLogRecord[];

      return {
        items: logs.map((log) => {
          const item = toAuditLogRecord(log);
          return { ...item, beforeData: hideDeletedValues(item.beforeData), afterData: hideDeletedValues(item.afterData) };
        }),
      };
    }

    return {
      items: this.store.listAuditLogs().map((item) => ({ ...item, beforeData: hideDeletedValues(item.beforeData), afterData: hideDeletedValues(item.afterData) })),
    };
  }

  private assertSkuUnique(sku: string, currentId?: number) {
    const duplicated = this.store.listProducts().some(
      (item) => item.sku === sku && item.id !== currentId,
    );

    if (duplicated) {
      throw new BadRequestException('SKU 已存在');
    }
  }

  private async assertPrismaSkuUnique(sku: string, currentId?: number) {
    const duplicated = (await this.prismaProductDelegate.findUnique({
      where: { sku },
    })) as unknown as PrismaProductRecord | null;

    if (duplicated && Number(duplicated.id) !== currentId) {
      throw new BadRequestException('SKU 已存在');
    }
  }

  private assertFormalProductReady(record: Pick<ProductRecord, 'category' | 'sku' | 'nameCn' | 'salesCode'>) {
    if (!record.category || !record.sku || !record.nameCn) {
      throw new BadRequestException('正式产品缺少必填字段');
    }

    if (!record.salesCode) {
      throw new BadRequestException('销售编码不能为空');
    }
  }

  private async findProductByIdOrSku(input: {
    productId?: number;
    sku?: string;
  }) {
    const productId = Number(input.productId ?? 0);
    const sku = normalizeSku(input.sku ?? '');

    if (this.shouldUsePrisma()) {
      if (Number.isInteger(productId) && productId > 0) {
        const byId = (await this.prismaProductDelegate.findUnique({
          include: productSalePriceTiersInclude,
          where: { id: BigInt(productId) },
        })) as unknown as PrismaProductRecord | null;

        if (byId) {
          return toProductRecord(byId);
        }
      }

      if (sku) {
        const bySku = (await this.prismaProductDelegate.findUnique({
          include: productSalePriceTiersInclude,
          where: { sku },
        })) as unknown as PrismaProductRecord | null;

        return bySku ? toProductRecord(bySku) : null;
      }

      return null;
    }

    const products = this.store.listProducts();
    const byId =
      Number.isInteger(productId) && productId > 0
        ? products.find((item) => item.id === productId)
        : null;

    if (byId) {
      return byId;
    }

    return sku ? products.find((item) => item.sku === sku) ?? null : null;
  }

  private async findSupplierCounterpartyByCode(defaultSupplierCode: string) {
    const supplierCode = normalizeSupplierCode(defaultSupplierCode);

    if (!supplierCode) {
      return null;
    }

    if (this.shouldUsePrisma()) {
      const counterparty = (await (this.prisma as any)?.counterparty?.findUnique?.({
        where: { code: supplierCode },
      })) as
        | {
            id: bigint;
            type?: string;
            code?: string;
            name?: string;
            ownerName?: string;
          }
        | null;

      if (!counterparty || (counterparty.type !== 'supplier' && counterparty.type !== 'both')) {
        return null;
      }

      return {
        id: Number(counterparty.id),
        code: counterparty.code ?? supplierCode,
        name: counterparty.name ?? supplierCode,
        ownerName: counterparty.ownerName ?? '',
      };
    }

    const counterparty = this.counterpartyStore
      .listCounterparties()
      .find((item) => item.code === supplierCode);

    if (!counterparty || (counterparty.type !== 'supplier' && counterparty.type !== 'both')) {
      return null;
    }

    return {
      id: counterparty.id,
      code: counterparty.code,
      name: counterparty.name,
      ownerName: counterparty.ownerName,
    };
  }

  private async assertSupplierCodeValid(
    defaultSupplierCode: string,
    factorySourceMode: FactorySourceMode | null = null,
  ) {
    if (!defaultSupplierCode) {
      if (factorySourceMode === 'supplier') {
        throw new BadRequestException('供应商联动模式必须选择供应商');
      }

      return null;
    }

    if (factorySourceMode === 'manual') {
      return null;
    }

    if (this.shouldUsePrisma()) {
      const counterparty = (await (this.prisma as any)?.counterparty?.findUnique?.({
        where: { code: defaultSupplierCode },
      })) as { type?: string; code?: string; name?: string } | null;

      if (
        !counterparty &&
        (defaultSupplierCode.startsWith('SUP-') || defaultSupplierCode.startsWith('CP-'))
      ) {
        return null;
      }

      if (!counterparty || (counterparty.type !== 'supplier' && counterparty.type !== 'both')) {
        throw new BadRequestException('默认供应商编码必须关联供应商');
      }

      return counterparty;
    }

    const counterparty = this.counterpartyStore
      .listCounterparties()
      .find((item) => item.code === defaultSupplierCode);

    if (
      !counterparty &&
      (defaultSupplierCode.startsWith('SUP-') || defaultSupplierCode.startsWith('CP-'))
    ) {
      return null;
    }

    if (!counterparty || (counterparty.type !== 'supplier' && counterparty.type !== 'both')) {
      throw new BadRequestException('默认供应商编码必须关联供应商');
    }

    return counterparty;
  }

  private async generatePurchaseCodeByRule(input: {
    defaultSupplierCode: string;
    category: ProductCategory;
  }) {
    const rule = this.productCodeRuleStore.getRuleByKind('purchase');
    const enabledSegments = rule.segments.filter((segment) => segment.enabled);

    if (enabledSegments.some((segment) => segment.key === 'supplier_code') && !input.defaultSupplierCode) {
      throw new BadRequestException('自动生成产品编码前必须填写供应商编码');
    }

    const sequence = (await this.countProductsForCodeRule(rule, input.defaultSupplierCode)) + 1;

    return buildProductCodePreview(rule, {
      supplierCode: input.defaultSupplierCode,
      category: input.category,
      now: new Date().toISOString(),
      sequence,
    });
  }

  async generateSalesCodeByRule(category: string, defaultSupplierCode = '') {
    if (!isProductCategory(category)) {
      throw new BadRequestException('商品分类不合法');
    }
    const rule = this.productCodeRuleStore.getRuleByKind('sales');
    const validation = validateProductCodeRule(rule, { kind: 'sales' });
    if (!validation.ok) {
      throw new BadRequestException(validation.error);
    }
    if (rule.segments.some((segment) => segment.enabled && segment.key === 'supplier_code') && !defaultSupplierCode) {
      throw new BadRequestException('自动生成产品编码前必须填写供应商编码');
    }
    let sequence = (await this.countProductsForCodeRule(rule, defaultSupplierCode)) + 1;
    for (;;) {
      const salesCode = buildProductCodePreview(rule, {
        supplierCode: defaultSupplierCode,
        category,
        now: new Date().toISOString(),
        sequence,
      });
      const duplicated = this.shouldUsePrisma()
        ? Boolean(
            await this.prismaProductDelegate.findUnique({
              where: { salesCode },
            }),
          )
        : this.store.listProducts().some((item) => item.salesCode === salesCode);
      if (!duplicated) {
        return salesCode;
      }
      sequence += 1;
    }
  }

  private async countProductsForCodeRule(
    rule: ProductCodeRuleRecord,
    defaultSupplierCode: string,
  ) {
    const createdAtRange = buildCodeRuleCreatedAtRange(rule.serialScope, new Date());

    if (this.shouldUsePrisma()) {
      return this.countPrismaProductsForCodeRule(rule, defaultSupplierCode, createdAtRange);
    }

    return this.store.listProducts().filter((item) => {
      if (
        usesSupplierScopedSerial(rule.serialScope) &&
        item.defaultSupplierCode !== defaultSupplierCode
      ) {
        return false;
      }

      return isDateWithinRange(item.createdAt, createdAtRange);
    }).length;
  }

  private async countPrismaProductsForCodeRule(
    rule: ProductCodeRuleRecord,
    defaultSupplierCode: string,
    createdAtRange: { gte: Date; lt: Date } | null,
  ) {
    const where = {
      ...(usesSupplierScopedSerial(rule.serialScope) ? { defaultSupplierCode } : {}),
      ...(createdAtRange ? { createdAt: createdAtRange } : {}),
    };

    const items = (await this.prismaProductDelegate.findMany({
      where,
      select: { id: true },
    })) as Array<{ id: bigint }>;

    return items.length;
  }
}
