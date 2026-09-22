import type { PaginatedListResponse } from './list-query.js';

export type WarehouseListItem = {
  id: number;
  code: string;
  name: string;
  status: string;
  locationCount: number;
  ownerName: string;
  updatedAt: string;
};

export type WarehouseListResponse = PaginatedListResponse<WarehouseListItem>;
