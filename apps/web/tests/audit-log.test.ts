import { describe, expect, it } from 'vitest';
import {
  buildAuditChangeSummary,
  formatAuditBizObject,
  formatAuditCreatedAt,
  formatAuditOperationType,
  formatAuditOperator,
  hasValidAuditLogResponse,
  hasValidUnifiedAuditLogResponse,
} from '../app/app/_lib/audit-log';

describe('audit log helpers', () => {
  it('shows quote audit statuses bilingually without changing stored snapshots or other modules', () => {
    const item = {
      id: 1, bizType: 'quote', bizId: 810, operationType: 'approve_demand',
      operatorId: 2, createdAt: '2026-09-24T01:00:00.000Z',
      beforeData: { status: 'pending_boss_approval' },
      afterData: { status: 'boss_approved' },
    };
    expect(buildAuditChangeSummary(item).rows).toEqual([{
      field: '状态', before: 'pending_boss_approval / 待老板审批需求单', after: 'boss_approved / 需求单审批通过',
    }]);
    expect(buildAuditChangeSummary({ ...item, beforeData: null }).rows[0].after).toBe('boss_approved / 需求单审批通过');
    expect(buildAuditChangeSummary({ ...item, afterData: null }).rows[0].before).toBe('pending_boss_approval / 待老板审批需求单');
    expect(item.beforeData.status).toBe('pending_boss_approval');
    expect(item.afterData.status).toBe('boss_approved');
    expect(buildAuditChangeSummary({ ...item, bizType: 'sales_order', beforeData: null, afterData: { status: 'draft' } }).rows[0].after).toBe('草稿 / draft');
  });

  it('accepts a well-formed audit log payload', () => {
    expect(
      hasValidAuditLogResponse({
        items: [
          {
            id: 1,
            bizType: 'sales_order',
            bizId: 1001,
            operationType: 'create',
            operatorId: 2001,
            operatorName: 'Zoe',
            beforeData: null,
            afterData: { status: 'draft' },
            createdAt: '2026-07-13T10:00:00.000Z',
          },
        ],
      }),
    ).toBe(true);
  });

  it('formats audit log records into business-readable labels', () => {
    const item = {
      id: 1,
      bizType: 'sales_order',
      bizId: 1001,
      operationType: 'finance_confirm',
      operatorId: 2001,
      beforeData: { financeStatus: 'pending', status: 'draft' },
      afterData: { financeStatus: 'confirmed', status: 'draft' },
      createdAt: '2026-07-13T10:00:00.000Z',
    };

    expect(formatAuditOperationType(item.operationType)).toBe('财务确认 / finance_confirm');
    expect(formatAuditBizObject(item)).toBe('销售单 #1001');
    expect(formatAuditBizObject({ bizType: 'quote', bizId: 120 })).toBe(
      '需求单 / 报价单 #120',
    );
    expect(formatAuditOperator({ operatorId: 2, operatorName: 'Mia' })).toBe('Mia #2');
    expect(formatAuditOperator({ operatorId: 3 })).toBe('Zoe #3');
    expect(formatAuditOperator({ operatorId: 2001 })).toBe('Zoe #2001');
    expect(formatAuditOperator({ operatorId: 2002 })).toBe('Leo #2002');
    expect(formatAuditOperator({ operatorId: 9000 })).toBe('Admin #9000');
    expect(
      formatAuditOperator({
        operatorId: 7000,
        afterData: { salesUserName: 'Zoe' },
      }),
    ).toBe('Zoe #7000');
    expect(formatAuditCreatedAt(item.createdAt)).toContain('2026');
    expect(buildAuditChangeSummary(item)).toEqual({
      title: '字段变更',
      rows: [
        {
          field: '财务状态',
          before: '待处理 / pending',
          after: '已确认 / confirmed',
        },
      ],
    });
  });

  it('rejects payloads that are not audit logs', () => {
    expect(hasValidAuditLogResponse({ items: [] })).toBe(true);
    expect(
      hasValidAuditLogResponse({
        items: [
          {
            id: 1,
            docNo: 'S202607130001',
            title: 'not audit log',
          },
        ],
      }),
    ).toBe(false);
    expect(hasValidAuditLogResponse({})).toBe(false);
  });

  it('accepts a unified audit log payload with module status summaries', () => {
    expect(
      hasValidUnifiedAuditLogResponse({
        modules: [
          { key: 'quotes', label: '报价 Quote', count: 1, failed: false },
          { key: 'quote-inquiries', label: '询价 Inquiry', count: 0, failed: true },
        ],
        items: [
          {
            id: 1,
            moduleKey: 'quotes',
            moduleLabel: '报价 Quote',
            bizType: 'quote',
            bizId: 1001,
            operationType: 'create',
            operatorId: 2001,
            beforeData: null,
            afterData: { status: 'draft' },
            createdAt: '2026-07-13T10:00:00.000Z',
          },
        ],
      }),
    ).toBe(true);

    expect(
      hasValidUnifiedAuditLogResponse({
        modules: [{ key: 'quotes', label: '报价 Quote', count: 1 }],
        items: [],
      }),
    ).toBe(false);
  });
});
