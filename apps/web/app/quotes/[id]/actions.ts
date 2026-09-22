 'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { redirect } from 'next/navigation';
import {
  buildFormalRequestHeaders,
  parseFormalAccessScopes,
} from '../../app/_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../../app/_lib/formal-request-signature';

export type ConvertQuoteFormState = {
  error: string | null;
};

type ConvertQuoteLineItem = {
  lineNo: number;
  productId: number;
  sku: string;
  productName: string;
  unit: string;
  quantity: number;
  salePrice: number;
  amount: number;
  imageUrls?: string[];
  confirmedSupplierId?: number;
  confirmedSupplierCode?: string;
  confirmedSupplierName?: string;
  confirmedPurchasePrice?: number;
  confirmedProductId?: number;
};

type ConvertQuoteAttachment = {
  key?: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

type ConvertQuoteLineItemCandidate = Partial<ConvertQuoteLineItem> & {
  confirmedSalePrice?: unknown;
};

const initialError = '转销售订单失败';

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

function parseBoolean(value: FormDataEntryValue | null) {
  return value === 'true';
}

function parseRequiredNumber(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.trim() === '') {
    return NaN;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
}

function parseOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function maybeNumberField(value: number) {
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseConvertQuoteItems(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    const items = parsed
      .map((item) => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }

        const candidate = item as ConvertQuoteLineItemCandidate;
        const lineNo = Number(candidate.lineNo);
        const productId = Number(candidate.productId);
        const quantity = Number(candidate.quantity);
        const sourceSalePrice = Number(candidate.salePrice);
        const confirmedSalePrice = Number(candidate.confirmedSalePrice);
        const confirmedSupplierId = Number(candidate.confirmedSupplierId);
        const confirmedPurchasePrice = Number(candidate.confirmedPurchasePrice);
        const confirmedProductId = Number(candidate.confirmedProductId);
        const salePrice =
          Number.isFinite(confirmedSalePrice) && confirmedSalePrice > 0
            ? confirmedSalePrice
            : sourceSalePrice;
        const amount =
          Number.isFinite(confirmedSalePrice) && confirmedSalePrice > 0
            ? Number((quantity * salePrice).toFixed(2))
            : Number(candidate.amount);

        if (
          !Number.isFinite(lineNo) ||
          !Number.isFinite(productId) ||
          typeof candidate.sku !== 'string' ||
          typeof candidate.productName !== 'string' ||
          typeof candidate.unit !== 'string' ||
          !Number.isFinite(quantity) ||
          !Number.isFinite(salePrice) ||
          !Number.isFinite(amount)
        ) {
          return null;
        }

        const imageUrls = Array.isArray(candidate.imageUrls)
          ? candidate.imageUrls
              .filter((entry): entry is string => typeof entry === 'string')
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0)
          : [];

        return {
          lineNo,
          productId,
          sku: candidate.sku,
          productName: candidate.productName,
          unit: candidate.unit,
          quantity,
          salePrice,
          amount,
          ...(Number.isFinite(confirmedSupplierId) && confirmedSupplierId > 0
            ? { confirmedSupplierId }
            : {}),
          ...(typeof candidate.confirmedSupplierCode === 'string' &&
          candidate.confirmedSupplierCode.trim()
            ? { confirmedSupplierCode: candidate.confirmedSupplierCode.trim() }
            : {}),
          ...(typeof candidate.confirmedSupplierName === 'string' &&
          candidate.confirmedSupplierName.trim()
            ? { confirmedSupplierName: candidate.confirmedSupplierName.trim() }
            : {}),
          ...(Number.isFinite(confirmedPurchasePrice) && confirmedPurchasePrice > 0
            ? { confirmedPurchasePrice }
            : {}),
          ...(Number.isFinite(confirmedProductId) && confirmedProductId > 0
            ? { confirmedProductId }
            : {}),
          ...(imageUrls.length > 0 ? { imageUrls } : {}),
        };
      })
      .filter((item): item is ConvertQuoteLineItem => item !== null);

    return items.length > 0 ? items : undefined;
  } catch {
    return undefined;
  }
}

function parseConvertQuoteAttachments(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    const attachments = parsed
      .map((item) => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }

        const candidate = item as Partial<ConvertQuoteAttachment>;
        const fileName = typeof candidate.fileName === 'string' ? candidate.fileName.trim() : '';
        const mimeType = typeof candidate.mimeType === 'string' ? candidate.mimeType.trim() : '';
        const url = typeof candidate.url === 'string' ? candidate.url.trim() : '';
        const size = Number(candidate.size);

        if (!fileName || !mimeType || !url || !Number.isFinite(size) || size < 0) {
          return null;
        }

        return {
          ...(typeof candidate.key === 'string' && candidate.key.trim()
            ? { key: candidate.key.trim() }
            : {}),
          fileName,
          mimeType,
          size,
          url,
        };
      })
      .filter((item): item is ConvertQuoteAttachment => item !== null);

    return attachments.length > 0 ? attachments : undefined;
  } catch {
    return undefined;
  }
}

