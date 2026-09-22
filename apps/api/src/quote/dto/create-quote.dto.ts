export class CreateQuoteItemDto {
  productId?: number;
  sku?: string;
  productName?: string;
  unit?: string;
  targetPrice?: number;
  imageUrls?: string[];
  createCandidateProduct?: {
    sku: string;
    nameCn: string;
    category: string;
    unit?: string;
    saveToProductMaster?: boolean;
  };
  quantity!: number;
  salePrice!: number;
}

export class QuoteAttachmentDto {
  key?: string;
  fileName!: string;
  mimeType!: string;
  size!: number;
  url!: string;
}

export class CreateQuoteDto {
  submitMode?: 'draft' | 'submit';
  documentType?: 'demand' | 'quote';
  productSource?: 'existing' | 'candidate';
  customerId?: number;
  customerEntryMode?: 'existing' | 'manual';
  customerName?: string;
  customerCode?: string;
  saveManualCustomerToCounterparty?: boolean;
  salesUserId!: number;
  sourceCode!: string;
  inquiryDate?: string;
  destination?: string;
  requirements!: string;
  quoteAttachments?: QuoteAttachmentDto[];
  items?: CreateQuoteItemDto[];
}
