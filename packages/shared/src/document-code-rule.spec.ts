import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDocumentCodePreview,
  describeDocumentCodeRule,
  defaultDemandNoRule,
  defaultQuoteNoRule,
  validateDocumentCodeRule,
  type DocumentCodeRule,
} from './document-code-rule.js';

describe('document code rule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const composedRule: DocumentCodeRule = {
    strategy: 'composed_segments',
    serialLength: 4,
    serialScope: 'global_day',
    segments: [
      { key: 'prefix', enabled: true, order: 1, value: 'XQ' },
      { key: 'year', enabled: true, order: 2 },
      { key: 'month', enabled: true, order: 3 },
      { key: 'day', enabled: true, order: 4 },
      { key: 'serial', enabled: true, order: 5 },
    ],
    updatedAt: '2026-08-08T00:00:00.000Z',
    updatedBy: 'Admin',
  };

  it('describes a composed document code rule with examples', () => {
    expect(describeDocumentCodeRule(composedRule)).toContain(
      '固定前缀 + 年 + 月 + 日 + 4 位流水号',
    );
    expect(describeDocumentCodeRule(composedRule)).toContain('XQ-2026-08-09-0001');
  });

  it('builds a preview from rule segments', () => {
    expect(
      buildDocumentCodePreview(composedRule, {
        prefix: 'XQ',
        now: '2026-08-08T08:00:00.000Z',
        sequence: 1,
      }),
    ).toBe('XQ-2026-08-08-0001');
  });

  it('keeps demand and quote defaults distinct', () => {
    expect(describeDocumentCodeRule(defaultDemandNoRule)).toContain(
      'XQ-2026-08-09-0001',
    );
    expect(describeDocumentCodeRule(defaultQuoteNoRule)).toContain(
      'BJ-2026-08-09-0001',
    );
  });

  it('rejects rules that only contain serial segments', () => {
    expect(
      validateDocumentCodeRule({
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
      validateDocumentCodeRule({
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
      validateDocumentCodeRule({
        ...composedRule,
        serialScope: 'global_month',
        segments: composedRule.segments.filter((segment) => segment.key !== 'month'),
      }),
    ).toEqual({
      ok: false,
      error: '按月流水时，必须同时启用年份段和月份段',
    });
  });
});
