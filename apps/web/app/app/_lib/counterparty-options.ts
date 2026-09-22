import { buildFormalApiRequestHeaders } from './formal-api-request-headers';
import {
  buildFormalRequestHeaders,
  type FormalRequestSession,
} from './formal-request-headers';

export type CounterpartyOption = {
  id: number;
  type: 'customer' | 'supplier' | 'both';
  code: string;
  name: string;
  shortName?: string;
};

type CounterpartyListResponse = {
  items: Array<{
    id: number;
    type: 'customer' | 'supplier' | 'both';
    code: string;
    name: string;
    shortName?: string;
    status: string;
  }>;
};

function getCounterpartyApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidCounterpartyListResponse(
  value: unknown,
): value is CounterpartyListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as CounterpartyListResponse).items)
  );
}

export async function loadActiveCounterpartyOptions(
  type: 'customer' | 'supplier',
  session?: FormalRequestSession,
) {
  try {
    const response = await fetch(
      `${getCounterpartyApiBaseUrl()}/formal-lookup/counterparties?type=${type}&status=active`,
      {
        cache: 'no-store',
        ...(session ? { headers: buildFormalApiRequestHeaders(session) } : {}),
      },
    );

    if (!response.ok) {
      throw new Error('counterparty options request failed');
    }

    const result = (await response.json().catch(() => null)) as unknown;
    if (!hasValidCounterpartyListResponse(result)) {
      throw new Error('counterparty options response invalid');
    }

    return result.items
      .filter((item) => item.status === 'active')
      .map((item) => ({
        id: item.id,
        type: item.type,
        code: item.code,
        name: item.name,
        shortName: item.shortName ?? '',
      }))
      .sort((left, right) => left.id - right.id);
  } catch {
    return [];
  }
}
