import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import { AuditLogTable } from '../../_components/audit-log-table';
import {
  type DemoSession,
  resolveDemoSession,
} from '../../_lib/demo-session';
import { hasValidAuditLogResponse } from '../../_lib/audit-log';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';
import { canUseFormalMasterDataActions } from '../../_lib/formal-access';
import { normalizePageNumber, paginateItems } from '../../_lib/formal-pagination';
import { normalizeCounterpartyDisplayItem } from './counterparty-display';
import { CounterpartyMasterDataClient } from './counterparty-master-data-client';
import { CounterpartyFilterForm } from './counterparty-filter-form';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';
import {
  buildCounterpartyOwnerOptions,
  fallbackCounterpartyAssignableUsers,
  type CounterpartyAssignableUser,
  type CounterpartyType,
} from './owner-options';

type SearchParams = Record<string, string | string[] | undefined>;

type CounterpartyListItem = {
  id: number;
  type: CounterpartyType;
  code: string;
  name: string;
  shortName: string;
  region: string;
  ownerName: string;
  contactName: string;
  phone: string;
  address: string;
  bankName: string;
  bankAccount: string;
  remark: string;
  status: 'active' | 'inactive';
  createdAt: string;
  createdBy: string;
  updatedBy?: string;
  deactivatedReason?: string;
};

type CounterpartyListResponse = {
  items: CounterpartyListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type AssignableUserListResponse = {
  items: CounterpartyAssignableUser[];
  total: number;
  page: number;
  pageSize: number;
};

const typeLabels: Record<CounterpartyType, string> = {
  customer: '客户 Customer',
  supplier: '供应商 Supplier',
  both: '客户兼供应商 Both',
};

const fallbackItems: CounterpartyListItem[] = [
  {
    id: 1,
    type: 'customer',
    code: 'CUST-ACME',
    name: 'Acme Trading',
    shortName: 'Acme',
    region: 'United States',
    ownerName: 'Zoe',
    contactName: 'Amy Chen',
    phone: '+1-202-555-0101',
    address: 'Los Angeles Harbor 88 号',
    bankName: 'Bank of America',
    bankAccount: '1234567890',
    remark: '北美客户',
    status: 'active',
    createdAt: '2026-07-11T09:00:00.000Z',
    createdBy: 'system',
  },
  {
    id: 2,
    type: 'supplier',
    code: 'SUP-BRAVO',
    name: 'Bravo Industrial',
    shortName: 'Bravo',
    region: 'Shenzhen',
    ownerName: 'Leo',
    contactName: 'Ben Li',
    phone: '+86-755-5555-0102',
    address: 'Shenzhen Baoan 99 号',
    bankName: '平安银行深圳分行',
    bankAccount: '6222000000000002',
    remark: '华南供应商',
    status: 'active',
    createdAt: '2026-07-11T09:05:00.000Z',
    createdBy: 'system',
  },
];

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
  padding: '14px 18px',
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  background: 'rgba(255,255,255,0.78)',
} satisfies React.CSSProperties;

const linkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
} satisfies React.CSSProperties;

const filterStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '10px',
  marginTop: '14px',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '6px',
  fontSize: '13px',
  color: '#334155',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cfd8e3',
  borderRadius: '4px',
  padding: '9px 10px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const filterButtonStyle = {
  alignSelf: 'end',
  border: '1px solid #0f172a',
  borderRadius: '4px',
  padding: '9px 12px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties;

function getCounterpartyApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hasValidCounterpartyListResponse(
  value: unknown,
): value is CounterpartyListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as CounterpartyListResponse).items) &&
    typeof (value as CounterpartyListResponse).total === 'number'
  );
}

function hasValidAssignableUserListResponse(
  value: unknown,
): value is AssignableUserListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as AssignableUserListResponse).items)
  );
}

function getAllowedTypes(session: DemoSession): CounterpartyType[] {
  if (session.role === 'sales' || session.role === 'sales_manager') {
    return ['customer', 'both'];
  }

  if (session.role === 'purchase' || session.role === 'purchase_manager') {
    return ['supplier', 'both'];
  }

  return ['customer', 'supplier', 'both'];
}

function getDefaultType(session: DemoSession): CounterpartyType | null {
  if (session.role === 'sales' || session.role === 'sales_manager') {
    return 'customer';
  }

  if (session.role === 'purchase' || session.role === 'purchase_manager') {
    return 'supplier';
  }

  return null;
}

function normalizeRequestedType(
  value: string | undefined,
  allowedTypes: CounterpartyType[],
  defaultType: CounterpartyType | null,
) {
  if (
    (value === 'customer' || value === 'supplier' || value === 'both') &&
    allowedTypes.includes(value)
  ) {
    return value;
  }

  return defaultType;
}

function buildQuery(searchParams: SearchParams, session: DemoSession) {
  const allowedTypes = getAllowedTypes(session);
  const defaultType = getDefaultType(session);
  const type = normalizeRequestedType(
    readParam(searchParams.type),
    allowedTypes,
    defaultType,
  );

  return {
    type,
    status: readParam(searchParams.status),
    keyword: readParam(searchParams.keyword),
    ownerName: readParam(searchParams.ownerName),
    page: normalizePageNumber(readParam(searchParams.page), 1),
    pageSize: normalizePageNumber(readParam(searchParams.pageSize), 20),
  };
}

