import Link from 'next/link';
import { quoteBossConfirmedOptions, quoteSourceTypeOptions, QUOTE_STATUSES } from '@erp/shared';
import { formatCounterpartyBilingualDisplay } from '../app/_lib/counterparty-display';
import { getQuotePreviewResponse } from './quote-preview';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeQuoteSourceType(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTriStateFilter(value: string | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

export default async function QuotesPage({
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
    sourceType: normalizeQuoteSourceType(readParam(resolvedSearchParams.sourceType)),
    bossConfirmed: normalizeTriStateFilter(
      readParam(resolvedSearchParams.bossConfirmed),
    ),
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;

  const result = getQuotePreviewResponse(query);
  const appliedAdvancedFilters = [
    ['customerName', query.customerName],
    ['createdBy', query.createdBy],
    ['sourceType', query.sourceType],
    ['bossConfirmed', query.bossConfirmed !== 'all' ? query.bossConfirmed : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const hasAdvancedFilters = appliedAdvancedFilters.length > 0;

  return (
    <main>
      <h1>报价中心</h1>
      <p>管理报价草稿、客户来源、版本修订和老板确认</p>
      <p>当前展示：报价高级筛选、结果摘要与确认状态预览</p>

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
            {QUOTE_STATUSES.map((status) => (
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
            来源类型
            <select name="sourceType" defaultValue={query.sourceType ?? ''}>
              <option value="">全部</option>
              {quoteSourceTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            老板确认
            <select name="bossConfirmed" defaultValue={query.bossConfirmed}>
              {quoteBossConfirmedOptions.map((value) => (
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
        <Link href="/quotes">重置</Link>
      </form>

      <p>
        <Link href="/quotes/new">新建报价</Link>
      </p>

      {hasAdvancedFilters ? (
        <section aria-labelledby="quote-applied-filters">
          <h2 id="quote-applied-filters">当前筛选</h2>
          <ul>
            {appliedAdvancedFilters.map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="quote-results">
        <h2 id="quote-results">查询结果</h2>
        <p>共 {result.total} 条</p>

        {result.items.length === 0 ? (
          <p>暂无符合条件的报价单</p>
        ) : (
          <ul>
            {result.items.map((item) => (
              <li key={item.docNo}>
                <h3>{item.docNo}</h3>
                <p>{item.title}</p>
                <p>主状态：{item.status}</p>
                <p>次状态：{item.secondaryStatus}</p>
                <p>客户：{formatCounterpartyBilingualDisplay(item.customerName)}</p>
                <p>创建人：{item.createdBy}</p>
                <Link href={item.detailHref}>查看详情</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="quote-pagination">
        <p>
          第 {result.page} 页 / 每页 {result.pageSize} 条
        </p>
      </nav>
    </main>
  );
}
