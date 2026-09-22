import Link from 'next/link';

type ShipmentBatchDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ShipmentBatchDetail = {
  id: number;
  batchNo: string;
  status: string;
  receiptSendStatus: string;
  salesOrderId: number;
  purchaseOrderId: number;
  stockOutStatus?: string;
  stockOutDocNo?: string | null;
  receiptDocUrl?: string;
  hasException?: boolean;
  exceptionReason?: string;
  items?: Array<{
    lineNo: number;
    purchaseLineNo: number;
    sourceSalesItemId: number;
    productId: number;
    sku: string;
    productName: string;
    unit: string;
    shippedQty: number;
    purchaseQty: number;
  }>;
};

function getShipmentBatchApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidShipmentBatchDetail(value: unknown): value is ShipmentBatchDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ShipmentBatchDetail).id === 'number' &&
    typeof (value as ShipmentBatchDetail).batchNo === 'string' &&
    typeof (value as ShipmentBatchDetail).status === 'string' &&
    typeof (value as ShipmentBatchDetail).receiptSendStatus === 'string' &&
    typeof (value as ShipmentBatchDetail).salesOrderId === 'number' &&
    typeof (value as ShipmentBatchDetail).purchaseOrderId === 'number' &&
    (
      (value as ShipmentBatchDetail).items === undefined ||
      Array.isArray((value as ShipmentBatchDetail).items)
    )
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
  minWidth: '820px',
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

function formatStockOutDocNo(value: string | null | undefined) {
  return value?.trim() ? value : '未生成';
}

async function loadShipmentBatchDetail(id: string) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${getShipmentBatchApiBaseUrl()}/shipment-batches/${id}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidShipmentBatchDetail(result) ? result : null;
  } catch {
    return null;
  }
}

export default async function ShipmentBatchDetailPage({
  params,
}: ShipmentBatchDetailPageProps) {
  const { id } = await params;
  const shipmentBatch = await loadShipmentBatchDetail(id);

  if (!shipmentBatch) {
    return (
      <section>
        <h1>发货批次详情加载失败</h1>
        <p>请返回发货履约中心后重试。</p>
        <Link href="/shipment-batches">返回发货履约中心</Link>
      </section>
    );
  }

  return (
    <section>
      <Link href="/shipment-batches">返回发货履约中心</Link>
      <h1>{`发货批次 ${shipmentBatch.batchNo}`}</h1>
      <p>{`状态：${shipmentBatch.status}`}</p>
      <p>{`回单状态：${shipmentBatch.receiptSendStatus}`}</p>
      <p>{`出库汇总：${shipmentBatch.stockOutStatus ?? 'not_started'}`}</p>
      <p>{`出库单号：${formatStockOutDocNo(shipmentBatch.stockOutDocNo)}`}</p>
      <p>
        {`销售单：#${shipmentBatch.salesOrderId} / 采购单：#${shipmentBatch.purchaseOrderId}`}
      </p>
      <p>{`异常状态：${shipmentBatch.hasException ? '已标记异常' : '暂无异常标记'}`}</p>
      {shipmentBatch.exceptionReason ? (
        <p>{`异常原因：${shipmentBatch.exceptionReason}`}</p>
      ) : null}
      {shipmentBatch.receiptDocUrl ? (
        <p>{shipmentBatch.receiptDocUrl}</p>
      ) : (
        <p>回单地址：未上传</p>
      )}

      <h2>发货明细</h2>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headCellStyle}>行号</th>
              <th style={headCellStyle}>采购行</th>
              <th style={headCellStyle}>SKU</th>
              <th style={headCellStyle}>商品</th>
              <th style={headCellStyle}>发货数量</th>
              <th style={headCellStyle}>采购数量</th>
              <th style={headCellStyle}>单位</th>
            </tr>
          </thead>
          <tbody>
            {(shipmentBatch.items ?? []).map((item) => (
              <tr key={`${item.lineNo}-${item.sku}`}>
                <td style={cellStyle}>{item.lineNo}</td>
                <td style={cellStyle}>{item.purchaseLineNo}</td>
                <td style={cellStyle}>{item.sku}</td>
                <td style={cellStyle}>{item.productName}</td>
                <td style={cellStyle}>{item.shippedQty}</td>
                <td style={cellStyle}>{item.purchaseQty}</td>
                <td style={cellStyle}>{item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
