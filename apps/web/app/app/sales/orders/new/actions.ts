'use server';

import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { type DemoRole } from '../../../_lib/demo-session';
import {
  buildFormalRequestHeaders,
  parseFormalAccessScopes,
} from '../../../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../../../_lib/formal-request-signature';
import { resolveFormalActionSessionFromForm } from '../../../_lib/formal-action-session';
import { readMutationRequestHeaders } from '../../../_lib/mutation-request-key';
import { resolveFormalUserId } from '../../../_lib/formal-access';

export type SalesOrderFormState = {
  error: string | null;
};

export type SalesOrderAutosaveState = {
  error: string | null;
  salesOrderId?: number;
  savedAt?: string;
  skipped?: boolean;
};

type FileLikeEntry = File;

type SalesOrderAttachmentPayload = {
  key?: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

type SalesOrderItemPayload = {
  clientLineId?: number;
  lineNo: number;
  productId?: number;
  sku: string;
  productName: string;
  factoryPicUrls?: string[];
  packageQuantity: number;
  unitsPerPackage: number;
  totalQuantity: number;
  quantity: number;
  unit: string;
  salePrice: number;
  amount: number;
};

const initialError = '创建销售单失败';
function getSalesOrderApiBaseUrl() {
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

function hasValidSalesOrderId(value: unknown): value is { id: number } {
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

function resolveAllowedSalesOwnerIds(role: DemoRole, user: string) {
  const currentUserId = resolveFormalUserId(user);

  if (role === 'sales') {
    return [currentUserId];
  }

  if (role === 'sales_manager') {
    return [2001, 2002, currentUserId];
  }

  if (role === 'boss' || role === 'admin') {
    return role === 'boss' ? [2001, 2002, 2000, currentUserId] : [2001, 2002, 2000];
  }

  return [currentUserId];
}

function normalizeSalesOwnerId(payload: {
  role: DemoRole;
  user: string;
  selectedSalesUserId: number;
}) {
  const allowedIds = resolveAllowedSalesOwnerIds(payload.role, payload.user);
  if (allowedIds.includes(payload.selectedSalesUserId)) {
    return payload.selectedSalesUserId;
  }

  const currentUserId = resolveFormalUserId(payload.user);
  return allowedIds.includes(currentUserId) ? currentUserId : allowedIds[0] ?? currentUserId;
}

function parseSalesOrderItems(value: FormDataEntryValue | null): SalesOrderItemPayload[] {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index): SalesOrderItemPayload | null => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }

        const candidate = item as Partial<SalesOrderItemPayload>;
        const sku = typeof candidate.sku === 'string' ? candidate.sku.trim() : '';
        const productName =
          typeof candidate.productName === 'string'
            ? candidate.productName.trim()
            : '';
        const unit = typeof candidate.unit === 'string' ? candidate.unit.trim() : '';
        const packageQuantity = Number(candidate.packageQuantity);
        const unitsPerPackage = Number(candidate.unitsPerPackage);
        const totalQuantity = Number(candidate.totalQuantity ?? candidate.quantity);
        const salePrice = Number(candidate.salePrice);
        const amount =
          candidate.amount != null
            ? Number(candidate.amount)
            : Number((totalQuantity * salePrice).toFixed(2));

        if (
          !sku ||
          !productName ||
          !unit ||
          !Number.isFinite(totalQuantity) ||
          totalQuantity <= 0
        ) {
          return null;
        }

        const factoryPicUrls = Array.isArray(candidate.factoryPicUrls)
          ? candidate.factoryPicUrls
              .filter((entry): entry is string => typeof entry === 'string')
              .map((entry) => entry.trim())
              .filter(Boolean)
          : [];

        return {
          clientLineId: Number.isFinite(Number(candidate.clientLineId))
            ? Number(candidate.clientLineId)
            : undefined,
          lineNo: Number.isFinite(Number(candidate.lineNo))
            ? Number(candidate.lineNo)
            : index + 1,
          productId: Number.isFinite(Number(candidate.productId))
            ? Number(candidate.productId)
            : 0,
          sku,
          productName,
          ...(factoryPicUrls.length > 0 ? { factoryPicUrls } : {}),
          packageQuantity:
            Number.isFinite(packageQuantity) && packageQuantity > 0
              ? packageQuantity
              : totalQuantity,
          unitsPerPackage:
            Number.isFinite(unitsPerPackage) && unitsPerPackage > 0
              ? unitsPerPackage
              : totalQuantity,
          totalQuantity,
          quantity: totalQuantity,
          unit,
          salePrice: Number.isFinite(salePrice) ? salePrice : 0,
          amount: Number.isFinite(amount)
            ? amount
            : Number((totalQuantity * (Number.isFinite(salePrice) ? salePrice : 0)).toFixed(2)),
        };
      })
      .filter((item): item is SalesOrderItemPayload => item !== null);
  } catch {
    return [];
  }
}

