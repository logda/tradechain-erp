import {
  purchaseApprovalStatuses,
  purchaseFulfillmentStatuses,
} from './purchase-order-status.js';

describe('purchase order statuses', () => {
  it('exports the stable approval statuses', () => {
    expect(purchaseApprovalStatuses).toEqual([
      'draft',
      'pending_purchase_claim',
      'pending_purchase_manager_approval',
      'purchasing',
      'void',
    ]);
  });

  it('exports the stable fulfillment statuses', () => {
    expect(purchaseFulfillmentStatuses).toEqual([
      'purchasing',
      'partial_shipped',
      'shipped',
      'partial_to_forwarder',
      'to_forwarder',
      'partial_forwarder_shipped',
      'forwarder_shipped',
      'partial_arrived',
      'arrived',
      'partial_exception',
      'exception',
      'void',
    ]);
  });
});
