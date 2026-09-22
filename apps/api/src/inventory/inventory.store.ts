export type InventoryBalanceStoreItem = {
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

export type InventoryLedgerStoreItem = {
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

const inventoryStore = {
  balances: [
    {
      productId: 1,
      sku: 'SKU-LED-001',
      productName: '智能 LED 灯带',
      warehouseId: 1,
      warehouseName: 'Main Warehouse',
      locationId: 11,
      locationName: 'A-01',
      onHandQty: 40,
      availableQty: 40,
      updatedAt: '2026-07-14T08:30:00.000Z',
    },
  ] satisfies InventoryBalanceStoreItem[],
  ledger: [
    {
      id: 1,
      movementType: 'stock_in_confirmed',
      sourceBizType: 'purchase_order',
      sourceDocNo: 'P202607110100',
      productId: 1,
      sku: 'SKU-LED-001',
      warehouseName: 'Main Warehouse',
      locationName: 'A-01',
      quantityDelta: 40,
      createdAt: '2026-07-14T08:30:00.000Z',
    },
  ] satisfies InventoryLedgerStoreItem[],
  nextLedgerId: 2,
};

export function resolveInventoryStore() {
  return inventoryStore;
}
