import type { DemoRole, DemoSession } from './demo-session';

export const FORMAL_SESSION_COOKIE = 'erp_formal_session';

export type FormalSession = DemoSession & {
  username: string;
  accessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
};

const supportedRoles = new Set<DemoRole>([
  'admin',
  'boss',
  'sales_manager',
  'sales',
  'purchase_manager',
  'purchase',
]);

function isSupportedRole(value: unknown): value is DemoRole {
  return typeof value === 'string' && supportedRoles.has(value as DemoRole);
}

function hasIdentity(searchParams: URLSearchParams) {
  return Boolean(searchParams.get('role') && searchParams.get('user'));
}

function isPublicFormalPath(pathname: string) {
  return (
    pathname === '/app/login' ||
    pathname.startsWith('/app/login/') ||
    pathname === '/app/logout' ||
    pathname.startsWith('/app/logout/')
  );
}

function readIdentity(searchParams: URLSearchParams) {
  const role = searchParams.get('role');
  const user = searchParams.get('user');

  if (!role || !user) {
    return null;
  }

  return { role, user };
}

function hasSupportedUrlIdentity(searchParams: URLSearchParams) {
  const identity = readIdentity(searchParams);
  if (!identity) {
    return false;
  }

  return isSupportedRole(identity.role) && Boolean(identity.user.trim());
}

function readSupportedRefererIdentity({
  referer,
  origin,
}: {
  referer?: string | null;
  origin: string;
}) {
  if (!referer) {
    return null;
  }

  try {
    const refererUrl = new URL(referer);
    if (refererUrl.origin !== origin || !refererUrl.pathname.startsWith('/app')) {
      return null;
    }

    const identity = readIdentity(refererUrl.searchParams);
    if (
      !identity ||
      !isSupportedRole(identity.role) ||
      !identity.user.trim()
    ) {
      return null;
    }

    return {
      role: identity.role,
      user: identity.user,
      access: refererUrl.searchParams.get('access'),
    };
  } catch {
    return null;
  }
}

function hasMatchingSessionIdentity({
  searchParams,
  session,
}: {
  searchParams: URLSearchParams;
  session: FormalSession;
}) {
  const identity = readIdentity(searchParams);
  if (!identity) {
    return false;
  }

  if (identity.role !== session.role || identity.user !== session.user) {
    return false;
  }

  const encodedAccessScopes = encodeAccessScopes(session.accessScopes);
  if (encodedAccessScopes === null) {
    return !searchParams.has('access');
  }

  return searchParams.get('access') === encodedAccessScopes;
}

function parseActionAccessScopes(value: string | undefined | null) {
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
      parsed.modules !== undefined &&
      (
        !Array.isArray(parsed.modules) ||
        parsed.modules.some((moduleCode) => typeof moduleCode !== 'string')
      )
    ) {
      return undefined;
    }

    if (
      parsed.dataScope !== undefined &&
      typeof parsed.dataScope !== 'string'
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
      modules: Array.isArray(parsed.modules) ? parsed.modules : [],
      dataScope: typeof parsed.dataScope === 'string' ? parsed.dataScope : 'all',
      ...(Array.isArray(parsed.actions) ? { actions: parsed.actions } : {}),
    };
  } catch {
    return undefined;
  }
}

function encodeAccessScopes(accessScopes: FormalSession['accessScopes']) {
  if (!accessScopes) {
    return null;
  }

  return encodeURIComponent(JSON.stringify(accessScopes));
}

export function resolveFormalRequestOrigin({
  origin,
  publicOrigin,
  forwardedHost,
  host,
  forwardedProto,
}: {
  origin: string;
  publicOrigin?: string | null;
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
}) {
  if (publicOrigin?.trim()) {
    return publicOrigin.trim();
  }

  const resolvedHost = forwardedHost?.trim() || host?.trim();

  if (!resolvedHost) {
    return origin;
  }

  const protocol = forwardedProto?.trim() === 'http' ? 'http' : 'https';
  return `${protocol}://${resolvedHost}`;
}

export function encodeFormalSessionCookie(session: {
  role: string;
  user: string;
  username: string;
  accessScopes?: FormalSession['accessScopes'];
}) {
  return encodeURIComponent(JSON.stringify(session));
}

export function buildFormalWorkspaceUrl(session: {
  role: string;
  user: string;
  accessScopes?: FormalSession['accessScopes'];
}) {
  const searchParams = new URLSearchParams({
    role: session.role,
    user: session.user,
  });

  if (session.accessScopes) {
    searchParams.set('access', encodeURIComponent(JSON.stringify(session.accessScopes)));
  }

  return `/app?${searchParams.toString()}`;
}

