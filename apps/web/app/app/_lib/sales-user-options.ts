import { type DemoRole } from './demo-session';
import { resolveFormalUserId } from './formal-access';
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

function matchesSessionUser(option: { username: string; label: string }, user: string) {
  const normalizedUser = user.trim().toLowerCase();
  return (
    option.username.trim().toLowerCase() === normalizedUser ||
    option.label.trim().toLowerCase().startsWith(`${normalizedUser} /`)
  );
}

function filterSalesUsersByRole(
  session: { role: DemoRole; user: string },
  items: SalesUserOption[],
) {
  const normalizedItems = ensureSessionUserOption(session, items);

  if (session.role === 'sales') {
    return normalizedItems.filter(
      (item) => item.roleCode === 'sales' && matchesSessionUser(item, session.user),
    );
  }

  if (session.role === 'sales_manager') {
    return normalizedItems.filter(
      (item) => item.roleCode === 'sales' || matchesSessionUser(item, session.user),
    );
  }

  if (session.role === 'boss') {
    return normalizedItems.filter(
      (item) =>
        item.roleCode === 'sales' ||
        item.roleCode === 'sales_manager' ||
        matchesSessionUser(item, session.user),
    );
  }

  if (session.role === 'admin') {
    return normalizedItems.filter(
      (item) => item.roleCode === 'sales' || item.roleCode === 'sales_manager',
    );
  }

  return normalizedItems;
}

function resolveSessionOwnerRoleCode(role: DemoRole): SalesUserOption['roleCode'] | null {
  if (role === 'sales') {
    return 'sales';
  }

  if (role === 'sales_manager') {
    return 'sales_manager';
  }

  if (role === 'boss') {
    return 'boss';
  }

  return null;
}

function ensureSessionUserOption(
  session: { role: DemoRole; user: string },
  items: SalesUserOption[],
) {
  if (items.some((item) => matchesSessionUser(item, session.user))) {
    return items;
  }

  const roleCode = resolveSessionOwnerRoleCode(session.role);
  if (!roleCode) {
    return items;
  }

  return [
    ...items,
    {
      id: resolveFormalUserId(session.user),
      label: `${session.user} / ${roleLabel(roleCode)} ${session.user}`,
      username: session.user,
      roleCode,
    },
  ];
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
  session: { role: DemoRole; user: string },
  items: SalesUserOption[],
) {
  const matched = items.find((item) => matchesSessionUser(item, session.user));
  return matched?.id ?? items[0]?.id ?? 0;
}

export async function loadSalesUserOptions(session: { role: string; user: string }) {
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
        username: item.realName,
        roleCode: normalizeRoleCode(item.roleCode),
        label: `${item.realName} / ${roleLabel(item.roleCode)} ${item.realName}`,
      }));

    return sortSalesUsers(
      filterSalesUsersByRole(session as { role: DemoRole; user: string }, options),
    );
  } catch {
    return sortSalesUsers(
      filterSalesUsersByRole(session as { role: DemoRole; user: string }, fallbackSalesUsers),
    );
  }
}
