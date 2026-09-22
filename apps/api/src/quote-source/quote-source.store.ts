import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export type QuoteSourceRecord = {
  code: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
  updatedAt: string;
  updatedBy: string;
};

export const defaultQuoteSources: QuoteSourceRecord[] = [
  {
    code: 'expo',
    label: '展会',
    enabled: true,
    sortOrder: 1,
    updatedAt: '2026-07-18T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    code: 'website',
    label: '官网',
    enabled: true,
    sortOrder: 2,
    updatedAt: '2026-07-18T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    code: 'online',
    label: '线上',
    enabled: true,
    sortOrder: 3,
    updatedAt: '2026-07-18T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    code: 'tiktok',
    label: 'TikTok',
    enabled: true,
    sortOrder: 4,
    updatedAt: '2026-07-18T00:00:00.000Z',
    updatedBy: 'system',
  },
  {
    code: 'referral',
    label: '转介绍',
    enabled: true,
    sortOrder: 5,
    updatedAt: '2026-07-18T00:00:00.000Z',
    updatedBy: 'system',
  },
];

const storeCache = new Map<string, QuoteSourceRuntimeStore>();

function cloneItem(item: QuoteSourceRecord): QuoteSourceRecord {
  return { ...item };
}

function normalizeItem(
  item: Partial<QuoteSourceRecord>,
  index: number,
  updatedBy: string,
): QuoteSourceRecord {
  const code = String(item.code ?? '')
    .trim()
    .toLowerCase();
  const label = String(item.label ?? '').trim();

  return {
    code,
    label,
    enabled: item.enabled !== false,
    sortOrder:
      typeof item.sortOrder === 'number' && Number.isFinite(item.sortOrder)
        ? item.sortOrder
        : index + 1,
    updatedAt: item.updatedAt ?? new Date().toISOString(),
    updatedBy: item.updatedBy ?? updatedBy,
  };
}

function readItems(filePath: string) {
  if (!existsSync(filePath)) {
    return defaultQuoteSources.map(cloneItem);
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as QuoteSourceRecord[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return defaultQuoteSources.map(cloneItem);
  }

  return parsed.map((item, index) => normalizeItem(item, index, item.updatedBy ?? 'system'));
}

function writeItems(filePath: string, items: QuoteSourceRecord[]) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

export class QuoteSourceRuntimeStore {
  private items: QuoteSourceRecord[];

  constructor(private readonly filePath?: string) {
    this.items = filePath ? readItems(filePath) : defaultQuoteSources.map(cloneItem);
    if (filePath && !existsSync(filePath)) {
      writeItems(filePath, this.items);
    }
  }

  list() {
    return this.items.map(cloneItem);
  }

  save(items: QuoteSourceRecord[]) {
    this.items = items.map(cloneItem);
    if (this.filePath) {
      writeItems(this.filePath, this.items);
    }
    return this.list();
  }
}

export function resolveQuoteSourceStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new QuoteSourceRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'quote-source-runtime.json'));
  const cached = storeCache.get(filePath);
  if (cached) {
    return cached;
  }

  const store = new QuoteSourceRuntimeStore(filePath);
  storeCache.set(filePath, store);
  return store;
}
