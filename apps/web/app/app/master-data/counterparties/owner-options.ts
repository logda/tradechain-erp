export type CounterpartyType = 'customer' | 'supplier' | 'both';

export type CounterpartyAssignableUser = {
  id: number;
  username: string;
  realName: string;
  roleCode: string;
  status: string;
  fullAccess: boolean;
};

export type CounterpartyOwnerOption = {
  value: string;
  label: string;
  roleCode: string;
  supportsCustomer: boolean;
  supportsSupplier: boolean;
  sortOrder: number;
};

const roleLabels: Record<string, string> = {
  admin: '管理员',
  boss: '老板',
  sales_manager: '销售主管',
  sales: '销售',
  purchase_manager: '采购主管',
  purchase: '采购',
};

const ownerRoleConfig: Record<
  string,
  { sortOrder: number; supportsCustomer: boolean; supportsSupplier: boolean }
> = {
  admin: { sortOrder: 1, supportsCustomer: true, supportsSupplier: true },
  boss: { sortOrder: 2, supportsCustomer: true, supportsSupplier: true },
  sales_manager: { sortOrder: 3, supportsCustomer: true, supportsSupplier: false },
  sales: { sortOrder: 4, supportsCustomer: true, supportsSupplier: false },
  purchase_manager: { sortOrder: 5, supportsCustomer: false, supportsSupplier: true },
  purchase: { sortOrder: 6, supportsCustomer: false, supportsSupplier: true },
};

export const fallbackCounterpartyAssignableUsers: CounterpartyAssignableUser[] = [
  {
    id: 1,
    username: 'admin',
    realName: '系统管理员',
    roleCode: 'admin',
    status: 'active',
    fullAccess: true,
  },
  {
    id: 2,
    username: 'mia',
    realName: 'Mia',
    roleCode: 'boss',
    status: 'active',
    fullAccess: true,
  },
  {
    id: 3,
    username: 'zoe-manager',
    realName: 'Sara',
    roleCode: 'sales_manager',
    status: 'active',
    fullAccess: false,
  },
  {
    id: 4,
    username: 'zoe',
    realName: 'Zoe',
    roleCode: 'sales',
    status: 'active',
    fullAccess: false,
  },
  {
    id: 5,
    username: 'leo-manager',
    realName: 'Peter',
    roleCode: 'purchase_manager',
    status: 'active',
    fullAccess: false,
  },
  {
    id: 6,
    username: 'leo',
    realName: 'Leo',
    roleCode: 'purchase',
    status: 'active',
    fullAccess: false,
  },
];

function resolveOwnerRoleConfig(user: CounterpartyAssignableUser) {
  if (user.fullAccess) {
    return { sortOrder: 0, supportsCustomer: true, supportsSupplier: true };
  }

  return (
    ownerRoleConfig[user.roleCode] ?? {
      sortOrder: 99,
      supportsCustomer: false,
      supportsSupplier: false,
    }
  );
}

export function buildCounterpartyOwnerOptions(
  users: CounterpartyAssignableUser[],
): CounterpartyOwnerOption[] {
  const uniqueOptions = new Map<string, CounterpartyOwnerOption>();

  for (const user of users) {
    if (user.status !== 'active') {
      continue;
    }

    const roleConfig = resolveOwnerRoleConfig(user);
    if (!roleConfig.supportsCustomer && !roleConfig.supportsSupplier) {
      continue;
    }

    const realName = user.realName.trim();
    if (!realName) {
      continue;
    }

    const existing = uniqueOptions.get(realName);
    const nextOption: CounterpartyOwnerOption = {
      value: realName,
      label: `${realName} / ${roleLabels[user.roleCode] ?? user.roleCode}`,
      roleCode: user.roleCode,
      supportsCustomer: roleConfig.supportsCustomer,
      supportsSupplier: roleConfig.supportsSupplier,
      sortOrder: roleConfig.sortOrder,
    };

    if (!existing || nextOption.sortOrder < existing.sortOrder) {
      uniqueOptions.set(realName, nextOption);
    }
  }

  return [...uniqueOptions.values()].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.label.localeCompare(right.label, 'zh-CN');
  });
}

export function filterCounterpartyOwnerOptions(
  options: CounterpartyOwnerOption[],
  type: CounterpartyType | '' | null | undefined,
  actorRole?: string,
) {
  if (actorRole === 'boss' || actorRole === 'admin') return options;
  if (!type) {
    return options.filter(
      (item) => item.supportsCustomer || item.supportsSupplier,
    );
  }

  if (type === 'customer') {
    return options.filter((item) => item.supportsCustomer);
  }

  if (type === 'supplier') {
    return options.filter((item) => item.supportsSupplier);
  }

  return options.filter(
    (item) => item.supportsCustomer || item.supportsSupplier,
  );
}
