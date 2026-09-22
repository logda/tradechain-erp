const defaultChineseNamesByKey: Record<string, string> = {
  'acme supply': '星河供应',
  'acme trading': '星河贸易',
  'bravo industrial': '光源制造',
  'bravo retail': '博瑞零售',
  'cp-global': '环球伙伴',
  'cus-acme': '星河贸易',
  'cust-acme': '星河贸易',
  'global partner ltd.': '环球伙伴',
  'northwind labs': '北风实验室',
  'runtime customer': '运行时客户',
  'runtime customer en': '上海星河贸易有限公司',
  'signed draft customer': '上海已签名草稿客户有限公司',
  'sup-bravo': '光源制造',
  'sup-light': '光源制造',
};

const defaultEnglishNamesByKey: Record<string, string> = {
  '上海星河贸易有限公司': 'Runtime Customer EN',
  '上海已签名草稿客户有限公司': 'Signed Draft Customer',
  '光源制造': 'Bravo Industrial',
  '博瑞零售': 'Bravo Retail',
  '北风实验室': 'Northwind Labs',
  '星河供应': 'Acme Supply',
  '星河贸易': 'Acme Trading',
  '环球伙伴': 'Global Partner Ltd.',
  '运行时客户': 'Runtime Customer',
  'acme supply': 'Acme Supply',
  'acme trading': 'Acme Trading',
  'bravo industrial': 'Bravo Industrial',
  'bravo retail': 'Bravo Retail',
  'cp-global': 'Global Partner Ltd.',
  'cus-acme': 'Acme Trading',
  'cust-acme': 'Acme Trading',
  'global partner ltd.': 'Global Partner Ltd.',
  'northwind labs': 'Northwind Labs',
  'runtime customer': 'Runtime Customer',
  'runtime customer en': 'Runtime Customer EN',
  'signed draft customer': 'Signed Draft Customer',
  'sup-bravo': 'Bravo Industrial',
  'sup-light': 'Bravo Industrial',
};

function hasChineseText(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function normalizeDisplayKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function resolveMappedChineseName(value: string | null | undefined) {
  const normalized = normalizeDisplayKey(value);
  return normalized ? defaultChineseNamesByKey[normalized] : undefined;
}

function resolveMappedEnglishName(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return defaultEnglishNamesByKey[trimmed] ?? defaultEnglishNamesByKey[trimmed.toLowerCase()];
}

function resolveChineseSegment(value: string | null | undefined) {
  const segments = value
    ?.split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments?.find((segment) => hasChineseText(segment));
}

function isLikelyCode(value: string) {
  return /^[A-Z]+-[A-Z0-9-]+$/.test(value.trim());
}

function resolveEnglishSegment(value: string | null | undefined) {
  const segments = value
    ?.split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !hasChineseText(segment));

  if (!segments?.length) {
    return undefined;
  }

  return segments.find((segment) => !isLikelyCode(segment)) ?? segments[0];
}

export function formatCounterpartyChineseDisplay(
  name: string | number | null | undefined,
  options: {
    code?: string | null;
    fullName?: string | null;
    fallback?: string;
  } = {},
) {
  const normalizedName =
    typeof name === 'number' ? String(name) : name?.trim() ?? '';
  const normalizedFullName = options.fullName?.trim() ?? '';
  const normalizedCode = options.code?.trim() ?? '';

  if (normalizedName && hasChineseText(normalizedName)) {
    return normalizedName;
  }

  const chineseSegment =
    resolveChineseSegment(normalizedName) ??
    resolveChineseSegment(normalizedFullName);
  if (chineseSegment) {
    return chineseSegment;
  }

  if (normalizedFullName && hasChineseText(normalizedFullName)) {
    return normalizedFullName;
  }

  return (
    resolveMappedChineseName(normalizedCode) ??
    resolveMappedChineseName(normalizedName) ??
    resolveMappedChineseName(normalizedFullName) ??
    (normalizedName || options.fallback || '-')
  );
}

export function formatCounterpartyBilingualDisplay(
  name: string | number | null | undefined,
  options: {
    code?: string | null;
    fullName?: string | null;
    fallback?: string;
  } = {},
) {
  const normalizedName =
    typeof name === 'number' ? String(name) : name?.trim() ?? '';
  const normalizedFullName = options.fullName?.trim() ?? '';
  const normalizedCode = options.code?.trim() ?? '';

  const chineseName =
    resolveChineseSegment(normalizedFullName) ??
    resolveChineseSegment(normalizedName) ??
    (normalizedFullName && hasChineseText(normalizedFullName)
      ? normalizedFullName
      : undefined) ??
    (normalizedName && hasChineseText(normalizedName) ? normalizedName : undefined) ??
    resolveMappedChineseName(normalizedCode) ??
    resolveMappedChineseName(normalizedFullName) ??
    resolveMappedChineseName(normalizedName);

  const englishName =
    resolveEnglishSegment(normalizedName) ??
    resolveEnglishSegment(normalizedFullName) ??
    resolveMappedEnglishName(normalizedCode) ??
    resolveMappedEnglishName(normalizedName) ??
    resolveMappedEnglishName(normalizedFullName);

  if (chineseName && englishName && chineseName !== englishName) {
    return `${chineseName} / ${englishName}`;
  }

  return chineseName ?? englishName ?? (normalizedName || options.fallback || '-');
}
