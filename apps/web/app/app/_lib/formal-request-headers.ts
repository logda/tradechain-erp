const defaultActionScopes: Record<string, string[]> = {
  admin: [
    'audit.view',
    'admin.user.write',
    'admin.role.write',
    'master_data.write',
    'counterparty.write',
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
  boss: [
    'counterparty.write',
    'sales.order.write',
    'sales.sample.approve',
    'purchase.order.approve',
    'after_sales.process',
    'boss.confirm',
    'finance.confirm',
  ],
  sales_manager: [
    'counterparty.write',
    'sales.quote.write',
    'sales.inquiry.submit',
    'sales.order.write',
    'sales.sample.submit',
    'sales.sample.approve',
    'sales.sample.execute',
  ],
  sales: [
    'counterparty.write',
    'sales.quote.write',
    'sales.inquiry.submit',
    'sales.order.write',
    'sales.sample.submit',
    'sales.sample.execute',
  ],
  purchase_manager: [
    'counterparty.write',
    'sales.inquiry.submit',
    'purchase.order.create',
    'purchase.order.submit',
    'purchase.order.approve',
    'purchase.sample.execute',
    'shipment.update',
    'after_sales.process',
  ],
  purchase: [
    'counterparty.write',
    'sales.inquiry.submit',
    'purchase.order.create',
    'purchase.order.submit',
    'purchase.sample.execute',
    'shipment.update',
    'after_sales.process',
  ],
};

const defaultModuleScopes: Record<string, string[]> = {
  admin: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
  boss: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit'],
  sales_manager: ['sales', 'boss_dashboard'],
  sales: ['sales'],
  purchase_manager: ['purchase', 'operations', 'boss_dashboard'],
  purchase: ['purchase', 'operations'],
};

export type FormalRequestSession = {
  role: string;
  user: string;
  username?: string;
  accessScopes?: { modules?: string[]; actions?: string[] };
};

export function parseFormalAccessScopes(value: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as {
      modules?: unknown;
      actions?: unknown;
    };

    if (
      parsed.modules !== undefined &&
      (
        !Array.isArray(parsed.modules) ||
        parsed.modules.some((moduleCode) => typeof moduleCode !== 'string')
      )
    ) {
      return undefined;
    }

    if (
      parsed.actions !== undefined &&
      (
        !Array.isArray(parsed.actions) ||
        parsed.actions.some((action) => typeof action !== 'string')
      )
    ) {
      return undefined;
    }

    return {
      modules: Array.isArray(parsed.modules) ? parsed.modules : undefined,
      actions: Array.isArray(parsed.actions) ? parsed.actions : undefined,
    };
  } catch {
    return undefined;
  }
}

export function resolveFormalAccessGrants(session: FormalRequestSession) {
  const modules = session.accessScopes?.modules ?? defaultModuleScopes[session.role] ?? [];
  const actions = session.accessScopes?.actions ?? defaultActionScopes[session.role] ?? [];

  return { modules, actions };
}

export function buildFormalRequestHeaders(session: FormalRequestSession) {
  const { modules, actions } = resolveFormalAccessGrants(session);

  return {
    'x-erp-role': session.role,
    'x-erp-user': session.user,
    ...(modules.length ? { 'x-erp-modules': modules.join(',') } : {}),
    ...(actions.length ? { 'x-erp-actions': actions.join(',') } : {}),
  };
}

export function buildFormalRequestHeadersFromSearch(
  searchParams: URLSearchParams,
  fallback: { role?: string; user?: string } = {},
) {
  const role = searchParams.get('role')?.trim() || fallback.role || '';
  const user = searchParams.get('user')?.trim() || fallback.user || '';

  if (!role || !user) {
    return {};
  }

  return buildFormalRequestHeaders({
    role,
    user,
    accessScopes: parseFormalAccessScopes(searchParams.get('access')),
  });
}
