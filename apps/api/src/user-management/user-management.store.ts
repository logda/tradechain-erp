import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

const roleCodes = [
  'admin',
  'boss',
  'sales_manager',
  'sales',
  'purchase_manager',
  'purchase',
] as const;

export type RoleCode = (typeof roleCodes)[number];

export type AccessScopes = {
  modules: string[];
  dataScope: string;
  actions: string[];
};

export type RolePermissionRecord = {
  roleCode: RoleCode;
  accessScopes: AccessScopes;
  updatedBy: string;
  updatedAt: string;
};

export type UserRecord = {
  id: number;
  username: string;
  realName: string;
  passwordHash: string;
  roleCode: RoleCode;
  status: 'active' | 'inactive';
  fullAccess: boolean;
  createdAt: string;
  createdBy: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  deactivatedReason?: string;
};

export type AuditLogRecord = {
  id: number;
  bizType: string;
  bizId: number;
  operationType: string;
  operatorId: number;
  beforeData: unknown | null;
  afterData: unknown | null;
  createdAt: string;
};

type RuntimeState = {
  users: UserRecord[];
  rolePermissions: RolePermissionRecord[];
  auditLogs: AuditLogRecord[];
  nextUserId: number;
  nextAuditLogId: number;
  counterpartyActionMigrated?: boolean;
  productFieldActionMigrated?: boolean;
  productWriteActionMigrated?: boolean;
};

const runtimeStoreCache = new Map<string, UserManagementRuntimeStore>();

export const defaultRolePermissions: Record<RoleCode, AccessScopes> = {
  admin: {
    modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
    dataScope: 'all',
    actions: [
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
    ],
  },
  boss: {
    modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit'],
    dataScope: 'all',
    actions: [
      'product.write',
      'product.custom_field.write',
      'counterparty.write',
      'sales.order.write',
      'sales.sample.approve',
      'purchase.order.approve',
      'after_sales.process',
      'boss.confirm',
      'finance.confirm',
    ],
  },
  sales_manager: {
    modules: ['sales', 'boss_dashboard'],
    dataScope: 'sales_team',
    actions: [
      'counterparty.write',
      'sales.quote.write',
      'sales.inquiry.submit',
      'sales.order.write',
      'sales.sample.submit',
      'sales.sample.approve',
      'sales.sample.execute',
    ],
  },
  sales: {
    modules: ['sales'],
    dataScope: 'own_sales',
    actions: [
      'counterparty.write',
      'sales.quote.write',
      'sales.inquiry.submit',
      'sales.order.write',
      'sales.sample.submit',
      'sales.sample.execute',
    ],
  },
  purchase_manager: {
    modules: ['purchase', 'operations', 'boss_dashboard'],
    dataScope: 'purchase_team',
    actions: [
      'counterparty.write',
      'sales.inquiry.submit',
      'purchase.order.create',
      'purchase.order.submit',
      'purchase.order.approve',
      'purchase.sample.execute',
      'shipment.update',
      'after_sales.process',
    ],
  },
  purchase: {
    modules: ['purchase', 'operations'],
    dataScope: 'own_purchase',
    actions: [
      'counterparty.write',
      'sales.inquiry.submit',
      'purchase.order.create',
      'purchase.order.submit',
      'purchase.sample.execute',
      'shipment.update',
      'after_sales.process',
    ],
  },
};

function createSeedRolePermissions(): RolePermissionRecord[] {
  return roleCodes.map((roleCode) => ({
    roleCode,
    accessScopes: {
      modules: [...defaultRolePermissions[roleCode].modules],
      dataScope: defaultRolePermissions[roleCode].dataScope,
      actions: [...defaultRolePermissions[roleCode].actions],
    },
    updatedBy: 'system',
    updatedAt: '2026-07-11T09:00:00.000Z',
  }));
}

