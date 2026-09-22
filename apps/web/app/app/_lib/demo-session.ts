export type DemoRole =
  | 'admin'
  | 'boss'
  | 'sales_manager'
  | 'sales'
  | 'purchase_manager'
  | 'purchase';

export type DemoSession = {
  role: DemoRole;
  user: string;
  accessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
};

type SearchParams = Record<string, string | string[] | undefined>;

export type FormalModule =
  | 'home'
  | 'sales'
  | 'purchase'
  | 'operations'
  | 'boss'
  | 'admin'
  | 'audit';

const roleLabels: Record<DemoRole, string> = {
  admin: '管理员',
  boss: '老板',
  sales_manager: '销售主管',
  sales: '销售',
  purchase_manager: '采购主管',
  purchase: '采购',
};

const defaultUsers: Record<DemoRole, string> = {
  admin: 'Admin',
  boss: 'Mia',
  sales_manager: 'Mia',
  sales: 'Zoe',
  purchase_manager: 'Mia',
  purchase: 'Leo',
};

const dataScopeLabels: Record<string, string> = {
  all: '全业务权限',
  sales_team: '销售团队数据',
  own_sales: '仅本人销售单/报价',
  purchase_team: '采购团队数据',
  own_purchase: '仅本人采购/发货/售后',
};

const actionLabels: Record<string, string> = {
  'admin.user.write': '账号管理',
  'admin.role.write': '角色权限',
  'master_data.write': '主数据维护',
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

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseAccessScopes(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as {
      modules?: unknown;
      dataScope?: unknown;
      actions?: unknown;
    };

    if (
      !Array.isArray(parsed.modules) ||
      parsed.modules.some((module) => typeof module !== 'string') ||
      typeof parsed.dataScope !== 'string' ||
      (parsed.actions !== undefined &&
        (!Array.isArray(parsed.actions) ||
          parsed.actions.some((action) => typeof action !== 'string')))
    ) {
      return undefined;
    }

    return {
      modules: parsed.modules as string[],
      dataScope: parsed.dataScope,
      ...(parsed.actions ? { actions: parsed.actions as string[] } : {}),
    };
  } catch {
    return undefined;
  }
}

function normalizeRole(value: string | undefined): DemoRole {
  if (
    value === 'admin' ||
    value === 'boss' ||
    value === 'sales_manager' ||
    value === 'sales' ||
    value === 'purchase_manager' ||
    value === 'purchase'
  ) {
    return value;
  }

  return 'boss';
}

export function resolveDemoSession(searchParams?: SearchParams): DemoSession {
  const role = normalizeRole(readParam(searchParams?.role));
  const user = readParam(searchParams?.user) ?? defaultUsers[role];
  const accessScopes = parseAccessScopes(readParam(searchParams?.access));

  return accessScopes ? { role, user, accessScopes } : { role, user };
}

export function getDemoRoleLabel(role: DemoRole) {
  return roleLabels[role];
}

export function getDemoAccessScopeLabel(session: DemoSession) {
  if (session.accessScopes) {
    return dataScopeLabels[session.accessScopes.dataScope] ?? session.accessScopes.dataScope;
  }

  if (session.role === 'admin' || session.role === 'boss') {
    return '全业务权限';
  }

  if (session.role === 'sales_manager') {
    return '销售全域';
  }

  if (session.role === 'sales') {
    return '仅销售域';
  }

  if (session.role === 'purchase_manager') {
    return '采购+运营全域';
  }

  return '仅采购/运营域';
}

export function getDemoActionLabels(session: DemoSession) {
  const actions = session.accessScopes?.actions ?? [];
  return actions.map((action) => actionLabels[action] ?? action);
}

function toFormalAccessModule(module: FormalModule) {
  return module === 'boss' ? 'boss_dashboard' : module;
}

export function canViewFormalModule(session: DemoSession, module: FormalModule) {
  if (module === 'admin') {
    return (
      session.role === 'admin' ||
      session.accessScopes?.modules.includes('admin') === true
    );
  }

  if (session.accessScopes) {
    if (module === 'home') {
      return true;
    }

    return session.accessScopes.modules.includes(toFormalAccessModule(module));
  }

  if (session.role === 'admin') {
    return true;
  }

  if (session.role === 'boss') {
    return true;
  }

  if (module === 'home') {
    return true;
  }

  if (module === 'sales') {
    return session.role === 'sales_manager' || session.role === 'sales';
  }

  if (module === 'purchase' || module === 'operations') {
    return session.role === 'purchase_manager' || session.role === 'purchase';
  }

  if (module === 'boss') {
    return session.role === 'sales_manager' || session.role === 'purchase_manager';
  }

  return false;
}

export function canViewFormalAuditCenter(session: DemoSession) {
  if (session.role === 'admin' || session.role === 'boss') {
    return true;
  }

  if (!session.accessScopes) {
    return false;
  }

  return session.accessScopes.modules.includes('audit');
}

export function filterQuoteRows<T extends { createdBy: string }>(
  items: T[],
  session: DemoSession,
) {
  if (
    session.role === 'admin' ||
    session.role === 'boss' ||
    session.role === 'sales_manager'
  ) {
    return items;
  }

  if (session.role === 'sales') {
    return items.filter((item) => item.createdBy === session.user);
  }

  return [];
}

export function filterSalesOrderRows<
  T extends { ownerName?: string; createdBy: string },
>(items: T[], session: DemoSession) {
  if (
    session.role === 'admin' ||
    session.role === 'boss' ||
    session.role === 'sales_manager'
  ) {
    return items;
  }

  if (session.role === 'sales') {
    return items.filter(
      (item) => item.ownerName === session.user || item.createdBy === session.user,
    );
  }

  return [];
}

export function filterPurchaseOrderRows<
  T extends { ownerName?: string; createdBy: string },
>(items: T[], session: DemoSession) {
  if (
    session.role === 'admin' ||
    session.role === 'boss' ||
    session.role === 'purchase_manager'
  ) {
    return items;
  }

  if (session.role === 'purchase') {
    return items.filter(
      (item) => item.ownerName === session.user || item.createdBy === session.user,
    );
  }

  return [];
}

export function filterOperationsRows<
  T extends { ownerName: string; createdBy?: string },
>(items: T[], session: DemoSession) {
  if (
    session.role === 'admin' ||
    session.role === 'boss' ||
    session.role === 'sales_manager' ||
    session.role === 'sales' ||
    session.role === 'purchase_manager'
  ) {
    return items;
  }

  if (session.role === 'purchase') {
    return items.filter(
      (item) => item.ownerName === session.user || item.createdBy === session.user,
    );
  }

  return [];
}
