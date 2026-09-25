export const documentCodeRuleSegmentKeys = [
  'prefix',
  'year',
  'month',
  'day',
  'serial',
] as const;

export const documentCodeRuleSerialScopes = [
  'global_total',
  'global_year',
  'global_month',
  'global_day',
] as const;

export type DocumentCodeRuleSegmentKey =
  (typeof documentCodeRuleSegmentKeys)[number];
export type DocumentCodeRuleSerialScope =
  (typeof documentCodeRuleSerialScopes)[number];

export type DocumentCodeRuleSegment = {
  key: DocumentCodeRuleSegmentKey;
  enabled: boolean;
  order: number;
  value?: string;
};

export type DocumentCodeRule = {
  strategy: 'composed_segments';
  serialLength: number;
  serialScope: DocumentCodeRuleSerialScope;
  segments: DocumentCodeRuleSegment[];
  updatedAt: string;
  updatedBy: string;
};

export type DocumentCodeRuleKind = 'demand_no' | 'quote_no';

export type ValidateDocumentCodeRuleResult =
  | { ok: true }
  | { ok: false; error: string };

export type DocumentCodePreviewOptions = {
  prefix?: string;
  now?: string | Date;
  sequence?: number;
};

const defaultQuoteNoSegments: DocumentCodeRuleSegment[] = [
  { key: 'prefix', enabled: true, order: 1, value: 'BJ' },
  { key: 'year', enabled: true, order: 2 },
  { key: 'month', enabled: true, order: 3 },
  { key: 'day', enabled: true, order: 4 },
  { key: 'serial', enabled: true, order: 5 },
];

const defaultDemandNoSegments: DocumentCodeRuleSegment[] = [
  { key: 'prefix', enabled: true, order: 1, value: 'XQ' },
  { key: 'year', enabled: true, order: 2 },
  { key: 'month', enabled: true, order: 3 },
  { key: 'day', enabled: true, order: 4 },
  { key: 'serial', enabled: true, order: 5 },
];

export const defaultQuoteNoRule: DocumentCodeRule = {
  strategy: 'composed_segments',
  serialLength: 4,
  serialScope: 'global_day',
  segments: defaultQuoteNoSegments,
  updatedAt: '2026-07-16T00:00:00.000Z',
  updatedBy: 'system',
};

export const defaultDemandNoRule: DocumentCodeRule = {
  strategy: 'composed_segments',
  serialLength: 4,
  serialScope: 'global_day',
  segments: defaultDemandNoSegments,
  updatedAt: '2026-07-16T00:00:00.000Z',
  updatedBy: 'system',
};

export const defaultDocumentCodeRuleSet = {
  demandNoRule: defaultDemandNoRule,
  quoteNoRule: defaultQuoteNoRule,
};

type LegacyDocumentCodeRuleSerialScope = 'global' | 'per_year' | 'per_month' | 'per_day';

type DocumentCodeRuleLike = Omit<DocumentCodeRule, 'serialScope'> & {
  serialScope: DocumentCodeRuleSerialScope | LegacyDocumentCodeRuleSerialScope;
};

function normalizePrefix(value: string | undefined) {
  return value?.trim().toUpperCase() ?? '';
}

function normalizeSerialScope(
  value: DocumentCodeRuleSerialScope | LegacyDocumentCodeRuleSerialScope,
): DocumentCodeRuleSerialScope {
  if (value === 'global' || value === 'per_year') {
    return 'global_year';
  }

  if (value === 'per_month') {
    return 'global_month';
  }

  if (value === 'per_day') {
    return 'global_day';
  }

  return documentCodeRuleSerialScopes.includes(value) ? value : 'global_day';
}