function readTrimmedString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function validateSalesOrderDraftPayload(payload: {
  customerName?: string;
  items?: SalesOrderItemPayload[];
}) {
  const missingFields = [];

  if (!payload.customerName?.trim()) {
    missingFields.push('订货单位');
  }

  if (!payload.items?.length) {
    missingFields.push('销售明细');
  }

  return missingFields.length > 0
    ? `请完善${missingFields.join('、')}后再保存销售单草稿。`
    : null;
}

function readOptionalNumber(formData: FormData, key: string) {
  const rawValue = readTrimmedString(formData, key);
  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : undefined;
}

function isFileLike(value: FormDataEntryValue): value is FileLikeEntry {
  return typeof value !== 'string';
}

type SalesOrderActionSession = Awaited<
  ReturnType<typeof resolveFormalActionSessionFromForm>
>;

function hasValidAttachmentPayload(
  value: unknown,
): value is SalesOrderAttachmentPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SalesOrderAttachmentPayload).fileName === 'string' &&
    typeof (value as SalesOrderAttachmentPayload).mimeType === 'string' &&
    typeof (value as SalesOrderAttachmentPayload).size === 'number' &&
    Number.isFinite((value as SalesOrderAttachmentPayload).size) &&
    typeof (value as SalesOrderAttachmentPayload).url === 'string' &&
    (
      (value as SalesOrderAttachmentPayload).key === undefined ||
      typeof (value as SalesOrderAttachmentPayload).key === 'string'
    )
  );
}

async function uploadSalesOrderAttachments(
  files: FileLikeEntry[],
  actionSession: SalesOrderActionSession,
) {
  const uploadFormData = new FormData();
  files.forEach((file) => {
    uploadFormData.append('files', file as unknown as Blob, file.name);
  });

  const response = await fetch(`${getSalesOrderApiBaseUrl()}/files/sales-order-attachments`, {
    method: 'POST',
    headers: {
      ...buildFormalRequestHeaders(actionSession),
      ...buildSignedFormalRequestHeaders(actionSession),
    },
    body: uploadFormData,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json().catch(() => null)) as
    | { items?: unknown[] }
    | null;

  return (payload?.items ?? []).filter(hasValidAttachmentPayload);
}

async function readSalesOrderAttachments(
  formData: FormData,
  actionSession: SalesOrderActionSession,
) {
  if (String(formData.get('skipAttachmentUpload') ?? '') === 'true') {
    return [];
  }

  const fileEntries = formData
    .getAll('salesOrderAttachmentFiles')
    .filter(isFileLike)
    .filter((file) => (file.size ?? 0) > 0);

  if (fileEntries.length === 0) {
    return [];
  }

  return uploadSalesOrderAttachments(fileEntries, actionSession);
}

function readExistingSalesOrderAttachments(formData: FormData) {
  const rawValue = formData.get('existingSalesOrderAttachments');
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(hasValidAttachmentPayload);
  } catch {
    return [];
  }
}

function isImageFileLike(value: FileLikeEntry) {
  return (
    value.type?.startsWith('image/') ||
    /\.(avif|gif|jpe?g|png|webp)$/i.test(value.name ?? '')
  );
}

async function readSalesOrderItemFactoryPicUrls(
  formData: FormData,
  item: SalesOrderItemPayload,
  actionSession: SalesOrderActionSession,
) {
  if (String(formData.get('skipAttachmentUpload') ?? '') === 'true') {
    return item.factoryPicUrls ?? [];
  }

  const lineKey = item.clientLineId ?? item.lineNo;
  const fileEntries = formData
    .getAll(`salesOrderItemFactoryPicFiles:${lineKey}`)
    .filter(isFileLike)
    .filter((file) => (file.size ?? 0) > 0)
    .filter(isImageFileLike);

  if (fileEntries.length === 0) {
    return item.factoryPicUrls ?? [];
  }

  const uploaded = await uploadSalesOrderAttachments(fileEntries, actionSession);
  return [
    ...(item.factoryPicUrls ?? []),
    ...uploaded
      .filter((attachment) => attachment.mimeType.startsWith('image/'))
      .map((attachment) => attachment.url),
  ];
}

async function attachSalesOrderItemFactoryPicUrls(
  formData: FormData,
  items: SalesOrderItemPayload[] | undefined,
  actionSession: SalesOrderActionSession,
) {
  const sourceItems = items ?? [];

  const resolvedItems = [];
  for (const item of sourceItems) {
    const factoryPicUrls = await readSalesOrderItemFactoryPicUrls(
      formData,
      item,
      actionSession,
    );
    const { clientLineId: _clientLineId, ...payloadItem } = item;
    resolvedItems.push({
      ...payloadItem,
      ...(factoryPicUrls.length > 0 ? { factoryPicUrls } : {}),
    });
  }

  return resolvedItems;
}

