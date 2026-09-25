import Link from 'next/link';
import { AppShell } from '../../../_components/app-shell';
import { AuditLogTable } from '../../../_components/audit-log-table';
import { ActionPermissionNote } from '../../../_components/action-permission-note';
import { ImagePreviewGallery } from '../../../_components/image-preview-gallery';
import { MutationActionForm } from '../../../_components/mutation-action-form';
import { canViewFormalModule, resolveDemoSession } from '../../../_lib/demo-session';
import {
  canUseFormalInquiryBossConfirmAction,
  canUseFormalInquirySubmitAction,
} from '../../../_lib/formal-access';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../../_lib/audit-log';
import {
  formatCounterpartyBilingualDisplay,
  formatCounterpartyChineseDisplay,
} from '../../../_lib/counterparty-display';
import { buildFormalRequestHeaders } from '../../../_lib/formal-request-headers';
import { loadActiveCounterpartyOptions } from '../../../_lib/counterparty-options';
import { getInquiryPreviewById } from '../inquiry-preview';
import { InquiryBossConfirmForm } from './inquiry-boss-confirm-form';
import { InquiryComparisonSubmitForm } from './inquiry-comparison-submit-form';
import { buildFormalApiRequestHeaders } from '../../../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;
type InquiryDetail = {
  id: number;
  inquiryNo: string;
  status: string;
  quoteOrderId: number;
  quoteOrderNo: string;
  quoteVersionNo: number;
  customerName: string;
  customerFullName?: string | null;
  createdBy: string;
  supplierCount: number;
  comparisonSummary: string;
  createdAt: string;
  detailHref: string;
  items: Array<{
    itemId: number;
    lineNo: number;
    productId?: number;
    sku: string;
    productName: string;
    productCategory?: string;
    unit?: string;
    imageUrls?: string[];
    requiredSupplierCount: number;
    supplierQuotes: Array<{
      supplierSourceMode: 'counterparty' | 'manual';
      supplierId?: number;
      supplierCode?: string;
      supplierName: string;
      purchasePrice: number;
      productId?: number;
      productSku?: string;
      productStatus?: 'active' | 'inactive' | 'deleted';
      productSizeCm?: string;
      productMaterial?: string;
      productPackaging?: string;
      productWeightG?: number;
      bulkLeadTimeDays?: string;
      cartonQuantity?: number;
      outerCartonSizeCm?: string;
      outerCartonGrossWeightKg?: number;
      samplingInfo?: string;
      remark?: string;
    }>;
    confirmedSalePrice: number;
    confirmedSupplierQuoteIndex?: number;
    confirmedSupplierCode?: string;
    confirmedSupplierName?: string;
    confirmedPurchasePrice?: number;
    confirmedProductId?: number;
  }>;
};

type SourceQuoteDetail = {
  id: number;
  quoteNo: string;
  documentType?: 'demand' | 'quote';
  productSource?: 'candidate' | 'existing';
  status: string;
  currentVersionNo: number;
  customerId: number;
  customerName?: string;
  customerFullName?: string | null;
  customerCode?: string;
  salesUserId: number;
  sourceCode: string;
  requirements: string;
  items?: Array<{
    lineNo: number;
    sku: string;
    productName: string;
    imageUrls?: string[];
    quantity: number;
    unit: string;
    targetPrice?: number;
    salePrice: number;
    amount: number;
  }>;
};

function getInquiryApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidInquiryDetail(value: unknown): value is InquiryDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as InquiryDetail).id === 'number' &&
    typeof (value as InquiryDetail).inquiryNo === 'string' &&
    typeof (value as InquiryDetail).status === 'string' &&
    typeof (value as InquiryDetail).quoteOrderId === 'number' &&
    typeof (value as InquiryDetail).quoteOrderNo === 'string' &&
    typeof (value as InquiryDetail).quoteVersionNo === 'number' &&
    typeof (value as InquiryDetail).customerName === 'string' &&
    typeof (value as InquiryDetail).createdBy === 'string' &&
    typeof (value as InquiryDetail).supplierCount === 'number' &&
    typeof (value as InquiryDetail).comparisonSummary === 'string' &&
    typeof (value as InquiryDetail).createdAt === 'string' &&
    typeof (value as InquiryDetail).detailHref === 'string' &&
    Array.isArray((value as InquiryDetail).items)
  );
}

