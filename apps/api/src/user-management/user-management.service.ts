import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { paginateItems } from '../common/pagination';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import {
  defaultRolePermissions,
  hashPassword,
  resolveUserManagementStore,
  type AccessScopes,
  type RolePermissionRecord,
  type RoleCode,
  type UserRecord,
} from './user-management.store';

const roleCodes: RoleCode[] = [
  'admin',
  'boss',
  'sales_manager',
  'sales',
  'purchase_manager',
  'purchase',
];

const moduleCodes = [
  'sales',
  'purchase',
  'operations',
  'boss_dashboard',
  'audit',
  'admin',
];

const dataScopes = [
  'all',
  'sales_team',
  'own_sales',
  'purchase_team',
  'own_purchase',
];

const actionCodes = [
  'audit.view',
  'admin.user.write',
  'admin.role.write',
  'master_data.write',
  'product.write',
  'product.custom_field.write',
  'counterparty.write',
  'sales.quote.write',
  'sales.inquiry.submit',
  'sales.order.write',
  'sales.sample.submit',
  'sales.sample.approve',
  'sales.sample.execute',
  'purchase.order.create',
  'purchase.order.submit',
  'purchase.order.approve',
  'purchase.sample.execute',
  'shipment.update',
  'after_sales.process',
  'boss.confirm',
  'finance.confirm',
];

type UserListItem = Omit<UserRecord, 'passwordHash'> & {
  accessScopes: AccessScopes;
};

type RolePermissionListItem = RolePermissionRecord;
function withDefaultPurchaseInquiryPermission(record: RolePermissionListItem) {
  if (
    record.updatedBy !== 'system' ||
    (record.roleCode !== 'purchase' && record.roleCode !== 'purchase_manager')
  ) {
    return record;
  }

  return {
    ...record,
    accessScopes: {
      ...record.accessScopes,
      actions: [...new Set([...record.accessScopes.actions, 'sales.inquiry.submit'])],
    },
  };
}

type AssignableSalesUserItem = Pick<
  UserRecord,
  'id' | 'username' | 'realName' | 'roleCode' | 'status'
>;
export type AssignablePurchaseUserItem = Pick<
  UserRecord,
  'id' | 'username' | 'realName' | 'roleCode' | 'status'
>;
type OperatorDirectoryItem = Pick<UserRecord, 'id' | 'username' | 'realName'>;

export type ListUsersQuery = {
  page?: string | number;
  pageSize?: string | number;
};

type PrismaUserRecord = {
  id: bigint;
  username: string;
  realName: string;
  passwordHash: string;
  roleCode: string;
  status: string;
  fullAccess: boolean;
  createdAt: Date;
  createdBy: string;
  deactivatedAt: Date | null;
  deactivatedBy: string | null;
  deactivatedReason: string | null;
};

type PrismaOperationLogRecord = {
  id: bigint;
  bizType: string;
  bizId: bigint;
  operationType: string;
  operatorId: bigint;
  beforeData: unknown | null;
  afterData: unknown | null;
  createdAt: Date;
};