export async function buildCreateSalesOrderPayload(formData: FormData) {
  const accessScopes = parseFormalAccessScopes(
    String(formData.get('access') ?? '') || null,
  );

  const role = normalizeRole(String(formData.get('role') ?? 'boss'));
  const user = String(formData.get('user') ?? 'Mia');
  const selectedSalesUserId = Number(formData.get('salesUserId'));
  const customerEntryMode =
    String(formData.get('customerEntryMode') ?? 'existing') === 'manual'
      ? 'manual'
      : 'existing';
  const items = parseSalesOrderItems(formData.get('salesOrderItems'));
  const submitMode =
    String(formData.get('submitMode') ?? 'draft') === 'submit'
      ? 'submit'
      : 'draft';

  return {
    submitMode,
    ...(customerEntryMode === 'existing' && readOptionalNumber(formData, 'customerId') != null
      ? { customerId: readOptionalNumber(formData, 'customerId') }
      : {}),
    customerEntryMode,
    customerName:
      customerEntryMode === 'existing'
        ? readTrimmedString(formData, 'selectedCustomerName') ||
          readTrimmedString(formData, 'customerName')
        : readTrimmedString(formData, 'customerName'),
    customerCode:
      customerEntryMode === 'existing'
        ? readTrimmedString(formData, 'selectedCustomerCode') ||
          readTrimmedString(formData, 'customerCode')
        : readTrimmedString(formData, 'customerCode'),
    ...(customerEntryMode === 'manual'
      ? {
          saveManualCustomerToCounterparty:
            String(formData.get('saveManualCustomerToCounterparty') ?? '') === 'on',
        }
      : {}),
    title: readTrimmedString(formData, 'title'),
    salesUserId: normalizeSalesOwnerId({
      role,
      user,
      selectedSalesUserId,
    }),
    createdBy: resolveFormalUserId(user),
    orderingUnit: readTrimmedString(formData, 'orderingUnit'),
    storeName: readTrimmedString(formData, 'storeName'),
    orderDate: readTrimmedString(formData, 'orderDate'),
    estimatedDeliveryDate: readTrimmedString(formData, 'estimatedDeliveryDate'),
    shipTo: readTrimmedString(formData, 'shipTo'),
    salesOrderRemark:
      readTrimmedString(formData, 'salesOrderRemark') ||
      readTrimmedString(formData, 'salesOrderAttachment'),
    ...(items.length > 0 ? { items } : {}),
    role,
    user,
    ...(accessScopes ? { accessScopes } : {}),
  };
}

export async function createSalesOrderAction(
  _prevState: SalesOrderFormState,
  formData: FormData,
): Promise<SalesOrderFormState> {
  try {
    const actionSession = await resolveFormalActionSessionFromForm(formData);
    const payload = await buildCreateSalesOrderPayload(formData);
    const validationError = validateSalesOrderDraftPayload(payload);
    if (validationError) {
      return { error: validationError };
    }

    const salesOrderAttachments = await readSalesOrderAttachments(
      formData,
      actionSession,
    );
    const items = await attachSalesOrderItemFactoryPicUrls(
      formData,
      payload.items,
      actionSession,
    );
    const response = await fetch(`${getSalesOrderApiBaseUrl()}/sales-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildFormalRequestHeaders(actionSession),
        ...buildSignedFormalRequestHeaders(actionSession),
        ...readMutationRequestHeaders(formData),
      },
      body: JSON.stringify({
        submitMode: payload.submitMode,
        customerId: payload.customerId,
        customerEntryMode: payload.customerEntryMode,
        customerName: payload.customerName,
        customerCode: payload.customerCode,
        ...(payload.saveManualCustomerToCounterparty !== undefined
          ? {
              saveManualCustomerToCounterparty:
                payload.saveManualCustomerToCounterparty,
            }
          : {}),
        title: payload.title,
        salesUserId: payload.salesUserId,
        createdBy: payload.createdBy,
        orderingUnit: payload.orderingUnit,
        storeName: payload.storeName,
        orderDate: payload.orderDate,
        estimatedDeliveryDate: payload.estimatedDeliveryDate,
        shipTo: payload.shipTo,
        salesOrderRemark: payload.salesOrderRemark,
        salesOrderAttachments,
        ...(items.length > 0 ? { items } : {}),
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    const result = (await response.json()) as unknown;
    if (!hasValidSalesOrderId(result)) {
      return { error: initialError };
    }

    const params = new URLSearchParams({
      role: actionSession.role,
      user: actionSession.user,
    });
    redirect(`/app/sales/orders/${result.id}?${params.toString()}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: initialError };
  }
}