function hasValidSourceQuoteDetail(value: unknown): value is SourceQuoteDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SourceQuoteDetail).id === 'number' &&
    typeof (value as SourceQuoteDetail).quoteNo === 'string' &&
    typeof (value as SourceQuoteDetail).status === 'string' &&
    typeof (value as SourceQuoteDetail).currentVersionNo === 'number' &&
    typeof (value as SourceQuoteDetail).customerId === 'number' &&
    typeof (value as SourceQuoteDetail).salesUserId === 'number' &&
    typeof (value as SourceQuoteDetail).sourceCode === 'string' &&
    typeof (value as SourceQuoteDetail).requirements === 'string' &&
    (
      (value as SourceQuoteDetail).items === undefined ||
      Array.isArray((value as SourceQuoteDetail).items)
    )
  );
}

async function loadInquiryDetail(id: string, session: { role: string; user: string }) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${getInquiryApiBaseUrl()}/quote-inquiries/${id}`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return getInquiryPreviewById(id);
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidInquiryDetail(result) ? result : getInquiryPreviewById(id);
  } catch {
    return getInquiryPreviewById(id);
  }
}

async function loadSourceQuoteDetail(
  quoteId: number,
  session: { role: string; user: string },
) {
  try {
    const response = await fetch(`${getInquiryApiBaseUrl()}/quotes/${quoteId}`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidSourceQuoteDetail(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadInquiryAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getInquiryApiBaseUrl()}/quote-inquiries/audit-logs`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
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

const detailLayoutStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const toolbarStyle = {
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

const heroCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '20px',
  padding: '22px 24px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, #edf4fb 100%)',
  boxShadow: '0 18px 56px rgba(15, 23, 42, 0.08)',
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  alignItems: 'start',
} satisfies React.CSSProperties;

const quoteOverviewStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  padding: '20px 22px',
  background: 'linear-gradient(135deg, #ffffff 0%, #f6f9fc 100%)',
  boxShadow: '0 14px 36px rgba(15, 23, 42, 0.06)',
} satisfies React.CSSProperties;

const quoteOverviewHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'flex-start',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const quoteOverviewMetaStyle = {
  display: 'grid',
  gap: '10px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  marginTop: '16px',
} satisfies React.CSSProperties;

const compactTableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '760px',
} satisfies React.CSSProperties;

const subtleBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  border: '1px solid #d8e1ea',
  borderRadius: '999px',
  padding: '7px 12px',
  background: '#ffffff',
  color: '#334155',
  fontSize: '13px',
  fontWeight: 700,
  textDecoration: 'none',
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '920px',
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

function renderInquiryItemImages(item: InquiryDetail['items'][number]) {
  return (
    <ImagePreviewGallery
      productName={item.productName}
      imageUrls={item.imageUrls}
    />
  );
}

function renderSourceQuoteItemImages(item: NonNullable<SourceQuoteDetail['items']>[number]) {
  return (
    <ImagePreviewGallery
      productName={item.productName}
      imageUrls={item.imageUrls}
    />
  );
}

function getInquiryStatusLabel(status: string) {
  if (status === 'pending_inquiry') return '待询价';
  if (status === 'pending_boss_review') return '待老板确认';
  if (status === 'boss_confirmed') return '老板已确认';
  return status;
}

function getInquiryStatusActionLabel(status: string) {
  if (status === 'pending_inquiry') return '提交比价';
  if (status === 'pending_boss_review') return '再次提交比价';
  return '再次提交比价';
}

function getBossConfirmLabel(status: string) {
  if (status === 'boss_confirmed') return '重新老板确认';
  return '老板确认';
}

function formatSupplierQuoteDisplay(
  supplierQuote: InquiryDetail['items'][number]['supplierQuotes'][number],
) {
  const supplierLabel = supplierQuote.supplierCode
    ? `${supplierQuote.supplierCode} / ${formatCounterpartyChineseDisplay(supplierQuote.supplierName, {
        code: supplierQuote.supplierCode,
      })}`
    : formatCounterpartyChineseDisplay(supplierQuote.supplierName);

  return `${supplierLabel} - ${supplierQuote.purchasePrice}`;
}

