import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { AuditLogTable } from '../_components/audit-log-table';
import { FormalDataTable } from '../_components/formal-data-table';
import { FormalPagination } from '../_components/formal-pagination';
import { StatStrip } from '../_components/stat-strip';
import {
  canViewFormalAuditCenter,
  resolveDemoSession,
  type DemoSession,
} from '../_lib/demo-session';
import {
  hasValidAuditLogResponse,
  hasValidUnifiedAuditLogResponse,
  type AuditLogItem,
  type UnifiedAuditLogItem,
} from '../_lib/audit-log';
import { buildFormalRequestHeaders } from '../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../_lib/formal-request-signature';
import { normalizePageNumber } from '../_lib/formal-pagination';

type SearchParams = Record<string, string | string[] | undefined>;

type AppAuditPageProps = {
  searchParams?: Promise<SearchParams>;
};

type AuditModuleConfig = {
  key: string;
  label: string;
  endpoint: string;
};

type AggregatedAuditLogItem = AuditLogItem & {
  moduleKey: string;
  moduleLabel: string;
};

type LoadedAuditModule = {
  key: string;
  label: string;
  count: number;
  items: AggregatedAuditLogItem[];
  failed: boolean;
};

type AuditCenterLoadResult = {
  mode: 'unified' | 'fallback';
  modules: LoadedAuditModule[];
  items: AggregatedAuditLogItem[];
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const auditModules: AuditModuleConfig[] = [
  { key: 'quotes', label: '报价 Quote', endpoint: '/quotes/audit-logs' },
  {
    key: 'quote-inquiries',
    label: '询价 Inquiry',
    endpoint: '/quote-inquiries/audit-logs',
  },
  { key: 'samples', label: '样品 Sample', endpoint: '/samples/audit-logs' },
  {
    key: 'sales-orders',
    label: '销售单 Sales Order',
    endpoint: '/sales-orders/audit-logs',
  },
  {
    key: 'purchase-orders',
    label: '采购单 Purchase Order',
    endpoint: '/purchase-orders/audit-logs',
  },
  {
    key: 'shipment-batches',
    label: '发货批次 Shipment',
    endpoint: '/shipment-batches/audit-logs',
  },
  {
    key: 'after-sales',
    label: '售后 After-sales',
    endpoint: '/after-sales/audit-logs',
  },
  {
    key: 'counterparties',
    label: '往来单位 Counterparty',
    endpoint: '/counterparties/audit-logs',
  },
  { key: 'products', label: '商品 Product', endpoint: '/products/audit-logs' },
];

function getAuditApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

async function loadAuditModule(
  module: AuditModuleConfig,
  session: DemoSession,
): Promise<LoadedAuditModule> {
  try {
    const response = await fetch(`${getAuditApiBaseUrl()}${module.endpoint}`, {
      cache: 'no-store',
      headers: {
        ...buildFormalRequestHeaders(session),
        ...buildSignedFormalRequestHeaders(session),
      },
    });

    if (!response.ok) {
      return { key: module.key, label: module.label, count: 0, items: [], failed: true };
    }

    const result = (await response.json().catch(() => null)) as unknown;
    if (!hasValidAuditLogResponse(result)) {
      return { key: module.key, label: module.label, count: 0, items: [], failed: true };
    }

    const items = result.items.map((item) => ({
      ...item,
      moduleKey: module.key,
      moduleLabel: module.label,
    }));

    return {
      key: module.key,
      label: module.label,
      count: items.length,
      failed: false,
      items,
    };
  } catch {
    return { key: module.key, label: module.label, count: 0, items: [], failed: true };
  }
}

async function loadUnifiedAuditCenter(
  session: DemoSession,
): Promise<AuditCenterLoadResult | null> {
  try {
    const response = await fetch(`${getAuditApiBaseUrl()}/audit-logs`, {
      cache: 'no-store',
      headers: {
        ...buildFormalRequestHeaders(session),
        ...buildSignedFormalRequestHeaders(session),
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    if (!hasValidUnifiedAuditLogResponse(result)) {
      return null;
    }

    return {
      mode: 'unified',
      modules: result.modules.map((module) => ({
        key: module.key,
        label: module.label,
        count: module.count,
        failed: module.failed,
        items: result.items
          .filter((item) => item.moduleKey === module.key)
          .map(toAggregatedAuditLogItem),
      })),
      items: result.items
        .map(toAggregatedAuditLogItem)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    };
  } catch {
    return null;
  }
}

async function loadFallbackAuditCenter(
  session: DemoSession,
): Promise<AuditCenterLoadResult> {
  const modules = await Promise.all(
    auditModules.map((module) => loadAuditModule(module, session)),
  );

  return {
    mode: 'fallback',
    modules,
    items: modules
      .flatMap((module) => module.items)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

function toAggregatedAuditLogItem(item: UnifiedAuditLogItem): AggregatedAuditLogItem {
  return {
    ...item,
    moduleLabel: item.moduleLabel,
  };
}

const layoutStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const backLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const heroCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '20px',
  padding: '22px 24px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, #eef6ff 100%)',
  boxShadow: '0 18px 56px rgba(15, 23, 42, 0.08)',
} satisfies React.CSSProperties;

const heroTitleStyle = {
  margin: '0 0 8px',
  fontSize: '30px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const heroSubStyle = {
  margin: 0,
  color: '#475569',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const moduleFilterStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
} satisfies React.CSSProperties;

const moduleFilterLinkStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  padding: '9px 13px',
  background: '#ffffff',
  color: '#334155',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 700,
} satisfies React.CSSProperties;

const moduleFilterActiveStyle = {
  ...moduleFilterLinkStyle,
  border: '1px solid #0f766e',
  background: '#ecfdf5',
  color: '#0f766e',
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  minWidth: '980px',
  borderCollapse: 'collapse' as const,
} satisfies React.CSSProperties;

const tableWrapStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #d8e1ea',
  borderRadius: '6px',
} satisfies React.CSSProperties;

const headCellStyle = {
  textAlign: 'left' as const,
  fontSize: '12px',
  color: '#334155',
  background: '#eef3f8',
  borderBottom: '1px solid #cfd8e3',
  borderRight: '1px solid #d8e1ea',
  padding: '10px',
} satisfies React.CSSProperties;

const cellStyle = {
  padding: '12px 10px',
  borderBottom: '1px solid #e5ebf2',
  borderRight: '1px solid #e5ebf2',
  fontSize: '13px',
  color: '#0f172a',
  verticalAlign: 'top' as const,
} satisfies React.CSSProperties;

export default async function AppAuditPage({ searchParams }: AppAuditPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);

  if (!canViewFormalAuditCenter(session)) {
    return (
      <AppShell
        title="正式日志中心"
        subtitle="集中查看正式业务操作日志。"
        session={session}
      >
        <section style={layoutStyle}>
          <Link href="/app" style={backLinkStyle}>
            返回正式首页
          </Link>
          <article style={heroCardStyle}>
            <h3 style={heroTitleStyle}>无权限访问正式日志中心</h3>
            <p style={heroSubStyle}>
              日志中心涉及业务操作日志，请联系管理员配置“审计查看”权限。
            </p>
          </article>
        </section>
      </AppShell>
    );
  }

  const loadedAuditCenter = await loadUnifiedAuditCenter(session) ??
    await loadFallbackAuditCenter(session);
  const modules = loadedAuditCenter.modules;
  const allItems = loadedAuditCenter.items;
  const selectedModule = readParam(resolvedSearchParams.module);
  const selectedModuleKey = modules.some((module) => module.key === selectedModule)
    ? selectedModule
    : 'all';
  const visibleItems =
    selectedModuleKey === 'all'
      ? allItems
      : allItems.filter((item) => item.moduleKey === selectedModuleKey);
  const selectedModuleLabel =
    selectedModuleKey === 'all'
      ? '全部模块'
      : modules.find((module) => module.key === selectedModuleKey)?.label ?? '全部模块';
  const failedModules = modules.filter((module) => module.failed);
  const logPage = normalizePageNumber(readParam(resolvedSearchParams.page), 1);
  const logPageSize = normalizePageNumber(readParam(resolvedSearchParams.pageSize), 20);
  const sortedVisibleItems = [...visibleItems].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const pagedVisibleItems = sortedVisibleItems.slice(
    (logPage - 1) * logPageSize,
    logPage * logPageSize,
  );
  const logPaginationParams = {
    module: selectedModuleKey !== 'all' ? selectedModuleKey : undefined,
  };

  const buildModuleHref = (moduleKey: string) => {
    const params = new URLSearchParams();
    if (moduleKey !== 'all') {
      params.set('module', moduleKey);
    }

    const query = params.toString();
    return `/app/logs${query ? `?${query}` : ''}`;
  };

  return (
    <AppShell
      title="正式日志中心"
      subtitle="集中查看报价、销售、采购、发货、售后、主数据等各板块操作日志。"
      session={session}
    >
      <section style={layoutStyle}>
        <Link href="/app" style={backLinkStyle}>
          返回正式首页
        </Link>

        <article style={heroCardStyle}>
          <h3 style={heroTitleStyle}>全链路操作追溯</h3>
          <p style={heroSubStyle}>
            {loadedAuditCenter.mode === 'unified'
              ? '统一审计 API 已接入，可按板块筛选并追溯最新操作日志。'
              : '统一审计 API 暂不可用，页面已降级为前端聚合各模块日志接口。'}
          </p>
        </article>

        <StatStrip
          items={[
            { label: '聚合模块', value: modules.length },
            { label: '审计总数', value: allItems.length },
            { label: '当前筛选', value: visibleItems.length },
            { label: '加载异常模块', value: failedModules.length },
          ]}
        />

        <section style={moduleFilterStyle} aria-label="日志模块筛选">
          <Link
            href={buildModuleHref('all')}
            style={selectedModuleKey === 'all' ? moduleFilterActiveStyle : moduleFilterLinkStyle}
          >
            全部模块 All ({allItems.length})
          </Link>
          {modules.map((module) => (
            <Link
              key={module.key}
              href={buildModuleHref(module.key)}
              style={
                selectedModuleKey === module.key
                  ? moduleFilterActiveStyle
                  : moduleFilterLinkStyle
              }
            >
              {module.label} ({module.count})
            </Link>
          ))}
        </section>

        <FormalDataTable title="模块审计概览" total={modules.length}>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>模块 Module</th>
                  <th style={headCellStyle}>日志数量 Count</th>
                  <th style={headCellStyle}>加载状态 Load Status</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module.key}>
                    <td style={cellStyle}>{module.label}</td>
                    <td style={cellStyle}>{module.count}</td>
                    <td style={cellStyle}>{module.failed ? '加载失败' : '正常'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormalDataTable>

        <AuditLogTable session={session}
          items={pagedVisibleItems}
          title={`${selectedModuleLabel}最新日志`}
          limit={logPageSize}
          showModule
          total={visibleItems.length}
        />
        <FormalPagination
          pathname="/app/logs"
          params={logPaginationParams}
          page={logPage}
          pageSize={logPageSize}
          total={visibleItems.length}
          summaryLabel="日志"
        />
      </section>
    </AppShell>
  );
}
