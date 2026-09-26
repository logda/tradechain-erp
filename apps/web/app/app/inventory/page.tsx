import type {
  InventoryBalanceListItem,
  InventoryBalanceListResponse,
  InventoryLedgerListItem,
  InventoryLedgerListResponse,
} from '@erp/shared';
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
  minWidth: '960px',
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

const quantityStyle = {
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

function getInventoryApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeBalances(value: InventoryBalanceListResponse): InventoryBalanceListItem[] {
  return value.items.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }

    const entry = item as Partial<InventoryBalanceListItem>;

    return [
      {
        productId: normalizeNumber(entry.productId),
        sku: typeof entry.sku === 'string' ? entry.sku : '',
        productName: typeof entry.productName === 'string' ? entry.productName : '',
        warehouseId: normalizeNumber(entry.warehouseId),
        warehouseName: typeof entry.warehouseName === 'string' ? entry.warehouseName : '',
        locationId: normalizeNumber(entry.locationId),
        locationName: typeof entry.locationName === 'string' ? entry.locationName : '',
        onHandQty: normalizeNumber(entry.onHandQty),
        availableQty: normalizeNumber(entry.availableQty),
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
      },
    ];
  });
}

function normalizeLedger(value: InventoryLedgerListResponse): InventoryLedgerListItem[] {
  return value.items.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }

    const entry = item as Partial<InventoryLedgerListItem>;

    return [
      {
        id: normalizeNumber(entry.id),
        movementType: typeof entry.movementType === 'string' ? entry.movementType : '',
        sourceBizType: typeof entry.sourceBizType === 'string' ? entry.sourceBizType : '',
        sourceDocNo: typeof entry.sourceDocNo === 'string' ? entry.sourceDocNo : '',
        productId: normalizeNumber(entry.productId),
        sku: typeof entry.sku === 'string' ? entry.sku : '',
        warehouseName: typeof entry.warehouseName === 'string' ? entry.warehouseName : '',
        locationName: typeof entry.locationName === 'string' ? entry.locationName : '',
        quantityDelta: normalizeNumber(entry.quantityDelta),
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      },
    ];
  });
}

function hasValidInventoryBalanceResponse(
  value: unknown,
): value is InventoryBalanceListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as InventoryBalanceListResponse).items) &&
    typeof (value as InventoryBalanceListResponse).total === 'number'
  );
}

function hasValidInventoryLedgerResponse(
  value: unknown,
): value is InventoryLedgerListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as InventoryLedgerListResponse).items) &&
    typeof (value as InventoryLedgerListResponse).total === 'number'
  );
}

