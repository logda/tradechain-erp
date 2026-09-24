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
import { validateCreateFormalQuoteFormData } from './formal-quote-validation';

export type FormalQuoteFormState = {
  error: string | null;
};

export type FormalQuoteAutosaveState = {
  error: string | null;
  quoteId?: number;
  savedAt?: string;
  skipped?: boolean;
  imageUrls?: string[];
  quoteAttachments?: QuoteAttachmentPayload[];
};

const initialError = '创建报价失败';
const uploadTooLargeError = '上传图片过大，请压缩图片后重试';

function getQuoteApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

async function readApiError(response: {
  status?: number;
  json: () => Promise<unknown>;
  text?: () => Promise<string>;
}) {
  if (response.status === 413) {
    return uploadTooLargeError;
  }

  const body = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;

  if (typeof body?.message === 'string') {
    if (body.message.toLowerCase().includes('request entity too large')) {
      return uploadTooLargeError;
    }

    return body.message;
  }

  if (Array.isArray(body?.message) && typeof body.message[0] === 'string') {
    if (body.message[0].toLowerCase().includes('request entity too large')) {
      return uploadTooLargeError;
    }

    return body.message[0];
  }

  const fallbackText = await response.text?.().catch(() => null);
  if (
    typeof fallbackText === 'string' &&
    fallbackText.toLowerCase().includes('request entity too large')
  ) {
    return uploadTooLargeError;
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

function readLinkedInquiryId(value: unknown) {
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { linkedInquiryId?: unknown }).linkedInquiryId === 'number'
  ) {
    return (value as { linkedInquiryId: number }).linkedInquiryId;
  }

  return null;
}

function readAutosavedImageUrls(value: unknown) {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as { items?: unknown }).items)
  ) {
    return [];
  }

  const firstItem = (value as { items: unknown[] }).items[0];
  if (
    typeof firstItem !== 'object' ||
    firstItem === null ||
    !Array.isArray((firstItem as { imageUrls?: unknown }).imageUrls)
  ) {
    return [];
  }

  return (firstItem as { imageUrls: unknown[] }).imageUrls.filter(
    (entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()),
  );
}

function readAutosavedQuoteAttachments(value: unknown) {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as { quoteAttachments?: unknown }).quoteAttachments)
  ) {
    return [];
  }

  return (value as { quoteAttachments: unknown[] }).quoteAttachments.filter(
    hasValidQuoteAttachmentPayload,
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

function parseProductOption(value: string) {
  const [productId, sku, productName, unit, defaultSalePrice] = value.split('|');

  return {
    productId: Number(productId),
    sku: sku ?? '',
    productName: productName ?? '',
    unit: unit ?? '',
    defaultSalePrice: Number(defaultSalePrice),
  };
}

function buildCandidateProductDraft(formData: FormData) {
  return {
    sku: readTrimmedString(formData, 'candidateSku'),
    nameCn: readTrimmedString(formData, 'candidateNameCn'),
    category: readTrimmedString(formData, 'candidateCategory'),
  };
}

function readTrimmedString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function readJsonStringArray(formData: FormData, key: string) {
  const rawValue = readTrimmedString(formData, key);
  if (!rawValue) {
    return [];
  }

  const parsed = JSON.parse(rawValue) as unknown;
  return Array.isArray(parsed)
    ? parsed.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

function readQuoteAttachmentArray(formData: FormData, key: string) {
  const rawValue = readTrimmedString(formData, key);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(hasValidQuoteAttachmentPayload)
      : [];
  } catch {
    return [];
  }
}

function readOptionalNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : undefined;
}

type FileLikeEntry = File;

