import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { createHmac } from 'node:crypto';
import { AdminOnlyGuard } from '../src/auth/admin-only.guard';
import { FormalRoleGuard } from '../src/auth/formal-role.guard';
import type { FormalRole } from '../src/auth/formal-role.decorator';

const FORMAL_ACTIONS_KEY = 'formal_actions';
const FORMAL_MODULES_KEY = 'formal_modules';
const FORMAL_ANY_MODULES_KEY = 'formal_any_modules';

function createSignedSession(
  payload: {
    role: string;
    user: string;
    modules?: string[];
    actions?: string[];
    exp?: number;
  },
  secret = 'test-secret',
) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return { encodedPayload, signature };
}

function createContext(
  role?: string,
  actions?: string,
  modules?: string,
  signedSession?: { encodedPayload: string; signature: string },
): ExecutionContext {
  return {
    getClass: () => class TestController {},
    getHandler: () => function testHandler() {},
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          ...(role ? { 'x-erp-role': role } : {}),
          ...(actions ? { 'x-erp-actions': actions } : {}),
          ...(modules ? { 'x-erp-modules': modules } : {}),
          ...(signedSession
            ? {
                'x-erp-session': signedSession.encodedPayload,
                'x-erp-session-signature': signedSession.signature,
              }
            : {}),
        },
      }),
    }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({ getContext: () => undefined }),
    switchToWs: () => ({ getClient: () => undefined, getData: () => undefined }),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

function createGuard({
  allowedRoles,
  requiredActions,
  requiredModules,
  requiredAnyModules,
}: {
  allowedRoles?: FormalRole[];
  requiredActions?: string[];
  requiredModules?: string[];
  requiredAnyModules?: string[];
}) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === FORMAL_ACTIONS_KEY) {
        return requiredActions;
      }
      if (key === FORMAL_MODULES_KEY) {
        return requiredModules;
      }
      if (key === FORMAL_ANY_MODULES_KEY) {
        return requiredAnyModules;
      }

      return allowedRoles;
    }),
  } as unknown as Reflector;

  return new FormalRoleGuard(reflector);
}

