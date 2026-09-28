import type { FormalRole } from './formal-role.decorator';

function readHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeUserName(value: string | undefined) {
  let decoded = value;
  try { decoded = value ? decodeURIComponent(value) : value; } catch { /* Plain header containing a literal percent sign. */ }
  const normalized = decoded?.trim();
  return normalized ? normalized : undefined;
}

export type FormalSession = {
  role?: FormalRole;
  user?: string;
  userId?: number;
  legacyUserIds?: number[];
  dataScope?: string;
  modules?: string[];
  actions?: string[];
};

export function readFormalSession(headers: {
  'x-erp-role'?: string | string[];
  'x-erp-user'?: string | string[];
  'x-erp-user-id'?: string | string[];
  'x-erp-legacy-user-ids'?: string | string[];
  'x-erp-data-scope'?: string | string[];
  'x-erp-modules'?: string | string[];
  'x-erp-actions'?: string | string[];
}): FormalSession {
  const userId = Number(readHeaderValue(headers['x-erp-user-id']));
  return {
    ...(headers['x-erp-legacy-user-ids'] ? { legacyUserIds: readHeaderValue(headers['x-erp-legacy-user-ids'])?.split(',').map(Number).filter(id => Number.isSafeInteger(id) && id > 0) } : {}),
    ...(Number.isSafeInteger(userId) && userId > 0 ? { userId } : {}),
    ...(headers['x-erp-data-scope'] ? { dataScope: readHeaderValue(headers['x-erp-data-scope']) } : {}),
    ...(headers['x-erp-modules'] !== undefined ? { modules: readHeaderValue(headers['x-erp-modules'])?.split(',').filter(Boolean) } : {}),
    ...(headers['x-erp-actions'] !== undefined ? { actions: readHeaderValue(headers['x-erp-actions'])?.split(',').filter(Boolean) } : {}),
    role: readHeaderValue(headers['x-erp-role'])?.trim() as FormalRole | undefined,
    user: normalizeUserName(readHeaderValue(headers['x-erp-user'])),
  };
}

export function readOptionalFormalSession(headers: {
  'x-erp-role'?: string | string[];
  'x-erp-user'?: string | string[];
  'x-erp-user-id'?: string | string[];
  'x-erp-legacy-user-ids'?: string | string[];
  'x-erp-data-scope'?: string | string[];
  'x-erp-modules'?: string | string[];
  'x-erp-actions'?: string | string[];
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

export type FormalOwnedItem = {
  ownerName?: string | null;
  createdBy?: string | number | null;
  ownerId?: number | null;
  ownerUserId?: number | bigint | null;
  salesUserId?: number | null;
  createdById?: number | null;
};

export function matchesFormalUser(
  session: FormalSession,
  item: FormalOwnedItem,
) {
  if (session.userId !== undefined) {
    return [item.ownerId, item.ownerUserId, item.salesUserId, item.createdById,
      typeof item.createdBy === 'number' ? item.createdBy : undefined].some(id => id != null && [session.userId, ...(session.legacyUserIds ?? [])].includes(Number(id)));
  }
  if (!session.user) {
    return false;
  }

  return [item.ownerName, item.createdBy].some(
    (value) => typeof value === 'string' && value.trim() === session.user,
  );
}

export function filterVisibleFormalItems<T extends FormalOwnedItem>(
  items: T[],
  session: FormalSession,
  allAccessRoles: FormalRole[] = ['admin', 'boss'],
) {
  if (!session.role && !session.user) {
    return items;
  }

  if (session.dataScope === 'all' || session.dataScope?.endsWith('_team') ||
      (!session.dataScope?.startsWith('own_') && session.role && allAccessRoles.includes(session.role))) {
    return items;
  }

  return items.filter((item) => matchesFormalUser(session, item));
}