export async function autosaveSalesOrderDraftAction(
  formData: FormData,
): Promise<SalesOrderAutosaveState> {
  try {
    formData.set('submitMode', 'draft');
    formData.set('skipAttachmentUpload', 'true');

    const actionSession = await resolveFormalActionSessionFromForm(formData);
    const salesOrderId = readOptionalNumber(formData, 'salesOrderId');
    const payload = await buildCreateSalesOrderPayload(formData);
    if (!payload.customerName || !payload.items?.length) {
      return { error: null, skipped: true };
    }

    const existingSalesOrderAttachments = readExistingSalesOrderAttachments(formData);
    const items = await attachSalesOrderItemFactoryPicUrls(
      formData,
      payload.items,
      actionSession,
    );
    const requestBody = {
      submitMode: 'draft' as const,
      customerId: payload.customerId,
      customerEntryMode: payload.customerEntryMode,
      customerName: payload.customerName,
      customerCode: payload.customerCode,
      ...(payload.saveManualCustomerToCounterparty !== undefined
        ? { saveManualCustomerToCounterparty: false }
        : {}),
      title: payload.title,
      salesUserId: payload.salesUserId,
      createdBy: payload.createdBy,
      orderingUnit: payload.orderingUnit,
      storeName: payload.storeName,
      orderDate: payload.orderDate,
      estimatedDeliveryDate: payload.estimatedDeliveryDate,
      shipTo: payload.shipTo,
      salesOrderRemark: payload.salesOrderRemark,
      salesOrderAttachments: existingSalesOrderAttachments,
      ...(items.length > 0 ? { items } : {}),
    };
    const response = await fetch(
      salesOrderId
        ? `${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrderId}/draft`
        : `${getSalesOrderApiBaseUrl()}/sales-orders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildFormalRequestHeaders(actionSession),
          ...buildSignedFormalRequestHeaders(actionSession),
          ...readMutationRequestHeaders(formData),
        },
        body: JSON.stringify(requestBody),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    const result = (await response.json()) as unknown;
    if (!hasValidSalesOrderId(result)) {
      return { error: '销售单自动保存失败' };
    }

    return {
      error: null,
      salesOrderId: result.id,
      savedAt: new Date().toISOString(),
    };
  } catch {
    return { error: '销售单自动保存失败' };
  }
}

export async function updateSalesOrderDraftAction(
  _prevState: SalesOrderFormState,
  formData: FormData,
): Promise<SalesOrderFormState> {
  try {
    const actionSession = await resolveFormalActionSessionFromForm(formData);
    const salesOrderId = readOptionalNumber(formData, 'salesOrderId');
    if (!salesOrderId) {
      return { error: '销售单草稿保存失败' };
    }

    const payload = await buildCreateSalesOrderPayload(formData);
    const validationError = validateSalesOrderDraftPayload(payload);
    if (validationError) {
      return { error: validationError };
    }

    const existingSalesOrderAttachments = readExistingSalesOrderAttachments(formData);
    const uploadedSalesOrderAttachments = await readSalesOrderAttachments(
      formData,
      actionSession,
    );
    const items = await attachSalesOrderItemFactoryPicUrls(
      formData,
      payload.items,
      actionSession,
    );
    const response = await fetch(
      `${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrderId}/draft`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildFormalRequestHeaders(actionSession),
          ...buildSignedFormalRequestHeaders(actionSession),
          ...readMutationRequestHeaders(formData),
        },
        body: JSON.stringify({
          submitMode: payload.submitMode,
          customerId: payload.customerId,
          customerEntryMode: payload.customerEntryMode,
          customerName: payload.customerName,
          customerCode: payload.customerCode,
          ...(payload.saveManualCustomerToCounterparty !== undefined
            ? {
                saveManualCustomerToCounterparty:
                  payload.saveManualCustomerToCounterparty,
              }
            : {}),
          title: payload.title,
          salesUserId: payload.salesUserId,
          createdBy: payload.createdBy,
          orderingUnit: payload.orderingUnit,
          storeName: payload.storeName,
          orderDate: payload.orderDate,
          estimatedDeliveryDate: payload.estimatedDeliveryDate,
          shipTo: payload.shipTo,
          salesOrderRemark: payload.salesOrderRemark,
          salesOrderAttachments: [
            ...existingSalesOrderAttachments,
            ...uploadedSalesOrderAttachments,
          ],
          ...(items.length > 0 ? { items } : {}),
        }),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    const result = (await response.json()) as unknown;
    if (!hasValidSalesOrderId(result)) {
      return { error: '销售单草稿保存失败' };
    }

    const params = new URLSearchParams({
      role: actionSession.role,
      user: actionSession.user,
    });
    redirect(`/app/sales/orders/${result.id}?${params.toString()}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: '销售单草稿保存失败' };
  }
}
