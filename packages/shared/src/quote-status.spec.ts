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
      'pending_boss_approval',
      'boss_approved',
      'inquiry_in_progress',
      'converted_to_quote',
      'pending_boss_price_confirmation',
      'pending_customer_feedback',
      'customer_accepted',
      'customer_no_follow_up',
      'repricing_in_progress',
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
