export class SalesOrderAttachmentDto {
  key?: string;
  fileName!: string;
  mimeType!: string;
  size!: number;
  url!: string;
}

export class CreateDirectSalesOrderItemDto {
  lineNo?: number;
  productId?: number;
  sku?: string;
  productName?: string;
  unit?: string;
  packageQuantity?: number;
  unitsPerPackage?: number;
  cartonQuantity?: number;
  outerCartonSizeCm?: string;
  outerCartonGrossWeightKg?: number;
  totalQuantity?: number;
  quantity?: number;
  salePrice?: number;
  amount?: number;
  factoryPicUrls?: string[];
}

export class CreateDirectSalesOrderDto {
  submitMode?: 'draft' | 'submit';
  customerId?: number;
  customerEntryMode?: 'existing' | 'manual';
  customerName!: string;
  customerCode?: string;
  saveManualCustomerToCounterparty?: boolean;
  title!: string;
  salesUserId!: number;
  createdBy!: number;
  customerOrderNo?: string;
  orderingUnit?: string;
  storeName?: string;
  orderDate?: string;
  estimatedDeliveryDate?: string;
  shipTo?: string;
  salesOrderAttachment?: string;
  salesOrderRemark?: string;
  salesOrderAttachments?: SalesOrderAttachmentDto[];
  items?: CreateDirectSalesOrderItemDto[];
}
