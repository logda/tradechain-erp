import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { ProductRecord } from './product.service';

export type ProductCustomFieldRecord = {
  id: number;
  name: string;
  type: 'text' | 'number' | 'date';
  createdBy: string;
  createdAt: string;
  deletedAt?: string;
};

export type ProductAuditLogRecord = {
  id: number;
  bizType: 'product';
  bizId: number;
  operationType: string;
  operatorId: number;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
};

type ProductRuntimeState = {
  products: ProductRecord[];
  auditLogs: ProductAuditLogRecord[];
  nextId: number;
  nextAuditLogId: number;
  customFields: ProductCustomFieldRecord[];
  nextCustomFieldId: number;
};

const productStoreCache = new Map<string, ProductRuntimeStore>();

function createSeedState(): ProductRuntimeState {
  return {
    products: [
      {
        id: 1,
        sku: 'SKU-LED-001',
        salesCode: 'SALE-LED-001',
        purchaseCode: 'PUR-LED-001',
        purchaseCodeMode: 'manual',
        productStage: 'formal',
        pricingMode: 'tiered',
        brand: 'Starlight',
        factoryName: '深圳光源制造有限公司',
        model: 'SL-001',
        spec: '5m / RGB',
        singleWeight: 0.85,
        cartonSpec: '20 pcs / carton',
        cartonQuantity: 20,
        cartonWeight: 18.5,
        defaultSupplierCode: 'SUP-LIGHT',
        nameCn: '智能 LED 灯带',
        nameEn: 'Smart LED Strip',
        category: 'electronics',
        unit: 'set',
        currency: 'USD',
        defaultSalePrice: 15.9,
        defaultPurchasePrice: 8.5,
        salePriceTiers: [
          { id: 1, minQuantity: 1, salePrice: 15.9, currency: 'USD', status: 'active' },
          { id: 2, minQuantity: 100, salePrice: 14.5, currency: 'USD', status: 'active' },
        ],
        ownerName: 'Zoe',
        status: 'active',
        createdAt: '2026-07-11T09:00:00.000Z',
        createdBy: 'system',
      },
      {
        id: 2,
        sku: 'SKU-CBL-002',
        salesCode: 'SALE-CBL-002',
        purchaseCode: 'PUR-CBL-002',
        purchaseCodeMode: 'generated',
        productStage: 'quote_candidate',
        pricingMode: 'fixed',
        brand: 'LinkPro',
        factoryName: '深圳连接制造厂',
        model: 'LC-002',
        spec: 'USB-C / 1m',
        singleWeight: 0.12,
        cartonSpec: '100 pcs / carton',
        cartonQuantity: 100,
        cartonWeight: 12.5,
        defaultSupplierCode: 'SUP-LIGHT',
        nameCn: 'USB-C 线缆',
        nameEn: 'USB-C Cable',
        category: 'electronics',
        unit: 'pcs',
        currency: 'USD',
        defaultSalePrice: 4.8,
        defaultPurchasePrice: 2.1,
        salePriceTiers: [],
        ownerName: 'Leo',
        status: 'active',
        createdAt: '2026-07-11T09:05:00.000Z',
        createdBy: 'system',
      },
      {
        id: 3,
        sku: 'SKU-SVC-003',
        salesCode: 'SALE-SVC-003',
        purchaseCode: 'PUR-SVC-003',
        purchaseCodeMode: 'manual',
        productStage: 'formal',
        pricingMode: 'fixed',
        brand: 'ServiceLab',
        factoryName: '',
        model: 'SV-003',
        spec: 'On-site setup',
        singleWeight: null,
        cartonSpec: '',
        cartonQuantity: null,
        cartonWeight: null,
        defaultSupplierCode: '',
        nameCn: '安装调试服务',
        nameEn: 'Installation Service',
        category: 'service',
        unit: 'job',
        currency: 'USD',
        defaultSalePrice: 120,
        defaultPurchasePrice: 70,
        salePriceTiers: [],
        ownerName: 'Mia',
        status: 'active',
        createdAt: '2026-07-11T09:10:00.000Z',
        createdBy: 'system',
      },
    ],
    auditLogs: [],
    nextId: 4,
    nextAuditLogId: 1,
    customFields: [],
    nextCustomFieldId: 1,
  };
}