function createSeedState(): RuntimeState {
  return {
    users: [
      {
        id: 1,
        username: 'admin',
        realName: '系统管理员',
        passwordHash: hashPassword('Admin123456'),
        roleCode: 'admin',
        status: 'active',
        fullAccess: true,
        createdAt: '2026-07-11T09:00:00.000Z',
        createdBy: 'system',
      },
      {
        id: 2,
        username: 'mia',
        realName: 'Mia',
        passwordHash: hashPassword('Mia123456'),
        roleCode: 'boss',
        status: 'active',
        fullAccess: true,
        createdAt: '2026-07-11T09:05:00.000Z',
        createdBy: 'system',
      },
      {
        id: 3,
        username: 'zoe',
        realName: 'Zoe',
        passwordHash: hashPassword('Zoe123456'),
        roleCode: 'sales',
        status: 'active',
        fullAccess: false,
        createdAt: '2026-07-11T09:10:00.000Z',
        createdBy: 'admin',
      },
      {
        id: 4,
        username: 'leo',
        realName: 'Leo',
        passwordHash: hashPassword('Leo123456'),
        roleCode: 'purchase',
        status: 'active',
        fullAccess: false,
        createdAt: '2026-07-11T09:12:00.000Z',
        createdBy: 'admin',
      },
    ],
    rolePermissions: createSeedRolePermissions(),
    auditLogs: [],
    nextUserId: 5,
    nextAuditLogId: 1,
    counterpartyActionMigrated: true,
    productFieldActionMigrated: true,
    productWriteActionMigrated: true,
  };
}

function cloneState(state: RuntimeState): RuntimeState {
  return {
    users: state.users.map((item) => ({ ...item })),
    rolePermissions: state.rolePermissions.map((item) => ({
      ...item,
      accessScopes: {
        modules: [...item.accessScopes.modules],
        dataScope: item.accessScopes.dataScope,
        actions: [...(item.accessScopes.actions ?? [])],
      },
    })),
    auditLogs: state.auditLogs.map((item) => ({ ...item })),
    nextUserId: state.nextUserId,
    nextAuditLogId: state.nextAuditLogId,
    counterpartyActionMigrated: state.counterpartyActionMigrated,
    productFieldActionMigrated: state.productFieldActionMigrated,
    productWriteActionMigrated: state.productWriteActionMigrated,
  };
}

export function hashPassword(password: string) {
  return createHash('sha256').update(password).digest('hex');
}

