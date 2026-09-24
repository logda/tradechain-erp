'use client';

import { useState } from 'react';
import { AuditLogTable } from '../../_components/audit-log-table';
import { FormalPagination } from '../../_components/formal-pagination';
import { MutationActionForm } from '../../_components/mutation-action-form';
import { hasValidAuditLogResponse, type AuditLogItem } from '../../_lib/audit-log';
import type { DemoSession } from '../../_lib/demo-session';
import { CreateAdminUserForm } from './create-admin-user-form';
import { RolePermissionEditor } from './role-permissions-editor';
import { UpdateUserRoleForm } from './update-user-role-form';

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

type AdminUsersClientProps = {
  initialItems: UserListItem[];
  initialTotal: number;
  initialAuditLogItems: AuditLogItem[];
  initialRolePermissionItems: Array<{
    roleCode: string;
    accessScopes: {
      modules: string[];
      dataScope: string;
      actions?: string[];
    };
    updatedBy: string;
    updatedAt: string;
  }>;
  page: number;
  pageSize: number;
  session: DemoSession;
  adminAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  requestHeaders: Record<string, string>;
  apiBaseUrl: string;
  paginationParams: {
    role: string;
    user: string;
    access?: string;
  };
};

const sectionStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  padding: '20px 22px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
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

const moduleLabels: Record<string, string> = {
  sales: '销售',
  purchase: '采购',
  operations: '运营',
  boss_dashboard: '老板看板',
  admin: '用户管理',
};

const dataScopeLabels: Record<string, string> = {
  all: '全部业务数据',
  sales_team: '销售团队数据',
  own_sales: '仅本人销售单/报价',
  purchase_team: '采购团队数据',
  own_purchase: '仅本人采购/发货/售后',
};

const actionLabels: Record<string, string> = {
  'audit.view': '审计查看',
  'admin.user.write': '账号管理',
  'admin.role.write': '角色权限',
  'master_data.write': '主数据维护',
  'counterparty.write': '往来单位维护',
  'sales.quote.write': '报价',
  'sales.inquiry.submit': '询价提交',
  'sales.order.write': '销售单',
  'sales.sample.submit': '样品提交',
  'sales.sample.approve': '样品审批',
  'sales.sample.execute': '样品执行',
  'purchase.order.create': '创建采购单',
  'purchase.order.submit': '采购提交',
  'purchase.order.approve': '采购审批',
  'purchase.sample.execute': '采购样品执行',
  'shipment.update': '发货更新',
  'after_sales.process': '售后处理',
  'boss.confirm': '老板确认',
  'finance.confirm': '财务确认',
};

const roleLabels: Record<string, string> = {
  admin: '管理员',
  boss: '老板',
  sales_manager: '销售主管',
  sales: '销售',
  purchase_manager: '采购主管',
  purchase: '采购',
};

function formatModuleScope(item: UserListItem) {
  const modules = (item.accessScopes?.modules ?? []).filter((module) => module !== 'audit');
  if (modules.length === 0) {
    return '-';
  }

  return modules.map((module) => moduleLabels[module] ?? module).join('、');
}

function formatDataScope(item: UserListItem) {
  const dataScope = item.accessScopes?.dataScope;
  if (!dataScope) {
    return '-';
  }

  return dataScopeLabels[dataScope] ?? dataScope;
}

function formatActionScope(item: UserListItem) {
  const actions = item.accessScopes?.actions ?? [];
  if (actions.length === 0) {
    return '-';
  }

  return actions.map((action) => actionLabels[action] ?? action).join('、');
}

