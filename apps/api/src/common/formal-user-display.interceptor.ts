import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { mergeMap, Observable } from 'rxjs';
import { formalUserAliases } from '../auth/formal-user-aliases';
import { UserManagementService } from '../user-management/user-management.service';

const userFields: Record<string, string[]> = {
  ownerName: ['ownerId', 'ownerUserId', 'salesUserId'],
  salesUserName: ['salesUserId'],
  purchaseOwnerName: ['purchaseOwnerId'],
  createdBy: ['createdById', 'createdBy'],
  createdByName: ['createdById', 'createdBy'],
  operatorName: ['operatorId'],
  comparisonSubmittedBy: ['comparisonSubmittedById'],
  receiptSentBy: ['receiptSentBy'],
  updatedBy: ['updatedById'],
  handlerLabel: ['handlerUserId'],
};
const userIdFields = new Set(Object.values(userFields).flat());
const unlinked = '历史账号未关联';
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}
function hasUserFields(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasUserFields);
  return isRecord(value) && Object.entries(value).some(([key, entry]) =>
    Object.hasOwn(userFields, key) || userIdFields.has(key) || hasUserFields(entry));
}

@Injectable()
export class FormalUserDisplayInterceptor implements NestInterceptor {
  constructor(@Inject(UserManagementService) private readonly users: UserManagementService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method: string; headers: Record<string, unknown> }>();
    if (request.method !== 'GET' || !request.headers['x-erp-role']) return next.handle();
    return next.handle().pipe(mergeMap(async (value) => {
      if (!hasUserFields(value)) return value;
      const users = await this.users.listOperatorDirectory();
      const byId = new Map(users.map(user => [user.id, user.username]));
      for (const [username, alias] of Object.entries(formalUserAliases)) {
        if (!byId.has(alias.legacyId) && byId.get(alias.id) === username) byId.set(alias.legacyId, username);
      }
      const byName = new Map<string, string[]>();
      for (const user of users) {
        for (const name of new Set([user.username, user.realName].map(name => name.trim().toLowerCase()))) {
          byName.set(name, [...(byName.get(name) ?? []), user.username]);
        }
      }
      const label = (reference: unknown): string => {
        if (reference === 0 || reference === '0' || reference === 'system') return '系统';
        const numeric = typeof reference === 'number' || (typeof reference === 'string' && /^\d+$/.test(reference));
        if (numeric) return byId.get(Number(reference)) ?? unlinked;
        if (typeof reference !== 'string') return unlinked;
        const names = byName.get(reference.trim().toLowerCase());
        return names?.length === 1 ? names[0] : unlinked;
      };
      const enrich = (entry: unknown): unknown => {
        if (Array.isArray(entry)) return entry.map(enrich);
        if (!isRecord(entry)) return entry;
        const result = Object.fromEntries(Object.entries(entry).map(([key, child]) =>
          [key, key === 'beforeData' || key === 'afterData' ? child : enrich(child)]));
        const displayNames: Record<string, string> = {};
        for (const [field, ids] of Object.entries(userFields)) {
          const reference = ids.map(id => entry[id]).find(value => typeof value === 'number' ||
            (typeof value === 'string' && /^\d+$/.test(value)));
          if (reference !== undefined) displayNames[field] = label(reference);
          else if (field !== 'handlerLabel' && typeof entry[field] === 'string' && entry[field]) displayNames[field] = label(entry[field]);
        }
        if (!displayNames.handlerLabel && typeof entry.handlerLabel === 'string' &&
          (entry.handlerLabel === entry.ownerName || /^(用户|操作人)\s*#/.test(entry.handlerLabel))) {
          displayNames.handlerLabel = displayNames.ownerName ?? unlinked;
        }
        if (entry.relation && typeof entry.description === 'string' && typeof entry.ownerName === 'string' && entry.ownerName && displayNames.ownerName) {
          displayNames.description = entry.description.split(entry.ownerName).join(displayNames.ownerName);
        }
        if ('operatorId' in entry) {
          const changedUsers: Record<string, string> = {};
          const changedNames: Record<string, string> = Object.create(null);
          const collect = (snapshot: unknown) => {
            if (Array.isArray(snapshot)) snapshot.forEach(collect);
            else if (isRecord(snapshot)) {
              for (const [field, ids] of Object.entries(userFields)) {
                const name = snapshot[field];
                if (typeof name !== 'string' || !name || /^\d+$/.test(name)) continue;
                const id = ids.map(key => snapshot[key]).find(value => typeof value === 'number' ||
                  (typeof value === 'string' && /^\d+$/.test(value)));
                const username = label(id ?? name);
                changedNames[name] = changedNames[name] && changedNames[name] !== username ? unlinked : username;
              }
              Object.entries(snapshot).forEach(([key, child]) => {
                if (userIdFields.has(key) && (typeof child === 'number' || (typeof child === 'string' && /^\d+$/.test(child)))) changedUsers[String(child)] = label(child);
                else collect(child);
              });
            }
          };
          collect(entry.beforeData);
          collect(entry.afterData);
          result.userDisplayNamesById = changedUsers;
          result.userDisplayNamesByName = changedNames;
        }
        return Object.keys(displayNames).length ? { ...result, userDisplayNames: displayNames } : result;
      };
      return enrich(value);
    }));
  }
}
