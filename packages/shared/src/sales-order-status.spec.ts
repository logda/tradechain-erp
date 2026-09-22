import {
  salesApprovalStatuses,
  salesFulfillmentStatuses,
} from './sales-order-status.js';

describe('sales order statuses', () => {
  it('exports the stable approval statuses', () => {
    expect(salesApprovalStatuses).toEqual([
      'draft',
      'rejected',
      'pending_sales_manager_approval',
      'purchasing',
      'void',
    ]);
  });

  it('exports the stable fulfillment statuses', () => {
    expect(salesFulfillmentStatuses).toEqual([
      'purchasing',
      'partial_purchasing',
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
      'closed',
      'void',
    ]);
  });
});
