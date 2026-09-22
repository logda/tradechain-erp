import type {
  CommonListQuery,
  ListQueryResponse,
  TriStateFilter,
} from './list-query.js';

export const shipmentBatchListSortFields = [
  'createdAt',
  'docNo',
  'supplierName',
] as const;

export const shipmentBatchHasExceptionOptions = ['all', 'yes', 'no'] as const;

export type ShipmentBatchListSortField =
  (typeof shipmentBatchListSortFields)[number];

export type ShipmentBatchListQuery = Omit<CommonListQuery, 'sortBy'> & {
  supplierName?: string;
  salesOrderNo?: string;
  purchaseOrderNo?: string;
  receiptSendStatus?: string;
  hasException?: TriStateFilter;
  sortBy?: ShipmentBatchListSortField;
};

export type ShipmentBatchListItem = {
  moduleLabel: string;
  docNo: string;
  title: string;
  status: string;
  secondaryStatus?: string;
  supplierName: string;
  salesOrderNo: string;
  purchaseOrderNo: string;
  shippedQty?: number;
  remainingQty?: number;
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
  receiptSendStatus: string;
  hasException: boolean;
  createdAt: string;
  detailHref: string;
  items?: Array<{
    purchaseLineNo: number;
    shippedQty: number;
    purchaseQty: number;
  }>;
};

export type ShipmentBatchListResponse =
  ListQueryResponse<ShipmentBatchListItem>;
