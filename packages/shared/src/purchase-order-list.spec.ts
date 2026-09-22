import {
  purchaseOrderIsResubmittedOptions,
  purchaseOrderListSortFields,
} from './purchase-order-list.js';

describe('purchase order list query contracts', () => {
  it('exposes the supported sort fields in order', () => {
    expect(purchaseOrderListSortFields).toEqual([
      'createdAt',
      'docNo',
      'supplierName',
    ]);
  });

  it('exposes tri-state resubmitted filter options', () => {
    expect(purchaseOrderIsResubmittedOptions).toEqual(['all', 'yes', 'no']);
  });
});
