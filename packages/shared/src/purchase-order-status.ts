export const purchaseApprovalStatuses = [
  'draft',
  'pending_purchase_claim',
  'pending_purchase_manager_approval',
  'purchasing',
  'void',
] as const;

export type PurchaseApprovalStatus = (typeof purchaseApprovalStatuses)[number];

export const purchaseFulfillmentStatuses = [
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
] as const;

export type PurchaseFulfillmentStatus =
  (typeof purchaseFulfillmentStatuses)[number];
