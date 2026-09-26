import type { WarehouseListItem, WarehouseListResponse } from '@erp/shared';
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

const cardStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: 'rgba(255,255,255,0.9)',
  padding: '20px 22px',
  boxShadow: '0 18px 56px rgba(15, 23, 42, 0.06)',
} satisfies React.CSSProperties;

const cardTitleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const cardMetaStyle = {
  margin: '8px 0 0',
  color: '#64748b',
  fontSize: '13px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const quickActionStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap' as const,
  marginTop: '16px',
} satisfies React.CSSProperties;

const quickActionLinkStyle = {
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
  minWidth: '760px',
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

function getWarehouseApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeWarehouseResult(value: unknown): WarehouseListResponse | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as WarehouseListResponse).items)
  ) {
    return null;
  }

  const response = value as WarehouseListResponse;
  const items = response.items.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }

    const entry = item as Partial<WarehouseListItem>;

    return [
      {
        id: normalizeNumber(entry.id),
        code: typeof entry.code === 'string' ? entry.code : '',
        name: typeof entry.name === 'string' ? entry.name : '',
        status: typeof entry.status === 'string' ? entry.status : '',
        locationCount: normalizeNumber(entry.locationCount),
        ownerName: typeof entry.ownerName === 'string' ? entry.ownerName : '',
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
      },
    ];
  });

  return {
    items,
    total: normalizeNumber(response.total),
    page: normalizeNumber(response.page) || 1,
    pageSize: normalizeNumber(response.pageSize) || 20,
  };
}

function hasValidWarehouseListResponse(
  value: unknown,
): value is WarehouseListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as WarehouseListResponse).items)
  );
}

function canViewWarehouseModule(searchParams: SearchParams) {
  const session = resolveDemoSession(searchParams);
  return {
    session,
    allowed:
      canViewFormalModule(session, 'purchase') ||
      canViewFormalModule(session, 'operations'),
  };
}

async function loadWarehouses(
  session: { role: string; user: string },
  query: { page: number; pageSize: number },
) {
  try {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    const response = await fetch(`${getWarehouseApiBaseUrl()}/warehouses?${params.toString()}`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidWarehouseListResponse(result) ? normalizeWarehouseResult(result) : null;
  } catch {
    return null;
  }
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

export default async function AppWarehousesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { session, allowed } = canViewWarehouseModule(resolvedSearchParams);
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

  if (!allowed) {
    return (
      <AppShell
        title="仓库中心"
        subtitle="当前角色不在采购/运营域内，不能查看仓库主数据和库位概况。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问仓库中心</h2>
          <p>请切换到采购、采购主管、老板或管理员视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const warehouseResult =
    (await loadWarehouses(session, query)) ??
    paginateItems<WarehouseListItem>([], query.page, query.pageSize);
  const items = warehouseResult.items;
  const activeCount = items.filter((item) => item.status === 'active').length;
  const totalLocations = items.reduce((sum, item) => sum + item.locationCount, 0);
  const ownerCount = new Set(items.map((item) => item.ownerName).filter(Boolean)).size;

  return (
    <AppShell
      title="仓库中心"
      subtitle="正式版仓储主数据入口，集中查看仓库编码、责任人、库位规模和库存协同入口。"
      session={session}
    >
      <StatStrip
        items={[
          { label: '仓库总数', value: warehouseResult.total },
          { label: '启用仓库', value: activeCount },
          { label: '库位合计', value: totalLocations },
          { label: '责任人数量', value: ownerCount },
        ]}
      />

      <section style={sectionStyle}>
        <section style={cardStyle}>
          <h2 style={cardTitleStyle}>仓储协同说明</h2>
          <p style={cardMetaStyle}>
            这一页用于老板演示正式版仓储主数据基础盘点。仓库定义稳定后，收货、出库和库存台账会基于这里的仓库与库位进行归集。
          </p>
          <div style={quickActionStyle}>
            <Link href="/app/purchase-orders" style={quickActionLinkStyle}>
              回到正式采购单
            </Link>
            <Link href="/app/shipment-batches" style={quickActionLinkStyle}>
              查看发货批次
            </Link>
          </div>
        </section>

        <FormalDataTable title="仓库主数据" total={warehouseResult.total}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>仓库编码</th>
                  <th style={headCellStyle}>仓库名称</th>
                  <th style={headCellStyle}>状态</th>
                  <th style={headCellStyle}>库位数</th>
                  <th style={headCellStyle}>负责人</th>
                  <th style={headCellStyle}>最近更新</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={cellStyle}>{item.code || '-'}</td>
                    <td style={cellStyle}>{item.name || '-'}</td>
                    <td style={cellStyle}>
                      <span style={badgeStyle}>
                        {item.status === 'active' ? '启用' : item.status || '-'}
                      </span>
                    </td>
                    <td style={cellStyle}>{item.locationCount}</td>
                    <td style={cellStyle}>{item.ownerName || '-'}</td>
                    <td style={cellStyle}>{formatDateTime(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <FormalPagination
            pathname="/app/warehouses"
            params={{
              role: session.role,
              user: session.user,
              access:
                Array.isArray(resolvedSearchParams.access)
                  ? resolvedSearchParams.access[0]
                  : resolvedSearchParams.access,
            }}
            page={warehouseResult.page}
            pageSize={warehouseResult.pageSize}
            total={warehouseResult.total}
          />
        </FormalDataTable>
      </section>
    </AppShell>
  );
}
