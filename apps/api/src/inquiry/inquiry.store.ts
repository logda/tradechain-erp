import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { InquiryListItem } from './inquiry-list.data';

export type InquiryAuditLogRecord = {
  id: number;
  bizType: 'quote_inquiry';
  bizId: number;
  operationType: string;
  operatorId: number;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
};

type InquiryRuntimeState = {
  inquiries: InquiryListItem[];
  auditLogs: InquiryAuditLogRecord[];
  nextId: number;
  nextAuditLogId: number;
};

const inquiryStoreCache = new Map<string, InquiryRuntimeStore>();

function createSeedState(): InquiryRuntimeState {
  return {
    inquiries: [],
    auditLogs: [],
    nextId: 100,
    nextAuditLogId: 1,
  };
}

function cloneInquiry(record: InquiryListItem): InquiryListItem {
  const items = Array.isArray(record.items) ? record.items : [];

  return {
    ...record,
    items: items.map((item) => ({
      ...item,
      supplierQuotes: Array.isArray(item.supplierQuotes)
        ? item.supplierQuotes.map((supplierQuote) => ({
            ...supplierQuote,
          }))
        : [],
    })),
  };
}

function normalizeAuditLog(record: InquiryAuditLogRecord): InquiryAuditLogRecord {
  return {
    ...record,
    operatorId: record.operatorId == null ? 0 : Number(record.operatorId),
  };
}

function readState(filePath: string): InquiryRuntimeState {
  if (!existsSync(filePath)) {
    return createSeedState();
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<InquiryRuntimeState>;
  return {
    inquiries: Array.isArray(parsed.inquiries)
      ? (parsed.inquiries as InquiryListItem[])
      : [],
    auditLogs: Array.isArray(parsed.auditLogs)
      ? (parsed.auditLogs as InquiryAuditLogRecord[]).map(normalizeAuditLog)
      : [],
    nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 100,
    nextAuditLogId:
      typeof parsed.nextAuditLogId === 'number' ? parsed.nextAuditLogId : 1,
  };
}

function writeState(filePath: string, state: InquiryRuntimeState) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export class InquiryRuntimeStore {
  private state: InquiryRuntimeState;

  constructor(private readonly filePath?: string) {
    this.state = filePath ? readState(filePath) : createSeedState();
    if (filePath && !existsSync(filePath)) {
      writeState(filePath, this.state);
    }
  }

  listInquiries() {
    return this.state.inquiries.map(cloneInquiry);
  }

  listAuditLogs() {
    return this.state.auditLogs.map(normalizeAuditLog);
  }

  getInquiry(id: number) {
    const record = this.state.inquiries.find((item) => item.id === id);
    return record ? cloneInquiry(record) : undefined;
  }

  nextInquiryId() {
    const nextId = this.state.nextId;
    this.state.nextId += 1;
    this.persist();
    return nextId;
  }

  upsertInquiry(record: InquiryListItem) {
    const nextInquiries = this.state.inquiries.filter((item) => item.id !== record.id);
    nextInquiries.push(cloneInquiry(record));
    this.state.inquiries = nextInquiries;
    this.persist();
  }

  recordAuditLog(entry: Omit<InquiryAuditLogRecord, 'id' | 'createdAt'>) {
    const record: InquiryAuditLogRecord = {
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

export function resolveInquiryStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new InquiryRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'inquiry-runtime.json'));
  const cachedStore = inquiryStoreCache.get(filePath);

  if (cachedStore) {
    return cachedStore;
  }

  const store = new InquiryRuntimeStore(filePath);
  inquiryStoreCache.set(filePath, store);

  return store;
}
