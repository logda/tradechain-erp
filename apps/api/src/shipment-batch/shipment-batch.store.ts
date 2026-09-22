import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { CreatedShipmentBatchRecord } from './shipment-batch.service';

export type ShipmentBatchAuditLogRecord = {
  id: number;
  bizType: 'shipment_batch';
  bizId: number;
  operationType: string;
  operatorId: number;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
};

type ShipmentBatchRuntimeState = {
  shipmentBatches: CreatedShipmentBatchRecord[];
  auditLogs: ShipmentBatchAuditLogRecord[];
  nextId: number;
  nextAuditLogId: number;
};

const shipmentBatchStoreCache = new Map<string, ShipmentBatchRuntimeStore>();

function createSeedState(): ShipmentBatchRuntimeState {
  return {
    shipmentBatches: [],
    auditLogs: [],
    nextId: 100,
    nextAuditLogId: 1,
  };
}

function cloneShipmentBatch(
  record: CreatedShipmentBatchRecord,
): CreatedShipmentBatchRecord {
  return {
    ...record,
    items: record.items.map((item) => ({ ...item })),
  };
}

function readState(filePath: string): ShipmentBatchRuntimeState {
  if (!existsSync(filePath)) {
    return createSeedState();
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<ShipmentBatchRuntimeState>;
  return {
    shipmentBatches: Array.isArray(parsed.shipmentBatches)
      ? (parsed.shipmentBatches as CreatedShipmentBatchRecord[])
      : [],
    auditLogs: Array.isArray(parsed.auditLogs)
      ? (parsed.auditLogs as ShipmentBatchAuditLogRecord[])
      : [],
    nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 100,
    nextAuditLogId:
      typeof parsed.nextAuditLogId === 'number' ? parsed.nextAuditLogId : 1,
  };
}

function writeState(filePath: string, state: ShipmentBatchRuntimeState) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export class ShipmentBatchRuntimeStore {
  private state: ShipmentBatchRuntimeState;

  constructor(private readonly filePath?: string) {
    this.state = filePath ? readState(filePath) : createSeedState();
    if (filePath && !existsSync(filePath)) {
      writeState(filePath, this.state);
    }
  }

  listShipmentBatches() {
    return this.state.shipmentBatches.map(cloneShipmentBatch);
  }

  listAuditLogs() {
    return this.state.auditLogs.map((item) => ({ ...item }));
  }

  getShipmentBatch(id: number) {
    const record = this.state.shipmentBatches.find((item) => item.id === id);
    return record ? cloneShipmentBatch(record) : undefined;
  }

  upsertShipmentBatch(record: CreatedShipmentBatchRecord) {
    const nextShipmentBatches = this.state.shipmentBatches.filter(
      (item) => item.id !== record.id,
    );
    nextShipmentBatches.push(cloneShipmentBatch(record));
    this.state.shipmentBatches = nextShipmentBatches;
    this.persist();
  }

  nextShipmentBatchId() {
    const nextId = this.state.nextId;
    this.state.nextId += 1;
    this.persist();
    return nextId;
  }

  recordAuditLog(entry: Omit<ShipmentBatchAuditLogRecord, 'id' | 'createdAt'>) {
    const record: ShipmentBatchAuditLogRecord = {
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

export function resolveShipmentBatchStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new ShipmentBatchRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'shipment-batch-runtime.json'));
  const cachedStore = shipmentBatchStoreCache.get(filePath);

  if (cachedStore) {
    return cachedStore;
  }

  const store = new ShipmentBatchRuntimeStore(filePath);
  shipmentBatchStoreCache.set(filePath, store);

  return store;
}
