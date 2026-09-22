import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { FormalDataTable } from '../_components/formal-data-table';
import { FormalPagination } from '../_components/formal-pagination';
import { StatStrip } from '../_components/stat-strip';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../_lib/demo-session';
import { normalizePageNumber, paginateItems } from '../_lib/formal-pagination';
import { buildFormalApiRequestHeaders } from '../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;

type StockDocumentItem = {
  id: number;
  docNo: string;
  status: string;
  sourceBizType: string;
  sourceBizId: number;
  sourceDocNo: string;
  warehouseId: number;
  warehouseName: string;
  locationId: number;
  locationName: string;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    productId: number;
    sku: string;
    productName: string;
    quantity: number;
  }>;
};

type StockDocumentListResponse = {
  items: StockDocumentItem[];
  total: number;
  page: number;
  pageSize: number;
};

const fallbackItems: StockDocumentItem[] = [
  {
    id: 701,
    docNo: 'SO202607140701',
    status: 'confirmed',
    sourceBizType: 'sales_order',
    sourceBizId: 88,
    sourceDocNo: 'S202607080088',
    warehouseId: 1,
    warehouseName: 'Main Warehouse',
    locationId: 11,
    locationName: 'A-01',
    createdBy: 2002,
    createdByName: 'Leo',
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:15:00.000Z',
    items: [
      {
        productId: 1,
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        quantity: 10,
      },
    ],
  },
];

const deniedStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: '#ffffff',
  padding: '24px',
} satisfies React.CSSProperties;

const sectionStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const introCardStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: 'rgba(255,255,255,0.9)',
  padding: '20px 22px',
  boxShadow: '0 18px 56px rgba(15, 23, 42, 0.06)',
} satisfies React.CSSProperties;

const introTitleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const introMetaStyle = {
  margin: '8px 0 0',
  color: '#64748b',
  fontSize: '13px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const actionWrapStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap' as const,
  marginTop: '16px',
} satisfies React.CSSProperties;

const actionLinkStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '12px',
  padding: '10px 14px',
  color: '#0f172a',
  background: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '980px',
} satisfies React.CSSProperties;

const headCellStyle = {
  textAlign: 'left' as const,
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
  borderBottom: '1px solid #e2e8f0',
  padding: '12px 10px',
} satisfies React.CSSProperties;

const cellStyle = {
  padding: '14px 10px',
  borderBottom: '1px solid #eef2f7',
  fontSize: '14px',
  color: '#0f172a',
  verticalAlign: 'top' as const,
} satisfies React.CSSProperties;

const badgeStyle = {
  display: 'inline-flex',
  border: '1px solid #d7e0ea',
  borderRadius: '999px',
  padding: '4px 10px',
  background: '#f8fafc',
  fontSize: '12px',
  fontWeight: 700,
  color: '#334155',
} satisfies React.CSSProperties;

const rowLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

function getApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidResponse(value: unknown): value is StockDocumentListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as StockDocumentListResponse).items) &&
    typeof (value as StockDocumentListResponse).total === 'number'
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatStatus(status: string) {
  if (status === 'confirmed') {
    return '已确认';
  }

  if (status === 'draft') {
    return '草稿';
  }

  return status;
}

async function loadStockOutList(
  session: { role: string; user: string },
  query: { page: number; pageSize: number },
) {
  try {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    const response = await fetch(`${getApiBaseUrl()}/stock-out?${params.toString()}`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidResponse(result) ? result : null;
  } catch {
    return null;
  }
}

export default async function AppStockOutPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const query = {
    page: normalizePageNumber(
      Array.isArray(resolvedSearchParams.page)
        ? resolvedSearchParams.page[0]
        : resolvedSearchParams.page,
      1,
    ),
    pageSize: normalizePageNumber(
      Array.isArray(resolvedSearchParams.pageSize)
        ? resolvedSearchParams.pageSize[0]
        : resolvedSearchParams.pageSize,
      20,
    ),
  };
  const allowed = canViewFormalModule(session, 'operations');

  if (!allowed) {
    return (
      <AppShell
        title="正式出库单"
        subtitle="当前角色不在运营域内，不能查看出库执行单据。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问正式出库单</h2>
          <p>请切换到采购、采购主管、老板或管理员视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const stockOutResult =
    (await loadStockOutList(session, query)) ??
    paginateItems(fallbackItems, query.page, query.pageSize);
  const items = stockOutResult.items;
  const confirmedCount = items.filter((item) => item.status === 'confirmed').length;
  const lineCount = items.reduce((sum, item) => sum + item.items.length, 0);
  const totalQty = items.reduce(
    (sum, item) =>
      sum + item.items.reduce((lineSum, line) => lineSum + line.quantity, 0),
    0,
  );

  return (
    <AppShell
      title="正式出库单"
      subtitle="正式版出库执行列表，承接销售发货、库存扣减与仓库出库追踪。"
      session={session}
    >
      <StatStrip
        items={[
          { label: '单据总数', value: items.length },
          { label: '已确认', value: confirmedCount },
          { label: '明细行数', value: lineCount },
          { label: '出库数量', value: totalQty },
        ]}
      />

      <section style={sectionStyle}>
        <section style={introCardStyle}>
          <h2 style={introTitleStyle}>出库执行说明</h2>
          <p style={introMetaStyle}>
            当前出库单已经接入正式 API，可用于展示销售发货、库存扣减和仓储执行之间的动作闭环。
          </p>
          <div style={actionWrapStyle}>
            <Link href="/app/shipment-batches" style={actionLinkStyle}>
              返回正式发货批次
            </Link>
            <Link href="/app/inventory" style={actionLinkStyle}>
              查看库存中心
            </Link>
            <Link href="/app/warehouses" style={actionLinkStyle}>
              查看仓库中心
            </Link>
          </div>
        </section>

        <FormalDataTable title="出库单列表" total={stockOutResult.total}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>出库单号</th>
                  <th style={headCellStyle}>状态</th>
                  <th style={headCellStyle}>来源业务</th>
                  <th style={headCellStyle}>仓库 / 库位</th>
                  <th style={headCellStyle}>创建人</th>
                  <th style={headCellStyle}>更新时间</th>
                  <th style={headCellStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={cellStyle}>{item.docNo}</td>
                    <td style={cellStyle}>
                      <span style={badgeStyle}>{formatStatus(item.status)}</span>
                    </td>
                    <td style={cellStyle}>
                      {item.sourceBizType}
                      <br />
                      {item.sourceDocNo}
                    </td>
                    <td style={cellStyle}>
                      {item.warehouseName} / {item.locationName}
                    </td>
                    <td style={cellStyle}>{item.createdByName}</td>
                    <td style={cellStyle}>{formatDateTime(item.updatedAt)}</td>
                    <td style={cellStyle}>
                      <Link href={`/app/stock-out/${item.id}`} style={rowLinkStyle}>
                        查看详情 {item.docNo}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <FormalPagination
            pathname="/app/stock-out"
            params={{
              role: session.role,
              user: session.user,
              access:
                Array.isArray(resolvedSearchParams.access)
                  ? resolvedSearchParams.access[0]
                  : resolvedSearchParams.access,
            }}
            page={stockOutResult.page}
            pageSize={stockOutResult.pageSize}
            total={stockOutResult.total}
          />
        </FormalDataTable>
      </section>
    </AppShell>
  );
}
