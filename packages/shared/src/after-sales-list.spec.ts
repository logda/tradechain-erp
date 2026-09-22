import {
  afterSalesListSortFields,
  afterSalesTypeOptions,
} from './after-sales-list.js';

describe('after-sales list query contracts', () => {
  it('exposes the supported sort fields in order', () => {
    expect(afterSalesListSortFields).toEqual([
      'createdAt',
      'docNo',
      'customerName',
    ]);
  });

  it('exposes the supported after-sales type options', () => {
    expect(afterSalesTypeOptions).toEqual([
      'customer_complaint',
      'return',
      'refund',
      'rework',
    ]);
  });
});
