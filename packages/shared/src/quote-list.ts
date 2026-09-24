import type {
  CommonListQuery,
  ListQueryResponse,
  TriStateFilter,
} from './list-query.js';

export const quoteListSortFields = [
  'createdAt',
  'docNo',
  'customerName',
] as const;

export const quoteBossConfirmedOptions = ['all', 'yes', 'no'] as const;

export const quoteSourceTypeOptions = [
  'expo',
  'referral',
  'website',
  'online',
  'tiktok',
] as const;

export type QuoteListSortField = (typeof quoteListSortFields)[number];
export type QuoteSourceType = string;
export type QuoteDocumentType = 'demand' | 'quote';
export type QuoteProductSource = 'existing' | 'candidate';

export type QuoteListQuery = Omit<CommonListQuery, 'sortBy'> & {
  documentType?: QuoteDocumentType;
  customerName?: string;
  createdBy?: string;
  sourceType?: QuoteSourceType;
  bossConfirmed?: TriStateFilter;
  sortBy?: QuoteListSortField;
};

export type QuoteListItem = {
  documentType?: QuoteDocumentType;
  productSource?: QuoteProductSource;
  moduleLabel: string;
  quoteId?: number;
  docNo: string;
  title: string;
  status: string;
  secondaryStatus?: string;
  currentVersionNo?: number;
  customerName: string;
  customerFullName?: string;
  customerCode?: string;
  customerId?: number;
  salesUserId?: number;
  createdBy: string;
  sourceType: QuoteSourceType;
  inquiryDate?: string;
  destination?: string;
  requirements?: string;
  items?: Array<{
    lineNo: number;
    productName: string;
    quantity: number;
    unit: string;
  }>;
  bossConfirmed: boolean;
  linkedSalesOrderId?: number;
  linkedSalesOrderNo?: string;
  createdAt: string;
  detailHref: string;
};

export type QuoteListResponse = ListQueryResponse<QuoteListItem>;
