import Link from 'next/link';
import {
  formatSalesDocumentSourceMode,
  normalizeSalesDocumentSourceMode,
  salesApprovalStatuses,
  salesDocumentSourceModeOptions,
  salesFulfillmentStatuses,
  salesOrderHasAfterSalesOptions,
} from '@erp/shared';
import { formatCounterpartyBilingualDisplay } from '../app/_lib/counterparty-display';
import { getSalesOrderPreviewResponse } from './sales-order-preview';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalesOrdersPage({
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
    customerName: readParam(resolvedSearchParams.customerName),
    createdBy: readParam(resolvedSearchParams.createdBy),
    ownerName: readParam(resolvedSearchParams.ownerName),
    approvalStatus: readParam(resolvedSearchParams.approvalStatus),
    fulfillmentStatus: readParam(resolvedSearchParams.fulfillmentStatus),
    receiptStatus: readParam(resolvedSearchParams.receiptStatus),
    financeConfirmStatus: readParam(resolvedSearchParams.financeConfirmStatus),
    sourceMode: normalizeSalesDocumentSourceMode(
      readParam(resolvedSearchParams.sourceMode),
    ),
    hasAfterSales: (readParam(resolvedSearchParams.hasAfterSales) ?? 'all') as
      | 'all'
      | 'yes'
      | 'no',
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;

  const result = getSalesOrderPreviewResponse(query);
  const appliedAdvancedFilters = [
    ['customerName', query.customerName],
    ['createdBy', query.createdBy],
    ['ownerName', query.ownerName],
    ['approvalStatus', query.approvalStatus],
    ['fulfillmentStatus', query.fulfillmentStatus],
    ['receiptStatus', query.receiptStatus],
    ['financeConfirmStatus', query.financeConfirmStatus],
    ['sourceMode', query.sourceMode !== 'all' ? query.sourceMode : undefined],
    ['hasAfterSales', query.hasAfterSales !== 'all' ? query.hasAfterSales : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const hasAdvancedFilters = appliedAdvancedFilters.length > 0;

  return (
    <main>
      <h1>销售订单中心</h1>
      <p>支持报价转销售、改单重提、撤销留痕</p>
      <p>当前展示：销售高级筛选、结果摘要与履约状态预览</p>

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
            {salesApprovalStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
            {salesFulfillmentStatuses.map((status) => (
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
            客户
            <input name="customerName" defaultValue={query.customerName} />
          </label>
          <label>
            创建人
            <input name="createdBy" defaultValue={query.createdBy} />
          </label>
          <label>
            负责人
            <input name="ownerName" defaultValue={query.ownerName} />
          </label>
          <label>
            审批状态
            <select name="approvalStatus" defaultValue={query.approvalStatus ?? ''}>
              <option value="">全部</option>
              {salesApprovalStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            履约状态
            <select
              name="fulfillmentStatus"
              defaultValue={query.fulfillmentStatus ?? ''}
            >
              <option value="">全部</option>
              {salesFulfillmentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            收款状态
            <input name="receiptStatus" defaultValue={query.receiptStatus} />
          </label>
          <label>
            财务确认状态
            <input
              name="financeConfirmStatus"
              defaultValue={query.financeConfirmStatus}
            />
          </label>
          <label>
            来源方式 Source Mode
            <select name="sourceMode" defaultValue={query.sourceMode}>
              {salesDocumentSourceModeOptions.map((value) => (
                <option key={value} value={value}>
                  {value} / {formatSalesDocumentSourceMode(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            是否有售后
            <select name="hasAfterSales" defaultValue={query.hasAfterSales}>
              {salesOrderHasAfterSalesOptions.map((value) => (
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
        <Link href="/sales-orders">重置</Link>
      </form>

      {hasAdvancedFilters ? (
        <section aria-labelledby="sales-order-applied-filters">
          <h2 id="sales-order-applied-filters">当前筛选</h2>
          <ul>
            {appliedAdvancedFilters.map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="sales-order-results">
        <h2 id="sales-order-results">查询结果</h2>
        <p>共 {result.total} 条</p>

        {result.items.length === 0 ? (
          <p>暂无符合条件的销售订单</p>
        ) : (
          <ul>
            {result.items.map((item) => (
              <li key={item.docNo}>
                <h3>{item.docNo}</h3>
                <p>{item.title}</p>
                <p>主状态：{item.status}</p>
                <p>次状态：{item.secondaryStatus}</p>
                <p>客户：{formatCounterpartyBilingualDisplay(item.counterpartyName)}</p>
                <p>负责人：{item.ownerName}</p>
                <Link href={item.detailHref}>查看详情</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="sales-order-pagination">
        <p>
          第 {result.page} 页 / 每页 {result.pageSize} 条
        </p>
      </nav>
    </main>
  );
}
