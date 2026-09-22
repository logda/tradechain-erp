export type CreateShipmentBatchDto = {
  salesOrderId: number;
  purchaseOrderId: number;
  shippedQty: number;
  accumulatedQty: number;
  remainingQty: number;
  shippedAt: string;
  factoryShipDate?: string;
  shippingCode?: string;
  shippingCodeItems?: Array<{
    code: string;
    quantity: number;
  }>;
  destination?: string;
  shippingMark?: string;
  goodsName?: string;
  totalPackages?: number;
  purchasingUnit?: string;
  customerName?: string;
  freightStation?: string;
  warehouseEntryNo?: string;
  arrivalStatus?: string;
  forwarderShipDate?: string;
  estimatedArrivalDate?: string;
  remark?: string;
  createdBy: number;
  purchaseOrderCurrentStatus: string;
  currentBatchCount: number;
  items?: Array<{
    purchaseLineNo: number;
    sourceSalesItemId: number;
    productId: number;
    sku: string;
    productName: string;
    unit: string;
    shippedQty: number;
    purchaseQty: number;
  }>;
};