describe('FormalRoleGuard', () => {
  const originalSecret = process.env.ERP_FORMAL_SESSION_SECRET;
  const originalStrictMode = process.env.ERP_REQUIRE_SIGNED_FORMAL_SESSION;
  const originalNodeEnv = process.env.NODE_ENV;

  function restoreEnv() {
    if (originalSecret === undefined) {
      delete process.env.ERP_FORMAL_SESSION_SECRET;
    } else {
      process.env.ERP_FORMAL_SESSION_SECRET = originalSecret;
    }
    process.env.ERP_REQUIRE_SIGNED_FORMAL_SESSION = originalStrictMode;
    process.env.NODE_ENV = originalNodeEnv;
  }

  // 基线不含密钥，避免开发机 shell 里的 ERP_FORMAL_SESSION_SECRET 影响断言
  beforeEach(() => {
    restoreEnv();
    delete process.env.ERP_FORMAL_SESSION_SECRET;
  });

  afterAll(restoreEnv);

  it('declares explicit Reflector injection metadata for tsx runtime', () => {
    expect(
      Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, FormalRoleGuard),
    ).toEqual([{ index: 0, param: Reflector }]);
    expect(
      Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, AdminOnlyGuard),
    ).toEqual([{ index: 0, param: Reflector }]);
  });

  it('allows routes without formal role metadata', () => {
    const guard = createGuard({});

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows matching formal roles', () => {
    const guard = createGuard({
      allowedRoles: ['admin', 'boss', 'sales_manager'],
    });

    expect(guard.canActivate(createContext('sales_manager'))).toBe(true);
  });

  it('blocks requests without a role header', () => {
    const guard = createGuard({ allowedRoles: ['admin'] });

    expect(() => guard.canActivate(createContext())).toThrow(ForbiddenException);
  });

  it('blocks non-matching formal roles', () => {
    const guard = createGuard({
      allowedRoles: ['purchase_manager', 'purchase'],
    });

    expect(() => guard.canActivate(createContext('sales'))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks a matching role when its dynamic action permission is missing', () => {
    const guard = createGuard({
      allowedRoles: ['sales'],
      requiredActions: ['sales.order.write'],
    });

    expect(() =>
      guard.canActivate(
        createContext('sales', 'sales.quote.write'),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows a matching role when its dynamic action permission is present', () => {
    const guard = createGuard({
      allowedRoles: ['sales'],
      requiredActions: ['sales.order.write'],
    });

    expect(guard.canActivate(createContext('sales', 'sales.order.write'))).toBe(
      true,
    );
  });

  it('allows comma-separated dynamic action permissions with whitespace', () => {
    const guard = createGuard({
      allowedRoles: ['sales'],
      requiredActions: ['sales.order.write'],
    });

    expect(
      guard.canActivate(
        createContext('sales', 'sales.quote.write, sales.order.write'),
      ),
    ).toBe(true);
  });

  it('requires every declared dynamic action permission', () => {
    const guard = createGuard({
      allowedRoles: ['boss'],
      requiredActions: ['boss.confirm', 'finance.confirm'],
    });

    expect(() =>
      guard.canActivate(createContext('boss', 'boss.confirm')),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(
        createContext('boss', 'boss.confirm,finance.confirm'),
      ),
    ).toBe(true);
  });

  it('blocks a matching role when its dynamic module permission is missing', () => {
    const guard = createGuard({
      allowedRoles: ['sales'],
      requiredModules: ['sales'],
    });

    expect(() =>
      guard.canActivate(createContext('sales', undefined, 'purchase')),
    ).toThrow(ForbiddenException);
  });

  it('allows a matching role when its dynamic module permission is present', () => {
    const guard = createGuard({
      allowedRoles: ['sales'],
      requiredModules: ['sales'],
    });

    expect(guard.canActivate(createContext('sales', undefined, 'sales'))).toBe(
      true,
    );
  });

  it('allows a matching role when any declared dynamic module permission is present', () => {
    const guard = createGuard({
      allowedRoles: ['sales', 'purchase'],
      requiredAnyModules: ['sales', 'purchase'],
    });

    expect(guard.canActivate(createContext('sales', undefined, 'sales'))).toBe(
      true,
    );
    expect(guard.canActivate(createContext('purchase', undefined, 'purchase'))).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(createContext('purchase', undefined, 'operations')),
    ).toThrow(ForbiddenException);
  });

  it('allows signed formal sessions without trusting plaintext role headers', () => {
    process.env.ERP_FORMAL_SESSION_SECRET = 'test-secret';
    const guard = createGuard({
      allowedRoles: ['sales'],
      requiredModules: ['sales'],
      requiredActions: ['sales.order.write'],
    });
    const signedSession = createSignedSession({
      role: 'sales',
      user: 'Zoe',
      modules: ['sales'],
      actions: ['sales.order.write'],
    });

    expect(guard.canActivate(createContext(undefined, undefined, undefined, signedSession))).toBe(
      true,
    );
  });

  it('rejects tampered signed formal sessions', () => {
    process.env.ERP_FORMAL_SESSION_SECRET = 'test-secret';
    const guard = createGuard({
      allowedRoles: ['admin'],
      requiredModules: ['admin'],
    });
    const signedSession = createSignedSession({
      role: 'sales',
      user: 'Zoe',
      modules: ['sales'],
    });
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        role: 'admin',
        user: 'Zoe',
        modules: ['admin'],
      }),
    ).toString('base64url');

    expect(() =>
      guard.canActivate(
        createContext(undefined, undefined, undefined, {
          encodedPayload: tamperedPayload,
          signature: signedSession.signature,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('requires signed formal sessions in strict auth mode', () => {
    process.env.ERP_REQUIRE_SIGNED_FORMAL_SESSION = 'true';
    process.env.ERP_FORMAL_SESSION_SECRET = 'test-secret';
    const guard = createGuard({
      allowedRoles: ['sales'],
      requiredModules: ['sales'],
    });

    const signedSession = createSignedSession({
      role: 'sales',
      user: 'Zoe',
      modules: ['sales'],
    });

    expect(
      guard.canActivate(createContext(undefined, undefined, undefined, signedSession)),
    ).toBe(true);
    expect(() =>
      guard.canActivate(createContext('sales', undefined, 'sales')),
    ).toThrow(ForbiddenException);
  });

  it('refuses to verify signatures in production when the secret is unset', () => {
    process.env.NODE_ENV = 'production';
    const guard = createGuard({ allowedRoles: ['admin'] });
    const signedSession = createSignedSession({ role: 'admin', user: 'Admin' });

    expect(() =>
      guard.canActivate(
        createContext(undefined, undefined, undefined, signedSession),
      ),
    ).toThrow(/ERP_FORMAL_SESSION_SECRET/);
  });

  it('rejects sessions signed with the previously published development secret', () => {
    const guard = createGuard({ allowedRoles: ['admin'] });
    const signedSession = createSignedSession(
      { role: 'admin', user: 'Admin', modules: ['admin'] },
      'erp-dev-formal-session-secret',
    );

    expect(() =>
      guard.canActivate(
        createContext(undefined, undefined, undefined, signedSession),
      ),
    ).toThrow(ForbiddenException);
  });
});
