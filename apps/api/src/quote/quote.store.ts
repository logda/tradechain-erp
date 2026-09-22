import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { QuoteDetailRecord } from './quote.service';

export type QuoteAuditLogRecord = {
  id: number;
  bizType: 'quote';
  bizId: number;
  operationType: string;
  operatorId: number;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
};

type QuoteRuntimeState = {
  quotes: QuoteDetailRecord[];
  auditLogs: QuoteAuditLogRecord[];
  nextId: number;
  nextAuditLogId: number;
};

const quoteStoreCache = new Map<string, QuoteRuntimeStore>();

function createSeedState(): QuoteRuntimeState {
  return {
    quotes: [],
    auditLogs: [],
    nextId: 100,
    nextAuditLogId: 1,
  };
}

function cloneQuote(record: QuoteDetailRecord): QuoteDetailRecord {
  return {
    ...record,
    items: record.items.map((item) => ({ ...item })),
  };
}

function readState(filePath: string): QuoteRuntimeState {
  if (!existsSync(filePath)) {
    return createSeedState();
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<QuoteRuntimeState>;
  return {
    quotes: Array.isArray(parsed.quotes) ? (parsed.quotes as QuoteDetailRecord[]) : [],
    auditLogs: Array.isArray(parsed.auditLogs)
      ? (parsed.auditLogs as QuoteAuditLogRecord[])
      : [],
    nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 100,
    nextAuditLogId:
      typeof parsed.nextAuditLogId === 'number' ? parsed.nextAuditLogId : 1,
  };
}

function writeState(filePath: string, state: QuoteRuntimeState) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export class QuoteRuntimeStore {
  private state: QuoteRuntimeState;

  constructor(private readonly filePath?: string) {
    this.state = filePath ? readState(filePath) : createSeedState();
    if (filePath && !existsSync(filePath)) {
      writeState(filePath, this.state);
    }
  }

  getQuote(id: number) {
    const record = this.state.quotes.find((item) => item.id === id);
    return record ? cloneQuote(record) : undefined;
  }

  listQuotes() {
    return this.state.quotes.map(cloneQuote);
  }

  listAuditLogs() {
    return this.state.auditLogs.map((item) => ({ ...item }));
  }

  upsertQuote(record: QuoteDetailRecord) {
    const nextQuotes = this.state.quotes.filter((item) => item.id !== record.id);
    nextQuotes.push(cloneQuote(record));
    this.state.quotes = nextQuotes;
    this.persist();
  }

  nextQuoteId() {
    const nextId = this.state.nextId;
    this.state.nextId += 1;
    this.persist();
    return nextId;
  }

  recordAuditLog(entry: Omit<QuoteAuditLogRecord, 'id' | 'createdAt'>) {
    const record: QuoteAuditLogRecord = {
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

export function resolveQuoteStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new QuoteRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'quote-runtime.json'));
  const cachedStore = quoteStoreCache.get(filePath);

  if (cachedStore) {
    return cachedStore;
  }

  const store = new QuoteRuntimeStore(filePath);
  quoteStoreCache.set(filePath, store);

  return store;
}
