import Link from 'next/link';
import { ConvertQuoteForm } from '../../../../quotes/[id]/convert-quote-form';
import { AppShell } from '../../../_components/app-shell';
import { AuditLogTable } from '../../../_components/audit-log-table';
import { ActionPermissionNote } from '../../../_components/action-permission-note';
import { ImagePreviewGallery } from '../../../_components/image-preview-gallery';
import { MutationActionForm } from '../../../_components/mutation-action-form';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../../../_lib/demo-session';
import {
  canUseFormalSalesOrderActions,
  canUseFormalQuoteActions,
  canUseFormalInquiryBossConfirmAction,
  canUseFormalSampleSubmitAction,
  canViewFormalQuoteDetail,
  getFormalDetailAccessDeniedLabel,
} from '../../../_lib/formal-access';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../../_lib/audit-log';
import { formatCounterpartyBilingualDisplay } from '../../../_lib/counterparty-display';
import { buildFormalRequestHeaders } from '../../../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../../../_lib/formal-request-signature';
import { loadActiveCounterpartyOptions } from '../../../_lib/counterparty-options';
import { loadActiveProductOptions } from '../../../_lib/product-options';
import { loadQuoteSourceOptions } from '../../../_lib/quote-source-options';
import { formatQuoteStatus } from '../../../_lib/quote-status';
import {
  loadSalesUserOptions,
  resolveDefaultSalesUserId,
} from '../../../_lib/sales-user-options';
import { CreateFormalQuoteForm } from '../new/create-formal-quote-form';
import { QuoteCustomerFeedbackForm } from './quote-customer-feedback-form';
import { QuotePriceConfirmForm } from './quote-price-confirm-form';

type SearchParams = Record<string, string | string[] | undefined>;

type AppQuoteDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<SearchParams>;
};

type QuoteDetail = {
  id: number;
  quoteNo: string;
  documentType?: 'demand' | 'quote';
  productSource?: 'existing' | 'candidate';
  status: string;
  currentVersionNo: number;
  customerId: number;
  customerName?: string;
  customerFullName?: string | null;
  customerCode?: string;
  customerEntryMode?: 'existing' | 'manual';
  salesUserId: number;
  salesUserName?: string;
  sourceCode: string;
  inquiryDate?: string;
  destination?: string;
  requirements: string;
  quoteAttachments?: Array<{
    key?: string;
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
  currentProgress?: string;
  linkedSalesOrderId?: number;
  linkedSalesOrderNo?: string;
  linkedInquiryId?: number;
  linkedInquiryNo?: string;
  linkedInquiryVersionNo?: number;
  sourceDemandId?: number;
  sourceDemandNo?: string;
  sourceDemandSnapshot?: {
    id: number;
    quoteNo: string;
    status: string;
    customerName?: string;
    requirements: string;
    sourceCode: string;
    createdAt?: string;
    quoteAttachments?: QuoteDetail['quoteAttachments'];
    items: NonNullable<QuoteDetail['items']>;
  };
  customerFeedbackResult?: 'accepted' | 'no_follow_up' | 'price_issue';
  customerFeedbackRemark?: string;
  customerFeedbackBy?: string;
  customerFeedbackAt?: string;
  customerFeedbackHistory?: Array<{
    versionNo: number;
    result: 'accepted' | 'no_follow_up' | 'price_issue';
    remark?: string;
    operatedBy: string;
    operatedAt: string;
  }>;
  versionHistory?: Array<{
    versionNo: number;
    status: string;
    confirmedAt?: string;
    confirmedBy?: string;
    sourceInquiryId?: number;
    items: Array<Record<string, unknown>>;
  }>;
  items?: Array<{
    lineNo: number;
    productId?: number;
    sku: string;
    productName: string;
    unit: string;
    quantity: number;
    targetPrice?: number;
    salePrice: number;
    amount: number;
    imageUrls?: string[];
    confirmedSalePrice?: number;
    confirmedSupplierId?: number;
    confirmedSupplierCode?: string;
    confirmedSupplierName?: string;
    confirmedPurchasePrice?: number;
    confirmedProductId?: number;
    samplingInfo?: string;
    cartonQuantity?: number;
    outerCartonSizeCm?: string;
    outerCartonGrossWeightKg?: number;
  }>;
};

type SourceQuoteSampleSummary = {
  quoteOrderId: number;
  totalSampleCount: number;
  activeSampleCount: number;
  latestSampleNo: string | null;
};

function getQuoteApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function encodeAccessScopes(accessScopes: ReturnType<typeof resolveDemoSession>['accessScopes']) {
  if (!accessScopes) {
    return undefined;
  }

  return encodeURIComponent(JSON.stringify(accessScopes));
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

function hasValidSourceQuoteSampleSummary(value: unknown): value is SourceQuoteSampleSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SourceQuoteSampleSummary).quoteOrderId === 'number' &&
    typeof (value as SourceQuoteSampleSummary).totalSampleCount === 'number' &&
    typeof (value as SourceQuoteSampleSummary).activeSampleCount === 'number' &&
    (
      (value as SourceQuoteSampleSummary).latestSampleNo === null ||
      typeof (value as SourceQuoteSampleSummary).latestSampleNo === 'string'
    )
  );
}

