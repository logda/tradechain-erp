export type PurchaseSplitSalesOrderItem = {
  lineNo: number;
  sku: string;
  productName: string;
  unit: string;
  quantity: number;
  packageQuantity?: number;
  unitsPerPackage?: number;
  totalQuantity?: number;
  salePrice: number;
  amount: number;
  productId?: number;
  factoryPicUrls?: string[];
};

export type PurchaseSplitSalesOrder = {
  id: number;
  salesNo: string;
  customerOrderNo?: string;
  storeName?: string;
  orderDate?: string;
  estimatedDeliveryDate?: string;
  shipTo?: string;
  salesOrderAttachments?: Array<{
    key?: string;
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
  items?: PurchaseSplitSalesOrderItem[];
};

type PurchaseSplitDraftItem = {
  salesItemId: number;
  supplierId: number;
  productId: number;
  sku: string;
  productName: string;
  unit: string;
  quantity: number;
  packageQuantity?: number;
  unitsPerPackage?: number;
  unitPrice: number;
  internalCode?: string;
  imageUrls?: string[];
  factoryEstimatedDeliveryDate?: string;
  shipTo?: string;
  domesticFreight?: number;
};

function resolveSalesItemProductId(
  item: PurchaseSplitSalesOrderItem,
) {
  if (Number.isFinite(item.productId) && Number(item.productId) > 0) {
    return item.productId ?? 0;
  }

  return 0;
}

export function buildPurchaseSplitDraft(
  salesOrder: PurchaseSplitSalesOrder,
): PurchaseSplitDraftItem[] {
  if (salesOrder.items?.length) {
    return salesOrder.items.map((item) => {
      const productId = resolveSalesItemProductId(item);

      return {
        salesItemId: item.lineNo,
        supplierId: 0,
        productId,
        sku: item.sku,
        productName: item.productName,
        unit: item.unit,
        quantity: item.totalQuantity ?? item.quantity,
        packageQuantity: item.packageQuantity,
        unitsPerPackage: item.unitsPerPackage,
        unitPrice: 0,
        internalCode: productId > 0 ? String(productId) : '',
        imageUrls: item.factoryPicUrls ?? [],
        factoryEstimatedDeliveryDate: salesOrder.estimatedDeliveryDate,
        shipTo: salesOrder.shipTo,
      };
    });
  }

  return [
    {
      salesItemId: salesOrder.id * 10 + 1,
      supplierId: 0,
      productId: 0,
      sku: 'SKU-LED-001',
      productName: '智能 LED 灯带',
      unit: 'set',
      quantity: 10,
      unitPrice: 0,
      internalCode: '',
    },
    {
      salesItemId: salesOrder.id * 10 + 2,
      supplierId: 0,
      productId: 0,
      sku: 'SKU-CBL-002',
      productName: 'USB-C 线缆',
      unit: 'pcs',
      quantity: 6,
      unitPrice: 0,
      internalCode: '',
    },
  ];
}
