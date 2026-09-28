import { formatFormalUserLabel } from './formal-user-display';
import { resolveFormalUserId } from './formal-access';
import { type DemoRole } from './demo-session';

import { buildFormalApiRequestHeaders } from './formal-api-request-headers';

export type SalesUserOption = {
  id: number;
  label: string;
  username: string;
  roleCode: 'sales' | 'sales_manager' | 'boss';
};

type QuoteCreateMetadataResponse = {
  salesUsers: Array<{
    id: number;
    username: string;
    realName: string;
    roleCode: string;
    status: string;
  }>;
};

const fallbackSalesUsers: SalesUserOption[] = [
  { id: 2001, label: 'Zoe / 销售 Zoe', username: 'Zoe', roleCode: 'sales' },
  { id: 2002, label: 'Leo / 销售 Leo', username: 'Leo', roleCode: 'sales' },
  { id: 2000, label: 'Mia / 销售主管 Mia', username: 'Mia', roleCode: 'sales_manager' },
];

function getQuoteApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidMetadataResponse(
  value: unknown,
): value is QuoteCreateMetadataResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as QuoteCreateMetadataResponse).salesUsers)
  );
}

function roleLabel(roleCode: string) {
  if (roleCode === 'boss') {
    return '老板';
  }

  if (roleCode === 'sales_manager') {
    return '销售主管';
  }

  return '销售';
}

function normalizeRoleCode(roleCode: string): SalesUserOption['roleCode'] {
  if (roleCode === 'boss') {
    return 'boss';
  }

  return roleCode === 'sales_manager' ? 'sales_manager' : 'sales';
}

function matchesSessionUser(option: { id: number; username: string; label: string }, session: { user: string; userId?: number }) {
  if (session.userId !== undefined) return option.id === session.userId;
  const user = session.user;
  const normalizedUser = user.trim().toLowerCase();
  return (
    option.username.trim().toLowerCase() === normalizedUser ||
    option.label.trim().toLowerCase().startsWith(`${normalizedUser} /`)
  );
}

function filterSalesUsersByRole(
  session: { role: DemoRole; user: string; userId?: number; username?: string },
  items: SalesUserOption[],
) {
  const mayOwn = session.role === 'sales_manager' || session.role === 'boss';
  const normalizedItems = mayOwn && !items.some(item => matchesSessionUser(item, session))
    ? [...items, { id: resolveFormalUserId(session), username: session.username ?? session.user, roleCode: session.role as 'sales_manager' | 'boss', label: `${session.username ?? session.user} / ${roleLabel(session.role)}` }]
    : items;

  if (session.role === 'sales') {
    return normalizedItems.filter(
      (item) => item.roleCode === 'sales' && matchesSessionUser(item, session),
    );
  }

  if (session.role === 'sales_manager') {
    return normalizedItems.filter(
      (item) => item.roleCode === 'sales' || matchesSessionUser(item, session),
    );
  }

  if (session.role === 'boss') {
    return normalizedItems.filter(
      (item) =>
        item.roleCode === 'sales' ||
        item.roleCode === 'sales_manager' ||
        matchesSessionUser(item, session),
    );
  }

  if (session.role === 'admin') {
    return normalizedItems.filter(
      (item) => item.roleCode === 'sales' || item.roleCode === 'sales_manager',
    );
  }

  return normalizedItems;
}

function sortSalesUsers(items: SalesUserOption[]) {
  return [...items].sort((left, right) => {
    const leftPriority = left.roleCode === 'sales' ? 0 : left.roleCode === 'sales_manager' ? 1 : 2;
    const rightPriority = right.roleCode === 'sales' ? 0 : right.roleCode === 'sales_manager' ? 1 : 2;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.id - right.id;
  });
}

export function resolveDefaultSalesUserId(
  session: { role: DemoRole; user: string; userId?: number },
  items: SalesUserOption[],
) {
  const matched = items.find((item) => matchesSessionUser(item, session));
  return matched?.id ?? items[0]?.id ?? 0;
}

export async function loadSalesUserOptions(session: { role: string; user: string; userId?: number; username?: string }, retainedOwner?: { id: number; name?: string }) {
  try {
    const response = await fetch(`${getQuoteApiBaseUrl()}/quotes/create-metadata`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      throw new Error('quote metadata request failed');
    }

    const result = (await response.json().catch(() => null)) as unknown;
    if (!hasValidMetadataResponse(result)) {
      throw new Error('quote metadata response invalid');
    }

    const options = result.salesUsers
      .filter((item) => item.status === 'active')
      .map((item) => ({
        id: item.id,
        username: item.username,
        roleCode: normalizeRoleCode(item.roleCode),
        label: `${item.username} / ${roleLabel(item.roleCode)}`,
      }));

    const visible = filterSalesUsersByRole(session as { role: DemoRole; user: string; userId?: number }, options);
    if (retainedOwner && !visible.some(item => item.id === retainedOwner.id)) {
      const name = formatFormalUserLabel({ ownerName: retainedOwner.name }, 'ownerName', '历史账号未关联');
      visible.push({ id: retainedOwner.id, username: '', label: `${name} / 原销售负责人`, roleCode: 'sales' });
    }
    return sortSalesUsers(visible);
  } catch {
    if (session.userId !== undefined || process.env.NODE_ENV !== 'test') return [];
    return sortSalesUsers(filterSalesUsersByRole(session as { role: DemoRole; user: string }, fallbackSalesUsers));
  }
}
