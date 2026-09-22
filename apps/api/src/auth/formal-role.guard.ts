import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  FORMAL_ACTIONS_KEY,
  FORMAL_ANY_MODULES_KEY,
  FORMAL_MODULES_KEY,
  FORMAL_ROLES_KEY,
  type FormalRole,
} from './formal-role.decorator';

function readHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function readHeaderList(value: string | string[] | undefined) {
  const raw = readHeaderValue(value)?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isStrictFormalSessionMode() {
  return process.env.ERP_REQUIRE_SIGNED_FORMAL_SESSION?.trim().toLowerCase() === 'true';
}

const DEV_ONLY_SESSION_SECRET = 'dev-only-insecure-formal-session-secret';

function getFormalSessionSecret() {
  const configured = process.env.ERP_FORMAL_SESSION_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '生产环境必须配置 ERP_FORMAL_SESSION_SECRET，且 api 与 web 两侧取值必须一致',
    );
  }

  return DEV_ONLY_SESSION_SECRET;
}

function verifySignature(payload: string, signature: string, secret: string) {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  return (
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
}

function readSignedFormalSession(headers: Record<string, string | string[] | undefined>) {
  const payload = readHeaderValue(headers['x-erp-session'])?.trim();
  const signature = readHeaderValue(headers['x-erp-session-signature'])?.trim();

  if (!payload && !signature) {
    return null;
  }

  if (!payload || !signature || !verifySignature(payload, signature, getFormalSessionSecret())) {
    throw new ForbiddenException('正式会话签名无效');
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: unknown;
      user?: unknown;
      modules?: unknown;
      actions?: unknown;
      exp?: unknown;
    };

    if (
      typeof parsed.role !== 'string' ||
      typeof parsed.user !== 'string' ||
      (parsed.modules !== undefined &&
        (!Array.isArray(parsed.modules) ||
          parsed.modules.some((moduleCode) => typeof moduleCode !== 'string'))) ||
      (parsed.actions !== undefined &&
        (!Array.isArray(parsed.actions) ||
          parsed.actions.some((action) => typeof action !== 'string'))) ||
      (parsed.exp !== undefined &&
        (typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)))
    ) {
      throw new ForbiddenException('正式会话无效或已过期');
    }

    return {
      role: parsed.role as FormalRole,
      modules: Array.isArray(parsed.modules) ? parsed.modules : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch (error) {
    if (error instanceof ForbiddenException) {
      throw error;
    }

    throw new ForbiddenException('正式会话无效或已过期');
  }
}

@Injectable()
export class FormalRoleGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const allowedRoles = this.reflector.getAllAndOverride<
      FormalRole[] | undefined
    >(FORMAL_ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!allowedRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const signedSession = readSignedFormalSession(request.headers);

    if (!signedSession && isStrictFormalSessionMode()) {
      throw new ForbiddenException('正式模式要求签名会话');
    }

    const role = signedSession?.role ??
      (readHeaderValue(request.headers['x-erp-role'])?.trim() as
        | FormalRole
        | undefined);

    if (!role || !allowedRoles.includes(role)) {
      throw new ForbiddenException('当前角色无权执行该业务操作');
    }

    const requiredModules = this.reflector.getAllAndOverride<string[] | undefined>(
      FORMAL_MODULES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredModules?.length) {
      const grantedModules = signedSession?.modules ??
        readHeaderList(request.headers['x-erp-modules']);
      const hasAllRequiredModules = requiredModules.every((moduleCode) =>
        grantedModules.includes(moduleCode),
      );

      if (!hasAllRequiredModules) {
        throw new ForbiddenException('当前角色无权访问该业务模块');
      }
    }

    const requiredAnyModules = this.reflector.getAllAndOverride<
      string[] | undefined
    >(FORMAL_ANY_MODULES_KEY, [context.getHandler(), context.getClass()]);

    if (requiredAnyModules?.length) {
      const grantedModules = signedSession?.modules ??
        readHeaderList(request.headers['x-erp-modules']);
      const hasAnyRequiredModule = requiredAnyModules.some((moduleCode) =>
        grantedModules.includes(moduleCode),
      );

      if (!hasAnyRequiredModule) {
        throw new ForbiddenException('当前角色无权访问该业务模块');
      }
    }

    const requiredActions = this.reflector.getAllAndOverride<string[] | undefined>(
      FORMAL_ACTIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredActions?.length) {
      return true;
    }

    const grantedActions = signedSession?.actions ??
      readHeaderList(request.headers['x-erp-actions']);
    const missingAction = requiredActions.find(
      (action) => !grantedActions.includes(action),
    );

    if (missingAction) {
      throw new ForbiddenException('当前角色无权执行该业务操作');
    }

    return true;
  }
}
