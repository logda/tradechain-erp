import Link from 'next/link';
import {
  afterSalesStatuses,
  afterSalesTypeOptions,
  financeConfirmStatuses,
  receiptCollectionStatuses,
} from '@erp/shared';
import { formatCounterpartyChineseDisplay } from '../app/_lib/counterparty-display';
import { getAfterSalesPreviewResponse } from './after-sales-preview';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeAfterSalesType(value: string | undefined) {
  if (
    value === 'customer_complaint' ||
    value === 'return' ||
    value === 'refund' ||
    value === 'rework'
  ) {
    return value;
  }

  return undefined;
}

export default async function AfterSalesPage({
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
    supplierName: readParam(resolvedSearchParams.supplierName),
    createdBy: readParam(resolvedSearchParams.createdBy),
    ownerName: readParam(resolvedSearchParams.ownerName),
    type: normalizeAfterSalesType(readParam(resolvedSearchParams.type)),
    financeReviewStatus: readParam(resolvedSearchParams.financeReviewStatus),
    receiptCollectionStatus: readParam(
      resolvedSearchParams.receiptCollectionStatus,
    ),
    shipmentBatchNo: readParam(resolvedSearchParams.shipmentBatchNo),
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;

  const result = getAfterSalesPreviewResponse(query);
  const appliedAdvancedFilters = [
    ['customerName', query.customerName],
    ['supplierName', query.supplierName],
    ['createdBy', query.createdBy],
    ['ownerName', query.ownerName],
    ['type', query.type],
    ['financeReviewStatus', query.financeReviewStatus],
    ['receiptCollectionStatus', query.receiptCollectionStatus],
    ['shipmentBatchNo', query.shipmentBatchNo],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const hasAdvancedFilters = appliedAdvancedFilters.length > 0;

  return (
    <main>
      <h1>售后与财务中心</h1>
      <p>支持售后闭环、收款状态维护和关单前财务确认</p>
      <p>当前展示：售后高级筛选、结果摘要与财务闭环预览</p>

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
            {afterSalesStatuses.map((status) => (
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
            售后类型
            <select name="type" defaultValue={query.type ?? ''}>
              <option value="">全部</option>
              {afterSalesTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            财务复核状态
            <select
              name="financeReviewStatus"
              defaultValue={query.financeReviewStatus ?? ''}
            >
              <option value="">全部</option>
              {financeConfirmStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            收款状态
            <select
              name="receiptCollectionStatus"
              defaultValue={query.receiptCollectionStatus ?? ''}
            >
              <option value="">全部</option>
              {receiptCollectionStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            发货批次号
            <input name="shipmentBatchNo" defaultValue={query.shipmentBatchNo} />
          </label>
        </details>

        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value="20" />
        <button type="submit">查询</button>
        <Link href="/after-sales">重置</Link>
      </form>

      {hasAdvancedFilters ? (
        <section aria-labelledby="after-sales-applied-filters">
          <h2 id="after-sales-applied-filters">当前筛选</h2>
          <ul>
            {appliedAdvancedFilters.map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="after-sales-results">
        <h2 id="after-sales-results">查询结果</h2>
        <p>共 {result.total} 条</p>

        {result.items.length === 0 ? (
          <p>暂无符合条件的售后单</p>
        ) : (
          <ul>
            {result.items.map((item) => (
              <li key={item.docNo}>
                <h3>{item.docNo}</h3>
                <p>{item.title}</p>
                <p>主状态：{item.status}</p>
                <p>次状态：{item.secondaryStatus}</p>
                <p>客户：{formatCounterpartyChineseDisplay(item.customerName)}</p>
                <p>供应商：{formatCounterpartyChineseDisplay(item.supplierName)}</p>
                <p>负责人：{item.ownerName}</p>
                <Link href={item.detailHref}>查看详情</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="after-sales-pagination">
        <p>
          第 {result.page} 页 / 每页 {result.pageSize} 条
        </p>
      </nav>
    </main>
  );
}