async function loadQuoteDetail(id: string, session: { role: string; user: string }) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${getQuoteApiBaseUrl()}/quotes/${id}`, {
      cache: 'no-store',
      headers: {
        ...buildFormalRequestHeaders(session),
        ...buildSignedFormalRequestHeaders(session),
      },
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

async function loadQuoteAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getQuoteApiBaseUrl()}/quotes/audit-logs`, {
      cache: 'no-store',
      headers: {
        ...buildFormalRequestHeaders(session),
        ...buildSignedFormalRequestHeaders(session),
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidAuditLogResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadSourceQuoteSampleSummary(
  id: string,
  session: { role: string; user: string },
) {
  const quoteOrderId = Number(id);
  if (!Number.isInteger(quoteOrderId) || quoteOrderId <= 0) {
    return null;
  }

  try {
    const response = await fetch(
      `${getQuoteApiBaseUrl()}/samples/source-quotes/${quoteOrderId}/summary`,
      {
        cache: 'no-store',
        headers: {
          ...buildFormalRequestHeaders(session),
          ...buildSignedFormalRequestHeaders(session),
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidSourceQuoteSampleSummary(result) ? result : null;
  } catch {
    return null;
  }
}

const actionBarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const backLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const detailLayoutStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const heroCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '20px',
  padding: '22px 24px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, #edf4fb 100%)',
  boxShadow: '0 18px 56px rgba(15, 23, 42, 0.08)',
} satisfies React.CSSProperties;

const heroEyebrowStyle = {
  margin: 0,
  fontSize: '12px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
} satisfies React.CSSProperties;

const heroTitleStyle = {
  margin: '10px 0 8px',
  fontSize: '32px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const heroSubStyle = {
  margin: 0,
  fontSize: '15px',
  color: '#475569',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
} satisfies React.CSSProperties;

const infoCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  padding: '18px',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 12px 36px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const labelStyle = {
  margin: 0,
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
} satisfies React.CSSProperties;

const valueStyle = {
  margin: '10px 0 0',
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const detailTextStyle = {
  margin: '10px 0 0',
  fontSize: '14px',
  color: '#334155',
  lineHeight: 1.8,
} satisfies React.CSSProperties;

const actionPanelStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  padding: '20px 22px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const actionGridStyle = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '860px',
} satisfies React.CSSProperties;

const tableWrapStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #d8e1ea',
  borderRadius: '6px',
} satisfies React.CSSProperties;

const headCellStyle = {
  textAlign: 'left' as const,
  fontSize: '12px',
  color: '#334155',
  background: '#eef3f8',
  borderBottom: '1px solid #cfd8e3',
  borderRight: '1px solid #d8e1ea',
  padding: '10px',
} satisfies React.CSSProperties;

const cellStyle = {
  padding: '12px 10px',
  borderBottom: '1px solid #e5ebf2',
  borderRight: '1px solid #e5ebf2',
  fontSize: '13px',
  color: '#0f172a',
} satisfies React.CSSProperties;

function renderQuoteItemImages(item: NonNullable<QuoteDetail['items']>[number]) {
  return (
    <ImagePreviewGallery
      productName={item.productName}
      imageUrls={item.imageUrls}
    />
  );
}

function isImageQuoteAttachment(
  attachment: NonNullable<QuoteDetail['quoteAttachments']>[number],
) {
  return (
    attachment.mimeType.startsWith('image/') ||
    /\.(avif|gif|jpe?g|png|webp)$/i.test(attachment.url)
  );
}

function renderQuoteAttachments(attachments: QuoteDetail['quoteAttachments']) {
  if (!attachments?.length) {
    return '-';
  }

  return (
    <div style={{ display: 'grid', gap: '8px', minWidth: '180px' }}>
      {attachments.map((attachment) => (
        <a
          key={`${attachment.url}-${attachment.fileName}`}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          style={{
            color: '#0f172a',
            textDecoration: 'none',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {isImageQuoteAttachment(attachment) ? (
            <img
              src={attachment.url}
              alt=""
              aria-hidden="true"
              style={{
                width: '42px',
                height: '32px',
                objectFit: 'cover',
                borderRadius: '4px',
                border: '1px solid #d8e1ea',
              }}
            />
          ) : null}
          <span>{attachment.fileName}</span>
        </a>
      ))}
    </div>
  );
}

function resolveQuoteDocumentLabel(documentType?: QuoteDetail['documentType']) {
  return documentType === 'demand' ? '需求单' : '报价单';
}

function resolveFeedbackLabel(result?: QuoteDetail['customerFeedbackResult']) {
  if (result === 'accepted') return 'accepted / 客户已接受';
  if (result === 'no_follow_up') return 'no_follow_up / 暂无后续';
  if (result === 'price_issue') return 'price_issue / 价格有问题';
  return 'pending / 待反馈';
}

function formatOperationTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

export default async function AppQuoteDetailPage({
  params,
  searchParams,
}: AppQuoteDetailPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  if (!canViewFormalModule(session, 'sales')) {
    return (
      <AppShell
        title="正式需求和报价详情"
        subtitle="正式工作台下查看需求和报价详情。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link href="/app/sales/quotes" style={backLinkStyle}>
            返回正式需求和报价列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>{getFormalDetailAccessDeniedLabel('quote')}</h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张单据。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const { id } = await params;
  const [quote, auditLogs, sampleSummary] = await Promise.all([
    loadQuoteDetail(id, session),
    loadQuoteAuditLogs(session),
    loadSourceQuoteSampleSummary(id, session),
  ]);
  const isDraftQuote = quote?.status === 'draft';
  const isLegacyBossConfirmedQuote = quote?.status === 'boss_confirmed';
  const isApprovedDemand =
    quote?.documentType === 'demand' && quote.status === 'boss_approved';
  const isAcceptedQuote =
    quote?.documentType === 'quote' && quote.status === 'customer_accepted';
  const isConvertible =
    !quote?.linkedSalesOrderId &&
    (isApprovedDemand || isAcceptedQuote || isLegacyBossConfirmedQuote);
  const canUseQuoteActions = canUseFormalQuoteActions(session);
  const canUseBossActions = canUseFormalInquiryBossConfirmAction(session);
  const canRecordCustomerFeedback =
    canUseQuoteActions || (session.role === 'boss' && canUseBossActions);
  const canConvertToSalesOrder = canUseFormalSalesOrderActions(session) ||
    (session.role === 'boss' && canUseBossActions);
  const canCreateSampleOrder = canUseFormalSampleSubmitAction(session);
  const actionRequestHeaders = buildFormalRequestHeaders(session);
  const access = encodeAccessScopes(session.accessScopes);
  const existingSampleCount = sampleSummary?.totalSampleCount ?? 0;
  const sampleCreateConfirmMessage =
    existingSampleCount > 0
      ? `该单据已存在 ${existingSampleCount} 张样品单，确认继续创建新的样品单？`
      : undefined;
  const draftEditData = isDraftQuote && quote && canUseQuoteActions
    ? await Promise.all([
        loadActiveCounterpartyOptions('customer', session),
        loadActiveProductOptions(session),
        loadSalesUserOptions(session),
        loadQuoteSourceOptions(session),
      ])
    : null;

  if (!quote) {
    return (
      <AppShell
        title="正式需求和报价详情"
        subtitle="正式工作台下查看需求和报价详情。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link
            href="/app/sales/quotes"
            style={backLinkStyle}
          >
            返回正式需求和报价列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>单据详情加载失败</h3>
            <p style={heroSubStyle}>请返回正式需求和报价列表后重试。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!canViewFormalQuoteDetail(session, quote)) {
    return (
      <AppShell
        title="正式需求和报价详情"
        subtitle="正式工作台下查看需求和报价详情。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link href="/app/sales/quotes" style={backLinkStyle}>
            返回正式需求和报价列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>{getFormalDetailAccessDeniedLabel('quote')}</h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张单据。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const hideSalePrice = quote.documentType === 'demand' && quote.productSource === 'candidate';

  return (
    <AppShell
      title="正式需求和报价详情"
      subtitle="展示单据状态、来源与版本信息，并保留对应转单动作。"
      session={session}
    >
      <section style={detailLayoutStyle}>
        <div style={actionBarStyle}>
          <Link
            href="/app/sales/quotes"
            style={backLinkStyle}
          >
            返回正式需求和报价列表
          </Link>
          <Link href="/app" style={backLinkStyle}>
            返回正式首页
          </Link>
          <Link href="/app/sales" style={backLinkStyle}>
            返回销售中心
          </Link>
        </div>

        <article style={heroCardStyle}>
          <p style={heroEyebrowStyle}>Quote Detail / 单据详情</p>
          <h3 style={heroTitleStyle}>{`${resolveQuoteDocumentLabel(quote.documentType)} ${quote.quoteNo}`}</h3>
          <p style={heroSubStyle}>
            正式页承接需求单与报价单的关键追踪信息，便于审批、转单与追溯。
          </p>
        </article>

        <div style={gridStyle}>
          <article style={infoCardStyle}>
            <p style={labelStyle}>当前进度 Current Status</p>
            <p style={valueStyle}>{formatQuoteStatus(quote.status)}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>来源 Source</p>
            <p style={valueStyle}>{quote.sourceCode}</p>
          </article>
          {quote.linkedSalesOrderId ? (
            <article style={infoCardStyle}>
              <p style={labelStyle}>关联销售单 Sales Order</p>
              <p style={valueStyle}>
                <Link href={`/app/sales/orders/${quote.linkedSalesOrderId}`} style={backLinkStyle}>
                  {quote.linkedSalesOrderNo ?? `销售单 #${quote.linkedSalesOrderId}`}
                </Link>
              </p>
            </article>
          ) : null}
          {quote.linkedInquiryId && session.role !== 'sales' && session.role !== 'sales_manager' ? (
            <article style={infoCardStyle}>
              <p style={labelStyle}>关联询价单 Inquiry</p>
              <p style={valueStyle}>
                <Link href={`/app/sales/inquiries/${quote.linkedInquiryId}`} style={backLinkStyle}>
                  {quote.linkedInquiryNo ?? `询价单 #${quote.linkedInquiryId}`}
                </Link>
              </p>
            </article>
          ) : null}
          {quote.sourceDemandId ? (
            <article style={infoCardStyle}>
              <p style={labelStyle}>来源需求单 Source Demand</p>
              <p style={valueStyle}>
                <Link href={`/app/sales/quotes/${quote.sourceDemandId}`} style={backLinkStyle}>
                  {quote.sourceDemandNo ?? `需求单 #${quote.sourceDemandId}`}
                </Link>
              </p>
            </article>
          ) : null}
          <article style={infoCardStyle}>
            <p style={labelStyle}>客户 Customer</p>
            <p style={valueStyle}>
              {formatCounterpartyBilingualDisplay(quote.customerName ?? quote.customerId, {
                code: quote.customerCode,
                fullName: quote.customerFullName,
              })}
            </p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>客户编码 Customer Code</p>
            <p style={valueStyle}>{quote.customerCode || '-'}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>询单日期 Inquiry Date</p>
            <p style={valueStyle}>{quote.inquiryDate || '-'}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>目的地 Destination</p>
            <p style={valueStyle}>{quote.destination || '-'}</p>
          </article>
        </div>

        <article style={infoCardStyle}>
          <p style={labelStyle}>需求 Requirements</p>
          <p style={detailTextStyle}>{quote.requirements}</p>
        </article>

        <article style={infoCardStyle}>
          <p style={labelStyle}>
            {quote.documentType === 'demand' ? '附件 Attachments' : '报价附件 Quote Attachments'}
          </p>
          <div style={detailTextStyle}>
            {renderQuoteAttachments(quote.quoteAttachments)}
          </div>
        </article>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>
            {quote.documentType === 'demand' ? '需求明细' : '报价明细'}
          </h3>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>行号 Line</th>
                  <th style={headCellStyle}>SKU</th>
                  <th style={headCellStyle}>商品 Product</th>
                  <th style={headCellStyle}>数量 Qty</th>
                  <th style={headCellStyle}>单位 Unit</th>
                  <th style={headCellStyle}>目标价 Target</th>
                  {hideSalePrice ? null : <th style={headCellStyle}>销售单价 Sale Price</th>}
                  <th style={headCellStyle}>图片 PIC</th>
                  {hideSalePrice ? null : <th style={headCellStyle}>金额 Amount</th>}
                </tr>
              </thead>
              <tbody>
                {(quote.items ?? []).map((item) => (
                  <tr key={`${item.lineNo}-${item.sku}`}>
                    <td style={cellStyle}>{item.lineNo}</td>
                    <td style={cellStyle}>{item.sku}</td>
                    <td style={cellStyle}>
                      {item.productName}
                      {item.samplingInfo ? (
                        <p style={{ ...detailTextStyle, margin: '4px 0 0' }}>
                          打样信息：<span>{item.samplingInfo}</span>
                        </p>
                      ) : null}
                    </td>
                    <td style={cellStyle}>{item.quantity}</td>
                    <td style={cellStyle}>{item.unit}</td>
                    <td style={cellStyle}>{item.targetPrice ?? 0}</td>
                    {hideSalePrice ? null : <td style={cellStyle}>{item.salePrice}</td>}
                    <td style={cellStyle}>{renderQuoteItemImages(item)}</td>
                    {hideSalePrice ? null : <td style={cellStyle}>{item.amount}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {quote.documentType === 'demand' ? (
          <article style={infoCardStyle}>
            <p style={labelStyle}>版本 Version</p>
            <p style={valueStyle}>V{quote.currentVersionNo}</p>
          </article>
        ) : null}

        {quote.documentType === 'quote' && quote.status === 'pending_boss_price_confirmation' ? (
          <article style={actionPanelStyle}>
            <h2 style={{ marginTop: 0 }}>老板确认报价售价</h2>
            <ActionPermissionNote>
              老板确认最终销售价格后，报价单进入销售记录客户反馈环节。
            </ActionPermissionNote>
            {quote.status === 'pending_boss_price_confirmation' && canUseBossActions ? (
              <QuotePriceConfirmForm
                endpoint={`${getQuoteApiBaseUrl()}/quotes/${quote.id}/confirm-price`}
                currentVersionNo={quote.currentVersionNo}
                requestHeaders={actionRequestHeaders}
                items={quote.items ?? []}
              />
            ) : (
              <p style={detailTextStyle}>
                {quote.status === 'pending_boss_price_confirmation'
                  ? '当前账号仅可查看，等待老板确认最终售价。'
                  : `当前状态：${formatQuoteStatus(quote.status)}`}
              </p>
            )}
          </article>
        ) : null}

        {quote.documentType === 'quote' ? (
          <article style={actionPanelStyle}>
            <h2 style={{ marginTop: 0 }}>销售记录客户反馈</h2>
            <div style={gridStyle}>
              <div>
                <p style={labelStyle}>当前报价版本</p>
                <p style={valueStyle}>V{quote.currentVersionNo}</p>
              </div>
              <div>
                <p style={labelStyle}>客户反馈状态</p>
                <p style={valueStyle}>{resolveFeedbackLabel(quote.customerFeedbackResult)}</p>
              </div>
              <div>
                <p style={labelStyle}>记录人 / 时间</p>
                <p style={detailTextStyle}>
                  {quote.customerFeedbackBy || '-'} / {formatOperationTime(quote.customerFeedbackAt)}
                </p>
              </div>
            </div>
            {quote.customerFeedbackRemark ? (
              <p style={detailTextStyle}>当前备注：{quote.customerFeedbackRemark}</p>
            ) : null}
            {(quote.status === 'pending_customer_feedback' ||
              quote.status === 'customer_no_follow_up') &&
            canRecordCustomerFeedback ? (
              <QuoteCustomerFeedbackForm
                endpoint={`${getQuoteApiBaseUrl()}/quotes/${quote.id}/customer-feedback`}
                currentVersionNo={quote.currentVersionNo}
                requestHeaders={actionRequestHeaders}
              />
            ) : quote.status === 'repricing_in_progress' ? (
              <p style={detailTextStyle}>
                客户反馈价格有问题，采购正在重新询价。完成后仍回到本报价单并升级版本。
              </p>
            ) : quote.status === 'customer_accepted' ? (
              <p style={detailTextStyle}>客户已接受当前版本报价，可以转为销售单。</p>
            ) : (
              <p style={detailTextStyle}>老板确认最终售价后，销售可在此记录客户反馈。</p>
            )}

            {(quote.versionHistory?.length ?? 0) > 0 ? (
              <div style={{ marginTop: '16px' }}>
                <h3>报价版本历史</h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {quote.versionHistory?.map((version) => (
                    <div key={`${version.versionNo}-${version.confirmedAt ?? version.status}`} style={infoCardStyle}>
                      <strong>V{version.versionNo}</strong>
                      <p style={detailTextStyle}>
                        {formatQuoteStatus(version.status)} · {version.confirmedBy || '-'} ·{' '}
                        {formatOperationTime(version.confirmedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {(quote.customerFeedbackHistory?.length ?? 0) > 0 ? (
              <div style={{ marginTop: '16px' }}>
                <h3>客户反馈历史</h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {quote.customerFeedbackHistory?.map((feedback, index) => (
                    <div key={`${feedback.versionNo}-${feedback.operatedAt}-${index}`} style={infoCardStyle}>
                      <strong>V{feedback.versionNo} · {resolveFeedbackLabel(feedback.result)}</strong>
                      <p style={detailTextStyle}>
                        {feedback.operatedBy} · {formatOperationTime(feedback.operatedAt)}
                        {feedback.remark ? ` · ${feedback.remark}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ) : null}

        <article style={actionPanelStyle}>
          <h2 style={{ marginTop: 0 }}>
            {quote.documentType === 'demand' ? '需求单操作' : '报价单操作'}
          </h2>
          <ActionPermissionNote>
            {quote.documentType === 'demand' && quote.linkedSalesOrderId
              ? '需求单已转为销售单，可前往销售单继续查看和处理。'
              : quote.documentType === 'quote' && quote.linkedSalesOrderId
                ? '报价单已转为销售单，可前往销售单继续查看和处理。'
              : quote.documentType === 'demand' && quote.status === 'pending_boss_approval'
                ? canUseBossActions
                  ? '老板只审批需求是否通过，不在这里填写或修改销售价格。'
                  : '当前账号仅可查看，等待老板审批。'
              : isConvertible
              ? quote.documentType === 'demand'
                ? '需求单已通过老板审批，可以转为销售单。'
                : '客户已接受报价，可以转为销售单并创建样品单。'
              : isDraftQuote
                ? quote.documentType === 'demand'
                  ? '当前为需求单草稿：产品库产品提交后等待老板审批；手填新品提交后进入采购询价。'
                  : '当前为报价单草稿：提交后等待老板确认最终售价，不生成首次采购询价。'
                : quote.documentType === 'demand'
                  ? '需求单尚未满足转销售单条件，请按当前流程状态继续处理。'
                  : quote.status === 'pending_customer_feedback'
                    ? '老板已确认售价，等待销售记录客户反馈。'
                  : '报价单尚未满足转销售单条件：必须先由老板确认售价，再由销售记录客户接受。'}
          </ActionPermissionNote>
          {quote.documentType === 'demand' &&
          quote.productSource !== 'candidate' &&
          quote.status === 'pending_boss_approval' &&
          canUseBossActions ? (
            <MutationActionForm
              endpoint={`${getQuoteApiBaseUrl()}/quotes/${quote.id}/approve-demand`}
              label="审批通过"
              successLabel="需求单审批通过"
              requiredAction="boss.confirm"
              requiredActionLabel="老板审批"
              requestHeaders={actionRequestHeaders}
              fields={[]}
            />
          ) : null}
          {isDraftQuote && draftEditData ? (
            <CreateFormalQuoteForm
              customerOptions={draftEditData[0]}
              productOptions={draftEditData[1]}
              salesUsers={draftEditData[2]}
              sourceOptions={draftEditData[3]}
              defaultSalesUserId={resolveDefaultSalesUserId(session, draftEditData[2])}
              role={session.role}
              user={session.user}
              access={access}
              initialQuote={{
                ...quote,
                customerEntryMode:
                  quote.customerEntryMode === 'manual' || !quote.customerId
                    ? 'manual'
                    : 'existing',
              }}
            />
          ) : (
            <div style={actionGridStyle}>
            {isConvertible && canConvertToSalesOrder ? (
            <ConvertQuoteForm
              quoteId={quote.id}
              quoteNo={quote.quoteNo}
              quoteVersionNo={quote.currentVersionNo}
              customerId={quote.customerId}
              customerName={quote.customerName}
              customerFullName={quote.customerFullName}
              customerCode={quote.customerCode}
              customerEntryMode={quote.customerEntryMode}
              sourceCode={quote.sourceCode}
              inquiryDate={quote.inquiryDate}
              destination={quote.destination}
              requirements={quote.requirements}
              createdBy={quote.salesUserId}
              items={quote.items}
              quoteAttachments={quote.quoteAttachments}
              access={access}
              role={session.role}
              user={session.user}
            />
            ) : null}
            {(isAcceptedQuote || isLegacyBossConfirmedQuote) && canCreateSampleOrder ? (
              <MutationActionForm
                endpoint={`${getQuoteApiBaseUrl()}/samples`}
                label="创建样品单"
                successLabel="已创建样品单草稿"
                successRedirectBasePath="/app/sales/samples"
                confirmMessage={sampleCreateConfirmMessage}
                requiredAction="sales.sample.submit"
                requiredActionLabel="样品提交"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'quoteOrderId',
                    value: quote.id,
                    dataType: 'number',
                  },
                  {
                    name: 'quoteVersionNo',
                    value: quote.currentVersionNo,
                    dataType: 'number',
                  },
                  {
                    name: 'customerId',
                    value: quote.customerId,
                    dataType: 'number',
                  },
                  {
                    name: 'createdBy',
                    value: quote.salesUserId,
                    dataType: 'number',
                  },
                  {
                    name: 'sampleRequirements',
                    value: quote.requirements,
                  },
                  {
                    name: 'samplingCost',
                    value: 0,
                    dataType: 'number',
                  },
                  {
                    name: 'quoteConfirmed',
                    value: true,
                    dataType: 'boolean',
                  },
                ]}
              />
            ) : null}
            </div>
          )}
        </article>

        {quote.documentType === 'quote' && quote.sourceDemandSnapshot ? (
          <article style={infoCardStyle}>
            <h2 style={{ marginTop: 0 }}>需求单信息</h2>
            <p style={detailTextStyle}>
              <strong>{quote.sourceDemandSnapshot.quoteNo}</strong> · {quote.sourceDemandSnapshot.customerName || '-'} · {quote.sourceDemandSnapshot.sourceCode || '-'}
            </p>
            <p style={detailTextStyle}>{quote.sourceDemandSnapshot.requirements}</p>
            <div style={{ ...tableWrapStyle, marginTop: '12px' }}>
              <table style={tableStyle}>
                <thead><tr>
                  <th style={headCellStyle}>行号</th><th style={headCellStyle}>商品</th>
                  <th style={headCellStyle}>数量</th><th style={headCellStyle}>目标价</th>
                  <th style={headCellStyle}>图片</th>
                </tr></thead>
                <tbody>{quote.sourceDemandSnapshot.items.map((item) => (
                  <tr key={`source-demand-${item.lineNo}`}>
                    <td style={cellStyle}>{item.lineNo}</td>
                    <td style={cellStyle}>{item.productName}</td>
                    <td style={cellStyle}>{item.quantity} {item.unit}</td>
                    <td style={cellStyle}>{item.targetPrice ?? '-'}</td>
                    <td style={cellStyle}>{renderQuoteItemImages(item)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {quote.sourceDemandSnapshot.quoteAttachments?.length ? (
              <div style={{ ...detailTextStyle, marginTop: '12px' }}>
                来源附件：{renderQuoteAttachments(quote.sourceDemandSnapshot.quoteAttachments)}
              </div>
            ) : null}
          </article>
        ) : null}

        <AuditLogTable session={session} items={auditLogs?.items ?? []} />
      </section>
    </AppShell>
  );
}
