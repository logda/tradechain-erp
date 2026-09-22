'use server';

import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { type DemoRole } from '../../_lib/demo-session';
import {
  buildFormalRequestHeaders,
  parseFormalAccessScopes,
} from '../../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../../_lib/formal-request-signature';
import { resolveFormalActionSessionFromForm } from '../../_lib/formal-action-session';

export type FormalAfterSalesFormState = {
  error: string | null;
};

const initialError = '创建售后单失败';

function getAfterSalesApiBaseUrl() {
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

function hasValidAfterSalesId(value: unknown): value is { id: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'number' &&
    Number.isFinite((value as { id: number }).id)
  );
}

function normalizeRole(value: string): DemoRole {
  if (
    value === 'admin' ||
    value === 'boss' ||
    value === 'sales_manager' ||
    value === 'sales' ||
    value === 'purchase_manager' ||
    value === 'purchase'
  ) {
    return value;
  }

  return 'boss';
}

export async function buildCreateFormalAfterSalesPayload(formData: FormData) {
  const accessScopes = parseFormalAccessScopes(
    String(formData.get('access') ?? '') || null,
  );

  return {
    salesOrderId: Number(formData.get('salesOrderId')),
    purchaseOrderId: Number(formData.get('purchaseOrderId')),
    shipmentBatchId: Number(formData.get('shipmentBatchId')),
    customerName: String(formData.get('customerName') ?? ''),
    supplierName: String(formData.get('supplierName') ?? ''),
    type: String(formData.get('type')),
    issueDescription: String(formData.get('issueDescription')),
    createdBy: Number(formData.get('createdBy')),
    role: normalizeRole(String(formData.get('role') ?? 'boss')),
    user: String(formData.get('user') ?? 'Mia'),
    ...(accessScopes ? { accessScopes } : {}),
  };
}

export async function createFormalAfterSalesAction(
  _prevState: FormalAfterSalesFormState,
  formData: FormData,
): Promise<FormalAfterSalesFormState> {
  try {
    const payload = await buildCreateFormalAfterSalesPayload(formData);
    const actionSession = await resolveFormalActionSessionFromForm(formData);
    const response = await fetch(`${getAfterSalesApiBaseUrl()}/after-sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildFormalRequestHeaders(actionSession),
        ...buildSignedFormalRequestHeaders(actionSession),
      },
      body: JSON.stringify({
        salesOrderId: payload.salesOrderId,
        purchaseOrderId: payload.purchaseOrderId,
        shipmentBatchId: payload.shipmentBatchId,
        customerName: payload.customerName,
        supplierName: payload.supplierName,
        type: payload.type,
        issueDescription: payload.issueDescription,
        createdBy: payload.createdBy,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    const result = (await response.json()) as unknown;
    if (!hasValidAfterSalesId(result)) {
      return { error: initialError };
    }

    const params = new URLSearchParams({
      role: actionSession.role,
      user: actionSession.user,
    });
    redirect(`/app/after-sales/${result.id}?${params.toString()}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: initialError };
  }
}
