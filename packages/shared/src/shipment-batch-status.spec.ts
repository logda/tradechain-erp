import {
  receiptSendStatuses,
  shipmentBatchStatuses,
} from './shipment-batch-status.js';

describe('shipment batch statuses', () => {
  it('exposes the full shipment batch lifecycle in order', () => {
    expect(shipmentBatchStatuses).toEqual([
      'shipped',
      'to_forwarder',
      'forwarder_shipped',
      'arrived',
      'exception',
    ]);
  });

  it('exposes the receipt sending statuses in order', () => {
    expect(receiptSendStatuses).toEqual(['pending', 'sent']);
  });
});
