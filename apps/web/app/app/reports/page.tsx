import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { StatStrip } from '../_components/stat-strip';
import { canViewFormalModule, resolveDemoSession } from '../_lib/demo-session';
import { DataLoadError } from '../_components/data-load-error';
import { DataScopeNote } from '../_components/data-scope-note';
import { buildFormalApiRequestHeaders } from '../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;
type SourceDocument = { id: number; bizType: string; docNo: string; status: string; href: string; amount?: number | null; currency?: string | null };
type GrossProfitSummary = {
  generatedAt: string; currency: string | null; totalRevenue: number | null; totalProcurementCost: number | null;
  totalAfterSalesCost: number | null; grossProfit: number | null; grossMargin: number | null; amountDifference: number | null;
  calculationStatus: string; missingCosts: string[]; unknownCurrencyCount: number; sourceDocuments: SourceDocument[];
};
type ReopenedApprovalEvent = { salesOrderId: number; docNo: string; createdAt: string; href: string };
type PeriodSummary = {
  generatedAt: string; period: string; timeZone: string; periodBasis: string;
  salesOrdersCreated: number; purchaseOrdersCreated: number; shipmentBatchesCreated: number; afterSalesCreated: number;
  closedOrders: number; reopenedApprovals: number; undatedCounts: Record<string, number>; sourceDocuments: SourceDocument[]; reopenedApprovalEvents: ReopenedApprovalEvent[];
};
const documentLabels: Record<string, string> = { sales_order: '销售单', purchase_order: '采购单', shipment_batch: '发货单', after_sales: '售后单' };
const sectionStyle = { display: 'grid', gap: 14 } satisfies React.CSSProperties;
const linkStyle = { color: '#0f172a', fontWeight: 700, textDecoration: 'none', border: '1px solid #d7e0ea', borderRadius: 8, padding: '8px 12px' } satisfies React.CSSProperties;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nullableNumber = (value: unknown) => value === null || finite(value);
const currentMonth = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7);