export async function buildConvertQuotePayload(formData: FormData) {
  const items = parseConvertQuoteItems(formData.get('items'));
  const quoteAttachments = parseConvertQuoteAttachments(formData.get('quoteAttachments'));
  const customerName = parseOptionalString(formData.get('customerName'));
  const customerFullName = parseOptionalString(formData.get('customerFullName'));
  const customerCode = parseOptionalString(formData.get('customerCode'));
  const customerEntryMode =
    String(formData.get('customerEntryMode') ?? '') === 'manual'
      ? 'manual'
      : String(formData.get('customerEntryMode') ?? '') === 'existing'
        ? 'existing'
        : undefined;
  const sourceQuoteNo = parseOptionalString(formData.get('sourceQuoteNo'));
  const sourceCode = parseOptionalString(formData.get('sourceCode'));
  const inquiryDate = parseOptionalString(formData.get('inquiryDate'));
  const destination = parseOptionalString(formData.get('destination'));
  const requirements = parseOptionalString(formData.get('requirements'));
  const quoteVersionNo = parseRequiredNumber(formData.get('quoteVersionNo'));
  const customerId = parseRequiredNumber(formData.get('customerId'));
  const createdBy = parseRequiredNumber(formData.get('createdBy'));
  const payload = {
    ...(maybeNumberField(quoteVersionNo) ? { quoteVersionNo } : {}),
    ...(maybeNumberField(customerId) ? { customerId } : {}),
    ...(customerName ? { customerName } : {}),
    ...(customerFullName ? { customerFullName } : {}),
    ...(customerCode ? { customerCode } : {}),
    ...(customerEntryMode ? { customerEntryMode } : {}),
    ...(sourceQuoteNo ? { sourceQuoteNo } : {}),
    ...(sourceCode ? { sourceCode } : {}),
    ...(inquiryDate ? { inquiryDate } : {}),
    ...(destination ? { destination } : {}),
    ...(requirements ? { requirements } : {}),
    ...(maybeNumberField(createdBy) ? { createdBy } : {}),
    quoteConfirmed: parseBoolean(formData.get('quoteConfirmed')),
    ...(items ? { items } : {}),
    ...(quoteAttachments ? { quoteAttachments } : {}),
  };

  return {
    quoteId: parseRequiredNumber(formData.get('quoteId')),
    payload,
  };
}

function readFormalConvertSession(formData: FormData) {
  const role = String(formData.get('role') ?? '').trim();
  const user = String(formData.get('user') ?? '').trim();
  const accessScopes = parseFormalAccessScopes(
    String(formData.get('access') ?? '') || null,
  );

  if (!role || !user) {
    return null;
  }

  return {
    role,
    user,
    formalRedirect: formData.get('formalRedirect') === 'true',
    ...(accessScopes ? { accessScopes } : {}),
  };
}

function hasValidConvertRequest(value: Awaited<ReturnType<typeof buildConvertQuotePayload>>) {
  return Number.isFinite(value.quoteId);
}

function hasValidSalesOrderId(value: unknown): value is { id: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'number' &&
    Number.isFinite((value as { id: number }).id) &&
    (value as { id: number }).id > 0
  );
}

export async function convertQuoteToSalesAction(
  _prevState: ConvertQuoteFormState,
  formData: FormData,
): Promise<ConvertQuoteFormState> {
  try {
    const request = await buildConvertQuotePayload(formData);
    const formalSession = readFormalConvertSession(formData);
    if (!hasValidConvertRequest(request)) {
      return { error: initialError };
    }

    const response = await fetch(
      `${getQuoteApiBaseUrl()}/quotes/${request.quoteId}/convert-to-sales`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(formalSession ? buildFormalRequestHeaders(formalSession) : {}),
          ...(formalSession ? buildSignedFormalRequestHeaders(formalSession) : {}),
        },
        body: JSON.stringify(request.payload),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    const result = (await response.json().catch(() => null)) as unknown;
    if (!hasValidSalesOrderId(result)) {
      return { error: initialError };
    }

    if (formalSession?.formalRedirect) {
      const params = new URLSearchParams({
        role: formalSession.role,
        user: formalSession.user,
      });
      redirect(`/app/sales/orders/${result.id}?${params.toString()}`);
    }

    redirect(`/sales-orders/${result.id}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { error: initialError };
  }
}
