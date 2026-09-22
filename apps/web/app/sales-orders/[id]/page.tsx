import Link from 'next/link';
import { MutationActionForm } from '../../app/_components/mutation-action-form';

type SalesOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type SalesOrderDetail = {
  id: number;
  salesNo: string;
  status: string;
  currentVersionNo: number;
  sourceQuoteOrderId?: number;
  sourceQuoteVersionNo?: number;
  sourceQuoteNo?: string;
  sourceDocumentType?: 'demand' | 'quote';
  purchaseAggregateStatus: string;
  shipmentAggregateStatus: string;
  stockOutStatus?: string;
  stockOutDocNo?: string | null;
  receiptStatus?: string;
  financeStatus?: string;
  receiptSendStatus?: string;
  afterSalesEndStatus?: string;
  cancelReason?: string;
  autoVoidedPurchaseOrderIds?: number[];
  versionHistory?: Array<{
    versionNo: number;
    status: string;
    createdAt: string;
    changeReason?: string;
  }>;
  items?: Array<{
    lineNo: number;
    sourceQuoteLineNo?: number;
    productId: number;
    sku: string;
    productName: string;
    unit: string;
    quantity: number;
    salePrice: number;
    amount: number;
  }>;
};

function getSalesOrderApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidSalesOrderDetail(value: unknown): value is SalesOrderDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SalesOrderDetail).id === 'number' &&
    typeof (value as SalesOrderDetail).salesNo === 'string' &&
    typeof (value as SalesOrderDetail).status === 'string' &&
    typeof (value as SalesOrderDetail).currentVersionNo === 'number' &&
    typeof (value as SalesOrderDetail).purchaseAggregateStatus === 'string' &&
    typeof (value as SalesOrderDetail).shipmentAggregateStatus === 'string' &&
    (
      (value as SalesOrderDetail).items === undefined ||
      Array.isArray((value as SalesOrderDetail).items)
    ) &&
    (
      (value as SalesOrderDetail).versionHistory === undefined ||
      Array.isArray((value as SalesOrderDetail).versionHistory)
    )
  );
}

function isReceiptPaid(receiptStatus: string | undefined) {
  return (
    receiptStatus === 'deposit_received' ||
    receiptStatus === 'fully_paid' ||
    receiptStatus === 'prepaid_deducted'
  );
}

function canCloseSalesOrder(salesOrder: SalesOrderDetail) {
  return (
    salesOrder.shipmentAggregateStatus === 'to_forwarder' ||
    salesOrder.shipmentAggregateStatus === 'forwarder_shipped' ||
    salesOrder.shipmentAggregateStatus === 'arrived' ||
    salesOrder.shipmentAggregateStatus === 'closed'
  );
}

const tableWrapStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #d8e1ea',
  borderRadius: '6px',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '760px',
};

const headCellStyle = {
  textAlign: 'left' as const,
  fontSize: '12px',
  color: '#334155',
  background: '#eef3f8',
  borderBottom: '1px solid #cfd8e3',
  borderRight: '1px solid #d8e1ea',
  padding: '10px',
};

const cellStyle = {
  padding: '12px 10px',
  borderBottom: '1px solid #e5ebf2',
  borderRight: '1px solid #e5ebf2',
  fontSize: '13px',
  color: '#0f172a',
};

const actionPanelStyle = {
  display: 'grid',
  gap: '14px',
  marginTop: '20px',
};

const versionTimelineStyle = {
  margin: '20px 0',
};

function formatStockOutDocNo(value: string | null | undefined) {
  return value?.trim() ? value : '未生成';
}

function resolveSalesOrderSourceDocumentType(salesOrder: SalesOrderDetail) {
  if (salesOrder.sourceDocumentType === 'demand' || salesOrder.sourceDocumentType === 'quote') {
    return salesOrder.sourceDocumentType;
  }

  return salesOrder.sourceQuoteNo?.startsWith('XQ') ? 'demand' : 'quote';
}

async function loadSalesOrderDetail(id: string) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(
      `${getSalesOrderApiBaseUrl()}/sales-orders/${id}`,
      {
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidSalesOrderDetail(result) ? result : null;
  } catch {
    return null;
  }
}

