export class CreatePurchaseOrdersFromSalesDto {
  items!: Array<{
    salesItemId: number;
    supplierId: number;
    supplierName?: string;
    purchaseOwnerName?: string;
    productId: number;
    sku?: string;
    internalCode?: string;
    productName?: string;
    unit?: string;
    quantity: number;
    packageQuantity?: number;
    unitsPerPackage?: number;
    unitPrice?: number;
    imageUrls?: string[];
    factoryEstimatedDeliveryDate?: string;
    shipTo?: string;
    domesticFreight?: number;
  }>;

  createdBy!: number;
  salesOrderNo?: string;
  customerOrderNo?: string;
  storeName?: string;
  orderDate?: string;
  factoryEstimatedDeliveryDate?: string;
  shipTo?: string;
  ownerName?: string;
  purchaseOrderAttachments?: Array<{
    key?: string;
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
}
