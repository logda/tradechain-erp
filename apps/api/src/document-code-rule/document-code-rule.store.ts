import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  defaultDemandNoRule,
  defaultQuoteNoRule,
  normalizeDocumentCodeRule,
  type DocumentCodeRule,
} from '@erp/shared';

export type DocumentCodeRuleSetRecord = {
  demandNoRule: DocumentCodeRule;
  quoteNoRule: DocumentCodeRule;
};

const documentCodeRuleStoreCache = new Map<string, DocumentCodeRuleRuntimeStore>();

function cloneRule(rule: DocumentCodeRule): DocumentCodeRule {
  return {
    ...rule,
    segments: rule.segments.map((segment) => ({ ...segment })),
  };
}

function cloneRuleSet(ruleSet: DocumentCodeRuleSetRecord): DocumentCodeRuleSetRecord {
  return {
    demandNoRule: cloneRule(ruleSet.demandNoRule),
    quoteNoRule: cloneRule(ruleSet.quoteNoRule),
  };
}

function createDefaultRuleSet(): DocumentCodeRuleSetRecord {
  return {
    demandNoRule: cloneRule(defaultDemandNoRule),
    quoteNoRule: cloneRule(defaultQuoteNoRule),
  };
}

function readRuleSet(filePath: string): DocumentCodeRuleSetRecord {
  if (!existsSync(filePath)) {
    return createDefaultRuleSet();
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<DocumentCodeRuleSetRecord>;
  const legacyQuoteRule = parsed.quoteNoRule
    ? normalizeDocumentCodeRule({
        ...cloneRule(defaultQuoteNoRule),
        ...parsed.quoteNoRule,
        segments: Array.isArray(parsed.quoteNoRule?.segments)
          ? parsed.quoteNoRule!.segments.map((segment) => ({ ...segment }))
          : cloneRule(defaultQuoteNoRule).segments,
      } as DocumentCodeRule)
    : cloneRule(defaultQuoteNoRule);
  const demandSourceRule = parsed.demandNoRule ?? parsed.quoteNoRule ?? defaultDemandNoRule;
  const demandBaseRule = parsed.demandNoRule
    ? cloneRule(defaultDemandNoRule)
    : parsed.quoteNoRule
      ? legacyQuoteRule
      : cloneRule(defaultDemandNoRule);
  return {
    demandNoRule: normalizeDocumentCodeRule({
      ...demandBaseRule,
      ...demandSourceRule,
      segments: Array.isArray(demandSourceRule.segments)
        ? demandSourceRule.segments.map((segment) => ({ ...segment }))
        : cloneRule(demandBaseRule).segments,
    } as DocumentCodeRule),
    quoteNoRule: normalizeDocumentCodeRule({
      ...cloneRule(defaultQuoteNoRule),
      ...(parsed.demandNoRule ? parsed.quoteNoRule ?? {} : {}),
      segments: Array.isArray(parsed.demandNoRule?.segments) && Array.isArray(parsed.quoteNoRule?.segments)
        ? parsed.quoteNoRule!.segments.map((segment) => ({ ...segment }))
        : cloneRule(defaultQuoteNoRule).segments,
    } as DocumentCodeRule),
  };
}

function writeRuleSet(filePath: string, ruleSet: DocumentCodeRuleSetRecord) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(ruleSet, null, 2)}\n`, 'utf8');
}

export class DocumentCodeRuleRuntimeStore {
  private ruleSet: DocumentCodeRuleSetRecord;

  constructor(private readonly filePath?: string) {
    this.ruleSet = filePath ? readRuleSet(filePath) : createDefaultRuleSet();
    if (filePath && !existsSync(filePath)) {
      writeRuleSet(filePath, this.ruleSet);
    }
  }

  getRuleSet() {
    return cloneRuleSet(this.ruleSet);
  }

  updateRule(
    kind: 'demand_no' | 'quote_no',
    rule: DocumentCodeRule,
  ) {
    this.ruleSet = {
      ...this.ruleSet,
      ...(kind === 'demand_no'
        ? { demandNoRule: cloneRule(normalizeDocumentCodeRule(rule)) }
        : { quoteNoRule: cloneRule(normalizeDocumentCodeRule(rule)) }),
    };
    this.persist();
    return this.getRuleSet();
  }

  private persist() {
    if (!this.filePath) {
      return;
    }

    writeRuleSet(this.filePath, this.ruleSet);
  }
}

export function resolveDocumentCodeRuleStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new DocumentCodeRuleRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'document-code-rule-runtime.json'));
  const cached = documentCodeRuleStoreCache.get(filePath);
  if (cached) {
    return cached;
  }

  const store = new DocumentCodeRuleRuntimeStore(filePath);
  documentCodeRuleStoreCache.set(filePath, store);
  return store;
}
