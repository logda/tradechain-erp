import {
  INQUIRY_STATUSES,
  QUOTE_STATUSES,
  purchaseApprovalStatuses,
  salesApprovalStatuses,
} from './index.js';

describe('shared domain enums', () => {
  it('exports the public shared status collections used across slices', () => {
    expect(QUOTE_STATUSES).toEqual([
      'draft',
      'submitted',
      'quoted',
      'revised',
      'sample_requested',
      'ordered',
      'closed',
    ]);
    expect(INQUIRY_STATUSES).toEqual([
      'draft',
      'submitted',
      'boss_confirmed',
      'rejected',
    ]);
    expect(salesApprovalStatuses).toEqual([
      'draft',
      'rejected',
      'pending_sales_manager_approval',
      'purchasing',
      'void',
    ]);
    expect(purchaseApprovalStatuses).toEqual([
      'draft',
      'pending_purchase_claim',
      'pending_purchase_manager_approval',
      'purchasing',
      'void',
    ]);
  });
});