function normalizeUserItem(
  result: unknown,
  fallbackItem?: UserListItem,
): UserListItem | null {
  if (typeof result !== 'object' || result === null) {
    return fallbackItem ?? null;
  }

  const value = result as Partial<UserListItem>;
  if (typeof value.id !== 'number') {
    return fallbackItem ?? null;
  }

  return {
    id: value.id,
    username: typeof value.username === 'string' ? value.username : fallbackItem?.username ?? '',
    realName: typeof value.realName === 'string' ? value.realName : fallbackItem?.realName ?? '',
    roleCode: typeof value.roleCode === 'string' ? value.roleCode : fallbackItem?.roleCode ?? '',
    status: typeof value.status === 'string' ? value.status : fallbackItem?.status ?? 'active',
    fullAccess:
      typeof value.fullAccess === 'boolean'
        ? value.fullAccess
        : fallbackItem?.fullAccess ?? false,
    accessScopes: value.accessScopes ?? fallbackItem?.accessScopes,
    createdAt:
      typeof value.createdAt === 'string'
        ? value.createdAt
        : fallbackItem?.createdAt ?? new Date().toISOString(),
    createdBy:
      typeof value.createdBy === 'string'
        ? value.createdBy
        : fallbackItem?.createdBy ?? '',
    deactivatedReason:
      typeof value.deactivatedReason === 'string' ? value.deactivatedReason : undefined,
  };
}

