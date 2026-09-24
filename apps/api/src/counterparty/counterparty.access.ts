import { ForbiddenException } from '@nestjs/common';
import type { FormalRole } from '../auth/formal-role.decorator';
import type { CounterpartyRecord } from './counterparty.service';

export type CounterpartyActor = { role: FormalRole; user: string };
export type CounterpartyOwner = { realName: string; roleCode: string; status: string };

const salesRoles = ['sales', 'sales_manager'];
const purchaseRoles = ['purchase', 'purchase_manager'];

export function accessibleCounterpartyOwners(actor: CounterpartyActor, users: CounterpartyOwner[]) {
  const counts = new Map<string, number>();
  for (const user of users) {
    if (user.status === 'active') counts.set(user.realName, (counts.get(user.realName) ?? 0) + 1);
  }
  const unique = users.filter((item) => item.status === 'active' && counts.get(item.realName) === 1);
  if (actor.role === 'admin' || actor.role === 'boss') {
    return unique;
  }
  if (actor.role === 'sales_manager') {
    return unique.filter((item) => salesRoles.includes(item.roleCode));
  }
  if (actor.role === 'purchase_manager') {
    return unique.filter((item) => purchaseRoles.includes(item.roleCode));
  }
  return unique.filter((item) => item.realName === actor.user && item.roleCode === actor.role);
}

export function canViewCounterparty(actor: CounterpartyActor, item: Pick<CounterpartyRecord, 'type' | 'ownerName'>, owners: CounterpartyOwner[]) {
  if (actor.role === 'admin' || actor.role === 'boss') return true;
  if (salesRoles.includes(actor.role) && item.type === 'supplier') return false;
  if (purchaseRoles.includes(actor.role) && item.type === 'customer') return false;
  return accessibleCounterpartyOwners(actor, owners).some((owner) => owner.realName === item.ownerName);
}

export function assertCounterpartyCreateAccess(actor: CounterpartyActor, type: string, ownerName: string, owners: CounterpartyOwner[]) {
  if (actor.role !== 'admin' && actor.role !== 'boss') {
    const expectedType = salesRoles.includes(actor.role) ? 'customer' : 'supplier';
    if (type !== expectedType) throw new ForbiddenException('当前岗位不能新建此类往来单位');
  }
  if (!accessibleCounterpartyOwners(actor, owners).some((owner) => owner.realName === ownerName)) {
    throw new ForbiddenException('所属人员不在可分配范围内');
  }
}

export function assertCounterpartyUpdateAccess(actor: CounterpartyActor, existing: Pick<CounterpartyRecord, 'type' | 'ownerName'>, nextType: string, nextOwnerName: string, owners: CounterpartyOwner[]) {
  if (!canViewCounterparty(actor, existing, owners)) throw new ForbiddenException('无权编辑该往来单位');
  if (actor.role !== 'admin' && actor.role !== 'boss' && nextType !== existing.type) {
    throw new ForbiddenException('当前岗位不能修改往来单位类型');
  }
  if (!accessibleCounterpartyOwners(actor, owners).some((owner) => owner.realName === nextOwnerName)) {
    throw new ForbiddenException('所属人员不在可分配范围内');
  }
}
