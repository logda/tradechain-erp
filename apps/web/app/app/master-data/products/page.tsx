import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import { AuditLogTable } from '../../_components/audit-log-table';
import { canViewFormalModule, resolveDemoSession } from '../../_lib/demo-session';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../_lib/audit-log';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';
import { canUseFormalMasterDataActions } from '../../_lib/formal-access';
import { normalizePageNumber, paginateItems } from '../../_lib/formal-pagination';
import {
  type PricingMode,
  type ProductCategory,
  type ProductStage,
  type PurchaseCodeMode,
} from './create-product-form';
import {
  defaultProductCodeRuleSet,
  normalizeProductCodeRule,
  type ProductCodeRule,
  type ProductCodeRuleSet,
} from './product-code-rule';
import {
  fallbackProductSupplierOptions,
  type ProductSupplierOption,
} from './product-supplier-options';
import { ProductMasterDataClient } from './product-master-data-client';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;

type ProductItem = {
  id: number;
  sku: string;
  salesCode?: string;
  purchaseCode?: string;
  purchaseCodeMode?: PurchaseCodeMode;
  productStage?: ProductStage;
  pricingMode?: PricingMode;
  brand?: string;
  factoryName?: string;
  model?: string;
  spec?: string;
  singleWeight?: number | null;
  cartonSpec?: string;
  cartonQuantity?: number | null;
  cartonWeight?: number | null;
  defaultSupplierCode?: string;
  nameCn: string;
  nameEn: string;
  category: ProductCategory;
  unit: string;
  currency: string;
  defaultSalePrice: number;
  defaultPurchasePrice: number;
  salePriceTiers?: Array<{
    id: number;
    minQuantity: number;
    salePrice: number;
    currency: string;
    status: 'active' | 'inactive' | 'deleted';
  }>;
  ownerName: string;
  status: 'active' | 'inactive' | 'deleted';
  createdAt: string;
  createdBy: string;
  deactivatedReason?: string;
};

type ProductListResponse = {
  items: ProductItem[];
  total: number;
  page: number;
  pageSize: number;
};

const fallbackItems: ProductItem[] = [
  {
    id: 1,
    sku: 'SKU-LED-001',
    salesCode: 'SALE-LED-001',
    purchaseCode: 'PUR-LED-001',
    purchaseCodeMode: 'manual',
    productStage: 'formal',
    pricingMode: 'tiered',
    brand: 'Starlight',
    factoryName: '深圳光源制造有限公司',
    model: 'SL-001',
    spec: '5m / RGB',
    singleWeight: 0.85,
    cartonSpec: '20 pcs / carton',
    cartonQuantity: 20,
    cartonWeight: 18.5,
    defaultSupplierCode: 'SUP-LIGHT',
    nameCn: '智能 LED 灯带',
    nameEn: 'Smart LED Strip',
    category: 'electronics',
    unit: 'set',
    currency: 'USD',
    defaultSalePrice: 15.9,
    defaultPurchasePrice: 8.5,
    salePriceTiers: [
      { id: 1, minQuantity: 1, salePrice: 15.9, currency: 'USD', status: 'active' },
      { id: 2, minQuantity: 100, salePrice: 14.5, currency: 'USD', status: 'active' },
    ],
    ownerName: 'Zoe',
    status: 'active',
    createdAt: '2026-07-11T09:00:00.000Z',
    createdBy: 'system',
  },
  {
    id: 2,
    sku: 'SKU-CBL-002',
    salesCode: 'SALE-CBL-002',
    purchaseCode: 'PUR-CBL-002',
    purchaseCodeMode: 'generated',
    productStage: 'formal',
    pricingMode: 'fixed',
    defaultSupplierCode: 'SUP-CABLE',
    nameCn: 'USB-C 线缆',
    nameEn: 'USB-C Cable',
    category: 'electronics',
    unit: 'pcs',
    currency: 'USD',
    defaultSalePrice: 4.8,
    defaultPurchasePrice: 2.1,
    salePriceTiers: [],
    ownerName: 'Leo',
    status: 'active',
    createdAt: '2026-07-11T09:05:00.000Z',
    createdBy: 'system',
  },
];

const sectionStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '24px',
  padding: '22px',
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap' as const,
  alignItems: 'flex-start',
} satisfies React.CSSProperties;

const linkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const heroSectionStyle = {
  ...sectionStyle,
  padding: '26px',
  background:
    'radial-gradient(circle at top left, rgba(15,118,110,0.12) 0%, rgba(255,255,255,0.98) 32%, rgba(248,250,252,0.96) 100%)',
} satisfies React.CSSProperties;

const heroTitleWrapStyle = {
  display: 'grid',
  gap: '10px',
  alignContent: 'start',
} satisfies React.CSSProperties;

const heroEyebrowStyle = {
  margin: 0,
  fontSize: '12px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: '#0f766e',
  fontWeight: 700,
} satisfies React.CSSProperties;

