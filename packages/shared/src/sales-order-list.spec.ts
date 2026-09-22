import {
  type SalesOrderListQuery,
  salesOrderHasAfterSalesOptions,
  salesOrderListSortFields,
} from './sales-order-list.js';

describe('sales order list query contracts', () => {
  it('exposes the supported sort fields in order', () => {
    expect(salesOrderListSortFields).toEqual([
      'createdAt',
      'docNo',
      'customerName',
    ]);
  });

  it('exposes tri-state after-sales filter options', () => {
    expect(salesOrderHasAfterSalesOptions).toEqual(['all', 'yes', 'no']);
  });

  it('constrains sortBy to supported sales order fields', () => {
    const validSortBy: SalesOrderListQuery['sortBy'] = 'createdAt';

    expect(validSortBy).toBe('createdAt');

    // @ts-expect-error sales order list sortBy must reject unsupported fields
    const invalidSortBy: SalesOrderListQuery['sortBy'] = 'updatedAt';

    expect(invalidSortBy).toBe('updatedAt');
  });
});
