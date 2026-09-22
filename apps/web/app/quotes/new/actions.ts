'use server';

import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

export type QuoteFormState = {
  error: string | null;
};

const initialError = '创建报价失败';

function getQuoteApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

async function readApiError(response: {
  json: () => Promise<unknown>;
}) {
  const body = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;

  if (typeof body?.message === 'string') {
    return body.message;
  }

  if (Array.isArray(body?.message) && typeof body.message[0] === 'string') {
    return body.message[0];
  }

  return initialError;
}

function hasValidQuoteId(value: unknown): value is { id: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'number' &&
    Number.isFinite((value as { id: number }).id)
  );
}

export async function buildCreateQuotePayload(formData: FormData) {
  return {
    submitMode:
      String(formData.get('submitMode') ?? 'draft') === 'submit' ? 'submit' : 'draft',
    customerId: Number(formData.get('customerId')),
    salesUserId: Number(formData.get('salesUserId')),
    sourceCode: String(formData.get('sourceCode')),
    requirements: String(formData.get('requirements')),
  };
}

export async function createQuoteAction(
  _prevState: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  try {
    const payload = await buildCreateQuotePayload(formData);
    const response = await fetch(`${getQuoteApiBaseUrl()}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    const result = (await response.json()) as unknown;
    if (!hasValidQuoteId(result)) {
      return { error: initialError };
    }

    redirect(`/quotes/${result.id}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: initialError };
  }
}
