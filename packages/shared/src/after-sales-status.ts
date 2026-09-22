export const afterSalesStatuses = [
  'pending_submit',
  'pending_approval',
  'processing',
  'finance_reviewing',
  'finished',
  'closed',
] as const;

export const receiptCollectionStatuses = [
  'unpaid',
  'deposit_received',
  'fully_paid',
  'prepaid_deducted',
] as const;

export const financeConfirmStatuses = ['pending', 'confirmed'] as const;

export type AfterSalesStatus = (typeof afterSalesStatuses)[number];
export type ReceiptCollectionStatus = (typeof receiptCollectionStatuses)[number];
export type FinanceConfirmStatus = (typeof financeConfirmStatuses)[number];
