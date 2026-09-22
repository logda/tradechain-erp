export type StockInOrderStoreItem = {
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
    sku: string;
    productName: string;
    quantity: number;
  }>;
};

export function resolveStockInStore() {
  return {
    nextId: 601,
    records: [] as StockInOrderStoreItem[],
  };
}