function validSources(value: unknown): value is SourceDocument[] {
  return Array.isArray(value) && value.every(item => item && finite(item.id) && typeof item.docNo === 'string' &&
    typeof item.bizType === 'string' && typeof item.href === 'string' && item.href.startsWith('/app/'));
}
function validGross(value: unknown): value is GrossProfitSummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as Record<string, unknown>;
  return typeof summary.generatedAt === 'string' && !Number.isNaN(Date.parse(summary.generatedAt)) &&
    ['totalRevenue', 'totalProcurementCost', 'totalAfterSalesCost', 'grossProfit', 'grossMargin', 'amountDifference'].every(key => nullableNumber(summary[key])) &&
    (summary.currency === null || typeof summary.currency === 'string') && typeof summary.calculationStatus === 'string' &&
    Array.isArray(summary.missingCosts) && finite(summary.unknownCurrencyCount) && validSources(summary.sourceDocuments);
}
function validPeriod(value: unknown): value is PeriodSummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as Record<string, unknown>;
  return typeof summary.generatedAt === 'string' && !Number.isNaN(Date.parse(summary.generatedAt)) && typeof summary.period === 'string' &&
    ['salesOrdersCreated', 'purchaseOrdersCreated', 'shipmentBatchesCreated', 'afterSalesCreated', 'closedOrders', 'reopenedApprovals'].every(key => finite(summary[key])) &&
    summary.periodBasis === 'created_business_documents' && summary.timeZone === 'Asia/Shanghai' &&
    !!summary.undatedCounts && typeof summary.undatedCounts === 'object' && Object.values(summary.undatedCounts).every(finite) && validSources(summary.sourceDocuments) && Array.isArray(summary.reopenedApprovalEvents) && summary.reopenedApprovalEvents.every(event =>
      event && finite(event.salesOrderId) && typeof event.docNo === 'string' && typeof event.createdAt === 'string' && !Number.isNaN(Date.parse(event.createdAt)) && typeof event.href === 'string' && event.href.startsWith('/app/'));
}
async function loadSummary<T>(endpoint: string, validate: (value: unknown) => value is T, session: Parameters<typeof buildFormalApiRequestHeaders>[0]): Promise<T | null> {
  try {
    const response = await fetch(`${process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api'}${endpoint}`, {
      cache: 'no-store', headers: buildFormalApiRequestHeaders(session),
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return validate(value) ? value : null;
  } catch { return null; }
}
function SourceDocuments({ documents, amounts = false }: { documents: SourceDocument[]; amounts?: boolean }) {
  return <div className="erp-table-scroll"><table className="erp-table">
    <thead><tr><th>单据</th><th>类型</th>{amounts ? <><th>单据金额</th><th>币种</th></> : null}</tr></thead>
    <tbody>{documents.map(doc => <tr key={`${doc.bizType}:${doc.id}`}>
      <td><Link href={doc.href}>{doc.docNo}</Link></td><td>{documentLabels[doc.bizType] ?? doc.bizType}</td>
      {amounts ? <><td>{finite(doc.amount) ? String(doc.amount) : '无法核对'}</td><td>{doc.currency ?? '未登记'}</td></> : null}
    </tr>)}</tbody>
  </table></div>;
}

export default async function AppReportsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const session = resolveDemoSession(params);
  if (!canViewFormalModule(session, 'boss')) return <AppShell title="报表中心" session={session}>
    <section className="erp-card"><h2>无权限访问报表中心</h2><p>请使用有报表权限的账号。</p></section>
  </AppShell>;
  const selectedMonth = typeof params.period === 'string' ? params.period : currentMonth();
  const [gross, period] = await Promise.all([
    loadSummary('/reports/gross-profit', validGross, session),
    loadSummary(`/reports/period-summary?period=${encodeURIComponent(selectedMonth)}`, validPeriod, session),
  ]);
  const amount = (value: number | null) => value === null ? '待确认' : `${value.toLocaleString('zh-CN')} ${gross?.currency ?? ''}`.trim();
  const undated = period ? Object.values(period.undatedCounts).reduce((sum, count) => sum + count, 0) : 0;
  return <AppShell title="报表中心" session={session}>
    <section className="erp-card" style={sectionStyle}>
      <h2 style={{ margin: 0, fontSize: 18 }}>月度单据</h2>
      <form method="get" className="erp-filter-form" style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <label>创建月份（口径待确认）<input aria-label="创建月份（口径待确认）" type="month" name="period" defaultValue={selectedMonth} /></label>
        <button className="erp-button" type="submit">查看月份</button>
      </form>
      <p style={{ margin: 0 }}>按北京时间的真实创建时间筛选。已收口表示所选月份创建、当前已内部收口的销售单；销售重提次数按重提事件发生时间统计。期间时间口径待确认。</p>
      <DataScopeNote session={session} generatedAt={period?.generatedAt} timeRange={`创建月份 ${period?.period ?? selectedMonth}`} />
      {period ? <>
        <StatStrip items={[
          { label: '新增销售单', value: period.salesOrdersCreated }, { label: '新增采购单', value: period.purchaseOrdersCreated },
          { label: '新增发货单', value: period.shipmentBatchesCreated }, { label: '新增售后单', value: period.afterSalesCreated },
          { label: '已收口销售单', value: period.closedOrders }, { label: '销售重提次数', value: period.reopenedApprovals },
        ]} />
        <p>缺少真实重提记录的历史重提未计入，不按普通版本数量推算。</p>
        {undated > 0 ? <p>{undated} 张单据缺少可靠创建时间，未计入月份统计，历史记录保留。</p> : null}
        <details><summary>核对本月来源单据（{period.sourceDocuments.length} 张）</summary>
          {period.sourceDocuments.length ? <SourceDocuments documents={period.sourceDocuments} /> : <p>暂无期间单据</p>}
        </details>
        <details><summary>核对销售重提记录（{period.reopenedApprovalEvents.length} 次）</summary>
          {period.reopenedApprovalEvents.length ? <ul>{period.reopenedApprovalEvents.map((event, index) => <li key={`${event.salesOrderId}:${event.createdAt}:${index}`}><Link href={event.href}>{event.docNo}</Link> · 销售重提 · <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</time></li>)}</ul> : <p>暂无销售重提记录</p>}
        </details>
      </> : <DataLoadError label="期间统计" />}
    </section>
    <section className="erp-card" style={sectionStyle}>
      <h2 style={{ margin: 0, fontSize: 18 }}>金额与毛利范围</h2>
      <DataScopeNote session={session} generatedAt={gross?.generatedAt} />
      {gross ? <>
        <p style={{ margin: 0 }}>提交销售金额沿用销售工作台口径：草稿、驳回和作废不计入。采购仅展示已提交且未作废的单据金额，不能视为完整成本。</p>
        <p style={{ margin: 0 }}>金额单位：单据明确登记的币种。未知币种或多币种不合并计算；汇率与成本归集规则待确认。</p>
        {gross.unknownCurrencyCount > 0 ? <p>{gross.unknownCurrencyCount} 张单据未登记币种，暂不能汇总金额。</p> : null}
        {gross.currency === null && gross.unknownCurrencyCount === 0 && gross.sourceDocuments.length > 0 ? <p>当前单据包含多个币种，暂不能汇总金额。</p> : null}
        <StatStrip items={[
          { label: '提交销售金额', value: amount(gross.totalRevenue) }, { label: '采购单金额', value: amount(gross.totalProcurementCost) },
          { label: '毛利', value: amount(gross.grossProfit) }, { label: '毛利率', value: gross.grossMargin === null ? '待确认' : `${(gross.grossMargin * 100).toFixed(1)}%` },
        ]} />
        <p>售后成本、运费等费用未计入，完整毛利暂不能计算。售后成本汇总尚未完成，不能按零成本处理。</p>
        {gross.amountDifference !== null ? <p>销售与采购单金额差额：{amount(gross.amountDifference)}，费用未计入。</p> : null}
        <p>来源保留快照计算精度，汇总累计后保留 2 位，与销售金额统计一致。</p>
        <details><summary>核对金额来源（{gross.sourceDocuments.length} 张）</summary>
          {gross.sourceDocuments.length ? <SourceDocuments documents={gross.sourceDocuments} amounts /> : <p>暂无符合金额范围的单据</p>}
        </details>
      </> : <DataLoadError label="毛利统计" />}
    </section>
    <nav aria-label="报表明细入口" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <Link href="/app/dashboard/boss" style={linkStyle}>经营看板</Link>
      <Link href="/app/sales/orders" style={linkStyle}>销售单明细</Link>
      <Link href="/app/purchase-orders" style={linkStyle}>采购单明细</Link>
      <Link href="/app/shipment-batches" style={linkStyle}>发货单明细</Link>
      <Link href="/app/after-sales" style={linkStyle}>售后单明细</Link>
      <Link href="/app/sales/orders?financeConfirmStatus=pending" style={linkStyle}>回款待确认</Link>
      <Link href="/app/after-sales?financeReviewStatus=pending" style={linkStyle}>售后财务复核</Link>
    </nav>
  </AppShell>;
}
