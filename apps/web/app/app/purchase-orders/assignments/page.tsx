import { formatFormalUserLabel } from '../../_lib/formal-user-display';
import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import { DataLoadError } from '../../_components/data-load-error';
import { ImagePreviewGallery } from '../../_components/image-preview-gallery';
import { MutationActionForm } from '../../_components/mutation-action-form';
import { canViewFormalModule, resolveDemoSession } from '../../_lib/demo-session';
import { canApproveFormalPurchaseOrder, canViewFormalSalesOrderDetail } from '../../_lib/formal-access';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';

type Assignment = {
  id: number; salesNo: string; title: string; customerName: string; customerFullName?: string;
  salesUserId?: number; salesUserName?: string; createdBy?: number;
  customerOrderNo?: string; orderingUnit?: string; storeName?: string;
  orderDate?: string; estimatedDeliveryDate?: string; shipTo?: string; salesOrderRemark?: string;
  salesOrderAttachments?: Array<{ fileName: string; url: string }>;
  sourceQuoteNo?: string; sourceQuoteVersionNo?: number; sourceInquiryId?: number;
  purchaseOwnerName?: string; purchaseOwnerId?: number;
  items?: Array<{
    lineNo: number; sku: string; productName: string; unit: string; quantity: number;
    packageQuantity?: number; unitsPerPackage?: number; totalQuantity?: number; factoryPicUrls?: string[];
  }>;
};
type Owner = { id: number; username?: string; realName: string; status: string };
type Inquiry = {
  id: number; inquiryNo: string; status: string; quoteOrderNo: string; quoteVersionNo: number;
  createdBy: string; comparisonSubmittedBy?: string; comparisonSummary?: string;
  items: Array<{
    lineNo: number; sku: string; productName: string; confirmedSupplierName?: string; confirmedPurchasePrice?: number;
    supplierQuotes: Array<{ supplierName: string; purchasePrice: number; bulkLeadTimeDays?: string; remark?: string }>;
  }>;
};

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 };
const labelStyle = { margin: '0 0 6px', fontSize: 12, color: '#64748b' };
const sectionStyle = { borderTop: '1px solid #e5ebf2', marginTop: 20, paddingTop: 16 };
const cellStyle = { padding: '10px 12px', borderBottom: '1px solid #e5ebf2', textAlign: 'left' as const, verticalAlign: 'top' as const };
const headStyle = { ...cellStyle, background: '#eef3f8', color: '#64748b', fontSize: 12 };
const linkStyle = { color: '#0369a1', fontSize: 14, fontWeight: 600 };

