import { buildFormalApiRequestHeaders } from './formal-api-request-headers';

export type QuoteSourceOption = {
  code: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
};

type QuoteSourceListResponse = {
  items: QuoteSourceOption[];
};

const fallbackQuoteSourceOptions: QuoteSourceOption[] = [
  { code: 'expo', label: '展会', enabled: true, sortOrder: 1 },
  { code: 'website', label: '官网', enabled: true, sortOrder: 2 },
  { code: 'online', label: '线上', enabled: true, sortOrder: 3 },
  { code: 'tiktok', label: 'TikTok', enabled: true, sortOrder: 4 },
  { code: 'referral', label: '转介绍', enabled: true, sortOrder: 5 },
];

function getQuoteSourceApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidQuoteSourceResponse(
  value: unknown,
): value is QuoteSourceListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as QuoteSourceListResponse).items)
  );
}

export async function loadQuoteSourceOptions(
  session?: { role: string; user: string },
  options?: { includeDisabled?: boolean },
) {
  try {
    const response = await fetch(`${getQuoteSourceApiBaseUrl()}/quote-sources`, {
      cache: 'no-store',
      headers: session ? buildFormalApiRequestHeaders(session) : undefined,
    });

    if (!response.ok) {
      throw new Error('quote source request failed');
    }

    const result = (await response.json().catch(() => null)) as unknown;
    if (!hasValidQuoteSourceResponse(result)) {
      throw new Error('quote source response invalid');
    }

    return result.items
      .filter((item) => options?.includeDisabled || item.enabled !== false)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  } catch {
    return options?.includeDisabled
      ? fallbackQuoteSourceOptions
      : fallbackQuoteSourceOptions.filter((item) => item.enabled !== false);
  }
}