type PrismaRolePermissionRecord = {
  id: bigint;
  roleCode: string;
  modules: unknown;
  actions: unknown;
  dataScope: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeModules(value: string[]) {
  const uniqueModules = [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  const invalidModule = uniqueModules.find((item) => !moduleCodes.includes(item));

  if (invalidModule) {
    throw new BadRequestException(`模块权限不合法: ${invalidModule}`);
  }

  if (uniqueModules.length === 0) {
    throw new BadRequestException('至少选择一个模块权限');
  }

  return moduleCodes.filter((item) => uniqueModules.includes(item));
}

function normalizeActions(value: string[]) {
  const uniqueActions = [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  const invalidAction = uniqueActions.find((item) => !actionCodes.includes(item));

  if (invalidAction) {
    throw new BadRequestException(`动作权限不合法: ${invalidAction}`);
  }

  return actionCodes.filter((item) => uniqueActions.includes(item));
}

function normalizeAccessScopes(
  roleCode: RoleCode,
  payload: { modules: string[]; dataScope: string; actions?: string[] },
): AccessScopes {
  if (roleCode === 'admin') {
    return {
      modules: [...defaultRolePermissions.admin.modules],
      dataScope: defaultRolePermissions.admin.dataScope,
      actions: [...defaultRolePermissions.admin.actions],
    };
  }

  if (!dataScopes.includes(payload.dataScope)) {
    throw new BadRequestException('数据权限范围不合法');
  }

  return {
    modules: normalizeModules(payload.modules),
    dataScope: payload.dataScope,
    actions: normalizeActions(payload.actions ?? defaultRolePermissions[roleCode].actions),
  };
}

function resolveAccessScopes(
  roleCode: RoleCode,
  permissions: Map<RoleCode, AccessScopes>,
): AccessScopes {
  const accessScopes = permissions.get(roleCode) ?? defaultRolePermissions[roleCode];

  return {
    modules: [...accessScopes.modules],
    dataScope: accessScopes.dataScope,
    actions: [...new Set([
      ...(accessScopes.actions ?? defaultRolePermissions[roleCode].actions),
      ...(roleCode === 'admin' ? ['audit.view'] : []),
    ])],
  };
}

function toRolePermissionRecord(record: PrismaRolePermissionRecord): RolePermissionRecord {
  const modules = Array.isArray(record.modules)
    ? record.modules.filter((item): item is string => typeof item === 'string')
    : defaultRolePermissions[record.roleCode as RoleCode]?.modules ?? [];
  const actions = Array.isArray(record.actions)
    ? record.actions.filter((item): item is string => typeof item === 'string')
    : defaultRolePermissions[record.roleCode as RoleCode]?.actions ?? [];

  return {
    roleCode: record.roleCode as RoleCode,
    accessScopes: {
      modules,
      dataScope: record.dataScope,
      actions: record.roleCode === 'admin' ? [...new Set([...actions, 'audit.view'])] : actions,
    },
    updatedBy: record.updatedBy,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toUserListItem(
  record: UserRecord,
  permissions: Map<RoleCode, AccessScopes>,
): UserListItem {
  const { passwordHash: _passwordHash, ...item } = record;
  const accessScopes = resolveAccessScopes(record.roleCode, permissions);

  return {
    ...item,
    fullAccess: accessScopes.dataScope === 'all',
    accessScopes,
  };
}

function toAssignableSalesUserItem(record: UserRecord): AssignableSalesUserItem {
  return {
    id: record.id,
    username: record.username,
    realName: record.realName,
    roleCode: record.roleCode,
    status: record.status,
  };
}

function toAssignablePurchaseUserItem(record: UserRecord): AssignablePurchaseUserItem {
  return {
    id: record.id,
    username: record.username,
    realName: record.realName,
    roleCode: record.roleCode,
    status: record.status,
  };
}

function toRuntimeUserRecord(record: PrismaUserRecord): UserRecord {
  return {
    id: Number(record.id),
    username: record.username,
    realName: record.realName,
    passwordHash: record.passwordHash,
    roleCode: record.roleCode as RoleCode,
    status: record.status === 'inactive' ? 'inactive' : 'active',
    fullAccess: record.fullAccess,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    ...(record.deactivatedAt
      ? { deactivatedAt: record.deactivatedAt.toISOString() }
      : {}),
    ...(record.deactivatedBy ? { deactivatedBy: record.deactivatedBy } : {}),
    ...(record.deactivatedReason
      ? { deactivatedReason: record.deactivatedReason }
      : {}),
  };
}

function toAuditLogRecord(record: PrismaOperationLogRecord) {
  return {
    id: Number(record.id),
    bizType: record.bizType,
    bizId: Number(record.bizId),
    operationType: record.operationType,
    operatorId: Number(record.operatorId),
    beforeData: record.beforeData,
    afterData: record.afterData,
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class UserManagementService {
  private readonly store = resolveUserManagementStore();

  async listActiveCounterpartyOwners() {
    const users = this.shouldUsePrisma()
      ? ((await this.prisma!.user.findMany({ orderBy: { realName: 'asc' } })) as PrismaUserRecord[])
      : this.store.listUsers();
    return users
      .filter((item) => item.status === 'active')
      .map((item) => ({
        id: Number(item.id),
        username: item.username,
        realName: item.realName,
        roleCode: item.roleCode,
        status: item.status,
        fullAccess: item.fullAccess,
      }));
  }

  async getCurrentSession(username: string): Promise<{
    role: RoleCode;
    user: string;
    username: string;
    accessScopes: AccessScopes;
  } | null> {
    const normalizedUsername = username.trim().toLowerCase();
    const record = this.shouldUsePrisma()
      ? ((await this.prisma!.user.findUnique({
          where: { username: normalizedUsername },
        })) as PrismaUserRecord | null)
      : this.store.listUsers().find((item) => item.username === normalizedUsername) ?? null;
    if (!record || record.status !== 'active') return null;
    const role = record.roleCode as RoleCode;
    const permissions = await this.loadRolePermissionMap();
    return {
      role,
      user: role === 'admin' ? 'Admin' : record.realName,
      username: record.username,
      accessScopes: resolveAccessScopes(role, permissions),
    };
  }

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  async listAssignableSalesUsers() {
    const sourceUsers = this.shouldUsePrisma()
      ? (
          (await this.prisma!.user.findMany({
            orderBy: [{ roleCode: 'asc' }, { realName: 'asc' }],
          })) as PrismaUserRecord[]
        ).map(toRuntimeUserRecord)
      : this.store.listUsers();

    return sourceUsers
      .filter(
        (item) =>
          item.status === 'active' &&
          (item.roleCode === 'sales' || item.roleCode === 'sales_manager'),
      )
      .map(toAssignableSalesUserItem)
      .sort((left, right) => {
        if (left.roleCode !== right.roleCode) {
          return left.roleCode === 'sales_manager' ? -1 : 1;
        }

        return left.realName.localeCompare(right.realName, 'zh-CN');
      });
  }

  async listAssignablePurchaseUsers(): Promise<AssignablePurchaseUserItem[]> {
    const sourceUsers = this.shouldUsePrisma()
      ? (
          (await this.prisma!.user.findMany({
            orderBy: [{ roleCode: 'asc' }, { realName: 'asc' }],
          })) as PrismaUserRecord[]
        ).map(toRuntimeUserRecord)
      : this.store.listUsers();

    return sourceUsers
      .filter(
        (item) =>
          item.status === 'active' &&
          (item.roleCode === 'purchase' || item.roleCode === 'purchase_manager'),
      )
      .map(toAssignablePurchaseUserItem)
      .sort((left, right) => {
        if (left.roleCode !== right.roleCode) {
          return left.roleCode === 'purchase_manager' ? -1 : 1;
        }

        return left.realName.localeCompare(right.realName, 'zh-CN');
      });
  }

  async listOperatorDirectory(): Promise<OperatorDirectoryItem[]> {
    if (this.shouldUsePrisma()) {
      const users = (await this.prisma!.user.findMany({
        select: {
          id: true,
          username: true,
          realName: true,
        },
        orderBy: { id: 'asc' },
      })) as Array<Pick<PrismaUserRecord, 'id' | 'username' | 'realName'>>;

      return users.map((user) => ({
        id: Number(user.id),
        username: user.username,
        realName: user.realName,
      }));
    }

    return this.store.listUsers().map((user) => ({
      id: user.id,
      username: user.username,
      realName: user.realName,
    }));
  }

  private get rolePermissionDelegate() {
    return (
      this.prisma as unknown as
        | {
            rolePermission?: {
              findMany: (args?: unknown) => Promise<PrismaRolePermissionRecord[]>;
              findUnique: (args: unknown) => Promise<PrismaRolePermissionRecord | null>;
              upsert: (args: unknown) => Promise<PrismaRolePermissionRecord>;
            };
          }
        | undefined
    )?.rolePermission;
  }

  private async listRolePermissionRecords(): Promise<RolePermissionListItem[]> {
    if (this.shouldUsePrisma() && this.rolePermissionDelegate) {
      const records = await this.rolePermissionDelegate.findMany({
        orderBy: { roleCode: 'asc' },
      });
      const recordMap = new Map(
        records.map((record) => [
          record.roleCode as RoleCode,
          toRolePermissionRecord(record),
        ]),
      );

      return roleCodes.map((roleCode) => {
        const persisted = recordMap.get(roleCode);
        if (persisted) {
          return withDefaultPurchaseInquiryPermission(persisted);
        }

        return {
          roleCode,
          accessScopes: {
            modules: [...defaultRolePermissions[roleCode].modules],
            dataScope: defaultRolePermissions[roleCode].dataScope,
            actions: [...defaultRolePermissions[roleCode].actions],
          },
          updatedBy: 'system',
          updatedAt: '2026-07-11T09:00:00.000Z',
        };
      });
    }

    const recordMap = new Map(
      this.store
        .listRolePermissions()
        .map((record) => [record.roleCode, record]),
    );

    return roleCodes.map((roleCode) => {
      const persisted = recordMap.get(roleCode);
      if (persisted) {
        return roleCode === 'admin'
          ? { ...persisted, accessScopes: {
            ...persisted.accessScopes,
            actions: [...new Set([...(persisted.accessScopes.actions ?? []), 'audit.view'])],
          } }
          : withDefaultPurchaseInquiryPermission(persisted);
      }

      return {
        roleCode,
        accessScopes: {
          modules: [...defaultRolePermissions[roleCode].modules],
          dataScope: defaultRolePermissions[roleCode].dataScope,
          actions: [...defaultRolePermissions[roleCode].actions],
        },
        updatedBy: 'system',
        updatedAt: '2026-07-11T09:00:00.000Z',
      };
    });
  }

  private async loadRolePermissionMap() {
    const records = await this.listRolePermissionRecords();
    return new Map(
      records.map((record) => [record.roleCode, record.accessScopes]),
    );
  }

  async list(query: ListUsersQuery = {}) {
    const permissions = await this.loadRolePermissionMap();

    if (this.shouldUsePrisma()) {
      const users = (await this.prisma!.user.findMany({
        orderBy: { createdAt: 'asc' },
      })) as PrismaUserRecord[];

      return paginateItems(
        users
          .map(toRuntimeUserRecord)
          .map((record) => toUserListItem(record, permissions)),
        query.page ?? 1,
        query.pageSize ?? 20,
      );
    }

    return paginateItems(
      this.store
        .listUsers()
        .map((record) => toUserListItem(record, permissions))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  async listRolePermissions() {
    return {
      items: await this.listRolePermissionRecords(),
    };
  }

  async updateRolePermission(
    roleCodeValue: string,
    payload: {
      modules: string[];
      dataScope: string;
      actions?: string[];
      updatedBy: string;
    },
  ) {
    if (!roleCodes.includes(roleCodeValue as RoleCode)) {
      throw new BadRequestException('角色不合法');
    }

    const roleCode = roleCodeValue as RoleCode;
    if (roleCode === 'admin') {
      throw new BadRequestException('管理员权限固定，不能在此修改');
    }
    const updatedBy = payload.updatedBy.trim() || 'admin';
    const accessScopes = normalizeAccessScopes(roleCode, payload);

    if (this.shouldUsePrisma() && this.rolePermissionDelegate) {
      const beforeRecord = await this.rolePermissionDelegate.findUnique({
        where: { roleCode },
      });
      const record = await this.rolePermissionDelegate.upsert({
        where: { roleCode },
        update: {
          modules: accessScopes.modules,
          dataScope: accessScopes.dataScope,
          actions: accessScopes.actions,
          updatedBy,
        },
        create: {
          roleCode,
          modules: accessScopes.modules,
          dataScope: accessScopes.dataScope,
          actions: accessScopes.actions,
          updatedBy,
        },
      });
      const operator = await this.prisma!.user.findUnique({
        where: { username: updatedBy.toLowerCase() },
      });
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'role_permission',
          bizId: record.id,
          operationType: 'update_role_permission',
          operatorId: operator?.id ?? record.id,
          beforeData: beforeRecord
            ? {
                roleCode: beforeRecord.roleCode,
                modules: toRolePermissionRecord(beforeRecord).accessScopes.modules,
                dataScope: beforeRecord.dataScope,
                actions: toRolePermissionRecord(beforeRecord).accessScopes.actions,
              }
            : undefined,
          afterData: {
            roleCode,
            modules: accessScopes.modules,
            dataScope: accessScopes.dataScope,
            actions: accessScopes.actions,
            updatedBy,
          },
        },
      });

      return toRolePermissionRecord(record);
    }

    const beforeRecord = this.store
      .listRolePermissions()
      .find((item) => item.roleCode === roleCode);
    const record = this.store.saveRolePermission({
      roleCode,
      accessScopes,
      updatedBy,
      updatedAt: new Date().toISOString(),
    });
    const operator = this.store
      .listUsers()
      .find((item) => item.username === updatedBy.toLowerCase());

    this.store.recordAuditLog({
      bizType: 'role_permission',
      bizId: roleCodes.indexOf(roleCode) + 1,
      operationType: 'update_role_permission',
      operatorId: operator?.id ?? 1,
      beforeData: beforeRecord
        ? {
            roleCode: beforeRecord.roleCode,
            modules: beforeRecord.accessScopes.modules,
            dataScope: beforeRecord.accessScopes.dataScope,
            actions: beforeRecord.accessScopes.actions,
          }
        : null,
      afterData: {
        roleCode,
        modules: accessScopes.modules,
        dataScope: accessScopes.dataScope,
        actions: accessScopes.actions,
        updatedBy,
      },
    });

    return record;
  }

  async create(payload: {
    username: string;
    realName: string;
    password: string;
    roleCode: string;
    createdBy: string;
  }) {
    const username = payload.username.trim().toLowerCase();
    const realName = payload.realName.trim();
    const password = payload.password.trim();

    if (!username || !realName || !password) {
      throw new BadRequestException('用户名、姓名和密码不能为空');
    }

    if (!roleCodes.includes(payload.roleCode as RoleCode)) {
      throw new BadRequestException('角色不合法');
    }

    const permissions = await this.loadRolePermissionMap();
    const roleCode = payload.roleCode as RoleCode;
    const accessScopes = resolveAccessScopes(roleCode, permissions);

    if (this.shouldUsePrisma()) {
      const duplicated = await this.prisma!.user.findUnique({
        where: { username },
      });

      if (duplicated) {
        throw new BadRequestException('用户名已存在');
      }

      const operator = await this.prisma!.user.findUnique({
        where: { username: payload.createdBy.trim().toLowerCase() },
      });
      const record = (await this.prisma!.user.create({
        data: {
          username,
          realName,
          passwordHash: hashPassword(password),
          roleCode,
          status: 'active',
          fullAccess: accessScopes.dataScope === 'all',
          createdBy: payload.createdBy,
        },
      })) as PrismaUserRecord;
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'user',
          bizId: record.id,
          operationType: 'create_user',
          operatorId: operator?.id ?? record.id,
          beforeData: undefined,
          afterData: {
            username: record.username,
            realName: record.realName,
            roleCode: record.roleCode,
            status: record.status,
            createdBy: record.createdBy,
          },
        },
      });

      return toUserListItem(toRuntimeUserRecord(record), permissions);
    }

    const duplicated = this.store.listUsers().some(
      (item) => item.username === username,
    );

    if (duplicated) {
      throw new BadRequestException('用户名已存在');
    }

    const recordId = this.store.nextUserId();
    const operator = this.store
      .listUsers()
      .find((item) => item.username === payload.createdBy.trim().toLowerCase());
    const record: UserRecord = {
      id: recordId,
      username,
      realName,
      passwordHash: hashPassword(password),
      roleCode,
      status: 'active',
      fullAccess: accessScopes.dataScope === 'all',
      createdAt: new Date().toISOString(),
      createdBy: payload.createdBy,
    };

    const users = this.store.listUsers();
    users.push(record);
    this.store.saveUsers(users);
    this.store.recordAuditLog({
      bizType: 'user',
      bizId: record.id,
      operationType: 'create_user',
      operatorId: operator?.id ?? record.id,
      beforeData: null,
      afterData: {
        username: record.username,
        realName: record.realName,
        roleCode: record.roleCode,
        status: record.status,
        createdBy: record.createdBy,
      },
    });

    return toUserListItem(record, permissions);
  }

  async deactivate(
    id: number,
    payload: {
      operatedBy: string;
      reason: string;
    },
  ) {
    const permissions = await this.loadRolePermissionMap();

    if (this.shouldUsePrisma()) {
      const record = (await this.prisma!.user.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaUserRecord | null;

      if (!record) {
        throw new NotFoundException('用户不存在');
      }

      if (record.status === 'inactive') {
        return toUserListItem(toRuntimeUserRecord(record), permissions);
      }

      if (record.roleCode === 'admin') {
        throw new BadRequestException('管理员账号不能被注销');
      }

      const operatedBy = payload.operatedBy.trim().toLowerCase();
      const operator = await this.prisma!.user.findUnique({
        where: { username: operatedBy },
      });
      const updatedRecord = (await this.prisma!.user.update({
        where: { id: record.id },
        data: {
          status: 'inactive',
          deactivatedAt: new Date(),
          deactivatedBy: payload.operatedBy,
          deactivatedReason: payload.reason.trim() || '管理员停用',
        },
      })) as PrismaUserRecord;
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'user',
          bizId: updatedRecord.id,
          operationType: 'deactivate_user',
          operatorId: operator?.id ?? updatedRecord.id,
          beforeData: {
            status: record.status,
            deactivatedAt: record.deactivatedAt?.toISOString() ?? null,
            deactivatedBy: record.deactivatedBy,
            deactivatedReason: record.deactivatedReason,
          },
          afterData: {
            status: updatedRecord.status,
            deactivatedAt: updatedRecord.deactivatedAt?.toISOString() ?? null,
            deactivatedBy: updatedRecord.deactivatedBy,
            deactivatedReason: updatedRecord.deactivatedReason,
          },
        },
      });

      return toUserListItem(toRuntimeUserRecord(updatedRecord), permissions);
    }

    const record = this.store.listUsers().find((item) => item.id === id);

    if (!record) {
      throw new NotFoundException('用户不存在');
    }

    if (record.status === 'inactive') {
      return toUserListItem(record, permissions);
    }

    if (record.roleCode === 'admin') {
      throw new BadRequestException('管理员账号不能被注销');
    }

    const updatedRecord = {
      ...record,
      status: 'inactive' as const,
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: payload.operatedBy,
      deactivatedReason: payload.reason.trim() || '管理员停用',
    };

    this.store.saveUsers(
      this.store.listUsers().map((item) =>
        item.id === updatedRecord.id ? updatedRecord : item,
      ),
    );
    this.store.recordAuditLog({
      bizType: 'user',
      bizId: updatedRecord.id,
      operationType: 'deactivate_user',
      operatorId:
        this.store
          .listUsers()
          .find((item) => item.username === payload.operatedBy.trim().toLowerCase())
          ?.id ?? updatedRecord.id,
      beforeData: {
        status: record.status,
        deactivatedAt: record.deactivatedAt ?? null,
        deactivatedBy: record.deactivatedBy ?? null,
        deactivatedReason: record.deactivatedReason ?? null,
      },
      afterData: {
        status: updatedRecord.status,
        deactivatedAt: updatedRecord.deactivatedAt,
        deactivatedBy: updatedRecord.deactivatedBy,
        deactivatedReason: updatedRecord.deactivatedReason,
      },
    });

    return toUserListItem(updatedRecord, permissions);
  }

  async activate(
    id: number,
    payload: {
      operatedBy: string;
      reason: string;
    },
  ) {
    const permissions = await this.loadRolePermissionMap();

    if (this.shouldUsePrisma()) {
      const record = (await this.prisma!.user.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaUserRecord | null;

      if (!record) {
        throw new NotFoundException('用户不存在');
      }

      if (record.status === 'active') {
        return toUserListItem(toRuntimeUserRecord(record), permissions);
      }

      const operatedBy = payload.operatedBy.trim().toLowerCase();
      const operator = await this.prisma!.user.findUnique({
        where: { username: operatedBy },
      });
      const updatedRecord = (await this.prisma!.user.update({
        where: { id: record.id },
        data: {
          status: 'active',
          deactivatedAt: null,
          deactivatedBy: null,
          deactivatedReason: null,
        },
      })) as PrismaUserRecord;
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'user',
          bizId: updatedRecord.id,
          operationType: 'activate_user',
          operatorId: operator?.id ?? updatedRecord.id,
          beforeData: {
            status: record.status,
            deactivatedAt: record.deactivatedAt?.toISOString() ?? null,
            deactivatedBy: record.deactivatedBy,
            deactivatedReason: record.deactivatedReason,
          },
          afterData: {
            status: updatedRecord.status,
            operatedBy: payload.operatedBy,
            reason: payload.reason.trim() || '恢复账号',
          },
        },
      });

      return toUserListItem(toRuntimeUserRecord(updatedRecord), permissions);
    }

    const record = this.store.listUsers().find((item) => item.id === id);

    if (!record) {
      throw new NotFoundException('用户不存在');
    }

    if (record.status === 'active') {
      return toUserListItem(record, permissions);
    }

    const updatedRecord = {
      ...record,
      status: 'active' as const,
      deactivatedAt: undefined,
      deactivatedBy: undefined,
      deactivatedReason: undefined,
    };

    this.store.saveUsers(
      this.store.listUsers().map((item) =>
        item.id === updatedRecord.id ? updatedRecord : item,
      ),
    );
    this.store.recordAuditLog({
      bizType: 'user',
      bizId: updatedRecord.id,
      operationType: 'activate_user',
      operatorId:
        this.store
          .listUsers()
          .find((item) => item.username === payload.operatedBy.trim().toLowerCase())
          ?.id ?? updatedRecord.id,
      beforeData: {
        status: record.status,
        deactivatedAt: record.deactivatedAt ?? null,
        deactivatedBy: record.deactivatedBy ?? null,
        deactivatedReason: record.deactivatedReason ?? null,
      },
      afterData: {
        status: updatedRecord.status,
        operatedBy: payload.operatedBy,
        reason: payload.reason.trim() || '恢复账号',
      },
    });

    return toUserListItem(updatedRecord, permissions);
  }

  async updateUserRole(
    id: number,
    payload: {
      roleCode: string;
      operatedBy: string;
    },
  ) {
    if (!roleCodes.includes(payload.roleCode as RoleCode)) {
      throw new BadRequestException('角色不合法');
    }

    const roleCode = payload.roleCode as RoleCode;
    const permissions = await this.loadRolePermissionMap();
    const accessScopes = resolveAccessScopes(roleCode, permissions);

    if (this.shouldUsePrisma()) {
      const record = (await this.prisma!.user.findUnique({
        where: { id: BigInt(id) },
      })) as PrismaUserRecord | null;

      if (!record) {
        throw new NotFoundException('用户不存在');
      }

      if (record.roleCode === 'admin') {
        throw new BadRequestException('管理员账号角色不能修改');
      }

      const updatedRecord = (await this.prisma!.user.update({
        where: { id: record.id },
        data: {
          roleCode,
          fullAccess: accessScopes.dataScope === 'all',
        },
      })) as PrismaUserRecord;
      const operator = await this.prisma!.user.findUnique({
        where: { username: payload.operatedBy.trim().toLowerCase() },
      });
      await this.prisma!.operationLog.create({
        data: {
          bizType: 'user',
          bizId: updatedRecord.id,
          operationType: 'update_user_role',
          operatorId: operator?.id ?? updatedRecord.id,
          beforeData: {
            roleCode: record.roleCode,
            fullAccess: record.fullAccess,
          },
          afterData: {
            roleCode: updatedRecord.roleCode,
            fullAccess: updatedRecord.fullAccess,
          },
        },
      });

      return toUserListItem(toRuntimeUserRecord(updatedRecord), permissions);
    }

    const record = this.store.listUsers().find((item) => item.id === id);

    if (!record) {
      throw new NotFoundException('用户不存在');
    }

    if (record.roleCode === 'admin') {
      throw new BadRequestException('管理员账号角色不能修改');
    }

    const updatedRecord = this.store.updateUserRole(
      id,
      roleCode,
      accessScopes.dataScope === 'all',
    );

    if (!updatedRecord) {
      throw new NotFoundException('用户不存在');
    }

    const operator = this.store
      .listUsers()
      .find((item) => item.username === payload.operatedBy.trim().toLowerCase());
    this.store.recordAuditLog({
      bizType: 'user',
      bizId: updatedRecord.id,
      operationType: 'update_user_role',
      operatorId: operator?.id ?? updatedRecord.id,
      beforeData: {
        roleCode: record.roleCode,
        fullAccess: record.fullAccess,
      },
      afterData: {
        roleCode: updatedRecord.roleCode,
        fullAccess: updatedRecord.fullAccess,
      },
    });

    return toUserListItem(updatedRecord, permissions);
  }

  async authenticate(payload: { username: string; password: string }) {
    const username = payload.username.trim().toLowerCase();
    const passwordHash = hashPassword(payload.password.trim());
    const permissions = await this.loadRolePermissionMap();
    if (this.shouldUsePrisma()) {
      const record = (await this.prisma!.user.findUnique({
        where: { username },
      })) as PrismaUserRecord | null;

      if (!record || record.passwordHash !== passwordHash) {
        throw new BadRequestException('用户名或密码错误');
      }

      if (record.status !== 'active') {
        throw new BadRequestException('账号已停用');
      }

      await this.prisma!.operationLog.create({
        data: {
          bizType: 'user',
          bizId: record.id,
          operationType: 'login',
          operatorId: record.id,
          beforeData: undefined,
          afterData: {
            username: record.username,
            roleCode: record.roleCode,
            status: record.status,
          },
        },
      });

      const roleCode = record.roleCode as RoleCode;
      return {
        role: roleCode,
        user: roleCode === 'admin' ? 'Admin' : record.realName,
        username: record.username,
        accessScopes: resolveAccessScopes(roleCode, permissions),
      };
    }

    const record = this.store.listUsers().find(
      (item) => item.username === username,
    );

    if (!record || record.passwordHash !== passwordHash) {
      throw new BadRequestException('用户名或密码错误');
    }

    if (record.status !== 'active') {
      throw new BadRequestException('账号已停用');
    }

    this.store.recordAuditLog({
      bizType: 'user',
      bizId: record.id,
      operationType: 'login',
      operatorId: record.id,
      beforeData: null,
      afterData: {
        username: record.username,
        roleCode: record.roleCode,
        status: record.status,
      },
    });

    return {
      role: record.roleCode,
      user: record.roleCode === 'admin' ? 'Admin' : record.realName,
      username: record.username,
      accessScopes: resolveAccessScopes(record.roleCode, permissions),
    };
  }

  async listAuditLogs() {
    if (this.shouldUsePrisma()) {
      const logs = (await this.prisma!.operationLog.findMany({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })) as PrismaOperationLogRecord[];

      return {
        items: logs.map(toAuditLogRecord),
      };
    }

    return {
      items: this.store.listAuditLogs(),
    };
  }
}
