import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../../_lib/demo-session';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;

type StockDocumentDetail = {
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

const sectionStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: 'rgba(255,255,255,0.9)',
  padding: '20px 22px',
  boxShadow: '0 18px 56px rgba(15, 23, 42, 0.06)',
} satisfies React.CSSProperties;

const sectionTitleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const metaGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
  marginTop: '16px',
} satisfies React.CSSProperties;

const metaItemStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '14px 16px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const metaLabelStyle = {
  margin: 0,
  fontSize: '12px',
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
} satisfies React.CSSProperties;

const metaValueStyle = {
  margin: '8px 0 0',
  fontSize: '15px',
  color: '#0f172a',
  fontWeight: 700,
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  marginTop: '16px',
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
} satisfies React.CSSProperties;

const backLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const deniedStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: '#ffffff',
  padding: '24px',
} satisfies React.CSSProperties;

function getApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidDetail(value: unknown): value is StockDocumentDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StockDocumentDetail).docNo === 'string' &&
    Array.isArray((value as StockDocumentDetail).items)
  );
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

function resolveSourceHref(detail: StockDocumentDetail) {
  if (detail.sourceBizType === 'sales_order') {
    return `/app/sales/orders?docNo=${detail.sourceDocNo}`;
  }

  return `/app/inventory`;
}

async function loadDetail(id: string, session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/stock-out/${id}`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidDetail(result) ? result : null;
  } catch {
    return null;
  }
}

export default async function AppStockOutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve({}),
  ]);
  const session = resolveDemoSession(resolvedSearchParams);
  const allowed = canViewFormalModule(session, 'operations');

  if (!allowed) {
    return (
      <AppShell
        title="正式出库单详情"
        subtitle="当前角色不在运营域内，不能查看出库单详情。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问正式出库单</h2>
          <p>请切换到采购、采购主管、老板或管理员视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const detail = await loadDetail(id, session);

  if (!detail) {
    return (
      <AppShell
        title="正式出库单详情"
        subtitle="未找到对应的出库单记录。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>出库单不存在</h2>
          <p>请返回列表重新选择，或确认后端数据已生成。</p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="正式出库单详情"
      subtitle="查看单据来源、仓库库位和出库商品明细。"
      session={session}
    >
      <section style={sectionStyle}>
        <Link href="/app/stock-out" style={backLinkStyle}>
          返回正式出库单列表
        </Link>
        <h2 style={sectionTitleStyle}>出库单 {detail.docNo}</h2>
        <div style={metaGridStyle}>
          <article style={metaItemStyle}>
            <p style={metaLabelStyle}>状态</p>
            <p style={metaValueStyle}>{formatStatus(detail.status)}</p>
          </article>
          <article style={metaItemStyle}>
            <p style={metaLabelStyle}>来源单号</p>
            <p style={metaValueStyle}>来源单号：{detail.sourceDocNo}</p>
          </article>
          <article style={metaItemStyle}>
            <p style={metaLabelStyle}>仓库库位</p>
            <p style={metaValueStyle}>
              {detail.warehouseName} / {detail.locationName}
            </p>
          </article>
          <article style={metaItemStyle}>
            <p style={metaLabelStyle}>创建人</p>
            <p style={metaValueStyle}>{detail.createdByName}</p>
          </article>
        </div>
        <p>
          <Link href={resolveSourceHref(detail)} style={backLinkStyle}>
            查看来源业务
          </Link>
        </p>
      </section>

      <section style={sectionStyle}>
        <section style={sectionStyle}>
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>出库明细</h3>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={headCellStyle}>SKU</th>
                <th style={headCellStyle}>商品名称</th>
                <th style={headCellStyle}>数量</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={`${detail.id}-${item.productId}`}>
                  <td style={cellStyle}>{item.sku}</td>
                  <td style={cellStyle}>{item.productName}</td>
                  <td style={cellStyle}>{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>
    </AppShell>
  );
}
