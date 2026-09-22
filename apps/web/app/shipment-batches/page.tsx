import Link from 'next/link';
import {
  receiptSendStatuses,
  shipmentBatchHasExceptionOptions,
  shipmentBatchStatuses,
} from '@erp/shared';
import { formatCounterpartyChineseDisplay } from '../app/_lib/counterparty-display';
import { getShipmentBatchPreviewResponse } from './shipment-batch-preview';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeTriStateFilter(value: string | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

export default async function ShipmentBatchesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = {
    keyword: readParam(resolvedSearchParams.keyword),
    docNo: readParam(resolvedSearchParams.docNo),
    status: readParam(resolvedSearchParams.status),
    dateFrom: readParam(resolvedSearchParams.dateFrom),
    dateTo: readParam(resolvedSearchParams.dateTo),
    supplierName: readParam(resolvedSearchParams.supplierName),
    salesOrderNo: readParam(resolvedSearchParams.salesOrderNo),
    purchaseOrderNo: readParam(resolvedSearchParams.purchaseOrderNo),
    receiptSendStatus: readParam(resolvedSearchParams.receiptSendStatus),
    hasException: normalizeTriStateFilter(
      readParam(resolvedSearchParams.hasException),
    ),
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;

  const result = getShipmentBatchPreviewResponse(query);
  const appliedAdvancedFilters = [
    ['supplierName', query.supplierName],
    ['salesOrderNo', query.salesOrderNo],
    ['purchaseOrderNo', query.purchaseOrderNo],
    ['receiptSendStatus', query.receiptSendStatus],
    ['hasException', query.hasException !== 'all' ? query.hasException : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const hasAdvancedFilters = appliedAdvancedFilters.length > 0;

  return (
    <main>
      <h1>发货履约中心</h1>
      <p>支持分批发货、货代推进和回单发送留痕</p>
      <p>当前展示：发货高级筛选、结果摘要与回单状态预览</p>

      <form method="get">
        <label>
          关键词
          <input name="keyword" defaultValue={query.keyword} />
        </label>
        <label>
          单号
          <input name="docNo" defaultValue={query.docNo} />
        </label>
        <label>
          状态
          <select name="status" defaultValue={query.status ?? ''}>
            <option value="">全部</option>
            {shipmentBatchStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          开始日期
          <input name="dateFrom" type="date" defaultValue={query.dateFrom} />
        </label>
        <label>
          结束日期
          <input name="dateTo" type="date" defaultValue={query.dateTo} />
        </label>

        <details open={hasAdvancedFilters}>
          <summary>高级筛选</summary>
          <label>
            供应商
            <input name="supplierName" defaultValue={query.supplierName} />
          </label>
          <label>
            销售单号
            <input name="salesOrderNo" defaultValue={query.salesOrderNo} />
          </label>
          <label>
            采购单号
            <input name="purchaseOrderNo" defaultValue={query.purchaseOrderNo} />
          </label>
          <label>
            回单发送状态
            <select
              name="receiptSendStatus"
              defaultValue={query.receiptSendStatus ?? ''}
            >
              <option value="">全部</option>
              {receiptSendStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            是否异常
            <select name="hasException" defaultValue={query.hasException}>
              {shipmentBatchHasExceptionOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </details>

        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value="20" />
        <button type="submit">查询</button>
        <Link href="/shipment-batches">重置</Link>
      </form>

      {hasAdvancedFilters ? (
        <section aria-labelledby="shipment-batch-applied-filters">
          <h2 id="shipment-batch-applied-filters">当前筛选</h2>
          <ul>
            {appliedAdvancedFilters.map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="shipment-batch-results">
        <h2 id="shipment-batch-results">查询结果</h2>
        <p>共 {result.total} 条</p>

        {result.items.length === 0 ? (
          <p>暂无符合条件的发货批次</p>
        ) : (
          <ul>
            {result.items.map((item) => (
              <li key={item.docNo}>
                <h3>{item.docNo}</h3>
                <p>{item.title}</p>
                <p>主状态：{item.status}</p>
                <p>次状态：{item.secondaryStatus}</p>
                <p>供应商：{formatCounterpartyChineseDisplay(item.supplierName)}</p>
                <Link href={item.detailHref}>查看详情</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="shipment-batch-pagination">
        <p>
          第 {result.page} 页 / 每页 {result.pageSize} 条
        </p>
      </nav>
    </main>
  );
}
