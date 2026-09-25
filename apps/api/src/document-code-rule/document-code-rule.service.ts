import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import {
  buildDocumentCodePreview,
  normalizeDocumentCodeRule,
  validateDocumentCodeRule,
  type DocumentCodeRule,
} from '@erp/shared';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import { resolveQuoteStore } from '../quote/quote.store';
import {
  resolveDocumentCodeRuleStore,
  type DocumentCodeRuleSetRecord,
} from './document-code-rule.store';

type PrismaBusinessDocumentRecord = {
  createdAt: Date;
  docNo?: string;
  payload?: {
    documentType?: 'demand' | 'quote';
  } | null;
};

type DocumentCodeKind = 'demand_no' | 'quote_no';

function normalizeText(value: string | undefined) {
  return value?.trim() ?? '';
}

function toUtcDateParts(value: string | Date) {
  const date = new Date(value);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function isSameUtcYear(left: string | Date, right: string | Date) {
  return toUtcDateParts(left).year === toUtcDateParts(right).year;
}

function isSameUtcMonth(left: string | Date, right: string | Date) {
  const leftParts = toUtcDateParts(left);
  const rightParts = toUtcDateParts(right);
  return leftParts.year === rightParts.year && leftParts.month === rightParts.month;
}

function isSameUtcDay(left: string | Date, right: string | Date) {
  const leftParts = toUtcDateParts(left);
  const rightParts = toUtcDateParts(right);
  return (
    leftParts.year === rightParts.year &&
    leftParts.month === rightParts.month &&
    leftParts.day === rightParts.day
  );
}

function buildSequenceCacheKey(
  kind: DocumentCodeKind,
  rule: DocumentCodeRule,
  now: Date,
) {
  const parts = toUtcDateParts(now);
  const keys: string[] = [kind, rule.serialScope];

  if (rule.serialScope === 'global_year' || rule.serialScope === 'global_month' || rule.serialScope === 'global_day') {
    keys.push(String(parts.year));
  }

  if (rule.serialScope === 'global_month' || rule.serialScope === 'global_day') {
    keys.push(String(parts.month).padStart(2, '0'));
  }

  if (rule.serialScope === 'global_day') {
    keys.push(String(parts.day).padStart(2, '0'));
  }

  return keys.join(':');
}

function isDemandDocument(record: {
  docNo?: string;
  payload?: { documentType?: 'demand' | 'quote' } | null;
  documentType?: 'demand' | 'quote';
  quoteNo?: string;
}) {
  const documentType = record.documentType ?? record.payload?.documentType;
  const docNo = record.docNo ?? record.quoteNo ?? '';
  return documentType === 'demand' || docNo.startsWith('XQ');
}

function isQuoteDocument(record: {
  docNo?: string;
  payload?: { documentType?: 'demand' | 'quote' } | null;
  documentType?: 'demand' | 'quote';
  quoteNo?: string;
}) {
  const documentType = record.documentType ?? record.payload?.documentType;
  const docNo = record.docNo ?? record.quoteNo ?? '';
  return documentType === 'quote' || docNo.startsWith('BJ');
}

@Injectable()
export class DocumentCodeRuleService {
  private readonly store = resolveDocumentCodeRuleStore();
  private readonly quoteStore = resolveQuoteStore();
  private readonly fallbackSequenceCache = new Map<string, number>();

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  getRuleSet(): DocumentCodeRuleSetRecord {
    return this.store.getRuleSet();
  }

  updateRule(kind: DocumentCodeKind, payload: Omit<DocumentCodeRule, 'updatedAt'> & { updatedBy: string }) {
    const nextRule = normalizeDocumentCodeRule({
      ...payload,
      updatedAt: new Date().toISOString(),
      updatedBy: normalizeText(payload.updatedBy) || 'system',
    });
    const validation = validateDocumentCodeRule(nextRule);

    if (!validation.ok) {
      throw new BadRequestException(validation.error);
    }

    return this.store.updateRule(kind, nextRule);
  }

  async generateDemandNo() {
    const rule = this.getRuleSet().demandNoRule;
    const sequence = await this.resolveNextSequence('demand_no', rule);
    return buildDocumentCodePreview(rule, {
      now: new Date(),
      sequence,
    });
  }

  async generateQuoteNo() {
    const rule = this.getRuleSet().quoteNoRule;
    const sequence = await this.resolveNextSequence('quote_no', rule);
    return buildDocumentCodePreview(rule, {
      now: new Date(),
      sequence,
    });
  }

  private async resolveNextSequence(kind: DocumentCodeKind, rule: DocumentCodeRule) {
    const records = await this.loadCreatedAtRecords(kind);
    const now = new Date();

    const matched = records.filter((record) => {
      if (rule.serialScope === 'global_total') {
        return true;
      }

      if (rule.serialScope === 'global_year') {
        return isSameUtcYear(record.createdAt, now);
      }

      if (rule.serialScope === 'global_month') {
        return isSameUtcMonth(record.createdAt, now);
      }

      return isSameUtcDay(record.createdAt, now);
    });

    const cacheKey = buildSequenceCacheKey(kind, rule, now);
    const nextSequence = matched.length + 1;
    const cachedSequence = this.fallbackSequenceCache.get(cacheKey) ?? 0;
    const sequence = Math.max(nextSequence, cachedSequence + 1);
    this.fallbackSequenceCache.set(cacheKey, sequence);
    return sequence;
  }

  private async loadCreatedAtRecords(kind: DocumentCodeKind) {
    if (
      this.shouldUsePrisma() &&
      typeof this.prisma?.businessDocument?.findMany === 'function'
    ) {
      const records = (await this.prisma!.businessDocument.findMany({
        where: {
          bizType: 'quote',
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, docNo: true, payload: true },
      })) as PrismaBusinessDocumentRecord[];

      return records
        .filter((record) => kind === 'demand_no'
          ? isDemandDocument(record)
          : isQuoteDocument(record))
        .map((record) => ({ createdAt: record.createdAt }));
    }

    if (kind === 'demand_no') {
      return this.quoteStore.listQuotes()
        .filter((record) => isDemandDocument(record))
        .map((record) => ({
          createdAt: record.createdAt,
        }));
    }

    return this.quoteStore.listQuotes()
      .filter((record) => isQuoteDocument(record))
      .map((record) => ({ createdAt: record.createdAt }));
  }
}
