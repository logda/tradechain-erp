export const productCodeCategoryCodeMap = {
  electronics: 'ELEC',
  consumables: 'CONS',
  service: 'SERV',
} as const;

export const productCodeRuleSegmentKeys = [
  'prefix',
  'supplier_code',
  'category_code',
  'year',
  'month',
  'year_month',
  'serial',
] as const;

export const productCodeRuleSerialScopes = [
  'global_total',
  'global_year',
  'global_month',
  'per_supplier_total',
  'per_supplier_year',
  'per_supplier_month',
] as const;

export type ProductCodeCategory = keyof typeof productCodeCategoryCodeMap;
export type ProductCodeRuleSegmentKey = (typeof productCodeRuleSegmentKeys)[number];
export type ProductCodeRuleSerialScope = (typeof productCodeRuleSerialScopes)[number];

export type ProductCodeRuleSegment = {
  key: ProductCodeRuleSegmentKey;
  enabled: boolean;
  order: number;
  value?: string;
  format?: 'YYYYMM';
};

export type ProductCodeRule = {
  strategy: 'composed_segments';
  serialLength: number;
  serialScope: ProductCodeRuleSerialScope;
  segments: ProductCodeRuleSegment[];
  updatedAt: string;
  updatedBy: string;
};

export type ValidateProductCodeRuleResult =
  | { ok: true }
  | { ok: false; error: string };

export type ProductCodePreviewOptions = {
  prefix?: string;
  supplierCode?: string;
  category?: string;
  now?: string | Date;
  sequence?: number;
};

const defaultSegments: ProductCodeRuleSegment[] = [
  { key: 'prefix', enabled: true, order: 1, value: 'PD' },
  { key: 'supplier_code', enabled: true, order: 2 },
  { key: 'serial', enabled: true, order: 3 },
];

export const defaultProductCodeRule: ProductCodeRule = {
  strategy: 'composed_segments',
  serialLength: 3,
  serialScope: 'per_supplier_total',
  segments: defaultSegments,
  updatedAt: '2026-07-16T00:00:00.000Z',
  updatedBy: 'system',
};

type LegacyProductCodeRuleSerialScope = 'global' | 'per_supplier';

type ProductCodeRuleLike = Omit<ProductCodeRule, 'serialScope'> & {
  serialScope: ProductCodeRuleSerialScope | LegacyProductCodeRuleSerialScope;
};

function normalizePrefix(value: string | undefined) {
  return value?.trim().toUpperCase() ?? '';
}

function normalizeSerialScope(
  value: ProductCodeRuleSerialScope | LegacyProductCodeRuleSerialScope,
): ProductCodeRuleSerialScope {
  if (value === 'global') {
    return 'global_total';
  }

  if (value === 'per_supplier') {
    return 'per_supplier_total';
  }

  return productCodeRuleSerialScopes.includes(value) ? value : 'per_supplier_total';
}

function normalizeSegments(segments: ProductCodeRuleSegment[]) {
  return [...segments]
    .reduce<ProductCodeRuleSegment[]>((result, segment) => {
      if (segment.key === 'year_month') {
        result.push(
          { key: 'year', enabled: segment.enabled, order: segment.order },
          {
            key: 'month',
            enabled: segment.enabled,
            order: segment.order + 0.5,
          },
        );
        return result;
      }

      result.push({
        ...segment,
        value: typeof segment.value === 'string' ? normalizePrefix(segment.value) : undefined,
      });
      return result;
    }, [])
    .sort((left, right) => left.order - right.order)
    .map((segment, index) => ({
      ...segment,
      order: index + 1,
    }));
}

function formatSerial(sequence: number, serialLength: number) {
  return String(Math.max(1, sequence)).padStart(serialLength, '0');
}

