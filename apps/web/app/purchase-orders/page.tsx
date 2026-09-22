import Link from 'next/link';
import {
  purchaseApprovalStatuses,
  purchaseFulfillmentStatuses,
  purchaseOrderIsResubmittedOptions,
} from '@erp/shared';
import { formatCounterpartyChineseDisplay } from '../app/_lib/counterparty-display';
import { getPurchaseOrderPreviewResponse } from './purchase-order-preview';

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

export default async function PurchaseOrdersPage({
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
    createdBy: readParam(resolvedSearchParams.createdBy),
    ownerName: readParam(resolvedSearchParams.ownerName),
    approvalStatus: readParam(resolvedSearchParams.approvalStatus),
    fulfillmentStatus: readParam(resolvedSearchParams.fulfillmentStatus),
    salesOrderNo: readParam(resolvedSearchParams.salesOrderNo),
    isResubmitted: normalizeTriStateFilter(
      readParam(resolvedSearchParams.isResubmitted),
    ),
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;

  const result = getPurchaseOrderPreviewResponse(query);
  const appliedAdvancedFilters = [
    ['supplierName', query.supplierName],
    ['createdBy', query.createdBy],
    ['ownerName', query.ownerName],
    ['approvalStatus', query.approvalStatus],
    ['fulfillmentStatus', query.fulfillmentStatus],
    ['salesOrderNo', query.salesOrderNo],
    [
      'isResubmitted',
      query.isResubmitted !== 'all' ? query.isResubmitted : undefined,
    ],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const hasAdvancedFilters = appliedAdvancedFilters.length > 0;

  return (
    <main>
      <h1>采购执行中心</h1>
      <p>按供应商拆单，并保留销售来源追溯</p>
      <p>当前展示：采购高级筛选、结果摘要与履约状态预览</p>

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
            {purchaseApprovalStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
            {purchaseFulfillmentStatuses.map((status) => (
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
              {purchaseApprovalStatuses.map((status) => (
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
              {purchaseFulfillmentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            销售单号
            <input name="salesOrderNo" defaultValue={query.salesOrderNo} />
          </label>
          <label>
            是否重提
            <select name="isResubmitted" defaultValue={query.isResubmitted}>
              {purchaseOrderIsResubmittedOptions.map((value) => (
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
        <Link href="/purchase-orders">重置</Link>
      </form>

      {hasAdvancedFilters ? (
        <section aria-labelledby="purchase-order-applied-filters">
          <h2 id="purchase-order-applied-filters">当前筛选</h2>
          <ul>
            {appliedAdvancedFilters.map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="purchase-order-results">
        <h2 id="purchase-order-results">查询结果</h2>
        <p>共 {result.total} 条</p>

        {result.items.length === 0 ? (
          <p>暂无符合条件的采购单</p>
        ) : (
          <ul>
            {result.items.map((item) => (
              <li key={item.docNo}>
                <h3>{item.docNo}</h3>
                <p>{item.title}</p>
                <p>主状态：{item.status}</p>
                <p>次状态：{item.secondaryStatus}</p>
                <p>供应商：{formatCounterpartyChineseDisplay(item.supplierName)}</p>
                <p>负责人：{item.ownerName}</p>
                <Link href={item.detailHref}>查看详情</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="purchase-order-pagination">
        <p>
          第 {result.page} 页 / 每页 {result.pageSize} 条
        </p>
      </nav>
    </main>
  );
}
