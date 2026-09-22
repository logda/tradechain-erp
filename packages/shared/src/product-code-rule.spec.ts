import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildProductCodePreview,
  describeProductCodeRule,
  validateProductCodeRule,
  type ProductCodeRule,
} from './product-code-rule.js';

describe('product code rule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const composedRule: ProductCodeRule = {
    strategy: 'composed_segments',
    serialLength: 4,
    serialScope: 'per_supplier_month',
    segments: [
      { key: 'prefix', enabled: true, order: 1, value: 'PD' },
      { key: 'supplier_code', enabled: true, order: 2 },
      { key: 'category_code', enabled: true, order: 3 },
      { key: 'year', enabled: true, order: 4 },
      { key: 'month', enabled: true, order: 5 },
      { key: 'serial', enabled: true, order: 6 },
    ],
    updatedAt: '2026-07-17T08:00:00.000Z',
    updatedBy: 'Admin',
  };

  it('describes a composed product code rule with examples', () => {
    expect(describeProductCodeRule(composedRule)).toContain(
      '固定前缀 + 供应商编码 + 分类编码 + 年 + 月 + 4 位流水号',
    );
    expect(describeProductCodeRule(composedRule)).toContain(
      'PD-SUP-BRAVO-ELEC-2026-07-0001',
    );
  });

  it('builds a preview from rule segments', () => {
    expect(
      buildProductCodePreview(composedRule, {
        prefix: 'PD',
        supplierCode: 'SUP-BRAVO',
        category: 'electronics',
        now: '2026-07-17T08:00:00.000Z',
        sequence: 1,
      }),
    ).toBe('PD-SUP-BRAVO-ELEC-2026-07-0001');
  });

  it('rejects rules that only contain serial segments', () => {
    expect(
      validateProductCodeRule({
        ...composedRule,
        segments: [{ key: 'serial', enabled: true, order: 1 }],
      }),
    ).toEqual({
      ok: false,
      error: '除流水号外，至少还要启用一个业务段',
    });
  });

  it('rejects yearly serial scopes when the year segment is disabled', () => {
    expect(
      validateProductCodeRule({
        ...composedRule,
        serialScope: 'global_year',
        segments: composedRule.segments.filter((segment) => segment.key !== 'year'),
      }),
    ).toEqual({
      ok: false,
      error: '按年流水时，必须启用年份段',
    });
  });

  it('rejects monthly serial scopes when year or month segments are disabled', () => {
    expect(
      validateProductCodeRule({
        ...composedRule,
        segments: composedRule.segments.filter((segment) => segment.key !== 'month'),
      }),
    ).toEqual({
      ok: false,
      error: '按月流水时，必须同时启用年份段和月份段',
    });
  });
});
