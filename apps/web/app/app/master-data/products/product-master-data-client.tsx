'use client';

import { useRef, useState } from 'react';
import {
  CreateProductForm,
  type PricingMode,
  type ProductCategory,
  type ProductStage,
  type PurchaseCodeMode,
} from './create-product-form';
import { describeProductCodeRule, type ProductCodeRule } from './product-code-rule';
import { ProductTableRow } from './product-table-row';
import type { ProductSupplierOption } from './product-supplier-options';

type ProductQuery = {
  keyword?: string;
  status?: string;
  category?: string;
  ownerName?: string;
  productStage?: string;
  pricingMode?: string;
  page: number;
  pageSize: number;
};

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

type ProductMasterDataClientProps = {
  initialItems: ProductItem[];
  initialTotal: number;
  initialQuery: ProductQuery;
  canManageMasterData: boolean;
  updatedBy: string;
  codeRule: ProductCodeRule;
  salesCodeRule: ProductCodeRule;
  supplierOptions: ProductSupplierOption[];
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  requestHeaders: Record<string, string>;
  apiBaseUrl: string;
};

const sectionStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '24px',
  padding: '22px',
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const sectionHeadingStyle = {
  marginTop: 0,
} satisfies React.CSSProperties;

const sectionCopyStyle = {
  color: '#475569',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const filterHeadingStyle = {
  margin: 0,
  fontSize: '18px',
} satisfies React.CSSProperties;

const metricsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '14px',
  marginTop: '18px',
} satisfies React.CSSProperties;

const metricCardStyle = {
  border: '1px solid #dbe4ee',
  borderRadius: '20px',
  padding: '18px 18px 16px',
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(241,245,249,0.94) 100%)',
  display: 'grid',
  gap: '8px',
  minHeight: '112px',
  alignContent: 'start',
} satisfies React.CSSProperties;

const metricLabelStyle = {
  fontSize: '12px',
  color: '#64748b',
  letterSpacing: '0.04em',
} satisfies React.CSSProperties;

const metricValueStyle = {
  fontSize: '28px',
  lineHeight: 1,
  color: '#0f172a',
  fontWeight: 800,
} satisfies React.CSSProperties;

const metricHintStyle = {
  fontSize: '12px',
  color: '#475569',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const tableWrapStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  background: '#ffffff',
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

const paginationWrapStyle = {
  marginTop: '14px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
  color: '#475569',
  fontSize: '13px',
} satisfies React.CSSProperties;

const paginationActionWrapStyle = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const paginationActionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '76px',
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  padding: '8px 12px',
  color: '#0f172a',
  background: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties;

const paginationDisabledActionStyle = {
  ...paginationActionStyle,
  color: '#94a3b8',
  background: '#f8fafc',
  cursor: 'not-allowed',
} satisfies React.CSSProperties;

function buildProductQueryParams(query: ProductQuery) {
  const params = new URLSearchParams();

  if (query.keyword) params.set('keyword', query.keyword);
  if (query.status) params.set('status', query.status);
  if (query.category) params.set('category', query.category);
  if (query.ownerName) params.set('ownerName', query.ownerName);
  if (query.productStage) params.set('productStage', query.productStage);
  if (query.pricingMode) params.set('pricingMode', query.pricingMode);
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));

  return params;
}

function hasValidProductListResponse(value: unknown): value is {
  items: ProductItem[];
  total: number;
  page: number;
  pageSize: number;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { items?: unknown }).items) &&
    typeof (value as { total?: unknown }).total === 'number' &&
    typeof (value as { page?: unknown }).page === 'number' &&
    typeof (value as { pageSize?: unknown }).pageSize === 'number'
  );
}

