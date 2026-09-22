import { describe, expect, it } from 'vitest';
import { formatCounterpartyBilingualDisplay } from '../app/app/_lib/counterparty-display';

describe('counterparty bilingual display', () => {
  it('prefers the explicit Chinese name while keeping the English segment', () => {
    expect(
      formatCounterpartyBilingualDisplay(
        '测试客户报价销售 / Quote Sales Customer',
        {
          fullName: '测试客户中文简称',
          code: 'CUST-TEST',
        },
      ),
    ).toBe('测试客户中文简称 / Quote Sales Customer');
  });
});