function renderSupplierQuoteDetails(
  supplierQuote: InquiryDetail['items'][number]['supplierQuotes'][number],
) {
  return (
    <span style={{ display: 'grid', gap: '3px', color: '#475569', fontSize: '12px' }}>
      <span>
        尺寸：{supplierQuote.productSizeCm || '-'} cm；材质：
        {supplierQuote.productMaterial || '-'}；包装：{supplierQuote.productPackaging || '-'}
      </span>
      <span>
        产品重量：{supplierQuote.productWeightG ?? '-'} g；大货交期：
        {supplierQuote.bulkLeadTimeDays || '-'} 天；装箱数：
        {supplierQuote.cartonQuantity ?? '-'} 个
      </span>
      <span>
        外箱尺寸：{supplierQuote.outerCartonSizeCm || '-'} cm；外箱毛重：
        {supplierQuote.outerCartonGrossWeightKg ?? '-'} kg
      </span>
      <span>备注：{supplierQuote.remark || '-'}</span>
      <span>打样信息：{supplierQuote.samplingInfo || '-'}</span>
    </span>
  );
}

function formatConfirmedSupplier(item: InquiryDetail['items'][number]) {
  if (!item.confirmedSupplierName) {
    return '-';
  }

  const supplierLabel = item.confirmedSupplierCode
    ? `${item.confirmedSupplierCode} / ${formatCounterpartyChineseDisplay(item.confirmedSupplierName, {
        code: item.confirmedSupplierCode,
      })}`
    : formatCounterpartyChineseDisplay(item.confirmedSupplierName);

  return `${supplierLabel} / 采购价 ${item.confirmedPurchasePrice ?? '-'}`;
}

function buildQuoteFromInquiryHref(quoteId: number, inquiryId: number) {
  return `/app/sales/quotes/${quoteId}?fromInquiryId=${inquiryId}`;
}

function isDemandSource(quoteNo: string, documentType?: SourceQuoteDetail['documentType']) {
  return documentType === 'demand' || (!documentType && quoteNo.startsWith('XQ'));
}

