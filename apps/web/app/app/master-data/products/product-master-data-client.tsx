'use client';

import { FilterPanel } from '../../_components/filter-panel';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { workspaceContentReadyEvent } from '../../_lib/workspace-navigation';
import {
  CreateProductForm,
  type PricingMode,
  type ProductCategory,
  type ProductStage,
  type PurchaseCodeMode,
} from './create-product-form';
import type { ProductCodeRule } from './product-code-rule';
import { ProductTableRow } from './product-table-row';
import type { ProductSupplierOption } from './product-supplier-options';
import { CounterpartyCustomFieldManager } from '../counterparties/counterparty-custom-field-manager';
import type { CounterpartyCustomField } from '../counterparties/counterparty-extra-fields';

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
  defaultPurchasePrice?: number;
  customValues?: Record<string, string>;
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
  hasExplicitQuery?: boolean;
  canManageMasterData: boolean;
  canConfigureFields?: boolean;
  salesView?: boolean;
  customFields?: CounterpartyCustomField[];
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
  mutationApiBaseUrl?: string;
};

const sectionStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '12px',
  padding: '14px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const summaryStyle = {
  display: 'flex',
  gap: '16px',
  flexWrap: 'wrap' as const,
  marginTop: '10px',
  fontSize: '12px',
  color: '#475569',
} satisfies React.CSSProperties;

const tableWrapStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #d8e1ea',
  borderRadius: '8px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '860px',
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