async function loadProductList(
  apiBaseUrl: string,
  requestHeaders: Record<string, string>,
  query: ProductQuery,
) {
  const response = await fetch(
    `${apiBaseUrl}/products?${buildProductQueryParams(query).toString()}`,
    {
      cache: 'no-store',
      headers: requestHeaders,
    },
  );

  if (!response.ok) {
    throw new Error('商品列表加载失败');
  }

  const result = (await response.json().catch(() => null)) as unknown;
  if (!hasValidProductListResponse(result)) {
    throw new Error('商品列表响应无效');
  }

  return result;
}

function matchesProductFilters(
  item: ProductItem,
  filters: ProductQuery,
) {
  if (item.status === 'deleted') {
    return false;
  }
  if (filters.status && item.status !== filters.status) {
    return false;
  }
  if (filters.category && item.category !== filters.category) {
    return false;
  }
  if (filters.ownerName && item.ownerName !== filters.ownerName) {
    return false;
  }
  if (filters.productStage && item.productStage !== filters.productStage) {
    return false;
  }
  if (filters.pricingMode && item.pricingMode !== filters.pricingMode) {
    return false;
  }

  const keyword = filters.keyword?.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  return [
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
    .includes(keyword);
}

function countProductsByStage(items: ProductItem[], stage: ProductStage) {
  return items.filter((item) => item.productStage === stage).length;
}

function countProductsByPricingMode(items: ProductItem[], pricingMode: PricingMode) {
  return items.filter((item) => item.pricingMode === pricingMode).length;
}

function countLinkedSuppliers(items: ProductItem[]) {
  return items.filter((item) => Boolean(item.defaultSupplierCode?.trim())).length;
}

function readFormFieldValue(
  form: HTMLFormElement,
  name: string,
): string {
  const field = form.elements.namedItem(name);
  const fieldWithValue = field as { value?: unknown } | null;

  if (
    fieldWithValue &&
    typeof fieldWithValue === 'object' &&
    typeof fieldWithValue.value === 'string'
  ) {
    return fieldWithValue.value.trim();
  }

  return '';
}

export function ProductMasterDataClient({
  initialItems,
  initialTotal,
  initialQuery,
  canManageMasterData,
  updatedBy,
  codeRule,
  salesCodeRule,
  supplierOptions,
  actorAccessScopes,
  requestHeaders,
  apiBaseUrl,
}: ProductMasterDataClientProps) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const formalCount = countProductsByStage(items, 'formal');
  const tieredCount = countProductsByPricingMode(items, 'tiered');
  const linkedSupplierCount = countLinkedSuppliers(items);

  async function fetchProducts(nextQuery: ProductQuery) {
    const nextRequestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = nextRequestSeq;
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await loadProductList(apiBaseUrl, requestHeaders, nextQuery);
      if (requestSeqRef.current !== nextRequestSeq) {
        return;
      }

      setItems(result.items);
      setTotal(result.total);
      const resolvedQuery = {
        ...nextQuery,
        page: result.page,
        pageSize: result.pageSize,
      };
      setAppliedQuery(resolvedQuery);
      setDraftQuery(resolvedQuery);
    } catch (error) {
      if (requestSeqRef.current !== nextRequestSeq) {
        return;
      }

      setLoadError(error instanceof Error ? error.message : '商品列表加载失败');
    } finally {
      if (requestSeqRef.current === nextRequestSeq) {
        setIsLoading(false);
      }
    }
  }

  function handleCreated(nextItem: ProductItem) {
    if (!matchesProductFilters(nextItem, appliedQuery)) {
      return;
    }

    setTotal((current) => current + 1);
    if (appliedQuery.page !== 1) {
      return;
    }

    setItems((current) =>
      [nextItem, ...current.filter((item) => item.id !== nextItem.id)].slice(
        0,
        appliedQuery.pageSize,
      ),
    );
  }

  function applyFilters(form: HTMLFormElement | null) {
    if (!form) {
      return;
    }

    const nextQuery = {
      keyword: readFormFieldValue(form, 'keyword'),
      status: readFormFieldValue(form, 'status'),
      category: readFormFieldValue(form, 'category'),
      ownerName: readFormFieldValue(form, 'ownerName'),
      productStage: readFormFieldValue(form, 'productStage'),
      pricingMode: readFormFieldValue(form, 'pricingMode'),
      page: 1,
      pageSize: appliedQuery.pageSize,
    };

    setDraftQuery(nextQuery);
    void fetchProducts(nextQuery);
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters(event.currentTarget);
  }

  function handlePageChange(nextPage: number) {
    const totalPages = Math.max(1, Math.ceil(total / Math.max(appliedQuery.pageSize, 1)));
    if (nextPage < 1 || nextPage > totalPages) {
      return;
    }

    void fetchProducts({
      ...appliedQuery,
      page: nextPage,
    });
  }

  return (
    <>
      <section style={sectionStyle}>
        <h3 style={sectionHeadingStyle}>当前页统计</h3>
        <div style={metricsGridStyle}>
          <article style={metricCardStyle}>
            <span style={metricLabelStyle}>当前页商品</span>
            <strong style={metricValueStyle}>{items.length}</strong>
            <span style={metricHintStyle}>按当前筛选条件和分页视图加载的产品数量。</span>
          </article>
          <article style={metricCardStyle}>
            <span style={metricLabelStyle}>正式产品</span>
            <strong style={metricValueStyle}>{formalCount}</strong>
            <span style={metricHintStyle}>已可进入标准下游流程的正式产品记录。</span>
          </article>
          <article style={metricCardStyle}>
            <span style={metricLabelStyle}>阶梯报价</span>
            <strong style={metricValueStyle}>{tieredCount}</strong>
            <span style={metricHintStyle}>当前页中启用数量阶梯报价模式的产品数量。</span>
          </article>
          <article style={metricCardStyle}>
            <span style={metricLabelStyle}>已关联供应商</span>
            <strong style={metricValueStyle}>{linkedSupplierCount}</strong>
            <span style={metricHintStyle}>已带出工厂或供应商编码的产品资料数。</span>
          </article>
        </div>
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionHeadingStyle}>新增商品</h3>
        <p style={sectionCopyStyle}>
          这是单据明细行的基础，先把销售、采购和价格资料补齐，便于追溯、报价和采购复用。
        </p>
        <p style={{ color: '#94a3b8', lineHeight: 1.7 }}>
          销售编码自动生成规则：{describeProductCodeRule(salesCodeRule)}；采购编码自动生成规则：
          {describeProductCodeRule(codeRule)}
        </p>
        {canManageMasterData ? (
          <CreateProductForm
            endpoint={`${apiBaseUrl}/products`}
            createdBy={updatedBy}
            codeRule={codeRule}
            salesCodeRule={salesCodeRule}
            supplierOptions={supplierOptions}
            actorAccessScopes={actorAccessScopes}
            onSuccess={handleCreated}
          />
        ) : (
          <p style={{ color: '#64748b', marginBottom: 0 }}>当前角色仅可查看商品主数据。</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>商品列表</h3>
        <form onSubmit={handleFilterSubmit} className="erp-filter-form erp-card">
          <h4 style={filterHeadingStyle}>筛选视图 Product Filters</h4>
          <div className="erp-form-grid">
            <label className="erp-form-field">
              关键词 Keyword
              <input
                name="keyword"
                value={draftQuery.keyword ?? ''}
                onChange={(event) =>
                  setDraftQuery((current) => ({ ...current, keyword: event.target.value }))
                }
                className="erp-control"
              />
            </label>
            <label className="erp-form-field">
              分类 Category
              <select
                name="category"
                value={draftQuery.category ?? ''}
                onChange={(event) =>
                  setDraftQuery((current) => ({ ...current, category: event.target.value }))
                }
                className="erp-control"
              >
                <option value="">全部 All</option>
                <option value="electronics">electronics / 电子类</option>
                <option value="consumables">consumables / 耗材类</option>
                <option value="service">service / 服务类</option>
              </select>
            </label>
            <label className="erp-form-field">
              状态 Status
              <select
                name="status"
                value={draftQuery.status ?? ''}
                onChange={(event) =>
                  setDraftQuery((current) => ({ ...current, status: event.target.value }))
                }
                className="erp-control"
              >
                <option value="">全部 All</option>
                <option value="active">active / 启用</option>
                <option value="inactive">inactive / 停用</option>
              </select>
            </label>
            <label className="erp-form-field">
              筛选产品阶段 Product Stage Filter
              <select
                name="productStage"
                value={draftQuery.productStage ?? ''}
                onChange={(event) =>
                  setDraftQuery((current) => ({
                    ...current,
                    productStage: event.target.value,
                  }))
                }
                className="erp-control"
              >
                <option value="">全部 All</option>
                <option value="formal">formal / 正式阶段筛选</option>
                <option value="quote_candidate">quote_candidate / 候选阶段筛选</option>
              </select>
            </label>
            <label className="erp-form-field">
              筛选定价方式 Pricing Mode Filter
              <select
                name="pricingMode"
                value={draftQuery.pricingMode ?? ''}
                onChange={(event) =>
                  setDraftQuery((current) => ({
                    ...current,
                    pricingMode: event.target.value,
                  }))
                }
                className="erp-control"
              >
                <option value="">全部 All</option>
                <option value="fixed">fixed / 固定模式筛选</option>
                <option value="tiered">tiered / 阶梯模式筛选</option>
              </select>
            </label>
            <button
              className="erp-button erp-button--primary"
              type="button"
              disabled={isLoading}
              onClick={(event) => applyFilters(event.currentTarget.form)}
            >
              {isLoading ? '查询中...' : '查询'}
            </button>
          </div>
          {loadError ? <p style={{ margin: 0, color: '#b91c1c' }}>{loadError}</p> : null}
        </form>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={headCellStyle}>销售编码 / 采购编码</th>
                <th style={headCellStyle}>产品名称 Product Name</th>
                <th style={headCellStyle}>英文名称 Name EN</th>
                <th style={headCellStyle}>品牌 / 分类</th>
                <th style={headCellStyle}>工厂 / 供应商</th>
                <th style={headCellStyle}>型号 / 规格 / 重量</th>
                <th style={headCellStyle}>包装信息</th>
                <th style={headCellStyle}>单位 Unit</th>
                <th style={headCellStyle}>阶段 / 价格</th>
                <th style={headCellStyle}>状态</th>
                <th style={headCellStyle}>编辑 Edit</th>
                <th style={headCellStyle}>操作 Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ProductTableRow
                  key={item.id}
                  item={item}
                  canManageMasterData={canManageMasterData}
                  updatedBy={updatedBy}
                  supplierOptions={supplierOptions}
                  actorAccessScopes={actorAccessScopes}
                  requestHeaders={requestHeaders}
                  apiBaseUrl={apiBaseUrl}
                />
              ))}
            </tbody>
          </table>
        </div>
        <nav style={paginationWrapStyle} aria-label="商品分页">
          <span>{`第 ${appliedQuery.page} / ${Math.max(1, Math.ceil(total / Math.max(appliedQuery.pageSize, 1)))} 页，共 ${total} 条`}</span>
          <div style={paginationActionWrapStyle}>
            {appliedQuery.page > 1 ? (
              <button
                type="button"
                style={paginationActionStyle}
                onClick={() => handlePageChange(appliedQuery.page - 1)}
                disabled={isLoading}
              >
                上一页
              </button>
            ) : (
              <span style={paginationDisabledActionStyle}>上一页</span>
            )}
            {appliedQuery.page < Math.max(1, Math.ceil(total / Math.max(appliedQuery.pageSize, 1))) ? (
              <button
                type="button"
                style={paginationActionStyle}
                onClick={() => handlePageChange(appliedQuery.page + 1)}
                disabled={isLoading}
              >
                下一页
              </button>
            ) : (
              <span style={paginationDisabledActionStyle}>下一页</span>
            )}
          </div>
        </nav>
      </section>
    </>
  );
}