async function loadBalances(
  session: { role: string; user: string },
  query: { page: number; pageSize: number },
) {
  try {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    const response = await fetch(
      `${getInventoryApiBaseUrl()}/inventory/balances?${params.toString()}`,
      {
        cache: 'no-store',
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    if (!hasValidInventoryBalanceResponse(result)) {
      return null;
    }

    return {
      items: normalizeBalances(result),
      total: normalizeNumber(result.total),
      page: normalizeNumber(result.page) || 1,
      pageSize: normalizeNumber(result.pageSize) || 20,
    };
  } catch {
    return null;
  }
}

async function loadLedger(
  session: { role: string; user: string },
  query: { page: number; pageSize: number },
) {
  try {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    const response = await fetch(
      `${getInventoryApiBaseUrl()}/inventory/ledger?${params.toString()}`,
      {
        cache: 'no-store',
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    if (!hasValidInventoryLedgerResponse(result)) {
      return null;
    }

    return {
      items: normalizeLedger(result),
      total: normalizeNumber(result.total),
      page: normalizeNumber(result.page) || 1,
      pageSize: normalizeNumber(result.pageSize) || 20,
    };
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

export default async function AppInventoryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const balanceQuery = {
    page: normalizePageNumber(
      Array.isArray(resolvedSearchParams.balancePage)
        ? resolvedSearchParams.balancePage[0]
        : resolvedSearchParams.balancePage,
      1,
    ),
    pageSize: normalizePageNumber(
      Array.isArray(resolvedSearchParams.balancePageSize)
        ? resolvedSearchParams.balancePageSize[0]
        : resolvedSearchParams.balancePageSize,
      20,
    ),
  };
  const ledgerQuery = {
    page: normalizePageNumber(
      Array.isArray(resolvedSearchParams.ledgerPage)
        ? resolvedSearchParams.ledgerPage[0]
        : resolvedSearchParams.ledgerPage,
      1,
    ),
    pageSize: normalizePageNumber(
      Array.isArray(resolvedSearchParams.ledgerPageSize)
        ? resolvedSearchParams.ledgerPageSize[0]
        : resolvedSearchParams.ledgerPageSize,
      20,
    ),
  };
  const allowed =
    canViewFormalModule(session, 'purchase') ||
    canViewFormalModule(session, 'operations');

  if (!allowed) {
    return (
      <AppShell
        title="库存中心"
        subtitle="当前角色不在采购/运营域内，不能查看库存余额和出入库台账。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问库存中心</h2>
          <p>请切换到采购、采购主管、老板或管理员视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const [balanceResult, ledgerResult] = await Promise.all([
    loadBalances(session, balanceQuery),
    loadLedger(session, ledgerQuery),
  ]);
  const balances =
    balanceResult ?? paginateItems([], balanceQuery.page, balanceQuery.pageSize);
  const ledger =
    ledgerResult ?? paginateItems([], ledgerQuery.page, ledgerQuery.pageSize);
  const totalOnHand = balances.items.reduce((sum, item) => sum + item.onHandQty, 0);
  const totalAvailable = balances.items.reduce(
    (sum, item) => sum + item.availableQty,
    0,
  );
  const skuCount = new Set(balances.items.map((item) => item.sku).filter(Boolean)).size;

  return (
    <AppShell
      title="库存中心"
      subtitle="正式版库存视角，展示余额、可用量和最近出入库台账，为采购、发货和老板汇报提供统一口径。"
      session={session}
    >
      <StatStrip
        items={[
          { label: 'SKU 数量', value: skuCount },
          { label: '现存合计', value: totalOnHand },
          { label: '可用合计', value: totalAvailable },
          { label: '台账笔数', value: ledger.total },
        ]}
      />

      <section style={sectionStyle}>
        <section style={introCardStyle}>
          <h2 style={introTitleStyle}>库存协同说明</h2>
          <p style={introMetaStyle}>
            当前库存中心已经接通余额与台账接口，适合作为正式版仓储可视化入口。后续收货单、出库单确认后，可直接回写这里的数量与流水。
          </p>
          <div style={actionWrapStyle}>
            <Link href="/app/purchase-orders" style={actionLinkStyle}>
              回到正式采购单
            </Link>
            <Link href="/app/shipment-batches" style={actionLinkStyle}>
              查看发货批次
            </Link>
          </div>
        </section>

        <FormalDataTable title="库存余额" total={balances.total}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>SKU</th>
                  <th style={headCellStyle}>商品名称</th>
                  <th style={headCellStyle}>仓库</th>
                  <th style={headCellStyle}>库位</th>
                  <th style={headCellStyle}>现存</th>
                  <th style={headCellStyle}>可用</th>
                  <th style={headCellStyle}>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {balances.items.map((item) => (
                  <tr key={`${item.productId}-${item.warehouseId}-${item.locationId}`}>
                    <td style={cellStyle}>{item.sku || '-'}</td>
                    <td style={cellStyle}>{item.productName || '-'}</td>
                    <td style={cellStyle}>{item.warehouseName || '-'}</td>
                    <td style={cellStyle}>{item.locationName || '-'}</td>
                    <td style={cellStyle}>
                      <span style={quantityStyle}>{item.onHandQty}</span>
                    </td>
                    <td style={cellStyle}>
                      <span style={quantityStyle}>{item.availableQty}</span>
                    </td>
                    <td style={cellStyle}>{formatDateTime(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <FormalPagination
            pathname="/app/inventory"
            params={{
              role: session.role,
              user: session.user,
              access:
                Array.isArray(resolvedSearchParams.access)
                  ? resolvedSearchParams.access[0]
                  : resolvedSearchParams.access,
              ledgerPage: ledger.page,
              ledgerPageSize: ledger.pageSize,
            }}
            page={balances.page}
            pageSize={balances.pageSize}
            total={balances.total}
            summaryLabel="库存余额"
            pageParamName="balancePage"
            pageSizeParamName="balancePageSize"
          />
        </FormalDataTable>

        <FormalDataTable title="最近库存台账" total={ledger.total}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>动作</th>
                  <th style={headCellStyle}>来源业务</th>
                  <th style={headCellStyle}>单号</th>
                  <th style={headCellStyle}>SKU</th>
                  <th style={headCellStyle}>仓库 / 库位</th>
                  <th style={headCellStyle}>数量变化</th>
                  <th style={headCellStyle}>发生时间</th>
                </tr>
              </thead>
              <tbody>
                {ledger.items.map((item) => (
                  <tr key={item.id}>
                    <td style={cellStyle}>{item.movementType || '-'}</td>
                    <td style={cellStyle}>{item.sourceBizType || '-'}</td>
                    <td style={cellStyle}>{item.sourceDocNo || '-'}</td>
                    <td style={cellStyle}>{item.sku || '-'}</td>
                    <td style={cellStyle}>
                      {item.warehouseName || '-'} / {item.locationName || '-'}
                    </td>
                    <td style={cellStyle}>
                      <span style={quantityStyle}>{item.quantityDelta}</span>
                    </td>
                    <td style={cellStyle}>{formatDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <FormalPagination
            pathname="/app/inventory"
            params={{
              role: session.role,
              user: session.user,
              access:
                Array.isArray(resolvedSearchParams.access)
                  ? resolvedSearchParams.access[0]
                  : resolvedSearchParams.access,
              balancePage: balances.page,
              balancePageSize: balances.pageSize,
            }}
            page={ledger.page}
            pageSize={ledger.pageSize}
            total={ledger.total}
            summaryLabel="库存台账"
            pageParamName="ledgerPage"
            pageSizeParamName="ledgerPageSize"
          />
        </FormalDataTable>
      </section>
    </AppShell>
  );
}
