import { describe, expect, it } from 'vitest';
import { resolveCounterpartyOwnerUsername } from '../app/app/master-data/counterparties/owner-options';
import { formatFormalUserLabel } from '../app/app/_lib/formal-user-display';
import { buildAuditChangeSummary, formatAuditOperator } from '../app/app/_lib/audit-log';

describe('formal user labels', () => {
  it('uses a username label while preserving the owner fields', () => {
    const order = { ownerId: 2000, ownerName: '用户 #2000', userDisplayNames: { ownerName: 'mia' } };
    expect(formatFormalUserLabel(order, 'ownerName')).toBe('mia');
    expect(order.ownerId).toBe(2000);
    expect(order.ownerName).toBe('用户 #2000');
    expect(formatFormalUserLabel({ userDisplayNames: { ownerName: '123' } }, 'ownerName')).toBe('123');
  });
  it.each(['用户 #2000', '操作人 #7777', 'User-7777', '7777'])('does not show an unresolved number %s', (value) => {
    expect(formatFormalUserLabel({ ownerName: value }, 'ownerName')).toBe('历史账号未关联');
  });
  it('removes a numeric suffix from a retained display name and keeps empty states', () => {
    expect(formatFormalUserLabel({ ownerName: 'Zoe #2001' }, 'ownerName')).toBe('Zoe');
    expect(formatFormalUserLabel({}, 'ownerName', '未分配')).toBe('未分配');
    expect(formatFormalUserLabel({ receiptSentBy: 4, userDisplayNames: { receiptSentBy: 'leo' } }, 'receiptSentBy')).toBe('leo');
  });
  it('keeps locally saved counterparty labels as usernames and does not guess a same-name user', () => {
    const user = { id: 5, username: 'new-sales', realName: '员工姓名', roleCode: 'sales', status: 'active', fullAccess: false };
    expect(resolveCounterpartyOwnerUsername([user], '员工姓名')).toBe('new-sales');
    expect(resolveCounterpartyOwnerUsername([user], '不存在')).toBe('历史账号未关联');
    expect(resolveCounterpartyOwnerUsername([user, { ...user, id: 6, username: 'other-sales' }], '员工姓名')).toBe('历史账号未关联');
  });
  it('retains unresolved user changes in audit details without displaying their raw IDs', () => {
    const item = { id: 1, bizType: 'sales_order', bizId: 10, operationType: 'update', operatorId: 1,
      createdAt: '2026-09-28T00:00:00Z', beforeData: { salesUserId: 7777 }, afterData: { salesUserId: 8888 } };
    expect(buildAuditChangeSummary(item, true)).toEqual({ title: '字段变更', rows: [
      { field: '销售ID', before: '历史账号未关联', after: '历史账号未关联' },
    ] });
  });
  it('shows audit operators as usernames without an ID suffix', () => {
    expect(formatAuditOperator({ operatorId: 9000, operatorName: 'Admin', userDisplayNames: { operatorName: 'admin' } })).toBe('admin');
    expect(formatAuditOperator({ operatorId: 0 })).toBe('系统');
    expect(formatAuditOperator({ operatorId: 8888 })).toBe('历史账号未关联');
  });
  it('shows changed responsible users by username without rewriting snapshots', () => {
    const item = { id: 1, bizType: 'sales_order', bizId: 10, operationType: 'save_sales_order_draft', operatorId: 1,
      createdAt: '2026-09-28T00:00:00Z', beforeData: { salesUserId: 2001, ownerName: '员工旧姓名' }, afterData: { salesUserId: 4, ownerName: '采购姓名' },
      userDisplayNamesById: { 2001: 'zoe', 4: 'leo' }, userDisplayNamesByName: { 员工旧姓名: 'zoe', 采购姓名: 'leo' } };
    expect(buildAuditChangeSummary(item, true).rows).toEqual([{ field: '销售ID', before: 'zoe', after: 'leo' }, { field: '负责人', before: 'zoe', after: 'leo' }]);
    expect(buildAuditChangeSummary(item).rows).toEqual([{ field: '销售ID', before: 'zoe', after: 'leo' }, { field: '负责人', before: 'zoe', after: 'leo' }]);
    expect(item.beforeData.salesUserId).toBe(2001);
  });
});
