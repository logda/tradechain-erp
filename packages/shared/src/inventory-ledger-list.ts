import type { PaginatedListResponse } from './list-query.js';

export type InventoryLedgerListItem = {
  id: number;
  movementType: string;
  sourceBizType: string;
  sourceDocNo: string;
  productId: number;
  sku: string;
  warehouseName: string;
  locationName: string;
  quantityDelta: number;
  createdAt: string;
};

export type InventoryLedgerListResponse =
  PaginatedListResponse<InventoryLedgerListItem>;