function buildApiUrl(query: ReturnType<typeof buildQuery>) {
  const params = new URLSearchParams();

  if (query.type) {
    params.set('type', query.type);
  }

  if (query.status) {
    params.set('status', query.status);
  }

  if (query.keyword) {
    params.set('keyword', query.keyword);
  }

  if (query.ownerName) {
    params.set('ownerName', query.ownerName);
  }

  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));

  const queryString = params.toString();
  return `${getCounterpartyApiBaseUrl()}/counterparties${queryString ? `?${queryString}` : ''}`;
}

async function loadAssignableUsers(
  session: DemoSession,
): Promise<CounterpartyAssignableUser[]> {
  try {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '200',
    });
    const response = await fetch(
      `${getCounterpartyApiBaseUrl()}/admin/users?${params.toString()}`,
      {
        cache: 'no-store',
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return fallbackCounterpartyAssignableUsers;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidAssignableUserListResponse(result)
      ? result.items
      : fallbackCounterpartyAssignableUsers;
  } catch {
    return fallbackCounterpartyAssignableUsers;
  }
}

async function loadCounterparties(
  query: ReturnType<typeof buildQuery>,
  session: DemoSession,
) {
  try {
    const response = await fetch(buildApiUrl(query), {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidCounterpartyListResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadAuditLogs(session: DemoSession) {
  try {
    const response = await fetch(`${getCounterpartyApiBaseUrl()}/counterparties/audit-logs`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidAuditLogResponse(result) ? result : null;
  } catch {
    return null;
  }
}

function filterFallbackItems(
  items: CounterpartyListItem[],
  query: ReturnType<typeof buildQuery>,
) {
  return items.filter((item) => {
    if (query.type && item.type !== query.type && item.type !== 'both') {
      return false;
    }

    if (query.status && item.status !== query.status) {
      return false;
    }

    const keyword = query.keyword?.toLowerCase();
    if (
      keyword &&
      ![
        item.code,
        item.name,
        item.shortName,
        item.region,
        item.ownerName,
        item.contactName,
        item.phone,
        item.address,
        item.bankName,
        item.bankAccount,
        item.remark,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    ) {
      return false;
    }

    return !query.ownerName || item.ownerName === query.ownerName;
  });
}

function describeDefaultType(type: CounterpartyType | null) {
  if (!type) {
    return '全部 All';
  }

  return typeLabels[type];
}

export default async function AppCounterpartiesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const allowedTypes = getAllowedTypes(session);
  const canManageMasterData = canUseFormalMasterDataActions(session);
  const query = buildQuery(resolvedSearchParams, session);
  const [result, auditLogs, assignableUsers] = await Promise.all([
    loadCounterparties(query, session),
    loadAuditLogs(session),
    loadAssignableUsers(session),
  ]);
  const loadedCounterpartyResult =
    result ??
    paginateItems(
      filterFallbackItems(fallbackItems, query),
      query.page,
      query.pageSize,
    );
  const counterpartyResult = {
    ...loadedCounterpartyResult,
    items: loadedCounterpartyResult.items.map(normalizeCounterpartyDisplayItem),
  };
  const auditLogItems = auditLogs?.items ?? [];
  const masterDataRequestHeaders = buildFormalRequestHeaders(session);
  const ownerOptions = buildCounterpartyOwnerOptions(assignableUsers);
  return (
    <AppShell
      title="往来单位主数据"
      subtitle="统一维护客户、供应商与客户兼供应商，报价、销售、采购都从这里下拉选择。"
      session={session}
    >
      <div style={toolbarStyle}>
        <Link href="/app" style={linkStyle}>
          返回正式首页
        </Link>
        <span style={{ color: '#475569', fontSize: '13px', fontWeight: 600 }}>
          当前角色默认查看：{describeDefaultType(query.type)}
        </span>
      </div>

      <CounterpartyMasterDataClient
        initialItems={counterpartyResult.items}
        initialTotal={counterpartyResult.total}
        page={counterpartyResult.page}
        pageSize={counterpartyResult.pageSize}
        canManageMasterData={canManageMasterData}
        allowedTypes={allowedTypes}
        assignableUsers={assignableUsers}
        updatedBy={session.user}
        actorAccessScopes={session.accessScopes}
        requestHeaders={masterDataRequestHeaders}
        apiBaseUrl={getCounterpartyApiBaseUrl()}
        paginationParams={{
          role: session.role,
          user: session.user,
          access: readParam(resolvedSearchParams.access),
          type: query.type ?? undefined,
          status: query.status,
          keyword: query.keyword,
          ownerName: query.ownerName,
        }}
        filters={query}
        filterSlot={
          <CounterpartyFilterForm
            key="counterparty-filter-form"
            pathname="/app/master-data/counterparties"
            role={session.role}
            user={session.user}
            access={readParam(resolvedSearchParams.access)}
            allowedTypes={allowedTypes}
            defaultType={getDefaultType(session)}
            initialType={query.type}
            initialStatus={query.status}
            initialKeyword={query.keyword}
            initialOwnerName={query.ownerName}
            pageSize={query.pageSize}
            ownerOptions={ownerOptions}
            labelStyle={labelStyle}
            inputStyle={inputStyle}
            filterStyle={filterStyle}
            filterButtonStyle={filterButtonStyle}
          />
        }
      />

      <AuditLogTable items={auditLogItems} />
    </AppShell>
  );
}