type QuoteAttachmentPayload = {
  key?: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

function isFileLike(value: FormDataEntryValue): value is FileLikeEntry {
  return typeof value !== 'string';
}

type FormalQuoteActionSession = Awaited<
  ReturnType<typeof resolveFormalActionSessionFromForm>
>;

async function uploadFormalQuoteImages(
  files: FileLikeEntry[],
  actionSession: FormalQuoteActionSession,
) {
  const uploadFormData = new FormData();
  files.forEach((file) => {
    uploadFormData.append('files', file, file.name);
  });

  const response = await fetch(`${getQuoteApiBaseUrl()}/files/formal-quote-images`, {
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
    | { items?: Array<{ url?: string }> }
    | null;

  return (payload?.items ?? [])
    .map((item) => item.url?.trim())
    .filter((value): value is string => Boolean(value));
}

function hasValidQuoteAttachmentPayload(
  value: unknown,
): value is QuoteAttachmentPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as QuoteAttachmentPayload).fileName === 'string' &&
    typeof (value as QuoteAttachmentPayload).mimeType === 'string' &&
    typeof (value as QuoteAttachmentPayload).size === 'number' &&
    Number.isFinite((value as QuoteAttachmentPayload).size) &&
    typeof (value as QuoteAttachmentPayload).url === 'string' &&
    (
      (value as QuoteAttachmentPayload).key === undefined ||
      typeof (value as QuoteAttachmentPayload).key === 'string'
    )
  );
}

