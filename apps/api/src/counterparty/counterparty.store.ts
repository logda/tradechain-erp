import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { CounterpartyRecord } from './counterparty.service';

export type CounterpartyCustomFieldRecord = {
  id: number;
  name: string;
  type: 'text' | 'number' | 'date';
  createdBy: string;
  createdAt: string;
  deletedAt?: string;
};

export type CounterpartyAuditLogRecord = {
  id: number;
  bizType: 'counterparty';
  bizId: number;
  operationType: string;
  operatorId: number;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
};

type CounterpartyRuntimeState = {
  counterparties: CounterpartyRecord[];
  auditLogs: CounterpartyAuditLogRecord[];
  nextId: number;
  nextAuditLogId: number;
  customFields: CounterpartyCustomFieldRecord[];
  nextCustomFieldId: number;
};

const counterpartyStoreCache = new Map<string, CounterpartyRuntimeStore>();

function createSeedState(): CounterpartyRuntimeState {
  return {
    counterparties: [
      {
        id: 1,
        type: 'customer',
        code: 'CUST-ACME',
        name: 'Acme Trading',
        shortName: '星河贸易',
        region: 'United States',
        ownerName: 'Zoe',
        contactName: 'Amy Chen',
        phone: '+1-202-555-0101',
        address: 'Los Angeles Harbor 88 号',
        bankName: 'Bank of America',
        bankAccount: '1234567890',
        remark: '北美客户',
        email: 'amy@acme.example',
        paymentTerms: 'Net 30',
        status: 'active',
        createdAt: '2026-07-11T09:00:00.000Z',
        createdBy: 'system',
      },
      {
        id: 2,
        type: 'supplier',
        code: 'SUP-BRAVO',
        name: 'Bravo Industrial',
        shortName: '光源制造',
        region: 'Shenzhen',
        ownerName: 'Leo',
        contactName: 'Ben Li',
        phone: '+86-755-5555-0102',
        address: 'Shenzhen Baoan 99 号',
        bankName: '平安银行深圳分行',
        bankAccount: '6222000000000002',
        remark: '华南供应商',
        email: 'ben@bravo.example',
        paymentTerms: '30% deposit, 70% before shipment',
        status: 'active',
        createdAt: '2026-07-11T09:05:00.000Z',
        createdBy: 'system',
      },
      {
        id: 4,
        type: 'supplier',
        code: 'SUP-LIGHT',
        name: 'Light Source Manufacturing',
        shortName: '光源制造',
        region: 'Shenzhen',
        ownerName: 'Leo',
        contactName: 'Liam Chen',
        phone: '+86-755-5555-0104',
        address: 'Shenzhen Longgang 68 号',
        bankName: '招商银行深圳分行',
        bankAccount: '6222000000000004',
        remark: '灯带默认供应商',
        email: 'liam@light.example',
        paymentTerms: '30% deposit, 70% before shipment',
        status: 'active',
        createdAt: '2026-07-11T09:08:00.000Z',
        createdBy: 'system',
      },
      {
        id: 3,
        type: 'both',
        code: 'CP-GLOBAL',
        name: 'Global Partner Ltd.',
        shortName: '环球伙伴',
        region: 'Hong Kong',
        ownerName: 'Mia',
        contactName: 'Morgan Wu',
        phone: '+852-5555-0103',
        address: 'Hong Kong Kwun Tong 18 号',
        bankName: '汇丰银行香港分行',
        bankAccount: '998877665544',
        remark: '客户兼供应商',
        email: 'morgan@global.example',
        paymentTerms: 'Monthly statement',
        status: 'active',
        createdAt: '2026-07-11T09:10:00.000Z',
        createdBy: 'system',
      },
    ],
    auditLogs: [],
    nextId: 5,
    nextAuditLogId: 1,
    customFields: [],
    nextCustomFieldId: 1,
  };
}

function cloneCounterparty(record: CounterpartyRecord): CounterpartyRecord {
  return { ...record, customValues: record.customValues ? { ...record.customValues } : undefined, unitTags: record.unitTags ? [...record.unitTags] : undefined };
}

function readState(filePath: string): CounterpartyRuntimeState {
  if (!existsSync(filePath)) {
    return createSeedState();
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<CounterpartyRuntimeState>;
  return {
    counterparties: Array.isArray(parsed.counterparties)
      ? (parsed.counterparties as CounterpartyRecord[])
      : [],
    auditLogs: Array.isArray(parsed.auditLogs)
      ? (parsed.auditLogs as CounterpartyAuditLogRecord[])
      : [],
    nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
    nextAuditLogId:
      typeof parsed.nextAuditLogId === 'number' ? parsed.nextAuditLogId : 1,
    customFields: Array.isArray(parsed.customFields) ? parsed.customFields : [],
    nextCustomFieldId: typeof parsed.nextCustomFieldId === 'number' ? parsed.nextCustomFieldId : 1,
  };
}

function writeState(filePath: string, state: CounterpartyRuntimeState) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export class CounterpartyRuntimeStore {
  private state: CounterpartyRuntimeState;

  constructor(private readonly filePath?: string) {
    this.state = filePath ? readState(filePath) : createSeedState();
    if (filePath && !existsSync(filePath)) {
      writeState(filePath, this.state);
    }
  }

  listCounterparties() {
    return this.state.counterparties.map(cloneCounterparty);
  }

  listAuditLogs() {
    return this.state.auditLogs.map((item) => ({ ...item }));
  }

  listCustomFields() {
    return this.state.customFields.map((item) => ({ ...item }));
  }

  saveCustomFields(fields: CounterpartyCustomFieldRecord[]) {
    this.state.customFields = fields.map((item) => ({ ...item }));
    this.persist();
  }

  nextCustomFieldId() {
    const id = this.state.nextCustomFieldId++;
    this.persist();
    return id;
  }

  getCounterparty(id: number) {
    const record = this.state.counterparties.find((item) => item.id === id);
    return record ? cloneCounterparty(record) : undefined;
  }

  saveCounterparties(counterparties: CounterpartyRecord[]) {
    this.state.counterparties = counterparties.map(cloneCounterparty);
    this.persist();
  }

  nextCounterpartyId() {
    const nextId = this.state.nextId;
    this.state.nextId += 1;
    this.persist();
    return nextId;
  }

  recordAuditLog(entry: Omit<CounterpartyAuditLogRecord, 'id' | 'createdAt'>) {
    const record: CounterpartyAuditLogRecord = {
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

export function resolveCounterpartyStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new CounterpartyRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'counterparty-runtime.json'));
  const cachedStore = counterpartyStoreCache.get(filePath);

  if (cachedStore) {
    return cachedStore;
  }

  const store = new CounterpartyRuntimeStore(filePath);
  counterpartyStoreCache.set(filePath, store);

  return store;
}
