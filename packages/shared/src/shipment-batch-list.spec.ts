import {
  shipmentBatchHasExceptionOptions,
  shipmentBatchListSortFields,
} from './shipment-batch-list.js';

describe('shipment batch list query contracts', () => {
  it('exposes the supported sort fields in order', () => {
    expect(shipmentBatchListSortFields).toEqual([
      'createdAt',
      'docNo',
      'supplierName',
    ]);
  });

  it('exposes tri-state exception filter options', () => {
    expect(shipmentBatchHasExceptionOptions).toEqual(['all', 'yes', 'no']);
  });
});