function renderSourceQuoteOverview(quote: SourceQuoteDetail, inquiryId: number) {
  const isDemand = isDemandSource(quote.quoteNo, quote.documentType);
  return (
    <section style={quoteOverviewStyle}>
      <div style={quoteOverviewHeaderStyle}>
        <div>
          <p style={labelStyle}>{isDemand ? '来源需求概览 Demand Overview' : '来源报价概览 Quote Overview'}</p>
          <h2 style={{ margin: '8px 0 0', color: '#0f172a' }}>
            {isDemand ? '需求单' : '报价单'} {quote.quoteNo}
          </h2>
        </div>
        {!isDemand ? (
          <Link href={buildQuoteFromInquiryHref(quote.id, inquiryId)} style={subtleBadgeStyle}>
            打开完整报价单
          </Link>
        ) : null}
      </div>

      <div style={quoteOverviewMetaStyle}>
        <article style={infoCardStyle}>
          <p style={labelStyle}>客户 Customer</p>
          <p style={valueStyle}>
            客户：
            {formatCounterpartyBilingualDisplay(quote.customerName ?? quote.customerId, {
              code: quote.customerCode,
              fullName: quote.customerFullName,
            })}
          </p>
          <p style={detailTextStyle}>客户编码：{quote.customerCode || '-'}</p>
        </article>
        <article style={infoCardStyle}>
          <p style={labelStyle}>{isDemand ? '需求版本 Version' : '报价版本 Version'}</p>
          <p style={valueStyle}>V{quote.currentVersionNo}</p>
          <p style={detailTextStyle}>来源：{quote.sourceCode || '-'}</p>
        </article>
      </div>

      <div style={{ ...tableWrapStyle, marginTop: '16px' }}>
        <table style={compactTableStyle}>
          <thead>
            <tr>
              <th style={headCellStyle}>行号</th>
              <th style={headCellStyle}>商品</th>
              <th style={headCellStyle}>图片</th>
              <th style={headCellStyle}>数量</th>
              <th style={headCellStyle}>目标价</th>
              <th style={headCellStyle}>客户价 / 销售单价</th>
              <th style={headCellStyle}>金额</th>
            </tr>
          </thead>
          <tbody>
            {(quote.items ?? []).map((item) => (
              <tr key={`${item.lineNo}-${item.sku}`}>
                <td style={cellStyle}>{item.lineNo}</td>
                <td style={cellStyle}>
                  <strong>{item.productName}</strong>
                  {quote.productSource !== 'candidate' && item.sku.trim() ? (
                    <p style={{ ...detailTextStyle, marginTop: '4px' }}>{item.sku}</p>
                  ) : null}
                </td>
                <td style={cellStyle}>
                  {renderSourceQuoteItemImages(item)}
                </td>
                <td style={cellStyle}>
                  {item.quantity} {item.unit}
                </td>
                <td style={cellStyle}>{item.targetPrice ?? 0}</td>
                <td style={cellStyle}>{item.salePrice}</td>
                <td style={cellStyle}>{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function canViewFormalInquiryDetail(
  session: { role: string; user: string },
  inquiry: { createdBy: string },
) {
  if (
    session.role === 'admin' ||
    session.role === 'boss' ||
    session.role === 'purchase_manager' ||
    session.role === 'purchase'
  ) {
    return true;
  }

  return false;
}

export default async function AppFormalInquiryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const { id } = await params;
  const inquiry = await loadInquiryDetail(id, session);
  const canSubmitInquiry = canUseFormalInquirySubmitAction(session);
  const canBossConfirmInquiry = canUseFormalInquiryBossConfirmAction(session);
  const actionRequestHeaders = buildFormalRequestHeaders(session);
  const supplierOptions = canSubmitInquiry
    ? await loadActiveCounterpartyOptions('supplier', session)
    : [];

  if (!inquiry) {
    return (
      <AppShell
        title="正式询价详情"
        subtitle="正式工作台下查看询价详情。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link href="/app/sales/inquiries" style={backLinkStyle}>
            返回正式询价列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>询价详情加载失败</h3>
            <p style={heroSubStyle}>请返回正式询价列表后重试。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!canViewFormalInquiryDetail(session, inquiry)) {
    return (
      <AppShell
        title="正式询价详情"
        subtitle="正式工作台下查看询价详情。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link href="/app/sales/inquiries" style={backLinkStyle}>
            返回正式询价列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>无权限访问正式询价单</h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张询价单。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const auditLogs = await loadInquiryAuditLogs(session);
  const sourceQuote = canBossConfirmInquiry
    ? await loadSourceQuoteDetail(inquiry.quoteOrderId, session)
    : null;
  const canSubmitComparison =
    canSubmitInquiry && inquiry.status === 'pending_inquiry';
  const canConfirmFinalPrice =
    canBossConfirmInquiry && inquiry.status === 'pending_boss_review';
  const hasAvailableActions = canSubmitComparison || canConfirmFinalPrice;
  const sourceIsDemand = isDemandSource(inquiry.quoteOrderNo, sourceQuote?.documentType);

  return (
    <AppShell
      title="正式询价详情"
      subtitle="正式询价页承接供应商比价、老板确认与报价版本回写。"
      session={session}
    >
      <section style={detailLayoutStyle}>
        <div style={toolbarStyle}>
          <Link href="/app/sales/inquiries" style={backLinkStyle}>
            返回正式询价列表
          </Link>
          <Link href="/app" style={backLinkStyle}>
            返回正式首页
          </Link>
          {canViewFormalModule(session, 'sales') ? (
            <Link href="/app/sales" style={backLinkStyle}>
              返回销售中心
            </Link>
          ) : null}
          {canBossConfirmInquiry && !sourceIsDemand ? (
            <Link
              href={buildQuoteFromInquiryHref(inquiry.quoteOrderId, inquiry.id)}
              style={backLinkStyle}
            >
              打开源报价详情
            </Link>
          ) : null}
        </div>

        <article style={heroCardStyle}>
          <p style={{ margin: 0, fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b' }}>
            Inquiry Detail
          </p>
          <h3 style={heroTitleStyle}>询价单 {inquiry.inquiryNo}</h3>
          <p style={heroSubStyle}>{inquiry.comparisonSummary}</p>
        </article>

        <section style={gridStyle}>
          <article style={infoCardStyle}>
            <p style={labelStyle}>{sourceIsDemand ? '来源需求 Source Demand' : '来源报价 Source Quote'}</p>
            <p style={valueStyle}>{inquiry.quoteOrderNo}</p>
            <p style={detailTextStyle}>{sourceIsDemand ? '需求版本' : '报价版本'}：V{inquiry.quoteVersionNo}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>当前状态 Status</p>
            <p style={valueStyle}>{getInquiryStatusLabel(inquiry.status)}</p>
            <p style={detailTextStyle}>供应商数：{inquiry.supplierCount}</p>
          </article>
        </section>

        {sourceQuote ? renderSourceQuoteOverview(sourceQuote, inquiry.id) : null}

        {!canConfirmFinalPrice ? <section style={actionPanelStyle}>
          <h2>比价明细</h2>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
	                  <th style={headCellStyle}>行号</th>
	                  <th style={headCellStyle}>SKU</th>
	                  <th style={headCellStyle}>品名</th>
	                  <th style={headCellStyle}>图片</th>
	                  <th style={headCellStyle}>最低比价供应数</th>
	                  <th style={headCellStyle}>供应商 / 采购价</th>
                  <th style={headCellStyle}>最终供应商</th>
                </tr>
              </thead>
              <tbody>
                {inquiry.items.map((item) => (
                  <tr key={item.itemId}>
	                    <td style={cellStyle}>{item.lineNo}</td>
	                    <td style={cellStyle}>{item.sku}</td>
	                    <td style={cellStyle}>{item.productName}</td>
	                    <td style={cellStyle}>{renderInquiryItemImages(item)}</td>
	                    <td style={cellStyle}>{item.requiredSupplierCount}</td>
                    <td style={cellStyle}>
                      {item.supplierQuotes.length > 0 ? (
                        <div style={{ display: 'grid', gap: '6px' }}>
                          {item.supplierQuotes.map((supplierQuote, index) => (
                            <span
                              key={item.itemId + '-' + index}
                              style={{ display: 'grid', gap: '5px' }}
                            >
                              <strong>{formatSupplierQuoteDisplay(supplierQuote)}</strong>
                              {renderSupplierQuoteDetails(supplierQuote)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '未录入'
                      )}
                    </td>
                    <td style={cellStyle}>{formatConfirmedSupplier(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section> : null}

        <section style={actionPanelStyle}>
          <h2>询价动作</h2>
          <ActionPermissionNote>
            {inquiry.status === 'pending_inquiry'
              ? '待询价可填写供应商报价并提交比价。'
              : inquiry.status === 'pending_boss_review'
                ? '待老板确认期间，供应商信息已锁定；老板驳回后，采购可继续询价并重新提交。'
                : '老板已确认价格，询价信息不可再修改。'}
          </ActionPermissionNote>
          <div style={actionGridStyle}>
            {canSubmitComparison ? (
              <InquiryComparisonSubmitForm
                endpoint={`${getInquiryApiBaseUrl()}/quote-inquiries/${inquiry.id}/submit-for-comparison`}
                label={getInquiryStatusActionLabel(inquiry.status)}
                requestHeaders={actionRequestHeaders}
                supplierOptions={supplierOptions}
                items={inquiry.items}
              />
            ) : null}
            {canConfirmFinalPrice ? (
              <InquiryBossConfirmForm
                endpoint={`${getInquiryApiBaseUrl()}/quote-inquiries/${inquiry.id}/boss-confirm`}
                label={getBossConfirmLabel(inquiry.status)}
                requestHeaders={actionRequestHeaders}
                quoteNo={inquiry.quoteOrderNo}
                sourceIsDemand={sourceIsDemand}
                quoteVersionNo={inquiry.quoteVersionNo}
                customerName={
                  sourceQuote?.customerName ??
                  inquiry.customerName
                }
                customerFullName={sourceQuote?.customerFullName ?? inquiry.customerFullName}
                showSku={sourceQuote?.productSource !== 'candidate'}
                items={inquiry.items}
                rejectAction={
                  <MutationActionForm
                    endpoint={`${getInquiryApiBaseUrl()}/quote-inquiries/${inquiry.id}/boss-reject`}
                    label="驳回询价"
                    successLabel="已驳回，采购可继续询价"
                    confirmMessage="确认驳回本次比价并退回待询价？"
                    requiredAction="boss.confirm"
                    requiredActionLabel="老板确认"
                    requestHeaders={actionRequestHeaders}
                    fields={[]}
                    buttonVariant="secondary"
                  />
                }
              />
            ) : null}
            {!hasAvailableActions ? (
              <p style={detailTextStyle}>
                {inquiry.status === 'pending_inquiry'
                  ? '当前角色无询价提交权限。'
                  : inquiry.status === 'pending_boss_review'
                    ? '等待老板确认价格，当前角色不能执行此操作。'
                    : '当前询价单已归档，无需继续提交比价或老板确认。'}
              </p>
            ) : null}
          </div>
        </section>

        <AuditLogTable session={session} items={auditLogs?.items ?? []} />
      </section>
    </AppShell>
  );
}
