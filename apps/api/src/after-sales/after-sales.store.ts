import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { CreatedAfterSalesRecord } from './after-sales.service';

export type AfterSalesAuditLogRecord = {
  id: number;
  bizType: 'after_sales';
  bizId: number;
  operationType: string;
  operatorId: number;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
};

type AfterSalesRuntimeState = {
  afterSalesOrders: CreatedAfterSalesRecord[];
  auditLogs: AfterSalesAuditLogRecord[];
  nextId: number;
  nextAuditLogId: number;
};

const afterSalesStoreCache = new Map<string, AfterSalesRuntimeStore>();

function createSeedState(): AfterSalesRuntimeState {
  return {
    afterSalesOrders: [],
    auditLogs: [],
    nextId: 100,
    nextAuditLogId: 1,
  };
}

function cloneAfterSales(
  record: CreatedAfterSalesRecord,
): CreatedAfterSalesRecord {
  return {
    ...record,
    items: record.items.map((item) => ({ ...item })),
  };
}

function readState(filePath: string): AfterSalesRuntimeState {
  if (!existsSync(filePath)) {
    return createSeedState();
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<AfterSalesRuntimeState>;
  return {
    afterSalesOrders: Array.isArray(parsed.afterSalesOrders)
      ? (parsed.afterSalesOrders as CreatedAfterSalesRecord[])
      : [],
    auditLogs: Array.isArray(parsed.auditLogs)
      ? (parsed.auditLogs as AfterSalesAuditLogRecord[])
      : [],
    nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 100,
    nextAuditLogId:
      typeof parsed.nextAuditLogId === 'number' ? parsed.nextAuditLogId : 1,
  };
}

function writeState(filePath: string, state: AfterSalesRuntimeState) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export class AfterSalesRuntimeStore {
  private state: AfterSalesRuntimeState;

  constructor(private readonly filePath?: string) {
    this.state = filePath ? readState(filePath) : createSeedState();
    if (filePath && !existsSync(filePath)) {
      writeState(filePath, this.state);
    }
  }

  listAfterSalesOrders() {
    return this.state.afterSalesOrders.map(cloneAfterSales);
  }

  listAuditLogs() {
    return this.state.auditLogs.map((item) => ({ ...item }));
  }

  getAfterSalesOrder(id: number) {
    const record = this.state.afterSalesOrders.find((item) => item.id === id);
    return record ? cloneAfterSales(record) : undefined;
  }

  upsertAfterSalesOrder(record: CreatedAfterSalesRecord) {
    const nextOrders = this.state.afterSalesOrders.filter(
      (item) => item.id !== record.id,
    );
    nextOrders.push(cloneAfterSales(record));
    this.state.afterSalesOrders = nextOrders;
    this.persist();
  }

  nextAfterSalesId() {
    const nextId = this.state.nextId;
    this.state.nextId += 1;
    this.persist();
    return nextId;
  }

  recordAuditLog(entry: Omit<AfterSalesAuditLogRecord, 'id' | 'createdAt'>) {
    const record: AfterSalesAuditLogRecord = {
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

export function resolveAfterSalesStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new AfterSalesRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'after-sales-runtime.json'));
  const cachedStore = afterSalesStoreCache.get(filePath);

  if (cachedStore) {
    return cachedStore;
  }

  const store = new AfterSalesRuntimeStore(filePath);
  afterSalesStoreCache.set(filePath, store);

  return store;
}