async function uploadFormalQuoteAttachments(
  files: FileLikeEntry[],
  actionSession: FormalQuoteActionSession,
) {
  const uploadFormData = new FormData();
  files.forEach((file) => {
    uploadFormData.append('files', file, file.name);
  });

  const response = await fetch(`${getQuoteApiBaseUrl()}/files/formal-quote-attachments`, {
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

  return (payload?.items ?? []).filter(hasValidQuoteAttachmentPayload);
}

async function readImageUrls(
  formData: FormData,
  actionSession: FormalQuoteActionSession,
) {
  const existingImageUrls = readJsonStringArray(formData, 'existingQuoteImageUrls');
  const shouldSkipImageUpload =
    String(formData.get('skipImageUpload') ?? '') === 'true';
  const fileEntries = formData
    .getAll('imageFiles')
    .filter(isFileLike)
    .filter((file) => (file.size ?? 0) > 0);

  if (!shouldSkipImageUpload && fileEntries.length > 0) {
    return [
      ...existingImageUrls,
      ...(await uploadFormalQuoteImages(fileEntries, actionSession)),
    ];
  }

  const typedImageUrls = readTrimmedString(formData, 'imageUrls')
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return typedImageUrls.length > 0 ? typedImageUrls : existingImageUrls;
}

async function readQuoteAttachments(
  formData: FormData,
  actionSession: FormalQuoteActionSession,
) {
  const existingAttachments = readQuoteAttachmentArray(formData, 'existingQuoteAttachments');
  const shouldSkipAttachmentUpload =
    String(formData.get('skipAttachmentUpload') ?? '') === 'true';
  const fileEntries = formData
    .getAll('quoteAttachmentFiles')
    .filter(isFileLike)
    .filter((file) => (file.size ?? 0) > 0);

  if (!shouldSkipAttachmentUpload && fileEntries.length > 0) {
    const uploadedAttachments = [
      ...existingAttachments,
      ...(await uploadFormalQuoteAttachments(fileEntries, actionSession)),
    ];
    return uploadedAttachments.length > 0 ? uploadedAttachments : undefined;
  }

  const typedAttachments = readTrimmedString(formData, 'quoteAttachments');
  if (typedAttachments) {
    try {
      const parsed = JSON.parse(typedAttachments) as unknown;
      if (Array.isArray(parsed)) {
        const attachments = parsed.filter(hasValidQuoteAttachmentPayload);
        return attachments.length > 0 ? attachments : undefined;
      }
    } catch {
      return existingAttachments.length > 0 ? existingAttachments : undefined;
    }
  }

  return existingAttachments.length > 0 ? existingAttachments : undefined;
}

export async function buildCreateFormalQuotePayload(
  formData: FormData,
  actionSession?: FormalQuoteActionSession,
) {
  const resolvedActionSession =
    actionSession ?? (await resolveFormalActionSessionFromForm(formData));
  const submitMode =
    String(formData.get('submitMode') ?? 'draft') === 'submit' ? 'submit' : 'draft';
  const productEntryMode = String(formData.get('productEntryMode') ?? 'existing');
  const productSource =
    String(formData.get('productSource') ?? productEntryMode) === 'candidate'
      ? 'candidate'
      : 'existing';
  const documentType =
    String(formData.get('documentType') ?? 'demand') ===
    'demand'
      ? 'demand'
      : 'quote';
  const customerEntryMode =
    String(formData.get('customerEntryMode') ?? 'existing') === 'manual'
      ? 'manual'
      : 'existing';
  const product = parseProductOption(String(formData.get('productOption') ?? ''));
  const salePrice = Number(formData.get('salePrice'));
  const targetPrice = readOptionalNumber(formData, 'targetPrice');
  const imageUrls = await readImageUrls(formData, resolvedActionSession);
  const quoteAttachments = await readQuoteAttachments(formData, resolvedActionSession);
  const accessScopes = parseFormalAccessScopes(
    String(formData.get('access') ?? '') || null,
  );
  const items =
    productSource === 'candidate'
      ? [
          {
            createCandidateProduct: buildCandidateProductDraft(formData),
            quantity: Number(formData.get('quantity')),
            ...(targetPrice != null ? { targetPrice } : {}),
            salePrice: Number.isFinite(salePrice) ? salePrice : 0,
            imageUrls,
          },
        ]
      : [
          {
            productId: product.productId,
            sku: product.sku,
            productName: product.productName,
            unit: product.unit,
            quantity: Number(formData.get('quantity')),
            ...(targetPrice != null ? { targetPrice } : {}),
            salePrice: Number.isFinite(salePrice) ? salePrice : product.defaultSalePrice,
            imageUrls,
          },
        ];

  return {
    submitMode,
    documentType,
    productSource,
    ...(customerEntryMode === 'existing'
      ? { customerId: Number(formData.get('customerId')) }
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
    salesUserId: Number(formData.get('salesUserId')),
    sourceCode: String(formData.get('sourceCode')),
    inquiryDate: readTrimmedString(formData, 'inquiryDate'),
    destination: readTrimmedString(formData, 'destination'),
    requirements: String(formData.get('requirements')),
    quoteAttachments,
    items,
    role: normalizeRole(String(formData.get('role') ?? 'boss')),
    user: String(formData.get('user') ?? 'Mia'),
    ...(accessScopes ? { accessScopes } : {}),
  };
}

export async function createFormalQuoteAction(
  _prevState: FormalQuoteFormState,
  formData: FormData,
): Promise<FormalQuoteFormState> {
  try {
    const validationError = validateCreateFormalQuoteFormData(formData);
    if (validationError) {
      return { error: validationError };
    }

    const actionSession = await resolveFormalActionSessionFromForm(formData);
    const payload = await buildCreateFormalQuotePayload(formData, actionSession);
    const response = await fetch(`${getQuoteApiBaseUrl()}/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildFormalRequestHeaders(actionSession),
        ...buildSignedFormalRequestHeaders(actionSession),
        ...readMutationRequestHeaders(formData),
      },
      body: JSON.stringify({
        submitMode: payload.submitMode,
        documentType: payload.documentType,
        productSource: payload.productSource,
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
        salesUserId: payload.salesUserId,
        sourceCode: payload.sourceCode,
        inquiryDate: payload.inquiryDate,
        destination: payload.destination,
        requirements: payload.requirements,
        quoteAttachments: payload.quoteAttachments,
        items: payload.items,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    const result = (await response.json()) as unknown;
    if (!hasValidQuoteId(result)) {
      return { error: initialError };
    }

    const params = new URLSearchParams({
      role: actionSession.role,
      user: actionSession.user,
    });
    redirect(`/app/sales/quotes/${result.id}?${params.toString()}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof Error && error.message.trim()) {
      return { error: error.message };
    }

    return { error: initialError };
  }
}

export async function autosaveFormalQuoteDraftAction(
  formData: FormData,
): Promise<FormalQuoteAutosaveState> {
  try {
    formData.set('submitMode', 'draft');

    const validationError = validateCreateFormalQuoteFormData(formData);
    if (validationError) {
      return { error: null, skipped: true };
    }

    const quoteId = Number(formData.get('quoteId'));
    const actionSession = await resolveFormalActionSessionFromForm(formData);
    const payload = await buildCreateFormalQuotePayload(formData, actionSession);
    const requestBody = {
      submitMode: 'draft' as const,
      documentType: payload.documentType,
      productSource: payload.productSource,
      customerId: payload.customerId,
      customerEntryMode: payload.customerEntryMode,
      customerName: payload.customerName,
      customerCode: payload.customerCode,
      ...(payload.saveManualCustomerToCounterparty !== undefined
        ? { saveManualCustomerToCounterparty: false }
        : {}),
      salesUserId: payload.salesUserId,
      sourceCode: payload.sourceCode,
      inquiryDate: payload.inquiryDate,
      destination: payload.destination,
      requirements: payload.requirements,
      quoteAttachments: payload.quoteAttachments,
      items: payload.items,
    };
      const response = await fetch(
      Number.isInteger(quoteId) && quoteId > 0
        ? `${getQuoteApiBaseUrl()}/quotes/${quoteId}/draft`
        : `${getQuoteApiBaseUrl()}/quotes`,
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
    if (!hasValidQuoteId(result)) {
      return { error: '报价单自动保存失败' };
    }

    return {
      error: null,
      quoteId: result.id,
      savedAt: new Date().toISOString(),
      imageUrls: readAutosavedImageUrls(result),
      quoteAttachments: readAutosavedQuoteAttachments(result),
    };
  } catch (error) {
    if (error instanceof Error && error.message.trim()) {
      return { error: error.message };
    }

    return { error: '报价单自动保存失败' };
  }
}

export async function updateFormalQuoteDraftAction(
  _prevState: FormalQuoteFormState,
  formData: FormData,
): Promise<FormalQuoteFormState> {
  try {
    const validationError = validateCreateFormalQuoteFormData(formData);
    if (validationError) {
      return { error: validationError };
    }

    const quoteId = Number(formData.get('quoteId'));
    if (!Number.isInteger(quoteId) || quoteId <= 0) {
      return { error: '报价单草稿保存失败' };
    }

    const actionSession = await resolveFormalActionSessionFromForm(formData);
    const payload = await buildCreateFormalQuotePayload(formData, actionSession);
    const response = await fetch(`${getQuoteApiBaseUrl()}/quotes/${quoteId}/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildFormalRequestHeaders(actionSession),
        ...buildSignedFormalRequestHeaders(actionSession),
        ...readMutationRequestHeaders(formData),
      },
      body: JSON.stringify({
        submitMode: payload.submitMode,
        documentType: payload.documentType,
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
        salesUserId: payload.salesUserId,
        sourceCode: payload.sourceCode,
        inquiryDate: payload.inquiryDate,
        destination: payload.destination,
        requirements: payload.requirements,
        quoteAttachments: payload.quoteAttachments,
        items: payload.items,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    const result = (await response.json()) as unknown;
    if (!hasValidQuoteId(result)) {
      return { error: '报价单草稿保存失败' };
    }

    const params = new URLSearchParams({
      role: actionSession.role,
      user: actionSession.user,
    });
    redirect(`/app/sales/quotes/${result.id}?${params.toString()}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof Error && error.message.trim()) {
      return { error: error.message };
    }

    return { error: '报价单草稿保存失败' };
  }
}
