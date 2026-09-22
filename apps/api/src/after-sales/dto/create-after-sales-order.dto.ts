export type CreateAfterSalesOrderDto = {
  salesOrderId: number;
  purchaseOrderId?: number;
  shipmentBatchId?: number;
  customerName?: string;
  supplierName?: string;
  type: string;
  issueDescription: string;
  createdBy: number;
  items?: Array<{
    lineNo?: number;
    shipmentLineNo?: number;
    purchaseLineNo?: number;
    sourceSalesItemId?: number;
    productId?: number;
    sku?: string;
    productName?: string;
    unit?: string;
    affectedQty?: number;
    shipmentQty?: number;
  }>;
};
