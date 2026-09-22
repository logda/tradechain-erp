export const shipmentBatchStatuses = [
  'shipped',
  'to_forwarder',
  'forwarder_shipped',
  'arrived',
  'exception',
] as const;

export const receiptSendStatuses = ['pending', 'sent'] as const;

export type ShipmentBatchStatus = (typeof shipmentBatchStatuses)[number];
export type ReceiptSendStatus = (typeof receiptSendStatuses)[number];