export default async function PurchaseAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = resolveDemoSession(searchParams ? await searchParams : {});
  const canAssign = canViewFormalModule(session, 'purchase') &&
    ['admin', 'boss', 'purchase_manager'].includes(session.role) &&
    canApproveFormalPurchaseOrder(session);
  const baseUrl = process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
  let assignments: Assignment[] = [];
  let owners: Owner[] = [];
  let loadFailed = false;
  const inquiries = new Map<number, Inquiry | null>();
  if (canAssign) {
    try {
      const headers = buildFormalApiRequestHeaders(session);
      const [assignmentResponse, ownerResponse] = await Promise.all([
        fetch(`${baseUrl}/sales-orders/purchase-assignments/pending`, { headers, cache: 'no-store' }),
        fetch(`${baseUrl}/purchase-orders/owner-options`, { headers, cache: 'no-store' }),
      ]);
      if (!assignmentResponse.ok || !ownerResponse.ok) {
        loadFailed = true;
      } else {
        const assignmentData = await assignmentResponse.json();
        const ownerData = await ownerResponse.json();
        if (!Array.isArray(assignmentData) || !Array.isArray(ownerData) ||
          assignmentData.some((item) => !item || !Number.isSafeInteger(item.id) || item.id <= 0 ||
            typeof item.salesNo !== 'string' || typeof item.customerName !== 'string' ||
            typeof item.title !== 'string' || (item.items !== undefined && !Array.isArray(item.items))) ||
          ownerData.some((owner) => !owner || !Number.isSafeInteger(owner.id) || owner.id <= 0 ||
            typeof owner.realName !== 'string' || typeof owner.status !== 'string')) {
          loadFailed = true;
        } else {
          assignments = assignmentData;
          owners = ownerData;
          await Promise.all(assignments.filter((item) => item.sourceInquiryId).map(async (item) => {
            try {
              const response = await fetch(`${baseUrl}/quote-inquiries/${item.sourceInquiryId}`, { headers, cache: 'no-store' });
              if (!response.ok) throw new Error('来源询价加载失败');
              const inquiry = await response.json();
              if (inquiry?.id !== item.sourceInquiryId || typeof inquiry.inquiryNo !== 'string' ||
                !Array.isArray(inquiry.items) || inquiry.items.some((line: Inquiry['items'][number]) =>
                  !line || typeof line.productName !== 'string' || !Array.isArray(line.supplierQuotes) ||
                  line.supplierQuotes.some((quote) => !quote || typeof quote.supplierName !== 'string' || !Number.isFinite(quote.purchasePrice)))) {
                throw new Error('来源询价数据无效');
              }
              inquiries.set(item.id, inquiry);
            } catch {
              inquiries.set(item.id, null);
            }
          }));
        }
      }
    } catch {
      loadFailed = true;
    }
  }

  return (
    <AppShell title="采购负责人分配" subtitle="销售单审批后，先明确采购负责人，再生成采购单。" session={session}>
      <section style={{ display: 'grid', gap: 16 }}>
        {!canAssign ? <p>当前角色无权分配采购负责人。</p> : null}
        {canAssign && loadFailed ? <DataLoadError label="待分配数据" /> : null}
        {canAssign && !loadFailed && assignments.length === 0 ? <p>当前没有待分配的销售单。</p> : null}
        {canAssign && !loadFailed ? assignments.map((item) => {
          const inquiry = inquiries.get(item.id);
          return (
          <article key={item.id} style={{ background: '#fff', border: '1px solid #d7e0ea', borderRadius: 20, padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>{item.salesNo}</h2>
            <p style={{ color: '#64748b' }}>{item.title}</p>
            <dl style={gridStyle}>
              {[
                ['客户', item.customerFullName || item.customerName],
                ['销售负责人', formatFormalUserLabel(item, 'salesUserName', '未填写')],
                ['客户订单号', item.customerOrderNo], ['订货单位', item.orderingUnit], ['门店', item.storeName],
                ['订货日期', item.orderDate], ['要求交期', item.estimatedDeliveryDate], ['发货地址', item.shipTo],
              ].map(([label, value]) => <div key={label}>
                <dt style={labelStyle}>{label}</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{value || '未填写'}</dd>
              </div>)}
            </dl>
            {item.salesOrderRemark ? <p style={{ whiteSpace: 'pre-wrap' }}>备注：{item.salesOrderRemark}</p> : null}
            {item.salesOrderAttachments?.length ? <p>附件：{item.salesOrderAttachments.map((attachment, index) => (
              <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" style={{ ...linkStyle, marginRight: 12 }}>{attachment.fileName}</a>
            ))}</p> : null}
            {canViewFormalModule(session, 'sales') && canViewFormalSalesOrderDetail(session, item) ?
              <Link href={`/app/sales/orders/${item.id}`} style={linkStyle}>查看销售单</Link> : null}
            <section style={sectionStyle}>
              <h3 style={{ margin: '0 0 12px' }}>产品明细</h3>
              {item.items?.length ? <div className="erp-table-scroll">
                <table aria-label="销售单产品明细" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead><tr>{['行号', '产品', '图片', '数量/件', '每件数量', '总数量', '单位'].map((label) => <th key={label} style={headStyle}>{label}</th>)}</tr></thead>
                  <tbody>{item.items.map((line) => <tr key={line.lineNo}>
                    <td style={cellStyle}>{line.lineNo}</td>
                    <td style={cellStyle}><strong>{line.productName}</strong><div style={{ color: '#64748b' }}>{line.sku}</div></td>
                    <td style={cellStyle}>{line.factoryPicUrls?.length ? <ImagePreviewGallery productName={line.productName} imageUrls={line.factoryPicUrls} /> : '—'}</td>
                    <td style={cellStyle}>{line.packageQuantity ?? 1}</td>
                    <td style={cellStyle}>{line.unitsPerPackage ?? line.quantity}</td>
                    <td style={cellStyle}>{line.totalQuantity ?? line.quantity}</td>
                    <td style={cellStyle}>{line.unit}</td>
                  </tr>)}</tbody>
                </table>
              </div> : <p style={{ color: '#64748b' }}>未记录产品明细</p>}
            </section>
            <section style={sectionStyle}>
              <h3 style={{ margin: '0 0 12px' }}>来源询价</h3>
              {!item.sourceInquiryId ? <p style={{ color: '#64748b' }}>未记录关联询价单</p> : inquiry ? <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{inquiry.inquiryNo} · {({ pending_inquiry: '待询价', pending_boss_review: '待老板确认', boss_confirmed: '老板已确认' } as Record<string, string>)[inquiry.status] ?? inquiry.status}</strong>
                    <Link href={`/app/sales/inquiries/${inquiry.id}`} style={linkStyle}>查看询价单 {inquiry.inquiryNo}</Link>
                  </div>
                  <p style={{ color: '#64748b' }}>来源报价：{inquiry.quoteOrderNo}（第 {inquiry.quoteVersionNo} 版） · 创建人：{formatFormalUserLabel(inquiry, 'createdBy')} · 比价提交人：{formatFormalUserLabel(inquiry, 'comparisonSubmittedBy', '未记录')}</p>
                  {inquiry.comparisonSummary ? <p>{inquiry.comparisonSummary}</p> : null}
                  {inquiry.items.length ? <div className="erp-table-scroll">
                    <table aria-label="来源询价供应商报价" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead><tr>{['产品', '供应商报价', '确认供应商 / 采购价'].map((label) => <th key={label} style={headStyle}>{label}</th>)}</tr></thead>
                      <tbody>{inquiry.items.map((line) => <tr key={line.lineNo}>
                        <td style={cellStyle}>{line.sku} / {line.productName}</td>
                        <td style={cellStyle}>{line.supplierQuotes.length ? line.supplierQuotes.map((quote, index) => <div key={index} style={{ marginBottom: 8 }}>
                          <div>{quote.supplierName}：{quote.purchasePrice}</div>
                          {quote.bulkLeadTimeDays ? <div style={{ color: '#64748b' }}>交期：{/^\d+$/.test(quote.bulkLeadTimeDays) ? `${quote.bulkLeadTimeDays} 天` : quote.bulkLeadTimeDays}</div> : null}
                          {quote.remark ? <div style={{ color: '#64748b', whiteSpace: 'pre-wrap' }}>{quote.remark}</div> : null}
                        </div>) : '未填写报价'}</td>
                        <td style={cellStyle}>{line.confirmedSupplierName ?? '未确认'} / {line.confirmedPurchasePrice ?? '未确认'}</td>
                      </tr>)}</tbody>
                    </table>
                  </div> : <p style={{ color: '#64748b' }}>未记录询价明细</p>}
                </> : <DataLoadError label="来源询价" />}
            </section>
            <section style={sectionStyle}>
            <MutationActionForm
              endpoint={`${baseUrl}/sales-orders/${item.id}/assign-purchaser`}
              label="指定并生成采购单"
              successLabel="已指定采购负责人并生成采购单"
              requiredAction="purchase.order.approve"
              requiredActionLabel="采购主管审批"
              requestHeaders={buildFormalRequestHeaders(session)}
              fields={[{
                name: 'ownerId',
                dataType: 'number',
                value: item.purchaseOwnerId ?? '',
                display: 'select',
                label: '采购负责人',
                required: true,
                options: [
                  { value: '', label: '请选择采购负责人' },
                  ...owners.filter((owner) => owner.status === 'active' && owner.id > 0 &&
                    (item.purchaseOwnerId !== undefined ? owner.id === item.purchaseOwnerId : !item.purchaseOwnerName || owner.realName === item.purchaseOwnerName)).map((owner) => ({
                    value: String(owner.id),
                    label: owner.username ?? owner.realName,
                  })),
                ],
              }]}
            />
            </section>
          </article>
          );
        }) : null}
      </section>
    </AppShell>
  );
}
