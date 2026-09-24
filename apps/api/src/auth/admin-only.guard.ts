import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FORMAL_ACTIONS_KEY, FORMAL_MODULES_KEY } from './formal-role.decorator';
import { readSignedFormalSession } from './formal-role.guard';

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

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const signedSession = readSignedFormalSession(request.headers);
    if (!signedSession && (process.env.NODE_ENV !== 'test' ||
      process.env.ERP_REQUIRE_SIGNED_FORMAL_SESSION?.trim().toLowerCase() === 'true')) {
      throw new ForbiddenException('正式模式要求签名会话');
    }
    if (signedSession) {
      request.headers['x-erp-role'] = signedSession.role;
      request.headers['x-erp-user'] = signedSession.user;
      request.headers['x-erp-modules'] = signedSession.modules.join(',');
      request.headers['x-erp-actions'] = signedSession.actions.join(',');
    }
    const role = signedSession?.role ?? readHeaderValue(request.headers['x-erp-role'])?.trim();

    if (role !== 'admin') {
      throw new ForbiddenException('仅管理员可访问用户管理接口');
    }

    const requiredModules = this.reflector.getAllAndOverride<string[] | undefined>(
      FORMAL_MODULES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredModules?.length) {
      const grantedModules = readHeaderList(request.headers['x-erp-modules']);
      const missingModule = requiredModules.find(
        (moduleCode) => !grantedModules.includes(moduleCode),
      );

      if (missingModule) {
        throw new ForbiddenException('仅管理员可访问用户管理接口');
      }
    }

    const requiredActions = this.reflector.getAllAndOverride<string[] | undefined>(
      FORMAL_ACTIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredActions?.length) {
      return true;
    }

    const grantedActions = readHeaderList(request.headers['x-erp-actions']);
    const missingAction = requiredActions.find(
      (action) => !grantedActions.includes(action),
    );

    if (missingAction) {
      throw new ForbiddenException('仅管理员可访问用户管理接口');
    }

    return true;
  }
}