export default async function SalesOrderDetailPage({
  params,
}: SalesOrderDetailPageProps) {
  const { id } = await params;
  const salesOrder = await loadSalesOrderDetail(id);

  if (!salesOrder) {
    return (
      <section>
        <h1>销售订单详情加载失败</h1>
        <p>请返回销售订单列表后重试。</p>
        <Link href="/sales-orders">返回销售订单列表</Link>
      </section>
    );
  }

  const sourceDocumentType = resolveSalesOrderSourceDocumentType(salesOrder);
  const sourceDocumentLabel = sourceDocumentType === 'demand' ? '需求单' : '报价单';
  const sourceDocumentNoun = sourceDocumentType === 'demand' ? '需求' : '报价';
  const sourceDocumentNo = salesOrder.sourceQuoteNo ?? String(salesOrder.sourceQuoteOrderId ?? '');
  const sourceDocumentVersion = `V${salesOrder.sourceQuoteVersionNo ?? '-'}`;

  return (
    <section>
      <h1>{`销售订单 ${salesOrder.salesNo}`}</h1>
      <p>{`状态：${salesOrder.status}`}</p>
      <p>{`采购汇总：${salesOrder.purchaseAggregateStatus}`}</p>
      <p>{`发货汇总：${salesOrder.shipmentAggregateStatus}`}</p>
      <p>{`出库汇总：${salesOrder.stockOutStatus ?? 'not_started'}`}</p>
      <p>{`出库单号：${formatStockOutDocNo(salesOrder.stockOutDocNo)}`}</p>
      <p>{`回款状态：${salesOrder.receiptStatus ?? 'unpaid'}`}</p>
      <p>{`财务状态：${salesOrder.financeStatus ?? 'pending'}`}</p>
      <p>{`回单状态：${salesOrder.receiptSendStatus ?? 'pending'}`}</p>
      <p>{`售后收口：${salesOrder.afterSalesEndStatus ?? 'open'}`}</p>
      {salesOrder.cancelReason ? <p>{`作废原因：${salesOrder.cancelReason}`}</p> : null}
      {salesOrder.autoVoidedPurchaseOrderIds?.length ? (
        <p>{`联动作废采购单：${salesOrder.autoVoidedPurchaseOrderIds.join(', ')}`}</p>
      ) : null}
      {salesOrder.versionHistory?.length ? (
        <div style={versionTimelineStyle}>
          <h2>版本时间线</h2>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>版本</th>
                  <th style={headCellStyle}>状态</th>
                  <th style={headCellStyle}>时间</th>
                  <th style={headCellStyle}>原因</th>
                </tr>
              </thead>
              <tbody>
                {salesOrder.versionHistory.map((entry) => (
                  <tr key={`${entry.versionNo}-${entry.createdAt}`}>
                    <td style={cellStyle}>{`V${entry.versionNo}`}</td>
                    <td style={cellStyle}>{entry.status}</td>
                    <td style={cellStyle}>{entry.createdAt}</td>
                    <td style={cellStyle}>{entry.changeReason ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <div style={{ marginTop: '16px' }}>
        <h2>来源追溯</h2>
        {salesOrder.sourceQuoteOrderId ? (
          <>
            <p>{`来源${sourceDocumentNoun}：${sourceDocumentNo} / ${sourceDocumentVersion}`}</p>
            <p>{`来源类型：${sourceDocumentLabel}`}</p>
            <p>{`来源${sourceDocumentNoun}版本：${sourceDocumentVersion}`}</p>
            <p>{`来源${sourceDocumentNoun}信息会保留在系统追溯字段中，销售明细仅展示业务识别字段。`}</p>
          </>
        ) : (
          <>
            <p>来源类型：直建销售单</p>
            <p>该销售单由销售直接创建，未关联需求单或报价单。</p>
          </>
        )}
      </div>
      <div style={actionPanelStyle}>
        <MutationActionForm
          endpoint={`${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrder.id}/receipt-status`}
          label="更新回款状态"
          requiredAction="finance.confirm"
          requiredActionLabel="财务确认"
          fields={[
            {
              name: 'receiptStatus',
              value: salesOrder.receiptStatus ?? 'fully_paid',
            },
          ]}
        />
        {isReceiptPaid(salesOrder.receiptStatus) &&
        salesOrder.financeStatus !== 'confirmed' ? (
          <MutationActionForm
            endpoint={`${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrder.id}/confirm-finance`}
            label="财务确认"
            requiredAction="finance.confirm"
            requiredActionLabel="财务确认"
            fields={[
              {
                name: 'receiptStatus',
                value: salesOrder.receiptStatus ?? 'fully_paid',
              },
              {
                name: 'financeStatus',
                value: salesOrder.financeStatus ?? 'pending',
              },
            ]}
          />
        ) : null}
        {canCloseSalesOrder(salesOrder) ? (
          <MutationActionForm
            endpoint={`${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrder.id}/close`}
            label="关单"
            requiredAction="sales.order.write"
            requiredActionLabel="销售单操作"
            fields={[
              {
                name: 'canClose',
                value: true,
                dataType: 'boolean',
              },
            ]}
          />
        ) : null}
      </div>
      <h2>销售明细</h2>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headCellStyle}>行号</th>
              <th style={headCellStyle}>SKU</th>
              <th style={headCellStyle}>商品</th>
              <th style={headCellStyle}>数量</th>
              <th style={headCellStyle}>单位</th>
              <th style={headCellStyle}>销售单价</th>
              <th style={headCellStyle}>金额</th>
            </tr>
          </thead>
          <tbody>
            {(salesOrder.items ?? []).map((item) => (
              <tr key={`${item.lineNo}-${item.sku}`}>
                <td style={cellStyle}>{item.lineNo}</td>
                <td style={cellStyle}>{item.sku}</td>
                <td style={cellStyle}>{item.productName}</td>
                <td style={cellStyle}>{item.quantity}</td>
                <td style={cellStyle}>{item.unit}</td>
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
