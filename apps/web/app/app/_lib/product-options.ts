import { buildFormalApiRequestHeaders } from './formal-api-request-headers';
import {
  buildFormalRequestHeaders,
  type FormalRequestSession,
} from './formal-request-headers';

export type ProductOption = {
  id: number;
  sku: string;
  nameCn: string;
  nameEn: string;
  productStage?: 'quote_candidate' | 'formal';
  category?: string;
  unit: string;
  pricingMode?: 'fixed' | 'tiered';
  defaultSalePrice?: number | null;
  defaultPurchasePrice?: number | null;
  quoteEligible?: boolean;
  salePriceTiers?: Array<{
    id?: number;
    minQuantity: number;
    salePrice: number;
    currency?: string;
    status?: string;
  }>;
  status?: string;
};

type ProductListResponse = {
  items: Array<{
    id: number;
    sku: string;
    nameCn: string;
    nameEn: string;
    productStage?: 'quote_candidate' | 'formal';
    category?: string;
    unit: string;
    pricingMode?: 'fixed' | 'tiered';
    defaultSalePrice?: number | null;
    defaultPurchasePrice?: number | null;
    quoteEligible?: boolean;
    salePriceTiers?: Array<{
      id?: number;
      minQuantity: number;
      salePrice: number;
      currency?: string;
      status?: string;
    }>;
    status: string;
  }>;
};

const fallbackProductOptions: ProductOption[] = [
  {
    id: 1,
    sku: 'SKU-LED-001',
    nameCn: '智能 LED 灯带',
    nameEn: 'Smart LED Strip',
    productStage: 'formal',
    category: 'electronics',
    unit: 'set',
    pricingMode: 'tiered',
    defaultSalePrice: 15.9,
    defaultPurchasePrice: 8.5,
    salePriceTiers: [
      { id: 1, minQuantity: 1, salePrice: 15.9, currency: 'USD', status: 'active' },
      { id: 2, minQuantity: 100, salePrice: 14.5, currency: 'USD', status: 'active' },
    ],
  },
  {
    id: 2,
    sku: 'SKU-CBL-002',
    nameCn: 'USB-C 线缆',
    nameEn: 'USB-C Cable',
    productStage: 'formal',
    category: 'electronics',
    unit: 'pcs',
    pricingMode: 'fixed',
    defaultSalePrice: 4.8,
    defaultPurchasePrice: 2.1,
    salePriceTiers: [],
  },
];

function getProductApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidProductListResponse(value: unknown): value is ProductListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as ProductListResponse).items)
  );
}

export async function loadActiveProductOptions(session?: FormalRequestSession) {
  const salesView = session?.role === 'sales' || session?.role === 'sales_manager';
  try {
    const response = await fetch(
      `${getProductApiBaseUrl()}/formal-lookup/products?status=active`,
      {
        cache: 'no-store',
        ...(session ? { headers: buildFormalApiRequestHeaders(session) } : {}),
      },
    );

    if (!response.ok) {
      throw new Error('product options request failed');
    }

    const result = (await response.json().catch(() => null)) as unknown;
    if (!hasValidProductListResponse(result)) {
      throw new Error('product options response invalid');
    }

    return result.items
      .filter((item) => item.status === 'active')
      .map((item) => ({
        id: item.id,
        sku: item.sku,
        nameCn: item.nameCn,
        nameEn: item.nameEn,
        productStage: item.productStage,
        category: item.category,
        unit: item.unit,
        pricingMode: item.pricingMode,
        defaultSalePrice: item.defaultSalePrice,
        ...(salesView ? {} : { defaultPurchasePrice: item.defaultPurchasePrice }),
        quoteEligible: item.quoteEligible ?? (Number(item.defaultSalePrice ?? 0) > 0 && Number(item.defaultPurchasePrice ?? 0) > 0),
        salePriceTiers: item.salePriceTiers ?? [],
        status: item.status,
      }))
      .sort((left, right) => left.id - right.id);
  } catch {
    return fallbackProductOptions.map((item) => {
      if (!salesView) return { ...item };
      const { defaultPurchasePrice, ...visible } = item;
      return { ...visible, quoteEligible: Number(item.defaultSalePrice ?? 0) > 0 && Number(defaultPurchasePrice ?? 0) > 0 };
    }).sort((left, right) => left.id - right.id);
  }
}
