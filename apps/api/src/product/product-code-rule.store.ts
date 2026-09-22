import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  defaultProductCodeRule,
  normalizeProductCodeRule,
  type ProductCodeRule,
} from '@erp/shared';

export type ProductCodeRuleRecord = ProductCodeRule;

const productCodeRuleStoreCache = new Map<string, ProductCodeRuleRuntimeStore>();

function cloneRule(rule: ProductCodeRuleRecord): ProductCodeRuleRecord {
  return {
    ...rule,
    segments: rule.segments.map((segment) => ({ ...segment })),
  };
}

function readRule(filePath: string): ProductCodeRuleRecord {
  if (!existsSync(filePath)) {
    return cloneRule(defaultProductCodeRule);
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as ProductCodeRuleRecord;
  return normalizeProductCodeRule({
    ...cloneRule(defaultProductCodeRule),
    ...parsed,
    segments: Array.isArray(parsed?.segments)
      ? parsed.segments.map((segment) => ({ ...segment }))
      : cloneRule(defaultProductCodeRule).segments,
  } as ProductCodeRuleRecord);
}

function writeRule(filePath: string, rule: ProductCodeRuleRecord) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(rule, null, 2)}\n`, 'utf8');
}

export class ProductCodeRuleRuntimeStore {
  private rule: ProductCodeRuleRecord;

  constructor(private readonly filePath?: string) {
    this.rule = filePath ? readRule(filePath) : cloneRule(defaultProductCodeRule);
    if (filePath && !existsSync(filePath)) {
      writeRule(filePath, this.rule);
    }
  }

  getRule() {
    return cloneRule(this.rule);
  }

  updateRule(rule: ProductCodeRuleRecord) {
    this.rule = cloneRule(normalizeProductCodeRule(rule));
    this.persist();
    return this.getRule();
  }

  private persist() {
    if (!this.filePath) {
      return;
    }

    writeRule(this.filePath, this.rule);
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