export function AdminUsersClient({
  initialItems,
  initialTotal,
  initialAuditLogItems,
  initialRolePermissionItems,
  page,
  pageSize,
  session,
  adminAccessScopes,
  requestHeaders,
  apiBaseUrl,
  paginationParams,
}: AdminUsersClientProps) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [auditLogItems, setAuditLogItems] = useState(initialAuditLogItems);
  const [rolePermissionItems] = useState(initialRolePermissionItems);

  async function refreshAuditLogs() {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/users/audit-logs`, {
        cache: 'no-store',
        headers: requestHeaders,
      });

      if (!response.ok) {
        return;
      }

      const result = (await response.json().catch(() => null)) as unknown;
      if (hasValidAuditLogResponse(result)) {
        setAuditLogItems(result.items);
      }
    } catch {
      return;
    }
  }

  function replaceItem(nextItem: UserListItem) {
    setItems((current) =>
      current.map((item) => (item.id === nextItem.id ? nextItem : item)),
    );
  }

  function handleCreated(nextItem: UserListItem) {
    setTotal((current) => current + 1);
    if (page !== 1) {
      return;
    }

    setItems((current) =>
      [nextItem, ...current.filter((item) => item.id !== nextItem.id)].slice(0, pageSize),
    );
  }

  return (
    <>
      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>新增账号</h3>
        <p style={{ color: '#475569', lineHeight: 1.7 }}>
          管理员可直接创建业务账号，并约定管理员与老板具备全业务查看能力。
        </p>
        <CreateAdminUserForm
          endpoint={`${apiBaseUrl}/admin/users`}
          createdBy={session.user}
          actorRole={session.role}
          actorUser={session.user}
          actorAccessScopes={adminAccessScopes}
          onSuccess={(nextItem) => {
            handleCreated(nextItem);
            void refreshAuditLogs();
          }}
        />
      </section>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>账号列表</h3>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headCellStyle}>用户名</th>
              <th style={headCellStyle}>姓名</th>
              <th style={headCellStyle}>角色</th>
              <th style={headCellStyle}>状态</th>
              <th style={headCellStyle}>全业务权限</th>
              <th style={headCellStyle}>权限范围</th>
              <th style={headCellStyle}>动作权限</th>
              <th style={headCellStyle}>创建信息</th>
              <th style={headCellStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={cellStyle}>{item.username}</td>
                <td style={cellStyle}>{item.realName}</td>
                <td style={cellStyle}>{item.roleCode}</td>
                <td style={cellStyle}>
                  <strong>{item.status}</strong>
                  {item.deactivatedReason ? (
                    <div style={{ marginTop: '6px', color: '#64748b' }}>
                      {item.deactivatedReason}
                    </div>
                  ) : null}
                </td>
                <td style={cellStyle}>{item.fullAccess ? '是 / Yes' : '否 / No'}</td>
                <td style={cellStyle}>
                  {formatModuleScope(item)}
                  <br />
                  <span style={{ color: '#64748b' }}>{formatDataScope(item)}</span>
                </td>
                <td style={cellStyle}>{formatActionScope(item)}</td>
                <td style={cellStyle}>
                  {item.createdBy}
                  <br />
                  <span style={{ color: '#64748b' }}>{item.createdAt}</span>
                </td>
                <td style={cellStyle}>
                  {item.status === 'active' && item.roleCode !== 'admin' ? (
                    <div style={{ display: 'grid', gap: '10px' }}>
                      <UpdateUserRoleForm
                        endpoint={`${apiBaseUrl}/admin/users/${item.id}/role`}
                        currentRoleCode={item.roleCode}
                        actorRole={session.role}
                        actorUser={session.user}
                        actorAccessScopes={adminAccessScopes}
                        onSuccess={(nextItem) => {
                          replaceItem(nextItem);
                          void refreshAuditLogs();
                        }}
                      />
                      <MutationActionForm
                        endpoint={`${apiBaseUrl}/admin/users/${item.id}/deactivate`}
                        label="注销用户"
                        successLabel="操作成功，用户已注销（假删除）"
                        requiredAction="admin.user.write"
                        requiredActionLabel="用户管理"
                        requestHeaders={requestHeaders}
                        fields={[
                          {
                            name: 'operatedBy',
                            value: session.user,
                          },
                          {
                            name: 'reason',
                            value: '管理员停用',
                          },
                        ]}
                        onSuccess={(result) => {
                          const nextItem = normalizeUserItem(result, item);
                          if (nextItem) {
                            replaceItem(nextItem);
                          }
                          void refreshAuditLogs();
                        }}
                      />
                    </div>
                  ) : item.status === 'inactive' && item.roleCode !== 'admin' ? (
                    <MutationActionForm
                      endpoint={`${apiBaseUrl}/admin/users/${item.id}/activate`}
                      label="启用用户"
                      successLabel="操作成功，用户已重新启用"
                      requiredAction="admin.user.write"
                      requiredActionLabel="用户管理"
                      requestHeaders={requestHeaders}
                      fields={[
                        {
                          name: 'operatedBy',
                          value: session.user,
                        },
                        {
                          name: 'reason',
                          value: '恢复账号',
                        },
                      ]}
                      onSuccess={(result) => {
                        const nextItem = normalizeUserItem(result, item);
                        if (nextItem) {
                          replaceItem(nextItem);
                        }
                        void refreshAuditLogs();
                      }}
                    />
                  ) : (
                    <span style={{ color: '#94a3b8' }}>不可操作</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <FormalPagination
          pathname="/app/admin/users"
          params={paginationParams}
          page={page}
          pageSize={pageSize}
          total={total}
        />
      </section>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>角色权限配置</h3>
        <p style={{ color: '#475569', lineHeight: 1.7 }}>
          管理员权限固定，无法在此修改。其他角色可单独配置可见模块、数据范围和动作权限。
        </p>
        <div style={{ display: 'grid', gap: '16px' }}>
          {rolePermissionItems.filter((item) => item.roleCode !== 'admin').map((item) => (
            <RolePermissionEditor
              key={item.roleCode}
              endpoint={`${apiBaseUrl}/admin/users/role-permissions/${item.roleCode}`}
              roleCode={item.roleCode}
              roleLabel={roleLabels[item.roleCode] ?? item.roleCode}
              modules={item.accessScopes.modules}
              dataScope={item.accessScopes.dataScope}
              actions={item.accessScopes.actions ?? []}
              updatedBy={item.updatedBy}
              updatedAt={item.updatedAt}
              actorRole={session.role}
              actorUser={session.user}
              actorAccessScopes={adminAccessScopes}
              onSuccess={() => {
                void refreshAuditLogs();
              }}
            />
          ))}
        </div>
      </section>

      <AuditLogTable session={session} items={auditLogItems} />
    </>
  );
}