function cloneProduct(record: ProductRecord): ProductRecord {
  return {
    ...record,
    salesCode: record.salesCode ?? '',
    purchaseCode: record.purchaseCode ?? '',
    purchaseCodeMode: record.purchaseCodeMode ?? 'manual',
    productStage: record.productStage ?? 'formal',
    pricingMode: record.pricingMode ?? 'fixed',
    brand: record.brand ?? '',
    factoryName: record.factoryName ?? '',
    model: record.model ?? '',
    spec: record.spec ?? '',
    singleWeight: record.singleWeight ?? null,
    cartonSpec: record.cartonSpec ?? '',
    cartonQuantity: record.cartonQuantity ?? null,
    cartonWeight: record.cartonWeight ?? null,
    defaultSupplierCode: record.defaultSupplierCode ?? '',
    salePriceTiers: (record.salePriceTiers ?? []).map((tier) => ({ ...tier })),
    customValues: { ...record.customValues },
    updatedAt: record.updatedAt ?? undefined,
    updatedBy: record.updatedBy ?? undefined,
    deactivatedAt: record.deactivatedAt ?? undefined,
    deactivatedBy: record.deactivatedBy ?? undefined,
    deactivatedReason: record.deactivatedReason ?? undefined,
  };
}

function readState(filePath: string): ProductRuntimeState {
  if (!existsSync(filePath)) {
    return createSeedState();
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<ProductRuntimeState>;
  return {
    products: Array.isArray(parsed.products) ? (parsed.products as ProductRecord[]) : [],
    auditLogs: Array.isArray(parsed.auditLogs)
      ? (parsed.auditLogs as ProductAuditLogRecord[])
      : [],
    nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
    nextAuditLogId:
      typeof parsed.nextAuditLogId === 'number' ? parsed.nextAuditLogId : 1,
    customFields: Array.isArray(parsed.customFields) ? parsed.customFields : [],
    nextCustomFieldId: typeof parsed.nextCustomFieldId === 'number' ? parsed.nextCustomFieldId : 1,
  };
}

function writeState(filePath: string, state: ProductRuntimeState) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export class ProductRuntimeStore {
  private state: ProductRuntimeState;

  constructor(private readonly filePath?: string) {
    this.state = filePath ? readState(filePath) : createSeedState();
    if (filePath && !existsSync(filePath)) {
      writeState(filePath, this.state);
    }
  }

  listProducts() {
    return this.state.products.map(cloneProduct);
  }

  listAuditLogs() {
    return this.state.auditLogs.map((item) => ({ ...item }));
  }

  listCustomFields() {
    return this.state.customFields.map((item) => ({ ...item }));
  }

  saveCustomFields(fields: ProductCustomFieldRecord[]) {
    this.state.customFields = fields.map((item) => ({ ...item }));
    this.persist();
  }

  nextCustomFieldId() {
    const id = this.state.nextCustomFieldId++;
    this.persist();
    return id;
  }

  getProduct(id: number) {
    const record = this.state.products.find((item) => item.id === id);
    return record ? cloneProduct(record) : undefined;
  }

  saveProducts(products: ProductRecord[]) {
    this.state.products = products.map(cloneProduct);
    this.persist();
  }

  nextProductId() {
    const nextId = this.state.nextId;
    this.state.nextId += 1;
    this.persist();
    return nextId;
  }

  recordAuditLog(entry: Omit<ProductAuditLogRecord, 'id' | 'createdAt'>) {
    const record: ProductAuditLogRecord = {
      ...entry,
      id: this.state.nextAuditLogId,
      createdAt: new Date().toISOString(),
    };
    this.state.nextAuditLogId += 1;
    this.state.auditLogs.push(record);
    this.persist();
    return record;
  }

  private persist() {
    if (!this.filePath) {
      return;
    }

    writeState(this.filePath, this.state);
  }
}

export function resolveProductStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new ProductRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'product-runtime.json'));
  const cachedStore = productStoreCache.get(filePath);

  if (cachedStore) {
    return cachedStore;
  }

  const store = new ProductRuntimeStore(filePath);
  productStoreCache.set(filePath, store);

  return store;
}
