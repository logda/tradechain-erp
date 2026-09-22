import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  defaultProductCodeRule,
  defaultProductCodeRuleSet,
  defaultSalesProductCodeRule,
  normalizeProductCodeRule,
  type ProductCodeRule,
  type ProductCodeRuleKind,
  type ProductCodeRuleSet,
} from '@erp/shared';

export type ProductCodeRuleRecord = ProductCodeRule;
export type ProductCodeRuleSetRecord = ProductCodeRuleSet;

const productCodeRuleStoreCache = new Map<string, ProductCodeRuleRuntimeStore>();

function cloneRule(rule: ProductCodeRuleRecord): ProductCodeRuleRecord {
  return {
    ...rule,
    segments: rule.segments.map((segment) => ({ ...segment })),
  };
}

function cloneRuleSet(ruleSet: ProductCodeRuleSetRecord): ProductCodeRuleSetRecord {
  return {
    purchase: cloneRule(ruleSet.purchase),
    sales: cloneRule(ruleSet.sales),
  };
}

function readRuleSet(filePath: string): ProductCodeRuleSetRecord {
  if (!existsSync(filePath)) {
    return cloneRuleSet(defaultProductCodeRuleSet);
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Record<
    string,
    unknown
  >;
  const legacyRule =
    parsed.strategy === 'composed_segments'
      ? (parsed as ProductCodeRuleRecord)
      : undefined;
  const parsedSet = parsed as Partial<ProductCodeRuleSetRecord>;
  const purchase: ProductCodeRuleRecord | undefined =
    legacyRule ?? parsedSet.purchase;
  const sales: ProductCodeRuleRecord | undefined = legacyRule
    ? undefined
    : parsedSet.sales;
  return {
    purchase: normalizeProductCodeRule({
      ...cloneRule(defaultProductCodeRule),
      ...purchase,
      segments: Array.isArray(purchase?.segments)
        ? purchase.segments.map((segment) => ({ ...segment }))
        : cloneRule(defaultProductCodeRule).segments,
    } as ProductCodeRuleRecord),
    sales: normalizeProductCodeRule({
      ...cloneRule(defaultSalesProductCodeRule),
      ...sales,
      segments: Array.isArray(sales?.segments)
        ? sales.segments.map((segment) => ({ ...segment }))
        : cloneRule(defaultSalesProductCodeRule).segments,
    } as ProductCodeRuleRecord),
  };
}

function writeRuleSet(filePath: string, ruleSet: ProductCodeRuleSetRecord) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(ruleSet, null, 2)}\n`, 'utf8');
}

export class ProductCodeRuleRuntimeStore {
  private ruleSet: ProductCodeRuleSetRecord;

  constructor(private readonly filePath?: string) {
    this.ruleSet = filePath
      ? readRuleSet(filePath)
      : cloneRuleSet(defaultProductCodeRuleSet);
    if (filePath) {
      writeRuleSet(filePath, this.ruleSet);
    }
  }

  getRule() {
    return this.getRuleByKind('purchase');
  }

  getRules() {
    return cloneRuleSet(this.ruleSet);
  }

  getRuleByKind(kind: ProductCodeRuleKind) {
    return cloneRule(this.ruleSet[kind]);
  }

  updateRule(rule: ProductCodeRuleRecord) {
    return this.updateRuleByKind('purchase', rule);
  }

  updateRuleByKind(kind: ProductCodeRuleKind, rule: ProductCodeRuleRecord) {
    this.ruleSet = {
      ...this.ruleSet,
      [kind]: cloneRule(normalizeProductCodeRule(rule)),
    };
    this.persist();
    return this.getRuleByKind(kind);
  }

  private persist() {
    if (!this.filePath) {
      return;
    }

    writeRuleSet(this.filePath, this.ruleSet);
  }
}

export function resolveProductCodeRuleStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new ProductCodeRuleRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'product-code-rule-runtime.json'));
  const cached = productCodeRuleStoreCache.get(filePath);
  if (cached) {
    return cached;
  }

  const store = new ProductCodeRuleRuntimeStore(filePath);
  productCodeRuleStoreCache.set(filePath, store);
  return store;
}