function readState(filePath: string): RuntimeState {
  if (!existsSync(filePath)) {
    return createSeedState();
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<RuntimeState>;
  const state: RuntimeState = {
    users: Array.isArray(parsed.users) ? (parsed.users as UserRecord[]) : [],
    rolePermissions: Array.isArray(parsed.rolePermissions)
      ? (parsed.rolePermissions as RolePermissionRecord[])
      : createSeedRolePermissions(),
    auditLogs: Array.isArray(parsed.auditLogs)
      ? (parsed.auditLogs as AuditLogRecord[])
      : [],
    nextUserId: typeof parsed.nextUserId === 'number' ? parsed.nextUserId : 1,
    nextAuditLogId:
      typeof parsed.nextAuditLogId === 'number' ? parsed.nextAuditLogId : 1,
    counterpartyActionMigrated: true,
    productFieldActionMigrated: true,
    productWriteActionMigrated: true,
  };
  if (!parsed.counterpartyActionMigrated) {
    state.rolePermissions = state.rolePermissions.map((item) => ({
      ...item,
      accessScopes: {
        ...item.accessScopes,
        actions: [...new Set([...(item.accessScopes.actions ?? []), 'counterparty.write'])],
      },
    }));
    writeState(filePath, state);
  }
  if (!parsed.productFieldActionMigrated) {
    state.rolePermissions = state.rolePermissions.map((item) => item.roleCode === 'admin' || item.roleCode === 'boss' ? {
      ...item,
      accessScopes: { ...item.accessScopes, actions: [...new Set([...(item.accessScopes.actions ?? []), 'product.custom_field.write'])] },
    } : item);
    writeState(filePath, state);
  }
  if (!parsed.productWriteActionMigrated) {
    state.rolePermissions = state.rolePermissions.map((item) => item.roleCode === 'admin' || item.roleCode === 'boss' ? {
      ...item,
      accessScopes: { ...item.accessScopes, actions: [...new Set([...(item.accessScopes.actions ?? []), 'product.write'])] },
    } : item);
    writeState(filePath, state);
  }
  return state;
}

function writeState(filePath: string, state: RuntimeState) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export class UserManagementRuntimeStore {
  private state: RuntimeState;

  constructor(private readonly filePath?: string) {
    this.state = filePath ? readState(filePath) : createSeedState();
    if (filePath && !existsSync(filePath)) {
      writeState(filePath, this.state);
    }
  }

  listUsers() {
    return this.state.users.map((item) => ({ ...item }));
  }

  saveUsers(users: UserRecord[]) {
    this.state.users = users.map((item) => ({ ...item }));
    this.persist();
  }

  updateUserRole(id: number, roleCode: RoleCode, fullAccess: boolean) {
    const target = this.state.users.find((item) => item.id === id);

    if (!target) {
      return null;
    }

    const updatedRecord: UserRecord = {
      ...target,
      roleCode,
      fullAccess,
    };

    this.state.users = this.state.users.map((item) =>
      item.id === id ? updatedRecord : item,
    );
    this.persist();

    return { ...updatedRecord };
  }

  listRolePermissions() {
    return this.state.rolePermissions.map((item) => ({
      ...item,
      accessScopes: {
        modules: [...item.accessScopes.modules],
        dataScope: item.accessScopes.dataScope,
        actions: [...(item.accessScopes.actions ?? [])],
      },
    }));
  }

  saveRolePermission(record: RolePermissionRecord) {
    const nextRecord = {
      ...record,
      accessScopes: {
        modules: [...record.accessScopes.modules],
        dataScope: record.accessScopes.dataScope,
        actions: [...record.accessScopes.actions],
      },
    };
    const existing = this.state.rolePermissions.some(
      (item) => item.roleCode === record.roleCode,
    );

    this.state.rolePermissions = existing
      ? this.state.rolePermissions.map((item) =>
          item.roleCode === record.roleCode ? nextRecord : item,
        )
      : [...this.state.rolePermissions, nextRecord];
    this.persist();

    return { ...nextRecord };
  }

  nextUserId() {
    const nextId = this.state.nextUserId;
    this.state.nextUserId += 1;
    this.persist();
    return nextId;
  }

  recordAuditLog(entry: Omit<AuditLogRecord, 'id' | 'createdAt'>) {
    const record: AuditLogRecord = {
      ...entry,
      id: this.state.nextAuditLogId,
      createdAt: new Date().toISOString(),
    };
    this.state.nextAuditLogId += 1;
    this.state.auditLogs.push(record);
    this.persist();

    return { ...record };
  }

  listAuditLogs() {
    return this.state.auditLogs
      .map((item) => ({ ...item }))
      .sort((left, right) => {
        const timeDiff = left.createdAt.localeCompare(right.createdAt);
        return timeDiff !== 0 ? timeDiff : left.id - right.id;
      });
  }

  private persist() {
    if (!this.filePath) {
      return;
    }

    writeState(this.filePath, this.state);
  }
}

export function resolveUserManagementStore() {
  const runtimeDir = process.env.ERP_DATA_DIR?.trim();

  if (!runtimeDir) {
    return new UserManagementRuntimeStore();
  }

  const filePath = resolve(join(runtimeDir, 'user-management-runtime.json'));
  const cachedStore = runtimeStoreCache.get(filePath);

  if (cachedStore) {
    return cachedStore;
  }

  const store = new UserManagementRuntimeStore(filePath);
  runtimeStoreCache.set(filePath, store);

  return store;
}