const heroTitleStyle = {
  margin: 0,
  fontSize: '30px',
  lineHeight: 1.12,
  color: '#0f172a',
} satisfies React.CSSProperties;

const heroCopyStyle = {
  margin: 0,
  color: '#475569',
  lineHeight: 1.8,
  fontSize: '14px',
  maxWidth: '860px',
} satisfies React.CSSProperties;

const heroActionWrapStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
} satisfies React.CSSProperties;

const heroMetaBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  padding: '8px 12px',
  background: '#ffffff',
  color: '#334155',
  fontSize: '12px',
  fontWeight: 700,
} satisfies React.CSSProperties;

const sectionHeadingStyle = {
  marginTop: 0,
  marginBottom: '8px',
  fontSize: '22px',
  lineHeight: 1.2,
} satisfies React.CSSProperties;

const sectionCopyStyle = {
  margin: 0,
  color: '#475569',
  lineHeight: 1.8,
  fontSize: '14px',
} satisfies React.CSSProperties;

const tableWrapStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #d8e1ea',
  borderRadius: '4px',
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '1240px',
} satisfies React.CSSProperties;

const headCellStyle = {
  textAlign: 'left' as const,
  fontSize: '12px',
  letterSpacing: '0.04em',
  color: '#334155',
  background: '#eef3f8',
  borderBottom: '1px solid #cfd8e3',
  borderRight: '1px solid #d8e1ea',
  padding: '10px',
} satisfies React.CSSProperties;

const cellStyle = {
  padding: '12px 10px',
  borderBottom: '1px solid #e5ebf2',
  borderRight: '1px solid #e5ebf2',
  fontSize: '13px',
  color: '#0f172a',
  verticalAlign: 'top' as const,
} satisfies React.CSSProperties;

function getProductApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function getProductBrowserApiBaseUrl() {
  return '/api';
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hasValidProductListResponse(value: unknown): value is ProductListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as ProductListResponse).items) &&
    typeof (value as ProductListResponse).total === 'number'
  );
}

function hasValidProductCodeRuleResponse(value: unknown): value is ProductCodeRule {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ProductCodeRule).strategy === 'composed_segments' &&
    typeof (value as ProductCodeRule).serialLength === 'number' &&
    typeof (value as ProductCodeRule).serialScope === 'string' &&
    Array.isArray((value as ProductCodeRule).segments) &&
    typeof (value as ProductCodeRule).updatedAt === 'string' &&
    typeof (value as ProductCodeRule).updatedBy === 'string'
  );
}

