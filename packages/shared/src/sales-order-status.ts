export const salesApprovalStatuses = [
  'draft',
  'rejected',
  'pending_sales_manager_approval',
  'purchasing',
  'void',
] as const;

export type SalesApprovalStatus = (typeof salesApprovalStatuses)[number];

export const salesFulfillmentStatuses = [
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
] as const;

export type SalesFulfillmentStatus = (typeof salesFulfillmentStatuses)[number];
