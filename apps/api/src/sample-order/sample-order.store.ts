import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { SampleOrderDetailRecord } from './sample-order.service';

export type SampleOrderAuditLogRecord = {
  id: number;
  bizType: 'sample_order';
  bizId: number;
  operationType: string;
  operatorId: number;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
};

type SampleOrderRuntimeState = {
  sampleOrders: SampleOrderDetailRecord[];
  auditLogs: SampleOrderAuditLogRecord[];
  nextId: number;
  nextAuditLogId: number;
};

const sampleOrderStoreCache = new Map<string, SampleOrderRuntimeStore>();

function createSeedState(): SampleOrderRuntimeState {
  return {
    sampleOrders: [],
    auditLogs: [],
    nextId: 100,
    nextAuditLogId: 1,
  };
}

function cloneSampleOrder(record: SampleOrderDetailRecord): SampleOrderDetailRecord {
  return {
    ...record,
    versionHistory: record.versionHistory.map((item) => ({ ...item })),
  };
}

function readState(filePath: string): SampleOrderRuntimeState {
  if (!existsSync(filePath)) {
    return createSeedState();
  }

  const parsed = JSON.parse(
    readFileSync(filePath, 'utf8'),
  ) as Partial<SampleOrderRuntimeState>;

  return {
    sampleOrders: Array.isArray(parsed.sampleOrders)
      ? (parsed.sampleOrders as SampleOrderDetailRecord[])
      : [],
    auditLogs: Array.isArray(parsed.auditLogs)
      ? (parsed.auditLogs as SampleOrderAuditLogRecord[])
      : [],
    nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 100,
    nextAuditLogId:
      typeof parsed.nextAuditLogId === 'number' ? parsed.nextAuditLogId : 1,
  };
}

function writeState(filePath: string, state: SampleOrderRuntimeState) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export class SampleOrderRuntimeStore {
  private state: SampleOrderRuntimeState;

  constructor(private readonly filePath?: string) {
    this.state = filePath ? readState(filePath) : createSeedState();
    if (filePath && !existsSync(filePath)) {
      writeState(filePath, this.state);
    }
  }

  listSampleOrders() {
    return this.state.sampleOrders.map(cloneSampleOrder);
  }

  listAuditLogs() {
    return this.state.auditLogs.map((item) => ({ ...item }));
  }

  getSampleOrder(id: number) {
    const record = this.state.sampleOrders.find((item) => item.id === id);
    return record ? cloneSampleOrder(record) : undefined;
  }

  upsertSampleOrder(record: SampleOrderDetailRecord) {
    const nextSampleOrders = this.state.sampleOrders.filter((item) => item.id !== record.id);
    nextSampleOrders.push(cloneSampleOrder(record));
    this.state.sampleOrders = nextSampleOrders;
    this.persist();
  }

  nextSampleOrderId() {
    const nextId = this.state.nextId;
    this.state.nextId += 1;
    this.persist();
    return nextId;
  }

  recordAuditLog(entry: Omit<SampleOrderAuditLogRecord, 'id' | 'createdAt'>) {
    const record: SampleOrderAuditLogRecord = {
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

export function resolveSampleOrderStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new SampleOrderRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'sample-order-runtime.json'));
  const cachedStore = sampleOrderStoreCache.get(filePath);

  if (cachedStore) {
    return cachedStore;
  }

  const store = new SampleOrderRuntimeStore(filePath);
  sampleOrderStoreCache.set(filePath, store);

  return store;
}
