import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type {
  CreatedPurchaseOrderRecord,
  PurchaseOrderRecord,
} from './purchase-order.service';

export type PurchaseOrderAuditLogRecord = {
  id: number;
  bizType: 'purchase_order';
  bizId: number;
  operationType: string;
  operatorId: number;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
};

type PurchaseOrderRuntimeState = {
  purchaseOrders: PurchaseOrderRecord[];
  auditLogs: PurchaseOrderAuditLogRecord[];
  nextId: number;
  nextAuditLogId: number;
};

const purchaseOrderStoreCache = new Map<string, PurchaseOrderRuntimeStore>();

function clonePurchaseOrder(record: PurchaseOrderRecord): PurchaseOrderRecord {
  return {
    ...record,
    versionHistory: record.versionHistory.map((item) => ({ ...item })),
    items: record.items.map((item) => ({ ...item })),
  } as PurchaseOrderRecord;
}

function createSeedState(): PurchaseOrderRuntimeState {
  return {
    purchaseOrders: [],
    auditLogs: [],
    nextId: 100,
    nextAuditLogId: 1,
  };
}

function readState(filePath: string): PurchaseOrderRuntimeState {
  if (!existsSync(filePath)) {
    return createSeedState();
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<PurchaseOrderRuntimeState>;
  return {
    purchaseOrders: Array.isArray(parsed.purchaseOrders)
      ? (parsed.purchaseOrders as PurchaseOrderRecord[])
      : [],
    auditLogs: Array.isArray(parsed.auditLogs)
      ? (parsed.auditLogs as PurchaseOrderAuditLogRecord[])
      : [],
    nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 100,
    nextAuditLogId:
      typeof parsed.nextAuditLogId === 'number' ? parsed.nextAuditLogId : 1,
  };
}

function writeState(filePath: string, state: PurchaseOrderRuntimeState) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export class PurchaseOrderRuntimeStore {
  private state: PurchaseOrderRuntimeState;

  constructor(private readonly filePath?: string) {
    this.state = filePath ? readState(filePath) : createSeedState();
    if (filePath && !existsSync(filePath)) {
      writeState(filePath, this.state);
    }
  }

  listPurchaseOrders() {
    return this.state.purchaseOrders.map(clonePurchaseOrder);
  }

  listAuditLogs() {
    return this.state.auditLogs.map((item) => ({ ...item }));
  }

  getPurchaseOrder(id: number) {
    const record = this.state.purchaseOrders.find((item) => item.id === id);
    return record ? clonePurchaseOrder(record) : undefined;
  }

  upsertPurchaseOrder(record: PurchaseOrderRecord) {
    const nextPurchaseOrders = this.state.purchaseOrders.filter((item) => item.id !== record.id);
    nextPurchaseOrders.push(clonePurchaseOrder(record));
    this.state.purchaseOrders = nextPurchaseOrders;
    this.persist();
  }

  nextPurchaseOrderId() {
    const nextId = this.state.nextId;
    this.state.nextId += 1;
    this.persist();
    return nextId;
  }

  recordAuditLog(entry: Omit<PurchaseOrderAuditLogRecord, 'id' | 'createdAt'>) {
    const record: PurchaseOrderAuditLogRecord = {
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

export function resolvePurchaseOrderStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new PurchaseOrderRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'purchase-order-runtime.json'));
  const cachedStore = purchaseOrderStoreCache.get(filePath);

  if (cachedStore) {
    return cachedStore;
  }

  const store = new PurchaseOrderRuntimeStore(filePath);
  purchaseOrderStoreCache.set(filePath, store);

  return store;
}
