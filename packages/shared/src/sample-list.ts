import type {
  CommonListQuery,
  ListQueryResponse,
  TriStateFilter,
} from './list-query.js';

export const sampleListSortFields = [
  'createdAt',
  'docNo',
  'customerName',
] as const;

export const sampleIsReplacementOptions = ['all', 'yes', 'no'] as const;

export const sampleIsCancelledOptions = ['all', 'yes', 'no'] as const;

export type SampleListSortField = (typeof sampleListSortFields)[number];

export type SampleListQuery = CommonListQuery<SampleListSortField> & {
  customerName?: string;
  createdBy?: string;
  ownerName?: string;
  quoteNo?: string;
  isReplacement?: TriStateFilter;
  isCancelled?: TriStateFilter;
};

export type SampleListItem = {
  moduleLabel: string;
  docNo: string;
  title: string;
  status: string;
  secondaryStatus?: string;
  customerName: string;
  createdBy: string;
  ownerName: string;
  quoteNo: string;
  isReplacement: boolean;
  isCancelled: boolean;
  createdAt: string;
  detailHref: string;
};

export type SampleListResponse = ListQueryResponse<SampleListItem>;