function normalizeSegments(segments: DocumentCodeRuleSegment[]) {
  return [...segments]
    .reduce<DocumentCodeRuleSegment[]>((result, segment) => {
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

function formatYear(value: string | Date | undefined) {
  const date = value ? new Date(value) : new Date();
  return String(date.getUTCFullYear()).slice(-2);
}

function formatMonth(value: string | Date | undefined) {
  const date = value ? new Date(value) : new Date();
  return String(date.getUTCMonth() + 1).padStart(2, '0');
}

function formatDay(value: string | Date | undefined) {
  const date = value ? new Date(value) : new Date();
  return String(date.getUTCDate()).padStart(2, '0');
}

function getSegmentLabel(segment: DocumentCodeRuleSegment, serialLength: number) {
  switch (segment.key) {
    case 'prefix':
      return '固定前缀';
    case 'year':
      return '年';
    case 'month':
      return '月';
    case 'day':
      return '日';
    case 'serial':
      return `${serialLength} 位流水号`;
  }
}

function usesYearScopedSerial(scope: DocumentCodeRuleSerialScope) {
  return scope === 'global_year' || scope === 'global_month' || scope === 'global_day';
}

function usesMonthScopedSerial(scope: DocumentCodeRuleSerialScope) {
  return scope === 'global_month' || scope === 'global_day';
}

function usesDayScopedSerial(scope: DocumentCodeRuleSerialScope) {
  return scope === 'global_day';
}

export function normalizeDocumentCodeRule(rule: DocumentCodeRuleLike): DocumentCodeRule {
  return {
    ...rule,
    serialScope: normalizeSerialScope(rule.serialScope),
    segments: normalizeSegments(rule.segments),
  };
}

export function validateDocumentCodeRule(rule: DocumentCodeRule): ValidateDocumentCodeRuleResult {
  const normalizedRule = normalizeDocumentCodeRule(rule);

  if (normalizedRule.strategy !== 'composed_segments') {
    return { ok: false, error: '当前仅支持组合段编码规则' };
  }

  if (
    !Number.isInteger(normalizedRule.serialLength) ||
    normalizedRule.serialLength < 2 ||
    normalizedRule.serialLength > 6
  ) {
    return { ok: false, error: '单据编号流水位数必须是 2 到 6 位整数' };
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

  const prefixSegment = enabledSegments.find((segment) => segment.key === 'prefix');
  if (prefixSegment && !normalizePrefix(prefixSegment.value)) {
    return { ok: false, error: '已启用固定前缀时，前缀内容不能为空' };
  }

  if (usesYearScopedSerial(normalizedRule.serialScope) && !enabledSegments.some((segment) => segment.key === 'year')) {
    return { ok: false, error: '按年流水时，必须启用年份段' };
  }

  if (
    usesMonthScopedSerial(normalizedRule.serialScope) &&
    (!enabledSegments.some((segment) => segment.key === 'year') ||
      !enabledSegments.some((segment) => segment.key === 'month'))
  ) {
    return { ok: false, error: '按月流水时，必须同时启用年份段和月份段' };
  }

  if (
    usesDayScopedSerial(normalizedRule.serialScope) &&
    (!enabledSegments.some((segment) => segment.key === 'year') ||
      !enabledSegments.some((segment) => segment.key === 'month') ||
      !enabledSegments.some((segment) => segment.key === 'day'))
  ) {
    return { ok: false, error: '按日流水时，必须同时启用年份段、月份段和日期段' };
  }

  return { ok: true };
}

export function buildDocumentCodePreview(
  rule: DocumentCodeRule,
  options: DocumentCodePreviewOptions = {},
) {
  const normalizedRule = normalizeDocumentCodeRule(rule);
  const enabledSegments = normalizedRule.segments.filter((segment) => segment.enabled);

  return enabledSegments
    .map((segment) => {
      switch (segment.key) {
        case 'prefix':
          return normalizePrefix(segment.value ?? options.prefix ?? 'NO') || 'NO';
        case 'year':
          return formatYear(options.now);
        case 'month':
          return formatMonth(options.now);
        case 'day':
          return formatDay(options.now);
        case 'serial':
          return formatSerial(options.sequence ?? 1, normalizedRule.serialLength);
      }
    })
    .filter(Boolean)
    .join('');
}

export function buildSequentialDocumentCode(
  prefix: string,
  sequence: number,
  now: string | Date = new Date(),
) {
  return `${prefix}${formatYear(now)}${formatMonth(now)}${formatDay(now)}${formatSerial(sequence, 4)}`;
}

export function describeDocumentCodeRule(rule: DocumentCodeRule) {
  const normalizedRule = normalizeDocumentCodeRule(rule);
  const enabledSegments = normalizedRule.segments.filter((segment) => segment.enabled);
  const summary = enabledSegments
    .map((segment) => getSegmentLabel(segment, normalizedRule.serialLength))
    .join(' + ');
  const example = buildDocumentCodePreview(rule);
  return `${summary}，例如 ${example}`;
}
