import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AdminOnlyGuard } from '../src/auth/admin-only.guard';
import {
  FORMAL_ACTIONS_KEY,
  FORMAL_MODULES_KEY,
} from '../src/auth/formal-role.decorator';

function createContext(role?: string, actions?: string, modules?: string): ExecutionContext {
  return {
    getClass: () => class AdminController {},
    getHandler: () => function adminHandler() {},
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          ...(role ? { 'x-erp-role': role } : {}),
          ...(actions ? { 'x-erp-actions': actions } : {}),
          ...(modules ? { 'x-erp-modules': modules } : {}),
        },
      }),
    }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({
      getContext: () => undefined,
      getData: () => undefined,
    }),
    switchToWs: () => ({ getClient: () => undefined, getData: () => undefined }),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

function createGuard(requiredActions?: string[], requiredModules?: string[]) {
  return new AdminOnlyGuard({
    getAllAndOverride: jest.fn((key: string) =>
      key === FORMAL_ACTIONS_KEY
        ? requiredActions
        : key === FORMAL_MODULES_KEY
          ? requiredModules
          : undefined,
    ),
  } as unknown as Reflector);
}

describe('AdminOnlyGuard', () => {
  it('allows admin requests', () => {
    const guard = createGuard();

    expect(guard.canActivate(createContext('admin'))).toBe(true);
  });

  it('blocks non-admin requests', () => {
    const guard = createGuard();

    expect(() => guard.canActivate(createContext('sales'))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks requests without a role header', () => {
    const guard = createGuard();

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });

  it('blocks admin requests when a required action permission is missing', () => {
    const guard = createGuard(['master_data.write']);

    expect(() =>
      guard.canActivate(createContext('admin', 'admin.user.write')),
    ).toThrow(ForbiddenException);
  });

  it('allows admin requests when the required action permission is present', () => {
    const guard = createGuard(['master_data.write']);

    expect(guard.canActivate(createContext('admin', 'master_data.write'))).toBe(
      true,
    );
  });

  it('allows comma-separated admin action permissions with whitespace', () => {
    const guard = createGuard(['admin.role.write']);

    expect(
      guard.canActivate(
        createContext('admin', 'admin.user.write, admin.role.write'),
      ),
    ).toBe(true);
  });

  it('requires every declared admin action permission', () => {
    const guard = createGuard(['admin.user.write', 'admin.role.write']);

    expect(() =>
      guard.canActivate(createContext('admin', 'admin.user.write')),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(
        createContext('admin', 'admin.user.write,admin.role.write'),
      ),
    ).toBe(true);
  });

  it('blocks admin requests when a required module permission is missing', () => {
    const guard = createGuard(undefined, ['admin']);

    expect(() =>
      guard.canActivate(createContext('admin', undefined, 'sales,purchase')),
    ).toThrow(ForbiddenException);
  });

  it('allows admin requests when the required module permission is present', () => {
    const guard = createGuard(undefined, ['admin']);

    expect(guard.canActivate(createContext('admin', undefined, 'sales, admin'))).toBe(
      true,
    );
  });
});
