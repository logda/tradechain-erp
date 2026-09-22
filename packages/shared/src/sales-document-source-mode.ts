export const salesDocumentSourceModeOptions = [
  'all',
  'direct',
  'from_demand',
  'from_quote',
  'from_quote_with_inquiry',
] as const;

const salesDocumentSourceModeLabels: Record<SalesDocumentSourceMode, string> = {
  all: '全部',
  direct: '直建',
  from_demand: '需求转入',
  from_quote: '报价转入',
  from_quote_with_inquiry: '报价+询价转入',
};

export type SalesDocumentSourceMode =
  (typeof salesDocumentSourceModeOptions)[number];

export function normalizeSalesDocumentSourceMode(
  value: string | undefined,
): SalesDocumentSourceMode {
  return salesDocumentSourceModeOptions.includes(
    value as SalesDocumentSourceMode,
  )
    ? (value as SalesDocumentSourceMode)
    : 'all';
}

export function resolveSalesDocumentSourceMode(
  sourceSummary: string | null | undefined,
): Exclude<SalesDocumentSourceMode, 'all'> {
  const normalized = sourceSummary?.trim().toLowerCase() ?? '';

  if (normalized.includes('direct') || normalized.includes('直建')) {
    return 'direct';
  }

  if (
    normalized.includes('inquiry') ||
    normalized.includes('询价')
  ) {
    return 'from_quote_with_inquiry';
  }

  if (
    normalized.includes('demand') ||
    normalized.includes('需求')
  ) {
    return 'from_demand';
  }

  return 'from_quote';
}

export function formatSalesDocumentSourceMode(
  value: SalesDocumentSourceMode,
): string {
  return salesDocumentSourceModeLabels[value];
}
