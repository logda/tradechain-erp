export type StockOutOrderStoreItem = {
  id: number;
  docNo: string;
  sourceBizType: string;
  sourceBizId: number;
  sourceDocNo: string;
  warehouseId: number;
  locationId: number;
  status: 'draft' | 'confirmed';
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
};

export function resolveStockOutStore() {
  return {
    nextId: 701,
    records: [] as StockOutOrderStoreItem[],
  };
}
