import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../../_lib/demo-session';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../_lib/audit-log';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';
import { normalizePageNumber, paginateItems } from '../../_lib/formal-pagination';
import { AdminUsersClient } from './admin-users-client';

type SearchParams = Record<string, string | string[] | undefined>;

type UserListItem = {
  id: number;
  username: string;
  realName: string;
  roleCode: string;
  status: string;
  fullAccess: boolean;
  accessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  createdAt: string;
  createdBy: string;
  deactivatedReason?: string;
};

type UserListResponse = {
  items: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type RolePermissionItem = {
  roleCode: string;
  accessScopes: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  updatedBy: string;
  updatedAt: string;
};

type RolePermissionResponse = {
  items: RolePermissionItem[];
};

function getAdminApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

const fullAdminAccessScopes = {
  modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'admin', 'audit'],
  dataScope: 'all',
  actions: ['audit.view', 'admin.user.write', 'admin.role.write', 'master_data.write', 'product.write'],
};

function hasValidUserListResponse(value: unknown): value is UserListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as UserListResponse).items) &&
    typeof (value as UserListResponse).total === 'number'
  );
}

function hasValidRolePermissionResponse(
  value: unknown,
): value is RolePermissionResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as RolePermissionResponse).items)
  );
}

async function loadUsers(
  headers: Record<string, string>,
  query: { page: number; pageSize: number },
) {
  try {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    const response = await fetch(`${getAdminApiBaseUrl()}/admin/users?${params.toString()}`, {
      cache: 'no-store',
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidUserListResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadAuditLogs(headers: Record<string, string>) {
  try {
    const response = await fetch(`${getAdminApiBaseUrl()}/admin/users/audit-logs`, {
      cache: 'no-store',
      headers,
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

async function loadRolePermissions(headers: Record<string, string>) {
  try {
    const response = await fetch(`${getAdminApiBaseUrl()}/admin/users/role-permissions`, {
      cache: 'no-store',
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidRolePermissionResponse(result) ? result : null;
  } catch {
    return null;
  }
}

const fallbackUsers: UserListItem[] = [
  {
    id: 1,
    username: 'admin',
    realName: '系统管理员',
    roleCode: 'admin',
    status: 'active',
    fullAccess: true,
    accessScopes: {
      modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'admin', 'audit'],
      dataScope: 'all',
      actions: ['admin.user.write', 'admin.role.write', 'master_data.write', 'product.write'],
    },
    createdAt: '2026-07-11T09:00:00.000Z',
    createdBy: 'system',
  },
  {
    id: 2,
    username: 'mia',
    realName: 'Mia',
    roleCode: 'boss',
    status: 'active',
    fullAccess: true,
    accessScopes: {
      modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit'],
      dataScope: 'all',
      actions: ['product.write', 'sales.order.write', 'purchase.order.approve', 'boss.confirm', 'finance.confirm'],
    },
    createdAt: '2026-07-11T09:05:00.000Z',
    createdBy: 'system',
  },
  {
    id: 3,
    username: 'zoe',
    realName: 'Zoe',
    roleCode: 'sales',
    status: 'active',
    fullAccess: false,
    accessScopes: {
      modules: ['sales'],
      dataScope: 'own_sales',
      actions: ['sales.quote.write', 'sales.inquiry.submit', 'sales.order.write'],
    },
    createdAt: '2026-07-11T09:10:00.000Z',
    createdBy: 'admin',
  },
];

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
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

function resolveRoleAccessScopes(roleCode: string) {
  if (roleCode === 'admin') {
    return {
      modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'admin', 'audit'],
      dataScope: 'all',
      actions: [
        'audit.view',
        'admin.user.write',
        'admin.role.write',
        'master_data.write',
        'product.write',
        'sales.quote.write',
        'sales.inquiry.submit',
        'sales.order.write',
        'sales.sample.submit',
        'sales.sample.approve',
        'sales.sample.execute',
        'purchase.order.create',
        'purchase.order.submit',
        'purchase.order.approve',
        'purchase.sample.execute',
        'shipment.update',
        'after_sales.process',
        'boss.confirm',
        'finance.confirm',
      ],
    };
  }

  if (roleCode === 'boss') {
    return {
      modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit'],
      dataScope: 'all',
      actions: ['product.write', 'sales.order.write', 'purchase.order.approve', 'boss.confirm', 'finance.confirm'],
    };
  }

  if (roleCode === 'sales_manager') {
    return {
      modules: ['sales', 'boss_dashboard'],
      dataScope: 'sales_team',
      actions: ['sales.quote.write', 'sales.inquiry.submit', 'sales.order.write', 'sales.sample.submit', 'sales.sample.approve', 'sales.sample.execute'],
    };
  }

  if (roleCode === 'sales') {
    return {
      modules: ['sales'],
      dataScope: 'own_sales',
      actions: ['sales.quote.write', 'sales.inquiry.submit', 'sales.order.write', 'sales.sample.submit', 'sales.sample.execute'],
    };
  }

  if (roleCode === 'purchase_manager') {
    return {
      modules: ['purchase', 'operations', 'boss_dashboard'],
      dataScope: 'purchase_team',
      actions: [
        'purchase.order.create',
        'purchase.order.submit',
        'purchase.order.approve',
        'shipment.update',
        'after_sales.process',
      ],
    };
  }

  return {
    modules: ['purchase', 'operations'],
    dataScope: 'own_purchase',
    actions: [
      'purchase.order.create',
      'purchase.order.submit',
      'shipment.update',
      'after_sales.process',
    ],
  };
}

const fallbackRolePermissions: RolePermissionItem[] = [
  {
    roleCode: 'admin',
    accessScopes: resolveRoleAccessScopes('admin'),
    updatedBy: 'system',
    updatedAt: '2026-07-11T09:00:00.000Z',
  },
  {
    roleCode: 'boss',
    accessScopes: resolveRoleAccessScopes('boss'),
    updatedBy: 'system',
    updatedAt: '2026-07-11T09:00:00.000Z',
  },
  {
    roleCode: 'sales_manager',
    accessScopes: resolveRoleAccessScopes('sales_manager'),
    updatedBy: 'system',
    updatedAt: '2026-07-11T09:00:00.000Z',
  },
  {
    roleCode: 'sales',
    accessScopes: resolveRoleAccessScopes('sales'),
    updatedBy: 'system',
    updatedAt: '2026-07-11T09:00:00.000Z',
  },
  {
    roleCode: 'purchase_manager',
    accessScopes: resolveRoleAccessScopes('purchase_manager'),
    updatedBy: 'system',
    updatedAt: '2026-07-11T09:00:00.000Z',
  },
  {
    roleCode: 'purchase',
    accessScopes: resolveRoleAccessScopes('purchase'),
    updatedBy: 'system',
    updatedAt: '2026-07-11T09:00:00.000Z',
  },
];

export default async function AppAdminUsersPage({
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
  const adminAccessScopes = session.accessScopes ?? fullAdminAccessScopes;
  const adminRequestHeaders = buildFormalApiRequestHeaders({
    role: session.role,
    user: session.user,
    username: session.username,
    accessScopes: adminAccessScopes,
  });

  if (!canViewFormalModule(session, 'admin')) {
    return (
      <AppShell
        title="用户管理"
        subtitle="当前角色不是管理员，不能访问用户管理。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问用户管理</h2>
          <p>请切换到管理员视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const [result, auditLogs, rolePermissions] = await Promise.all([
    loadUsers(adminRequestHeaders, query),
    loadAuditLogs(adminRequestHeaders),
    loadRolePermissions(adminRequestHeaders),
  ]);
  const userResult = result ?? paginateItems(fallbackUsers, query.page, query.pageSize);
  const auditLogItems = auditLogs?.items ?? [];
  const rolePermissionItems = rolePermissions?.items ?? fallbackRolePermissions;

  return (
    <AppShell
      title="用户管理"
      subtitle="管理员可以新增用户、注销用户，并查看账号是否具备全业务访问权限。"
      session={session}
    >
      <div style={toolbarStyle}>
        <Link href="/app" style={backLinkStyle}>
          返回正式首页
        </Link>
        <Link
          href="/app/dashboard/boss"
          style={backLinkStyle}
        >
          去经营驾驶舱
        </Link>
      </div>

      <AdminUsersClient
        initialItems={userResult.items}
        initialTotal={userResult.total}
        initialAuditLogItems={auditLogItems}
        initialRolePermissionItems={rolePermissionItems}
        page={userResult.page}
        pageSize={userResult.pageSize}
        session={{
          role: session.role,
          user: session.user,
        }}
        adminAccessScopes={adminAccessScopes}
        requestHeaders={adminRequestHeaders}
        apiBaseUrl={getAdminApiBaseUrl()}
        paginationParams={{
          role: session.role,
          user: session.user,
          access:
            Array.isArray(resolvedSearchParams.access)
              ? resolvedSearchParams.access[0]
              : resolvedSearchParams.access,
        }}
      />
    </AppShell>
  );
}
