import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  buildFormalSessionRouteDecision,
  decodeFormalSessionCookie,
  encodeFormalSessionCookie,
  resolveFormalActionSession,
  resolveFormalRequestOrigin,
} from '../app/app/_lib/formal-session';
import { buildFormalRequestHeaders } from '../app/app/_lib/formal-request-headers';
import { resolveFormalActionSessionFromHeaders } from '../app/app/_lib/formal-action-session';
import { buildSignedFormalRequestHeaders } from '../app/app/_lib/formal-request-signature';
import { middleware } from '../middleware';

describe('formal session helpers', () => {
  it('keeps formal action session helpers free of file-level server action directives', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/app/_lib/formal-action-session.ts'),
      'utf8',
    );

    expect(source.startsWith("'use server';")).toBe(false);
  });

  it('builds formal request headers with modules and actions from access scopes', () => {
    expect(
      buildFormalRequestHeaders({
        role: 'sales',
        user: 'Zoe',
        accessScopes: {
          modules: ['sales'],
          actions: ['sales.quote.write'],
        },
      }),
    ).toEqual({
      'x-erp-role': 'sales',
      'x-erp-user': 'Zoe',
      'x-erp-modules': 'sales',
      'x-erp-actions': 'sales.quote.write',
    });
  });

  it('builds default module headers for legacy role and user URLs', () => {
    expect(
      buildFormalRequestHeaders({
        role: 'admin',
        user: 'Admin',
      }),
    ).toEqual({
      'x-erp-role': 'admin',
      'x-erp-user': 'Admin',
      'x-erp-modules': 'sales,purchase,operations,boss_dashboard,audit,admin',
      'x-erp-actions': expect.stringContaining('admin.user.write'),
    });
  });

  it('builds signed formal request headers for strict API mode', () => {
    vi.stubEnv('ERP_FORMAL_SESSION_SECRET', 'test-secret');

    const headers = buildSignedFormalRequestHeaders({
      role: 'sales',
      user: 'Zoe',
      accessScopes: {
        modules: ['sales'],
        actions: ['sales.order.write'],
      },
    });

    expect(headers['x-erp-session']).toEqual(expect.any(String));
    expect(headers['x-erp-session-signature']).toEqual(expect.any(String));

    vi.unstubAllEnvs();
  });

  it('refuses to sign in production when the secret is unset', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ERP_FORMAL_SESSION_SECRET', '');

    expect(() =>
      buildSignedFormalRequestHeaders({
        role: 'admin',
        user: 'Admin',
        accessScopes: { modules: ['admin'], actions: ['admin.user.write'] },
      }),
    ).toThrow(/ERP_FORMAL_SESSION_SECRET/);

    vi.unstubAllEnvs();
  });

  it('no longer signs with the previously published development secret', () => {
    vi.stubEnv('ERP_FORMAL_SESSION_SECRET', '');

    const headers = buildSignedFormalRequestHeaders({
      role: 'admin',
      user: 'Admin',
      accessScopes: { modules: ['admin'], actions: ['admin.user.write'] },
    });

    const leakedSignature = createHmac(
      'sha256',
      'erp-dev-formal-session-secret',
    )
      .update(headers['x-erp-session'])
      .digest('base64url');

    expect(headers['x-erp-session-signature']).not.toBe(leakedSignature);

    vi.unstubAllEnvs();
  });

  it('round-trips a formal session cookie payload', () => {
    const cookie = encodeFormalSessionCookie({
      role: 'admin',
      user: 'Admin',
      username: 'admin',
        accessScopes: {
        modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
        dataScope: 'all',
      },
    });

    expect(decodeFormalSessionCookie(cookie)).toEqual({
      role: 'admin',
      user: 'Admin',
      username: 'admin',
      accessScopes: {
        modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
        dataScope: 'all',
      },
    });
  });

  it('decodes cookies that were encoded again by the browser cookie writer', () => {
    const cookie = encodeURIComponent(
      encodeFormalSessionCookie({
        role: 'admin',
        user: 'Admin',
        username: 'admin',
        accessScopes: {
          modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'admin'],
          dataScope: 'all',
        },
      }),
    );

    expect(decodeFormalSessionCookie(cookie)).toEqual({
      role: 'admin',
      user: 'Admin',
      username: 'admin',
      accessScopes: {
        modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'admin'],
        dataScope: 'all',
      },
    });
  });

  it('rejects invalid or unsupported session cookies', () => {
    expect(decodeFormalSessionCookie('not-json')).toBeNull();
    expect(
      decodeFormalSessionCookie(
        encodeFormalSessionCookie({
          role: 'unknown',
          user: 'Ghost',
          username: 'ghost',
        }),
      ),
    ).toBeNull();
  });

  it('rewrites role and user from the cookie when formal app url has no identity', () => {
    const decision = buildFormalSessionRouteDecision({
      pathname: '/app/admin/users',
      search: '',
      origin: 'http://127.0.0.1:3000',
      sessionCookie: encodeFormalSessionCookie({
        role: 'admin',
        user: 'Admin',
        username: 'admin',
        accessScopes: {
          modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
          dataScope: 'all',
        },
      }),
    });

    expect(decision).toEqual({
      type: 'rewrite',
      url:
        'http://127.0.0.1:3000/app/admin/users?role=admin&user=Admin&access=%257B%2522modules%2522%253A%255B%2522sales%2522%252C%2522purchase%2522%252C%2522operations%2522%252C%2522boss_dashboard%2522%252C%2522audit%2522%252C%2522admin%2522%255D%252C%2522dataScope%2522%253A%2522all%2522%257D',
    });
  });

  it('removes visible query identity when a cookie identity exists', () => {
    expect(
      buildFormalSessionRouteDecision({
        pathname: '/app/sales/orders',
        search: '?role=sales&user=Zoe&keyword=SO-001',
        origin: 'http://127.0.0.1:3000',
        sessionCookie: encodeFormalSessionCookie({
          role: 'admin',
          user: 'Admin',
          username: 'admin',
        }),
      }),
    ).toEqual({
      type: 'redirect',
      url: 'http://127.0.0.1:3000/app/sales/orders?keyword=SO-001',
    });

    expect(
      buildFormalSessionRouteDecision({
        pathname: '/app/sales/orders',
        search: '?keyword=SO-001',
        origin: 'http://127.0.0.1:3000',
        sessionCookie: encodeFormalSessionCookie({
          role: 'sales',
          user: 'Zoe',
          username: 'zoe',
          accessScopes: {
            modules: ['sales'],
            dataScope: 'own_sales',
          },
        }),
      }),
    ).toEqual({
        type: 'rewrite',
      url:
        'http://127.0.0.1:3000/app/sales/orders?keyword=SO-001&role=sales&user=Zoe&access=%257B%2522modules%2522%253A%255B%2522sales%2522%255D%252C%2522dataScope%2522%253A%2522own_sales%2522%257D',
    });
  });

  it('does not redirect again when the rewritten identity already matches the session cookie', () => {
    expect(
      buildFormalSessionRouteDecision({
        pathname: '/app',
        search:
          '?role=sales&user=Zoe&access=%257B%2522modules%2522%253A%255B%2522sales%2522%255D%252C%2522dataScope%2522%253A%2522own_sales%2522%257D',
        origin: 'http://127.0.0.1:3000',
        sessionCookie: encodeFormalSessionCookie({
          role: 'sales',
          user: 'Zoe',
          username: 'zoe',
          accessScopes: {
            modules: ['sales'],
            dataScope: 'own_sales',
          },
        }),
      }),
    ).toBeNull();
  });

  it('allows formal app access with supported url identity when there is no session cookie', () => {
    expect(
      buildFormalSessionRouteDecision({
        pathname: '/app/sales/orders',
        search: '?role=sales&user=Zoe',
        origin: 'http://127.0.0.1:3000',
        sessionCookie: undefined,
      }),
    ).toBeNull();
  });

  it('keeps supported url identity on formal pages even without a session cookie', () => {
    expect(
      buildFormalSessionRouteDecision({
        pathname: '/app/master-data',
        search: '?role=admin&user=Admin&access=%257B%2522modules%2522%253A%255B%2522sales%2522%255D%252C%2522dataScope%2522%253A%2522all%2522%257D',
        origin: 'http://127.0.0.1:3000',
        sessionCookie: undefined,
      }),
    ).toBeNull();
  });

  it('still redirects unsupported url identity to login without a session cookie', () => {
    expect(
      buildFormalSessionRouteDecision({
        pathname: '/app/master-data',
        search: '?role=unknown&user=Ghost',
        origin: 'http://127.0.0.1:3000',
        sessionCookie: undefined,
      }),
    ).toEqual({
      type: 'redirect',
      url: 'http://127.0.0.1:3000/app/login',
    });
  });

  it('inherits supported identity from a same-origin formal referer for bare submodule links', () => {
    expect(
      buildFormalSessionRouteDecision({
        pathname: '/app/master-data/counterparties',
        search: '',
        origin: 'http://127.0.0.1:3000',
        sessionCookie: undefined,
        referer:
          'http://127.0.0.1:3000/app/master-data?role=admin&user=Admin&access=%257B%2522modules%2522%253A%255B%2522admin%2522%255D%252C%2522dataScope%2522%253A%2522all%2522%257D',
      }),
    ).toEqual({
      type: 'redirect',
      url:
        'http://127.0.0.1:3000/app/master-data/counterparties?role=admin&user=Admin&access=%257B%2522modules%2522%253A%255B%2522admin%2522%255D%252C%2522dataScope%2522%253A%2522all%2522%257D',
    });
  });

  it('prefers forwarded public origin over the internal next origin', () => {
    expect(
      resolveFormalRequestOrigin({
        origin: 'https://localhost:3002',
        publicOrigin: 'https://example.trycloudflare.com',
        forwardedHost: 'example.trycloudflare.com',
        host: 'localhost:3002',
        forwardedProto: 'https',
      }),
    ).toBe('https://example.trycloudflare.com');
  });

  it('keeps formal app rewrites on the same public origin for cookie-backed sessions', () => {
    const request = new NextRequest('https://example.trycloudflare.com/app', {
      headers: {
        cookie: `erp_formal_session=${encodeFormalSessionCookie({
          role: 'admin',
          user: 'Admin',
          username: 'admin',
          accessScopes: {
            modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'admin'],
            dataScope: 'all',
          },
        })}`,
        'x-forwarded-host': 'example.trycloudflare.com',
        'x-forwarded-proto': 'https',
        'x-erp-public-origin': 'https://example.trycloudflare.com',
        'x-erp-internal-origin': 'http://127.0.0.1:3002',
      },
    });

    const response = middleware(request);

    expect(response.headers.get('location')).toBe(
      'https://example.trycloudflare.com/app?role=admin&user=Admin&access=%257B%2522modules%2522%253A%255B%2522sales%2522%252C%2522purchase%2522%252C%2522operations%2522%252C%2522boss_dashboard%2522%252C%2522admin%2522%255D%252C%2522dataScope%2522%253A%2522all%2522%257D',
    );
  });

  it('redirects legacy preview routes to formal app routes', () => {
    const request = new NextRequest('https://erp.example.com/sales-orders/88?foo=bar');

    const response = middleware(request);

    expect(response.headers.get('location')).toBe(
      'https://erp.example.com/app/sales/orders/88?foo=bar',
    );
  });

  it('resolves server action identity from the formal session cookie before form fields', () => {
    const sessionCookie = encodeFormalSessionCookie({
      role: 'sales',
      user: 'Zoe',
      username: 'zoe',
      accessScopes: {
        modules: ['sales'],
        dataScope: 'own_sales',
        actions: ['sales.quote.write'],
      },
    });

    expect(
      resolveFormalActionSession({
        formRole: 'admin',
        formUser: 'Admin',
        formAccess: encodeURIComponent(
          JSON.stringify({
            modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
            dataScope: 'all',
            actions: ['admin.user.write', 'admin.role.write'],
          }),
        ),
        sessionCookie,
      }),
    ).toEqual({
      role: 'sales',
      user: 'Zoe',
      accessScopes: {
        modules: ['sales'],
        dataScope: 'own_sales',
        actions: ['sales.quote.write'],
      },
    });
  });

  it('falls back to form identity for server actions when there is no session cookie', () => {
    expect(
      resolveFormalActionSession({
        formRole: 'purchase',
        formUser: 'Leo',
        formAccess: encodeURIComponent(
          JSON.stringify({
            modules: ['purchase', 'operations'],
            dataScope: 'own_purchase',
            actions: ['shipment.update'],
          }),
        ),
      }),
    ).toEqual({
      role: 'purchase',
      user: 'Leo',
      accessScopes: {
        modules: ['purchase', 'operations'],
        dataScope: 'own_purchase',
        actions: ['shipment.update'],
      },
    });
  });

  it('resolves formal action identity from request headers', async () => {
    await expect(
      resolveFormalActionSessionFromHeaders({
        'x-erp-role': 'sales',
        'x-erp-user': 'Zoe',
        'x-erp-modules': 'sales',
        'x-erp-actions': 'sales.order.write',
      }),
    ).resolves.toEqual({
      role: 'sales',
      user: 'Zoe',
      accessScopes: {
        modules: ['sales'],
        dataScope: 'all',
        actions: ['sales.order.write'],
      },
    });
  });
});
