import {
  afterSalesStatuses,
  financeConfirmStatuses,
  receiptCollectionStatuses,
} from './after-sales-status.js';

describe('after sales and finance statuses', () => {
  it('exposes the full after-sales lifecycle in order', () => {
    expect(afterSalesStatuses).toEqual([
      'pending_submit',
      'pending_approval',
      'processing',
      'finance_reviewing',
      'finished',
      'closed',
    ]);
  });

  it('exposes the receipt collection statuses in order', () => {
    expect(receiptCollectionStatuses).toEqual([
      'unpaid',
      'deposit_received',
      'fully_paid',
      'prepaid_deducted',
    ]);
  });

  it('exposes the finance confirmation statuses in order', () => {
    expect(financeConfirmStatuses).toEqual(['pending', 'confirmed']);
  });
});