async function loadProducts(
  query: {
    keyword?: string;
    status?: string;
    category?: string;
    ownerName?: string;
    productStage?: string;
    pricingMode?: string;
    page: number;
    pageSize: number;
  },
  session: ReturnType<typeof resolveDemoSession>,
) {
  const params = new URLSearchParams();

  if (query.keyword) params.set('keyword', query.keyword);
  if (query.status) params.set('status', query.status);
  if (query.category) params.set('category', query.category);
  if (query.ownerName) params.set('ownerName', query.ownerName);
  if (query.productStage) params.set('productStage', query.productStage);
  if (query.pricingMode) params.set('pricingMode', query.pricingMode);
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));

  try {
    const response = await fetch(
      `${getProductApiBaseUrl()}/products${params.toString() ? `?${params.toString()}` : ''}`,
      {
        cache: 'no-store',
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidProductListResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadAuditLogs(session: ReturnType<typeof resolveDemoSession>) {
  try {
    const response = await fetch(`${getProductApiBaseUrl()}/products/audit-logs`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidAuditLogResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadProductCodeRules(session: ReturnType<typeof resolveDemoSession>) {
  try {
    const response = await fetch(`${getProductApiBaseUrl()}/products/code-rules`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return defaultProductCodeRuleSet;
    }

    const result = (await response.json().catch(() => null)) as Partial<ProductCodeRuleSet> | null;
    return result &&
      hasValidProductCodeRuleResponse(result.purchase) &&
      hasValidProductCodeRuleResponse(result.sales)
      ? {
          purchase: normalizeProductCodeRule(result.purchase),
          sales: normalizeProductCodeRule(result.sales),
        }
      : defaultProductCodeRuleSet;
  } catch {
    return defaultProductCodeRuleSet;
  }
}

function hasValidSupplierListResponse(
  value: unknown,
): value is { items: Array<{ code: string; name: string; shortName?: string }> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { items?: unknown[] }).items)
  );
}

async function loadSupplierOptions(session: ReturnType<typeof resolveDemoSession>) {
  try {
    const params = new URLSearchParams({
      type: 'supplier',
      status: 'active',
      page: '1',
      pageSize: '200',
    });
    const response = await fetch(
      `${getProductApiBaseUrl()}/counterparties?${params.toString()}`,
      {
        cache: 'no-store',
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return fallbackProductSupplierOptions;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    if (!hasValidSupplierListResponse(result)) {
      return fallbackProductSupplierOptions;
    }

    const items = result.items
      .filter(
        (item): item is { code: string; name: string; shortName?: string } =>
          typeof item?.code === 'string' && typeof item?.name === 'string',
      )
      .map((item) => ({
        code: item.code,
        name: item.name,
        shortName: item.shortName ?? '',
      }));

    return items.length > 0 ? items : fallbackProductSupplierOptions;
  } catch {
    return fallbackProductSupplierOptions;
  }
}

function filterFallbackItems(
  items: ProductItem[],
  query: {
    keyword?: string;
    status?: string;
    category?: string;
    ownerName?: string;
    productStage?: string;
    pricingMode?: string;
  },
) {
  return items.filter((item) => {
    if (item.status === 'deleted') {
      return false;
    }

    if (query.status && item.status !== query.status) return false;
    if (query.category && item.category !== query.category) return false;
    if (query.ownerName && item.ownerName !== query.ownerName) return false;
    if (query.productStage && item.productStage !== query.productStage) return false;
    if (query.pricingMode && item.pricingMode !== query.pricingMode) return false;

    const keyword = query.keyword?.toLowerCase();
    if (
      keyword &&
      ![
        item.sku,
        item.salesCode,
        item.purchaseCode,
        item.nameCn,
        item.nameEn,
        item.category,
        item.unit,
        item.currency,
        item.defaultSupplierCode,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    ) {
      return false;
    }

    return true;
  });
}

function filterVisibleProductItems(items: ProductItem[]) {
  return items.filter((item) => item.status !== 'deleted');
}

export default async function AppProductsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const canManageMasterData = canUseFormalMasterDataActions(session);

  if (!canViewFormalModule(session, 'admin')) {
    return (
      <AppShell
        title="商品 / SKU 主数据"
        subtitle="当前角色不具备商品主数据维护权限。"
        session={session}
      >
        <section style={sectionStyle}>
          <h2>无权限访问商品主数据</h2>
          <p>请切换到管理员账号后再维护 SKU、价格和商品基础资料。</p>
        </section>
      </AppShell>
    );
  }

  const query = {
    keyword: readParam(resolvedSearchParams.keyword),
    status: readParam(resolvedSearchParams.status),
    category: readParam(resolvedSearchParams.category),
    ownerName: readParam(resolvedSearchParams.ownerName),
    productStage: readParam(resolvedSearchParams.productStage),
    pricingMode: readParam(resolvedSearchParams.pricingMode),
    page: normalizePageNumber(readParam(resolvedSearchParams.page), 1),
    pageSize: normalizePageNumber(readParam(resolvedSearchParams.pageSize), 20),
  };
  const [result, auditLogs, productCodeRules, supplierOptions] = await Promise.all([
    loadProducts(query, session),
    loadAuditLogs(session),
    loadProductCodeRules(session),
    loadSupplierOptions(session),
  ]);
  const productResult =
    result ??
    paginateItems(
      filterFallbackItems(fallbackItems, query),
      query.page,
      query.pageSize,
    );
  const visibleProductItems = filterVisibleProductItems(productResult.items);
  const auditLogItems = auditLogs?.items ?? [];
  const masterDataRequestHeaders = buildFormalRequestHeaders(session);

  return (
    <AppShell
      title="商品 / SKU 主数据"
      subtitle="统一维护 SKU、中文名、英文名、分类、单位、价格，报价和销售采购明细直接复用。"
      session={session}
    >
      <section style={heroSectionStyle}>
        <div style={toolbarStyle}>
          <div style={heroTitleWrapStyle}>
            <p style={heroEyebrowStyle}>Product Library</p>
            <h3 style={heroTitleStyle}>产品资料总览</h3>
            <p style={heroCopyStyle}>
              这里承接正式版商品主数据，统一维护销售编码、采购编码、工厂与价格规则，让报价、
              销售、采购和后续库存动作都复用同一套产品底账。
            </p>
          </div>
          <div style={heroActionWrapStyle}>
            <Link href="/app" style={linkStyle}>
              返回正式首页
            </Link>
            <Link href="/app/master-data/product-code-rule" style={linkStyle}>
              产品编码规则设置
            </Link>
            <span style={heroMetaBadgeStyle}>当前页面支持商品主数据维护</span>
          </div>
        </div>
      </section>

      <ProductMasterDataClient
        initialItems={visibleProductItems}
        initialTotal={productResult.total}
        initialQuery={query}
        canManageMasterData={canManageMasterData}
        updatedBy={session.user}
        codeRule={productCodeRules.purchase}
        salesCodeRule={productCodeRules.sales}
        supplierOptions={supplierOptions}
        actorAccessScopes={session.accessScopes}
        requestHeaders={masterDataRequestHeaders}
        apiBaseUrl={getProductBrowserApiBaseUrl()}
      />

      <AuditLogTable session={session} items={auditLogItems} />
    </AppShell>
  );
}
