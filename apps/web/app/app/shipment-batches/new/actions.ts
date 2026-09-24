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
import { readMutationRequestHeaders } from '../../_lib/mutation-request-key';

export type FormalShipmentBatchFormState = {
  error: string | null;
};

const initialError = '创建发货批次失败';

function getShipmentBatchApiBaseUrl() {
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

function hasValidShipmentBatchId(value: unknown): value is { id: number } {
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

function normalizeShippingCodes(value: string) {
  return value
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n');
}

export async function buildCreateFormalShipmentBatchPayload(formData: FormData) {
  const accessScopes = parseFormalAccessScopes(
    String(formData.get('access') ?? '') || null,
  );

  return {
    salesOrderId: Number(formData.get('salesOrderId')),
    purchaseOrderId: Number(formData.get('purchaseOrderId')),
    shippedQty: Number(formData.get('shippedQty')),
    accumulatedQty: Number(formData.get('accumulatedQty')),
    remainingQty: Number(formData.get('remainingQty')),
    shippedAt: String(formData.get('shippedAt')),
    factoryShipDate: String(formData.get('factoryShipDate') ?? ''),
    shippingCode: normalizeShippingCodes(String(formData.get('shippingCode') ?? '')),
    destination: String(formData.get('destination') ?? ''),
    shippingMark: String(formData.get('shippingMark') ?? ''),
    goodsName: String(formData.get('goodsName') ?? ''),
    totalPackages: Number(formData.get('totalPackages')),
    purchasingUnit: String(formData.get('purchasingUnit') ?? ''),
    customerName: String(formData.get('customerName') ?? ''),
    freightStation: String(formData.get('freightStation') ?? ''),
    warehouseEntryNo: String(formData.get('warehouseEntryNo') ?? ''),
    arrivalStatus: String(formData.get('arrivalStatus') ?? ''),
    forwarderShipDate: String(formData.get('forwarderShipDate') ?? ''),
    estimatedArrivalDate: String(formData.get('estimatedArrivalDate') ?? ''),
    remark: String(formData.get('remark') ?? ''),
    createdBy: Number(formData.get('createdBy')),
    purchaseOrderCurrentStatus: String(formData.get('purchaseOrderCurrentStatus')),
    currentBatchCount: Number(formData.get('currentBatchCount')),
    items: String(formData.get('items') ?? ''),
    role: normalizeRole(String(formData.get('role') ?? 'boss')),
    user: String(formData.get('user') ?? 'Mia'),
    ...(accessScopes ? { accessScopes } : {}),
  };
}

export async function createFormalShipmentBatchAction(
  _prevState: FormalShipmentBatchFormState,
  formData: FormData,
): Promise<FormalShipmentBatchFormState> {
  try {
    const payload = await buildCreateFormalShipmentBatchPayload(formData);
    const actionSession = await resolveFormalActionSessionFromForm(formData);
    const response = await fetch(`${getShipmentBatchApiBaseUrl()}/shipment-batches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildFormalRequestHeaders(actionSession),
        ...buildSignedFormalRequestHeaders(actionSession),
        ...readMutationRequestHeaders(formData),
      },
      body: JSON.stringify({
        salesOrderId: payload.salesOrderId,
        purchaseOrderId: payload.purchaseOrderId,
        shippedQty: payload.shippedQty,
        accumulatedQty: payload.accumulatedQty,
        remainingQty: payload.remainingQty,
        shippedAt: payload.shippedAt,
        factoryShipDate: payload.factoryShipDate,
        shippingCode: payload.shippingCode,
        destination: payload.destination,
        shippingMark: payload.shippingMark,
        goodsName: payload.goodsName,
        totalPackages: payload.totalPackages,
        purchasingUnit: payload.purchasingUnit,
        customerName: payload.customerName,
        freightStation: payload.freightStation,
        warehouseEntryNo: payload.warehouseEntryNo,
        arrivalStatus: payload.arrivalStatus,
        forwarderShipDate: payload.forwarderShipDate,
        estimatedArrivalDate: payload.estimatedArrivalDate,
        remark: payload.remark,
        createdBy: payload.createdBy,
        purchaseOrderCurrentStatus: payload.purchaseOrderCurrentStatus,
        currentBatchCount: payload.currentBatchCount,
        ...(payload.items ? { items: JSON.parse(payload.items) as unknown } : {}),
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    const result = (await response.json()) as unknown;
    if (!hasValidShipmentBatchId(result)) {
      return { error: initialError };
    }

    const params = new URLSearchParams({
      role: actionSession.role,
      user: actionSession.user,
    });
    redirect(`/app/shipment-batches/${result.id}?${params.toString()}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: initialError };
  }
}