export function decodeFormalSessionCookie(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  const candidates = [value];
  let decoded = value;
  for (let index = 0; index < 2; index += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) {
        break;
      }
      decoded = nextDecoded;
      candidates.push(decoded);
    } catch {
      break;
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<FormalSession>;

      if (
        !isSupportedRole(parsed.role) ||
        typeof parsed.user !== 'string' ||
        !parsed.user.trim() ||
        typeof parsed.username !== 'string' ||
        !parsed.username.trim() ||
        (parsed.accessScopes !== undefined &&
          (
            !Array.isArray(parsed.accessScopes.modules) ||
            typeof parsed.accessScopes.dataScope !== 'string' ||
            (parsed.accessScopes.actions !== undefined &&
              (!Array.isArray(parsed.accessScopes.actions) ||
                parsed.accessScopes.actions.some((action) => typeof action !== 'string')))
          ))
      ) {
        continue;
      }

      return {
        role: parsed.role,
        user: parsed.user,
        username: parsed.username,
        accessScopes: parsed.accessScopes,
      } satisfies FormalSession;
    } catch {
      continue;
    }
  }

  return null;
}

export function buildFormalSessionRouteDecision({
  pathname,
  search,
  origin,
  sessionCookie,
  referer,
}: {
  pathname: string;
  search: string;
  origin: string;
  sessionCookie: string | undefined;
  referer?: string | null;
}) {
  if (!pathname.startsWith('/app') || isPublicFormalPath(pathname)) {
    return null;
  }

  const searchParams = new URLSearchParams(search);

  const session = decodeFormalSessionCookie(sessionCookie);
  if (session) {
    if (hasMatchingSessionIdentity({ searchParams, session })) {
      return null;
    }

    if (searchParams.has('role') || searchParams.has('user')) {
      searchParams.delete('role');
      searchParams.delete('user');
      searchParams.delete('access');

      const cleanSearch = searchParams.toString();
      return {
        type: 'redirect' as const,
        url: `${origin}${pathname}${cleanSearch ? `?${cleanSearch}` : ''}`,
      };
    }

    searchParams.set('role', session.role);
    searchParams.set('user', session.user);
    const encodedAccessScopes = encodeAccessScopes(session.accessScopes);
    if (encodedAccessScopes) {
      searchParams.set('access', encodedAccessScopes);
    } else {
      searchParams.delete('access');
    }

    const nextSearch = searchParams.toString();
    return {
      type: 'rewrite' as const,
      url: `${origin}${pathname}${nextSearch ? `?${nextSearch}` : ''}`,
    };
  }

  if (hasSupportedUrlIdentity(searchParams)) {
    return null;
  }

  const refererIdentity = readSupportedRefererIdentity({ referer, origin });
  if (refererIdentity) {
    searchParams.set('role', refererIdentity.role);
    searchParams.set('user', refererIdentity.user);
    if (refererIdentity.access) {
      searchParams.set('access', refererIdentity.access);
    }

    const nextSearch = searchParams.toString();
    return {
      type: 'redirect' as const,
      url: `${origin}${pathname}${nextSearch ? `?${nextSearch}` : ''}`,
    };
  }

  return {
    type: 'redirect' as const,
    url: `${origin}/app/login`,
  };
}

export function resolveFormalActionSession({
  formRole,
  formUser,
  formAccess,
  sessionCookie,
}: {
  formRole: string | undefined | null;
  formUser: string | undefined | null;
  formAccess?: string | undefined | null;
  sessionCookie?: string | undefined | null;
}) {
  const session = decodeFormalSessionCookie(sessionCookie);
  if (session) {
    return {
      role: session.role,
      user: session.user,
      accessScopes: session.accessScopes,
    } satisfies DemoSession;
  }

  const role = isSupportedRole(formRole) ? formRole : 'boss';
  const user = formUser?.trim() || 'Mia';
  const accessScopes = parseActionAccessScopes(formAccess);

  return accessScopes
    ? ({ role, user, accessScopes } satisfies DemoSession)
    : ({ role, user } satisfies DemoSession);
}

export function buildFormalSessionRedirectUrl({
  pathname,
  search,
  origin,
  sessionCookie,
}: {
  pathname: string;
  search: string;
  origin: string;
  sessionCookie: string | undefined;
}) {
  const decision = buildFormalSessionRouteDecision({
    pathname,
    search,
    origin,
    sessionCookie,
  });

  return decision?.url ?? null;
}
