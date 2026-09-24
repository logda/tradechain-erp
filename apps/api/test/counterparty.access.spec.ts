import { ForbiddenException } from '@nestjs/common';
import { accessibleCounterpartyOwners, assertCounterpartyCreateAccess, assertCounterpartyUpdateAccess, canViewCounterparty } from '../src/counterparty/counterparty.access';

const users = [
  { realName: 'Zoe', roleCode: 'sales', status: 'active' },
  { realName: 'Amy', roleCode: 'sales', status: 'active' },
  { realName: 'Sara', roleCode: 'sales_manager', status: 'active' },
  { realName: 'Leo', roleCode: 'purchase', status: 'active' },
  { realName: 'Old', roleCode: 'sales', status: 'inactive' },
];

describe('counterparty ownership policy', () => {
  it('uses owner rather than creator for sales visibility and blocks forged reassignment', () => {
    const actor = { role: 'sales' as const, user: 'Zoe' };
    expect(canViewCounterparty(actor, { type: 'customer', ownerName: 'Zoe' }, users)).toBe(true);
    expect(canViewCounterparty(actor, { type: 'customer', ownerName: 'Amy' }, users)).toBe(false);
    expect(canViewCounterparty(actor, { type: 'supplier', ownerName: 'Zoe' }, users)).toBe(false);
    expect(() => assertCounterpartyCreateAccess(actor, 'customer', 'Amy', users)).toThrow(ForbiddenException);
    expect(() => assertCounterpartyUpdateAccess(actor, { type: 'customer', ownerName: 'Zoe' }, 'customer', 'Amy', users)).toThrow(ForbiddenException);
    expect(() => assertCounterpartyCreateAccess(actor, 'supplier', 'Zoe', users)).toThrow(ForbiddenException);
  });

  it('lets managers assign only within their team and excludes inactive users', () => {
    const actor = { role: 'sales_manager' as const, user: 'Sara' };
    expect(accessibleCounterpartyOwners(actor, users).map((item) => item.realName)).toEqual(['Zoe', 'Amy', 'Sara']);
    expect(() => assertCounterpartyUpdateAccess(actor, { type: 'customer', ownerName: 'Zoe' }, 'customer', 'Amy', users)).not.toThrow();
    expect(() => assertCounterpartyUpdateAccess(actor, { type: 'customer', ownerName: 'Zoe' }, 'customer', 'Leo', users)).toThrow(ForbiddenException);
    expect(canViewCounterparty({ role: 'purchase_manager', user: 'Peter' }, { type: 'supplier', ownerName: 'Leo' }, users)).toBe(true);
  });

  it('fails closed when two active accounts share the same owner name', () => {
    const duplicates = [...users, { realName: 'Zoe', roleCode: 'sales', status: 'active' }];
    expect(canViewCounterparty({ role: 'sales', user: 'Zoe' }, { type: 'customer', ownerName: 'Zoe' }, duplicates)).toBe(false);
    expect(accessibleCounterpartyOwners({ role: 'boss', user: 'Mia' }, duplicates).some((item) => item.realName === 'Zoe')).toBe(false);
  });
});