function isProductQuery(value: unknown): value is ProductQuery {
  const query = value as ProductQuery | null;
  return !!query && Number.isInteger(query.page) && query.page > 0 && Number.isInteger(query.pageSize) && query.pageSize > 0 &&
    ['keyword', 'status', 'category', 'ownerName', 'productStage', 'pricingMode'].every((name) =>
      query[name as keyof ProductQuery] == null || typeof query[name as keyof ProductQuery] === 'string');
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
  hasExplicitQuery = false,
  canManageMasterData,
  canConfigureFields = false,
  salesView = false,
  customFields: initialCustomFields = [],
  updatedBy,
  codeRule,
  salesCodeRule,
  supplierOptions,
  actorAccessScopes,
  requestHeaders,
  apiBaseUrl,
  mutationApiBaseUrl = apiBaseUrl,
}: ProductMasterDataClientProps) {
  const [items, setItems] = useState(initialItems);
  const [customFields, setCustomFields] = useState(initialCustomFields);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [hasOpenedCreate, setHasOpenedCreate] = useState(false);
  const [createNotice, setCreateNotice] = useState<string | null>(null);
  const openCreateRef = useRef<HTMLButtonElement>(null);
  const closeCreateRef = useRef<HTMLButtonElement>(null);
  const [total, setTotal] = useState(initialTotal);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);
  const userId = Number(requestHeaders['x-erp-user-id']);
  const cacheKey = Number.isSafeInteger(userId) && userId > 0 && requestHeaders['x-erp-role']
    ? `erp-product-query:${userId}:${requestHeaders['x-erp-role']}:${requestHeaders['x-erp-data-scope'] ?? 'default'}` : null;
  const [cacheReady, setCacheReady] = useState(false);
  const successfulQueryRef = useRef(initialQuery);
  const restoringQueryRef = useRef(false);

  useEffect(() => {
    if (!cacheKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(cacheKey) ?? 'null');
      if (saved && isProductQuery(saved.applied) && isProductQuery(saved.draft)) {
        const sameQuery = buildProductQueryParams(saved.applied).toString() === buildProductQueryParams(initialQuery).toString();
        if (!hasExplicitQuery || sameQuery) {
          successfulQueryRef.current = saved.applied;
          setDraftQuery(saved.draft);
          if (!sameQuery) {
            restoringQueryRef.current = true;
            void fetchProducts(saved.applied);
          }
        }
      }
    } catch { /* No usable query context is available. */ }
    setCacheReady(true);
  }, [cacheKey]);
  useEffect(() => {
    if (!cacheKey || !cacheReady) return;
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ applied: successfulQueryRef.current, draft: draftQuery })); }
    catch { /* Query controls remain usable without storage. */ }
  }, [cacheKey, cacheReady, appliedQuery, draftQuery]);
  useEffect(() => {
    if (!cacheReady || isLoading || !restoringQueryRef.current) return;
    restoringQueryRef.current = false;
    if (!loadError) window.dispatchEvent(new Event(workspaceContentReadyEvent));
  }, [cacheReady, isLoading, loadError, appliedQuery]);

  const formalCount = countProductsByStage(items, 'formal');
  const tieredCount = countProductsByPricingMode(items, 'tiered');
  const linkedSupplierCount = countLinkedSuppliers(items);

  useEffect(() => {
    if (!isCreateOpen) return;
    closeCreateRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCreateOpen(false);
        openCreateRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [isCreateOpen]);

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
      successfulQueryRef.current = resolvedQuery;
      setAppliedQuery(resolvedQuery);
      setDraftQuery((current) =>
        buildProductQueryParams({ ...current, page: nextQuery.page, pageSize: nextQuery.pageSize }).toString() === buildProductQueryParams(nextQuery).toString()
          ? resolvedQuery : current);
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
    const matchesFilters = matchesProductFilters(nextItem, appliedQuery);
    setCreateNotice(matchesFilters && appliedQuery.page === 1
      ? `产品“${nextItem.nameCn || nextItem.sku}”新增成功，列表已更新。`
      : `产品“${nextItem.nameCn || nextItem.sku}”新增成功；当前筛选或分页下未显示，请调整筛选条件。`);
    if (!matchesFilters) {
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

  const totalPages = Math.max(1, Math.ceil(total / Math.max(appliedQuery.pageSize, 1)));
  const appliedSummary = [
    appliedQuery.keyword ? `关键词：${appliedQuery.keyword}` : '',
    appliedQuery.category ? `分类：${({ electronics: '电子类', consumables: '耗材类', service: '服务类' } as Record<string, string>)[appliedQuery.category] ?? appliedQuery.category}` : '',
    appliedQuery.status ? `状态：${appliedQuery.status === 'active' ? '启用' : appliedQuery.status === 'inactive' ? '停用' : appliedQuery.status}` : '',
    appliedQuery.ownerName ? `负责人：${appliedQuery.ownerName}` : '',
    appliedQuery.productStage ? `阶段：${({ formal: '正式产品', quote_candidate: '报价候选产品' } as Record<string, string>)[appliedQuery.productStage] ?? appliedQuery.productStage}` : '',
    appliedQuery.pricingMode ? `定价：${({ tiered: '阶梯报价', fixed: '固定报价' } as Record<string, string>)[appliedQuery.pricingMode] ?? appliedQuery.pricingMode}` : '',
  ].filter(Boolean).join('，');

  function clearFilters() {
    const nextQuery = { page: 1, pageSize: appliedQuery.pageSize };
    setDraftQuery(nextQuery);
    void fetchProducts(nextQuery);
  }

  return (
    <>
      <section style={sectionStyle}>
        <form onSubmit={handleFilterSubmit} className="erp-filter-form" style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'end', gap: '10px', flexWrap: 'wrap' }}>
            <label className="erp-form-field" style={{ flex: '1 1 280px' }}>
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
            <button className="erp-button erp-button--primary" type="submit" disabled={isLoading}>
              {isLoading ? '查询中...' : '查询'}
            </button>
            <span style={{ alignSelf: 'center', color: '#64748b', fontSize: '12px' }}>{canManageMasterData ? '可维护产品' : '产品只读'}</span>
            {canManageMasterData ? <button ref={openCreateRef} type="button" className="erp-button erp-button--primary" onClick={() => { setCreateNotice(null); setHasOpenedCreate(true); setIsCreateOpen(true); }}>新增</button> : null}
          </div>
          <FilterPanel title="筛选商品" appliedSummary={appliedSummary} onClear={clearFilters}>
          <div className="erp-form-grid">
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
          </div>
          </FilterPanel>
          {loadError ? <p style={{ margin: 0, color: '#b91c1c' }}>{loadError}</p> : null}
        </form>
        <div style={summaryStyle}>
          <span><span>当前页商品</span> <strong>{items.length}</strong></span>
          <span><span>正式产品</span> <strong>{formalCount}</strong></span>
          <span><span>阶梯报价</span> <strong>{tieredCount}</strong></span>
          {!salesView ? <span><span>已关联供应商</span> <strong>{linkedSupplierCount}</strong></span> : null}
        </div>
        {createNotice ? <p role="status" style={{ margin: '10px 0 0', color: '#166534', fontSize: '13px' }}>{createNotice}</p> : null}
      </section>

      <section style={sectionStyle}>
        <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>商品列表</h3>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={headCellStyle}>{salesView ? '产品编码' : '产品编码 / 采购编码'}</th>
                <th style={headCellStyle}>产品名称 Product Name</th>
                <th style={headCellStyle}>品牌 / 分类</th>
                <th style={headCellStyle}>型号 / 规格</th>
                <th style={headCellStyle}>阶段 / 价格</th>
                <th style={headCellStyle}>状态</th>
                <th style={headCellStyle}>操作 Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ProductTableRow
                  key={item.id}
                  item={item}
                  canManageMasterData={canManageMasterData}
                  salesView={salesView}
                  customFields={customFields}
                  updatedBy={updatedBy}
                  supplierOptions={supplierOptions}
                  actorAccessScopes={actorAccessScopes}
                  requestHeaders={requestHeaders}
                  apiBaseUrl={apiBaseUrl}
                  mutationApiBaseUrl={mutationApiBaseUrl}
                />
              ))}
            </tbody>
          </table>
        </div>
        <nav style={paginationWrapStyle} aria-label="商品分页">
          <span>{`第 ${appliedQuery.page} / ${totalPages} 页，共 ${total} 条`}</span>
          {totalPages > 1 ? <div style={paginationActionWrapStyle}>
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
          </div> : null}
        </nav>
      </section>
      {canManageMasterData ? <details style={sectionStyle}>
        <summary style={{ cursor: 'pointer', color: '#334155', fontWeight: 700 }}>产品设置</summary>
        <div style={{ display: 'grid', gap: '12px', paddingTop: '12px' }}>
          <Link href="/app/master-data/product-code-rule" style={{ color: '#334155', fontWeight: 700 }}>产品编码规则设置</Link>
          {canConfigureFields ? <CounterpartyCustomFieldManager fields={customFields} onChange={setCustomFields} endpoint={`${mutationApiBaseUrl}/products/custom-fields`} requestHeaders={requestHeaders} /> : null}
        </div>
      </details> : null}
      {hasOpenedCreate ? <div aria-hidden={!isCreateOpen} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.58)', display: isCreateOpen ? 'grid' : 'none', placeItems: 'center', padding: '20px' }}>
        <section role="dialog" aria-modal="true" aria-label="新增产品" style={{ width: 'min(1100px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', color: '#0f172a', borderRadius: '20px', boxShadow: '0 24px 80px rgba(15, 23, 42, 0.28)' }}>
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
            <button ref={closeCreateRef} type="button" aria-label="关闭新增产品弹窗" title="关闭" className="erp-button" style={{ width: '36px', minHeight: '36px', padding: 0, fontSize: '26px', lineHeight: 1 }} onClick={() => { setIsCreateOpen(false); openCreateRef.current?.focus(); }}>×</button>
          </div>
          <div style={{ minHeight: 0, overflowY: 'auto', padding: '24px' }}>
            <CreateProductForm endpoint={`${mutationApiBaseUrl}/products`} createdBy={updatedBy} codeRule={codeRule} salesCodeRule={salesCodeRule} supplierOptions={supplierOptions} actorAccessScopes={actorAccessScopes} customFields={customFields} onSuccess={(item) => { handleCreated(item); setIsCreateOpen(false); setHasOpenedCreate(false); openCreateRef.current?.focus(); }} />
          </div>
        </section>
      </div> : null}
    </>
  );
}
