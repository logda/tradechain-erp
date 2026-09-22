import type { FormalRole } from './formal-role.decorator';

function readHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeUserName(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export type FormalSession = {
  role?: FormalRole;
  user?: string;
};

export function readFormalSession(headers: {
  'x-erp-role'?: string | string[];
  'x-erp-user'?: string | string[];
}): FormalSession {
  return {
    role: readHeaderValue(headers['x-erp-role'])?.trim() as FormalRole | undefined,
    user: normalizeUserName(readHeaderValue(headers['x-erp-user'])),
  };
}

export function readOptionalFormalSession(headers: {
  'x-erp-role'?: string | string[];
  'x-erp-user'?: string | string[];
}) {
  const session = readFormalSession(headers);
  return session.role || session.user ? session : undefined;
}

export function isFormalAdminOrBoss(role?: FormalRole) {
  return role === 'admin' || role === 'boss';
}

export function canSeeSalesDomain(role?: FormalRole) {
  return isFormalAdminOrBoss(role) || role === 'sales_manager' || role === 'sales';
}

export function canSeePurchaseDomain(role?: FormalRole) {
  return (
    isFormalAdminOrBoss(role) ||
    role === 'purchase_manager' ||
    role === 'purchase'
  );
}

export function canSeeOperationsDomain(role?: FormalRole) {
  return canSeePurchaseDomain(role);
}

export function matchesFormalUser(
  session: FormalSession,
  item: { ownerName?: string | null; createdBy?: string | null },
) {
  if (!session.user) {
    return false;
  }

  return [item.ownerName, item.createdBy].some(
    (value) => typeof value === 'string' && value.trim() === session.user,
  );
}

export function filterVisibleFormalItems<T extends { ownerName?: string | null; createdBy?: string | null }>(
  items: T[],
  session: FormalSession,
  allAccessRoles: FormalRole[] = ['admin', 'boss'],
) {
  if (!session.role && !session.user) {
    return items;
  }

  if (session.role && allAccessRoles.includes(session.role)) {
    return items;
  }

  return items.filter((item) => matchesFormalUser(session, item));
}