function formatYearMonth(value: string | Date | undefined) {
  const date = value ? new Date(value) : new Date();
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

function formatYear(value: string | Date | undefined) {
  return formatYearMonth(value).slice(0, 4);
}

function formatMonth(value: string | Date | undefined) {
  return formatYearMonth(value).slice(4);
}

function getSegmentLabel(segment: ProductCodeRuleSegment, serialLength: number) {
  switch (segment.key) {
    case 'prefix':
      return '固定前缀';
    case 'supplier_code':
      return '供应商编码';
    case 'category_code':
      return '分类编码';
    case 'year':
      return '年';
    case 'month':
      return '月';
    case 'year_month':
      return '年月';
    case 'serial':
      return `${serialLength} 位流水号`;
  }
}

function usesSupplierScopedSerial(scope: ProductCodeRuleSerialScope) {
  return scope.startsWith('per_supplier');
}

function usesYearlySerial(scope: ProductCodeRuleSerialScope) {
  return scope.endsWith('_year') || scope.endsWith('_month');
}

function usesMonthlySerial(scope: ProductCodeRuleSerialScope) {
  return scope.endsWith('_month');
}

export function normalizeProductCodeRule(rule: ProductCodeRuleLike): ProductCodeRule {
  return {
    ...rule,
    serialScope: normalizeSerialScope(rule.serialScope),
    segments: normalizeSegments(rule.segments),
  };
}

export function validateProductCodeRule(rule: ProductCodeRule): ValidateProductCodeRuleResult {
  const normalizedRule = normalizeProductCodeRule(rule);

  if (normalizedRule.strategy !== 'composed_segments') {
    return { ok: false, error: '当前仅支持组合段编码规则' };
  }

  if (
    !Number.isInteger(normalizedRule.serialLength) ||
    normalizedRule.serialLength < 2 ||
    normalizedRule.serialLength > 6
  ) {
    return { ok: false, error: '产品编码流水位数必须是 2 到 6 位整数' };
  }

  const enabledSegments = normalizedRule.segments.filter((segment) => segment.enabled);
  const serialSegment = enabledSegments.find((segment) => segment.key === 'serial');

  if (!serialSegment) {
    return { ok: false, error: '流水号段必须启用' };
  }

  if (enabledSegments[enabledSegments.length - 1]?.key !== 'serial') {
    return { ok: false, error: '流水号必须放在最后一段' };
  }

  const businessSegments = enabledSegments.filter((segment) => segment.key !== 'serial');
  if (businessSegments.length === 0) {
    return { ok: false, error: '除流水号外，至少还要启用一个业务段' };
  }

  if (usesSupplierScopedSerial(normalizedRule.serialScope) &&
    !enabledSegments.some((segment) => segment.key === 'supplier_code')) {
    return { ok: false, error: '按供应商独立流水时，必须启用供应商编码段' };
  }

  if (
    usesMonthlySerial(normalizedRule.serialScope) &&
    (
      !enabledSegments.some((segment) => segment.key === 'year') ||
      !enabledSegments.some((segment) => segment.key === 'month')
    )
  ) {
    return { ok: false, error: '按月流水时，必须同时启用年份段和月份段' };
  }

  if (
    !usesMonthlySerial(normalizedRule.serialScope) &&
    usesYearlySerial(normalizedRule.serialScope) &&
    !enabledSegments.some((segment) => segment.key === 'year')
  ) {
    return { ok: false, error: '按年流水时，必须启用年份段' };
  }

  const prefixSegment = enabledSegments.find((segment) => segment.key === 'prefix');
  if (prefixSegment && !normalizePrefix(prefixSegment.value)) {
    return { ok: false, error: '已启用固定前缀时，前缀内容不能为空' };
  }

  return { ok: true };
}

export function buildProductCodePreview(
  rule: ProductCodeRule,
  options: ProductCodePreviewOptions = {},
) {
  const normalizedRule = normalizeProductCodeRule(rule);
  const enabledSegments = normalizedRule.segments.filter((segment) => segment.enabled);

  return enabledSegments
    .map((segment) => {
      switch (segment.key) {
        case 'prefix':
          return normalizePrefix(segment.value ?? options.prefix ?? 'PD') || 'PD';
        case 'supplier_code':
          return options.supplierCode?.trim() || 'SUP-BRAVO';
        case 'category_code':
          return productCodeCategoryCodeMap[
            (options.category as ProductCodeCategory | undefined) ?? 'electronics'
          ];
        case 'year':
          return formatYear(options.now);
        case 'month':
          return formatMonth(options.now);
        case 'year_month':
          return formatYearMonth(options.now);
        case 'serial':
          return formatSerial(options.sequence ?? 1, normalizedRule.serialLength);
      }
    })
    .filter(Boolean)
    .join('-');
}

export function describeProductCodeRule(rule: ProductCodeRule) {
  const normalizedRule = normalizeProductCodeRule(rule);
  const enabledSegments = normalizedRule.segments.filter((segment) => segment.enabled);
  const summary = enabledSegments
    .map((segment) => getSegmentLabel(segment, normalizedRule.serialLength))
    .join(' + ');
  const example = buildProductCodePreview(rule);
  return `${summary}，例如 ${example}`;
}
