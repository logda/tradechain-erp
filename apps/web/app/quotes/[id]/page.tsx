import Link from 'next/link';
import { ConvertQuoteForm } from './convert-quote-form';

type QuoteDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type QuoteDetail = {
  id: number;
  quoteNo: string;
  status: string;
  currentVersionNo: number;
  customerId: number;
  salesUserId: number;
  sourceCode: string;
  requirements: string;
  items?: Array<{
    lineNo: number;
    productId?: number;
    sku: string;
    productName: string;
    unit: string;
    quantity: number;
    salePrice: number;
    amount: number;
    confirmedSupplierId?: number;
    confirmedSupplierCode?: string;
    confirmedSupplierName?: string;
    confirmedPurchasePrice?: number;
    confirmedProductId?: number;
  }>;
};

function getQuoteApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function resolveSingleSearchParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' && rawValue.trim() ? rawValue.trim() : null;
}

function hasValidQuoteDetail(value: unknown): value is QuoteDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as QuoteDetail).id === 'number' &&
    typeof (value as QuoteDetail).quoteNo === 'string' &&
    typeof (value as QuoteDetail).status === 'string' &&
    typeof (value as QuoteDetail).currentVersionNo === 'number' &&
    typeof (value as QuoteDetail).customerId === 'number' &&
    typeof (value as QuoteDetail).salesUserId === 'number' &&
    typeof (value as QuoteDetail).sourceCode === 'string' &&
    typeof (value as QuoteDetail).requirements === 'string' &&
    (
      (value as QuoteDetail).items === undefined ||
      Array.isArray((value as QuoteDetail).items)
    )
  );
}

async function loadQuoteDetail(id: string) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${getQuoteApiBaseUrl()}/quotes/${id}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidQuoteDetail(result) ? result : null;
  } catch {
    return null;
  }
}

export default async function QuoteDetailPage({
  params,
  searchParams,
}: QuoteDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const fromInquiryId = resolveSingleSearchParam(resolvedSearchParams.fromInquiryId);
  const quote = await loadQuoteDetail(id);

  if (!quote) {
    return (
      <section>
        <h1>报价详情加载失败</h1>
        <p>请返回报价列表后重试。</p>
        <Link href="/quotes">返回报价列表</Link>
      </section>
    );
  }

  const isBossConfirmedQuote = quote.status === 'boss_confirmed';

  return (
    <section>
      <h1>{`报价单 ${quote.quoteNo}`}</h1>
      <p>{`状态：${quote.status}`}</p>
      <p>{`来源：${quote.sourceCode}`}</p>
      <p>{`需求：${quote.requirements}`}</p>
      {fromInquiryId ? (
        <Link href={`/app/sales/inquiries/${encodeURIComponent(fromInquiryId)}`}>
          返回询价单详情
        </Link>
      ) : null}
      {isBossConfirmedQuote ? (
        <ConvertQuoteForm
          quoteId={quote.id}
          quoteVersionNo={quote.currentVersionNo}
          customerId={quote.customerId}
          createdBy={quote.salesUserId}
          items={quote.items}
        />
      ) : (
        <p>当前为待确认状态：需等待老板确认后，才可转销售单或创建样品单。</p>
      )}
    </section>
  );
}
