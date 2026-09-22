import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type {
  ConvertedSalesOrderRecord,
  CreatedSalesOrderRecord,
  SalesOrderRecord,
} from './sales-order.service';

export type SalesOrderAuditLogRecord = {
  id: number;
  bizType: 'sales_order';
  bizId: number;
  operationType: string;
  operatorId: number;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
};

type SalesOrderRuntimeState = {
  salesOrders: SalesOrderRecord[];
  auditLogs: SalesOrderAuditLogRecord[];
  nextId: number;
  nextAuditLogId: number;
};

const salesOrderStoreCache = new Map<string, SalesOrderRuntimeStore>();

function cloneSalesOrder(
  record: SalesOrderRecord,
): SalesOrderRecord {
  return {
    ...record,
    autoVoidedPurchaseOrderIds: record.autoVoidedPurchaseOrderIds
      ? [...record.autoVoidedPurchaseOrderIds]
      : record.autoVoidedPurchaseOrderIds,
    versionHistory: record.versionHistory.map((item) => ({ ...item })),
    items: record.items?.map((item) => ({ ...item })),
  } as SalesOrderRecord;
}

function createSeedState(): SalesOrderRuntimeState {
  return {
    salesOrders: [],
    auditLogs: [],
    nextId: 100,
    nextAuditLogId: 1,
  };
}

function readState(filePath: string): SalesOrderRuntimeState {
  if (!existsSync(filePath)) {
    return createSeedState();
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<SalesOrderRuntimeState>;
  return {
    salesOrders: Array.isArray(parsed.salesOrders)
      ? (parsed.salesOrders as SalesOrderRecord[])
      : [],
    auditLogs: Array.isArray(parsed.auditLogs)
      ? (parsed.auditLogs as SalesOrderAuditLogRecord[])
      : [],
    nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 100,
    nextAuditLogId:
      typeof parsed.nextAuditLogId === 'number' ? parsed.nextAuditLogId : 1,
  };
}

function writeState(filePath: string, state: SalesOrderRuntimeState) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export class SalesOrderRuntimeStore {
  private state: SalesOrderRuntimeState;

  constructor(private readonly filePath?: string) {
    this.state = filePath ? readState(filePath) : createSeedState();
    if (filePath && !existsSync(filePath)) {
      writeState(filePath, this.state);
    }
  }

  listSalesOrders() {
    return this.state.salesOrders.map(cloneSalesOrder);
  }

  listAuditLogs() {
    return this.state.auditLogs.map((item) => ({ ...item }));
  }

  getSalesOrder(id: number) {
    const record = this.state.salesOrders.find((item) => item.id === id);
    return record ? cloneSalesOrder(record) : undefined;
  }

  upsertSalesOrder(record: SalesOrderRecord) {
    const nextSalesOrders = this.state.salesOrders.filter((item) => item.id !== record.id);
    nextSalesOrders.push(cloneSalesOrder(record));
    this.state.salesOrders = nextSalesOrders;
    this.persist();
  }

  nextSalesOrderId() {
    const nextId = this.state.nextId;
    this.state.nextId += 1;
    this.persist();
    return nextId;
  }

  recordAuditLog(entry: Omit<SalesOrderAuditLogRecord, 'id' | 'createdAt'>) {
    const record: SalesOrderAuditLogRecord = {
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

export function resolveSalesOrderStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new SalesOrderRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'sales-order-runtime.json'));
  const cachedStore = salesOrderStoreCache.get(filePath);

  if (cachedStore) {
    return cachedStore;
  }

  const store = new SalesOrderRuntimeStore(filePath);
  salesOrderStoreCache.set(filePath, store);

  return store;
}
