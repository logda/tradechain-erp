import type { PaginatedListResponse } from './list-query.js';

export type InventoryBalanceListItem = {
  productId: number;
  sku: string;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  locationId: number;
  locationName: string;
  onHandQty: number;
  availableQty: number;
  updatedAt: string;
};

export type InventoryBalanceListResponse =
  PaginatedListResponse<InventoryBalanceListItem>;
