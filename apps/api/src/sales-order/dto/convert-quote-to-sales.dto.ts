export class ConvertQuoteToSalesItemDto {
  lineNo!: number;
  productId!: number;
  sku!: string;
  productName!: string;
  unit!: string;
  quantity!: number;
  salePrice!: number;
  amount?: number;
  imageUrls?: string[];
  confirmedSupplierId?: number;
  confirmedSupplierCode?: string;
  confirmedSupplierName?: string;
  confirmedPurchasePrice?: number;
  confirmedProductId?: number;
}

export class ConvertQuoteToSalesAttachmentDto {
  key?: string;
  fileName!: string;
  mimeType!: string;
  size!: number;
  url!: string;
}

export class ConvertQuoteToSalesDto {
  quoteVersionNo?: number;
  customerId?: number;
  customerName?: string;
  customerFullName?: string;
  customerCode?: string;
  customerEntryMode?: 'existing' | 'manual';
  sourceQuoteNo?: string;
  sourceCode?: string;
  inquiryDate?: string;
  destination?: string;
  requirements?: string;
  createdBy?: number;
  existingSalesOrderId?: number | null;
  quoteConfirmed?: boolean;
  items?: ConvertQuoteToSalesItemDto[];
  quoteAttachments?: ConvertQuoteToSalesAttachmentDto[];
}
