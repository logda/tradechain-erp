import Link from 'next/link';
import {
  sampleIsCancelledOptions,
  sampleIsReplacementOptions,
  sampleOrderStatuses,
} from '@erp/shared';
import { formatCounterpartyChineseDisplay } from '../app/_lib/counterparty-display';
import { getSampleOrderPreviewResponse } from './sample-order-preview';

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

export default async function SamplesPage({
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
    quoteNo: readParam(resolvedSearchParams.quoteNo),
    isReplacement: normalizeTriStateFilter(
      readParam(resolvedSearchParams.isReplacement),
    ),
    isCancelled: normalizeTriStateFilter(
      readParam(resolvedSearchParams.isCancelled),
    ),
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;

  const result = getSampleOrderPreviewResponse(query);
  const appliedAdvancedFilters = [
    ['customerName', query.customerName],
    ['createdBy', query.createdBy],
    ['ownerName', query.ownerName],
    ['quoteNo', query.quoteNo],
    [
      'isReplacement',
      query.isReplacement !== 'all' ? query.isReplacement : undefined,
    ],
    ['isCancelled', query.isCancelled !== 'all' ? query.isCancelled : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const hasAdvancedFilters = appliedAdvancedFilters.length > 0;

  return (
    <main>
      <h1>样品管理中心</h1>
      <p>支持依附确认报价版本的样品申请、替代版本和取消留痕</p>
      <p>当前展示：样品高级筛选、结果摘要与替代/取消状态预览</p>

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
            {sampleOrderStatuses.map((status) => (
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
            报价单号
            <input name="quoteNo" defaultValue={query.quoteNo} />
          </label>
          <label>
            是否替代版
            <select name="isReplacement" defaultValue={query.isReplacement}>
              {sampleIsReplacementOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            是否已取消
            <select name="isCancelled" defaultValue={query.isCancelled}>
              {sampleIsCancelledOptions.map((value) => (
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
        <Link href="/samples">重置</Link>
      </form>

      {hasAdvancedFilters ? (
        <section aria-labelledby="sample-applied-filters">
          <h2 id="sample-applied-filters">当前筛选</h2>
          <ul>
            {appliedAdvancedFilters.map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="sample-results">
        <h2 id="sample-results">查询结果</h2>
        <p>共 {result.total} 条</p>

        {result.items.length === 0 ? (
          <p>暂无符合条件的样品单</p>
        ) : (
          <ul>
            {result.items.map((item) => (
              <li key={item.docNo}>
                <h3>{item.docNo}</h3>
                <p>{item.title}</p>
                <p>主状态：{item.status}</p>
                <p>次状态：{item.secondaryStatus}</p>
                <p>客户：{formatCounterpartyChineseDisplay(item.customerName)}</p>
                <p>负责人：{item.ownerName}</p>
                <Link href={item.detailHref}>查看详情</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="sample-pagination">
        <p>
          第 {result.page} 页 / 每页 {result.pageSize} 条
        </p>
      </nav>
    </main>
  );
}
