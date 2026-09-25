import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateProductForm } from '../app/app/master-data/products/create-product-form';
import AppProductsPage from '../app/app/master-data/products/page';
import { ProductTableRow } from '../app/app/master-data/products/product-table-row';

describe('formal product master data page', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the product master data page for admin users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 1,
                  bizType: 'product',
                  bizId: 1,
                  operationType: 'create_product',
                  operatorId: 1,
                  beforeData: null,
                  afterData: { sku: 'SKU-LED-001' },
                  createdAt: '2026-07-13T09:00:00.000Z',
                },
              ],
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
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
                ownerName: 'Zoe',
                salePriceTiers: [
                  { id: 1, minQuantity: 1, salePrice: 15.9, currency: 'USD', status: 'active' },
                  { id: 2, minQuantity: 100, salePrice: 14.5, currency: 'USD', status: 'active' },
                ],
                status: 'active',
                createdAt: '2026-07-11T09:00:00.000Z',
                createdBy: 'system',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }),
    );

    render(
      <>
        {await AppProductsPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '商品 / SKU 主数据' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '产品编码 / 采购编码' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '产品名称 Product Name' })).toBeInTheDocument();
    expect(screen.getByText('智能 LED 灯带')).toBeInTheDocument();
    expect(screen.getByText('SALE-LED-001')).toBeInTheDocument();
    expect(screen.getByText('PUR-LED-001')).toBeInTheDocument();
    expect(screen.getByText('SUP-LIGHT')).toBeInTheDocument();
    expect(screen.getByText('Starlight')).toBeInTheDocument();
    expect(screen.getByText('深圳光源制造有限公司')).toBeInTheDocument();
    expect(screen.getByText('产品编码 Product Code')).toBeInTheDocument();
    expect(screen.getByText('采购编码 Purchase')).toBeInTheDocument();
    expect(screen.getByText('供应商编码 Supplier Code')).toBeInTheDocument();
    expect(screen.getByText('SL-001')).toBeInTheDocument();
    expect(screen.getByText('5m / RGB')).toBeInTheDocument();
    expect(screen.getByText('20 pcs / carton')).toBeInTheDocument();
    expect(screen.getByText('tiered / 阶梯报价')).toBeInTheDocument();
    expect(screen.getByText('formal / 正式产品')).toBeInTheDocument();
    expect(screen.getByText('阶梯 2 档')).toBeInTheDocument();
    expect(screen.getByText('>=1: 15.9')).toBeInTheDocument();
    expect(screen.getByText('>=100: 14.5')).toBeInTheDocument();
    expect(screen.getByText('产品编码规则设置')).toBeInTheDocument();
    expect(screen.queryByText('Owner: Zoe')).not.toBeInTheDocument();
    expect(screen.queryByText('USD')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新增' })).toBeInTheDocument();
    const productList = screen.getByRole('heading', { name: '商品列表' }).closest('section');
    expect(productList).not.toBeNull();
    expect(within(productList!).queryByRole('button', { name: '新增' })).not.toBeInTheDocument();
    expect(within(productList!).queryByRole('textbox', { name: '关键词 Keyword' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '新增产品' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toHaveClass(
      'erp-button',
      'erp-button--primary',
    );
    expect(screen.getByRole('textbox', { name: '关键词 Keyword' })).toHaveClass(
      'erp-control',
    );
    expect(screen.getAllByRole('button', { name: '停用' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建商品 / create_product')).toBeInTheDocument();
  });

  it('renders a formal overview strip with product summary metrics', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
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
                ownerName: 'Zoe',
                salePriceTiers: [
                  { id: 1, minQuantity: 1, salePrice: 15.9, currency: 'USD', status: 'active' },
                  { id: 2, minQuantity: 100, salePrice: 14.5, currency: 'USD', status: 'active' },
                ],
                status: 'active',
                createdAt: '2026-07-11T09:00:00.000Z',
                createdBy: 'system',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }),
    );

    render(
      <>
        {await AppProductsPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByText('产品资料总览')).toBeInTheDocument();
    expect(screen.getByText('当前页商品')).toBeInTheDocument();
    expect(screen.getByText('正式产品')).toBeInTheDocument();
    expect(screen.getByText('阶梯报价')).toBeInTheDocument();
    expect(screen.getByText('已关联供应商')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('passes pagination and filter params to the product api and renders pagination controls', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }

      return Promise.resolve({
          ok: true,
          json: async () => ({
            items: url.includes('page=3')
              ? [
                  {
                    id: 31,
                    sku: 'SKU-031',
                    nameCn: '分页商品-3',
                    nameEn: 'Paged Product 3',
                    category: 'electronics',
                    unit: 'pcs',
                    currency: 'USD',
                    defaultSalePrice: 13.8,
                    defaultPurchasePrice: 9.6,
                    ownerName: 'Zoe',
                    status: 'active',
                    createdAt: '2026-07-11T09:00:00.000Z',
                    createdBy: 'system',
                  },
                ]
              : [
                  {
                    id: 21,
                    sku: 'SKU-021',
                    nameCn: '分页商品',
                    nameEn: 'Paged Product',
                    category: 'electronics',
                    unit: 'pcs',
                    currency: 'USD',
                    defaultSalePrice: 12.8,
                    defaultPurchasePrice: 8.6,
                    ownerName: 'Zoe',
                    status: 'active',
                    createdAt: '2026-07-11T09:00:00.000Z',
                    createdBy: 'system',
                  },
                ],
          total: 41,
          page: url.includes('page=3') ? 3 : 2,
          pageSize: 20,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppProductsPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
            page: '2',
            pageSize: '20',
            productStage: 'formal',
            pricingMode: 'tiered',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/products?productStage=formal&pricingMode=tiered&page=2&pageSize=20'),
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(screen.getByText('第 2 / 3 页，共 41 条')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument();
    expect(screen.getByLabelText('筛选产品阶段 Product Stage Filter')).toHaveValue('formal');
    expect(screen.getByLabelText('筛选定价方式 Pricing Mode Filter')).toHaveValue('tiered');
  });

  it('renders an activate action for inactive products', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 9,
                sku: 'SKU-OFF-009',
                salesCode: 'SALE-OFF-009',
                purchaseCode: 'PUR-OFF-009',
                purchaseCodeMode: 'manual',
                productStage: 'quote_candidate',
                pricingMode: 'fixed',
                brand: '',
                factoryName: '',
                model: '',
                spec: '',
                singleWeight: null,
                cartonSpec: '',
                cartonQuantity: null,
                cartonWeight: null,
                defaultSupplierCode: '',
                nameCn: '停用商品',
                nameEn: 'Inactive Product',
                category: 'electronics',
                unit: 'pcs',
                currency: 'USD',
                defaultSalePrice: 12.8,
                defaultPurchasePrice: 8.6,
                ownerName: 'Zoe',
                salePriceTiers: [],
                status: 'inactive',
                deactivatedReason: '商品停用',
                createdAt: '2026-07-11T09:00:00.000Z',
                createdBy: 'system',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }),
    );

    render(
      <>
        {await AppProductsPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
            status: 'inactive',
          }),
        })}
      </>,
    );

    expect(screen.getByText('停用商品')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '启用' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '转正式产品' })).toBeInTheDocument();
    expect(screen.queryByText('已停用')).not.toBeInTheDocument();
  });

  it('hides deleted products from the default product list view', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                sku: 'SKU-ON-001',
                salesCode: 'SALE-ON-001',
                purchaseCode: 'PUR-ON-001',
                purchaseCodeMode: 'manual',
                productStage: 'formal',
                pricingMode: 'fixed',
                brand: '',
                factoryName: '',
                model: '',
                spec: '',
                singleWeight: null,
                cartonSpec: '',
                cartonQuantity: null,
                cartonWeight: null,
                defaultSupplierCode: '',
                nameCn: '正常商品',
                nameEn: 'Active Product',
                category: 'electronics',
                unit: 'pcs',
                currency: 'USD',
                defaultSalePrice: 12.8,
                defaultPurchasePrice: 8.6,
                ownerName: 'Zoe',
                salePriceTiers: [],
                status: 'active',
                createdAt: '2026-07-11T09:00:00.000Z',
                createdBy: 'system',
              },
              {
                id: 2,
                sku: 'SKU-DEL-002',
                salesCode: 'SALE-DEL-002',
                purchaseCode: 'PUR-DEL-002',
                purchaseCodeMode: 'manual',
                productStage: 'formal',
                pricingMode: 'fixed',
                brand: '',
                factoryName: '',
                model: '',
                spec: '',
                singleWeight: null,
                cartonSpec: '',
                cartonQuantity: null,
                cartonWeight: null,
                defaultSupplierCode: '',
                nameCn: '已删除商品',
                nameEn: 'Deleted Product',
                category: 'electronics',
                unit: 'pcs',
                currency: 'USD',
                defaultSalePrice: 9.9,
                defaultPurchasePrice: 5.6,
                ownerName: 'Zoe',
                salePriceTiers: [],
                status: 'deleted',
                createdAt: '2026-07-11T09:05:00.000Z',
                createdBy: 'system',
              },
            ],
            total: 2,
            page: 1,
            pageSize: 20,
          }),
        });
      }),
    );

    render(
      <>
        {await AppProductsPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByText('正常商品')).toBeInTheDocument();
    expect(screen.queryByText('已删除商品')).not.toBeInTheDocument();
  });

  it('keeps product row editors collapsed by default and expands into grouped sections', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
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
                ownerName: 'Zoe',
                salePriceTiers: [
                  { id: 1, minQuantity: 1, salePrice: 15.9, currency: 'USD', status: 'active' },
                  { id: 2, minQuantity: 100, salePrice: 14.5, currency: 'USD', status: 'active' },
                ],
                status: 'active',
                createdAt: '2026-07-11T09:00:00.000Z',
                createdBy: 'system',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }),
    );

    render(
      <>
        {await AppProductsPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.queryByRole('button', { name: '保存编辑' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));

    expect(screen.getByRole('button', { name: '保存编辑' })).toBeInTheDocument();
    expect(screen.getByText('基础信息 Basic Info')).toBeInTheDocument();
    expect(screen.getByText('包装物流 Packaging & Logistics')).toBeInTheDocument();
    expect(screen.getByText('价格与供应商 Pricing & Supplier')).toBeInTheDocument();
    expect(screen.getByText('阶梯售价 Sale Price Tiers')).toBeInTheDocument();
  });

  it('prefills tiered sale prices when editing a product row', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
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
                ownerName: 'Zoe',
                salePriceTiers: [
                  { id: 1, minQuantity: 1, salePrice: 15.9, currency: 'USD', status: 'active' },
                  { id: 2, minQuantity: 100, salePrice: 14.5, currency: 'USD', status: 'active' },
                ],
                status: 'active',
                createdAt: '2026-07-11T09:00:00.000Z',
                createdBy: 'system',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }),
    );

    render(
      <>
        {await AppProductsPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));

    expect(screen.getByText('阶梯 2 档')).toBeInTheDocument();
    expect(screen.getByLabelText('最小数量 Min Qty 1')).toHaveValue(1);
    expect(screen.getByLabelText('阶梯售价 Tier Price 1')).toHaveValue(15.9);
    expect(screen.getByLabelText('最小数量 Min Qty 2')).toHaveValue(100);
    expect(screen.getByLabelText('阶梯售价 Tier Price 2')).toHaveValue(14.5);
  });

  it('shows sales a read-only product list without purchase or supplier data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      items: [{ id: 1, sku: 'SKU-LED-001', salesCode: 'PD-SUP-LIGHT-001', purchaseCode: 'PUR-LED-001', factoryName: '秘密工厂', defaultSupplierCode: 'SUP-LIGHT', nameCn: '智能 LED 灯带', nameEn: 'Smart LED Strip', category: 'electronics', unit: 'set', currency: 'USD', defaultSalePrice: 15.9, defaultPurchasePrice: 8.5, ownerName: 'Zoe', status: 'active', createdAt: '2026-07-11T09:00:00.000Z', createdBy: 'system' }], total: 1, page: 1, pageSize: 20,
    }) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppProductsPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByText('智能 LED 灯带')).toBeInTheDocument();
    expect(screen.getByText('PD-SUP-LIGHT-001')).toBeInTheDocument();
    expect(screen.queryByText('PUR-LED-001')).not.toBeInTheDocument();
    expect(screen.queryByText('秘密工厂')).not.toBeInTheDocument();
    expect(screen.queryByText('供应商编码 Supplier Code')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新增' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('submits create product payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 9, sku: 'SKU-CAM-009', status: 'active' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CreateProductForm
        endpoint="http://127.0.0.1:3001/api/products"
        createdBy="Admin"
        customFields={[{ id: 3, name: '包装备注', type: 'text' }]}
        codeRule={{
          strategy: 'composed_segments',
          serialLength: 4,
          serialScope: 'per_supplier_month',
          segments: [
            { key: 'prefix', enabled: true, order: 1, value: 'PD' },
            { key: 'supplier_code', enabled: true, order: 2 },
            { key: 'category_code', enabled: true, order: 3 },
            { key: 'year', enabled: true, order: 4 },
            { key: 'month', enabled: true, order: 5 },
            { key: 'serial', enabled: true, order: 6 },
          ],
          updatedAt: '2026-07-16T00:00:00.000Z',
          updatedBy: 'system',
        }}
        actorAccessScopes={{
          modules: ['admin'],
          dataScope: 'all',
          actions: ['master_data.write'],
        }}
      />,
    );

    expect(screen.queryByLabelText('内部编码 Internal Code')).not.toBeInTheDocument();
    expect(screen.getByText('产品编码 Product Code')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: '产品编码模式 Product Code Mode' })).getByRole(
        'button',
        { name: 'generated / 自动生成' },
      ),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('产品编码 Product Code')).toHaveClass('erp-control');
    expect(
      within(screen.getByRole('group', { name: '产品编码模式 Product Code Mode' })).getByRole(
        'button',
        { name: 'generated / 自动生成' },
      ),
    ).toHaveClass('erp-mode-button');
    expect(screen.getByRole('button', { name: '新增商品' })).toHaveClass(
      'erp-button--primary',
    );
    fireEvent.click(
      within(screen.getByRole('group', { name: '产品编码模式 Product Code Mode' })).getByRole(
        'button',
        { name: 'manual / 手工填写' },
      ),
    );
    expect(screen.getByText('产品名称 Product Name')).toBeInTheDocument();
    expect(screen.getByText('分类 Category')).toBeInTheDocument();
    expect(screen.getByText('单位 Unit')).toBeInTheDocument();
    expect(screen.getByText('产品阶段 Product Stage')).toBeInTheDocument();
    expect(screen.getAllByText('*').length).toBeGreaterThanOrEqual(4);
    fireEvent.click(within(screen.getByRole('group', { name: '采购编码模式 Purchase Code Mode' })).getByRole('button', { name: 'generated / 自动生成' }));
    expect(
      within(screen.getByRole('group', { name: '采购编码模式 Purchase Code Mode' })).getByRole(
        'button',
        { name: 'generated / 自动生成' },
      ),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('产品编码 Product Code'), {
      target: { value: 'SALE-CAM-009' },
    });
    fireEvent.click(
      within(screen.getByRole('group', { name: '工厂来源 Factory Source' })).getByRole('button', {
        name: 'supplier / 选择供应商自动带出',
      }),
    );
    expect(screen.getByLabelText('关联供应商 Supplier')).toHaveValue(
      'SUP-BRAVO / 光源制造 / Bravo Industrial',
    );
    expect(
      screen.getByText(
        /自动生成规则：固定前缀 \+ 供应商编码 \+ 分类编码 \+ 年 \+ 月 \+ 4 位流水号，例如 PD-SUP-BRAVO-ELEC-2026-\d{2}-0001。/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('生成前提：已选择供应商，已填写产品分类。')).toBeInTheDocument();
    const currentPeriod = new Date().toISOString().slice(0, 7);
    expect(screen.getByText(`当前示例：PD-SUP-BRAVO-ELEC-${currentPeriod}-0001`)).toBeInTheDocument();
    expect(screen.queryByLabelText('币种 Currency')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('归属人 Owner')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('品牌 Brand'), {
      target: { value: 'OpenAI Vision' },
    });
    expect(screen.getByLabelText('工厂 Factory')).toHaveValue('Bravo Industrial');
    expect(screen.getByLabelText('单位编码 Unit Code')).toHaveValue('SUP-BRAVO');
    fireEvent.change(screen.getByLabelText('型号 Model'), {
      target: { value: 'CAM-009' },
    });
    fireEvent.change(screen.getByLabelText('单个规格 Spec'), {
      target: { value: '4K / HDMI' },
    });
    fireEvent.change(screen.getByLabelText('产品名称 Product Name'), {
      target: { value: '户外摄像头' },
    });
    fireEvent.change(screen.getByLabelText('英文名称 Name EN'), {
      target: { value: 'Outdoor Camera' },
    });
    fireEvent.change(screen.getByLabelText('单位 Unit'), {
      target: { value: 'pcs' },
    });
    fireEvent.change(screen.getByLabelText('产品阶段 Product Stage'), {
      target: { value: 'formal' },
    });
    fireEvent.click(
      within(screen.getByRole('group', { name: '定价方式 Pricing Mode' })).getByRole('button', {
        name: 'fixed / 固定模式',
      }),
    );
    fireEvent.change(screen.getByLabelText('默认销售价 Sale Price'), {
      target: { value: '39.9' },
    });
    fireEvent.change(screen.getByLabelText('默认采购价 Purchase Price'), {
      target: { value: '21.5' },
    });
    fireEvent.change(screen.getByLabelText('包装备注'), { target: { value: '避光保存' } });
    fireEvent.click(screen.getByRole('button', { name: '新增商品' }));

    await waitFor(() => {
      expect(screen.getByText('新增成功，请刷新查看最新商品。')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"sku":"SALE-CAM-009"'),
        headers: expect.objectContaining({
          'x-erp-actions': 'master_data.write',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({
        body: expect.stringContaining('"salesCode":"SALE-CAM-009"'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({
        body: expect.stringContaining('"productStage":"formal"'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({
        body: expect.stringContaining('"ownerName":"Admin"'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({
        body: expect.stringContaining('"currency":"USD"'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3001/api/products', expect.objectContaining({ body: expect.stringContaining('"customValues":{"3":"避光保存"}') }));
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({
        body: expect.stringContaining('"factorySourceMode":"supplier"'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({
        body: expect.stringContaining('"factoryName":"Bravo Industrial"'),
      }),
    );
  });

  it('uses backend generated purchase code when adding the created product locally', async () => {
    const onSuccess = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 31,
        sku: 'SALE-GENERATED-031',
        salesCode: 'SALE-GENERATED-031',
        purchaseCode: 'SUP-BRAVO-001',
        purchaseCodeMode: 'generated',
        productStage: 'formal',
        pricingMode: 'fixed',
        factoryName: 'Bravo Industrial',
        defaultSupplierCode: 'SUP-BRAVO',
        nameCn: '测试商品自动采购编码031',
        nameEn: 'Generated Purchase Code Product',
        category: 'consumables',
        unit: '',
        currency: 'USD',
        defaultSalePrice: 33.33,
        defaultPurchasePrice: 12.34,
        salePriceTiers: [],
        ownerName: 'Admin',
        status: 'active',
        createdAt: '2026-08-09T06:30:00.000Z',
        createdBy: 'Admin',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CreateProductForm
        endpoint="http://127.0.0.1:3001/api/products"
        createdBy="Admin"
        supplierOptions={[{ code: 'SUP-BRAVO', name: 'Bravo Industrial' }]}
        actorAccessScopes={{
          modules: ['admin'],
          dataScope: 'all',
          actions: ['master_data.write'],
        }}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(
      within(screen.getByRole('group', { name: '工厂来源 Factory Source' })).getByRole('button', {
        name: 'supplier / 选择供应商自动带出',
      }),
    );
    expect(
      within(screen.getByRole('group', { name: '产品编码模式 Product Code Mode' })).getByRole(
        'button',
        { name: 'generated / 自动生成' },
      ),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('产品编码 Product Code')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('产品名称 Product Name'), {
      target: { value: '测试商品自动采购编码031' },
    });
    fireEvent.change(screen.getByLabelText('英文名称 Name EN'), {
      target: { value: 'Generated Purchase Code Product' },
    });
    fireEvent.change(screen.getByLabelText('分类 Category'), {
      target: { value: 'consumables' },
    });
    fireEvent.change(screen.getByLabelText('产品阶段 Product Stage'), {
      target: { value: 'formal' },
    });
    fireEvent.change(screen.getByLabelText('默认销售价 Sale Price'), {
      target: { value: '33.33' },
    });
    fireEvent.change(screen.getByLabelText('默认采购价 Purchase Price'), {
      target: { value: '12.34' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新增商品' }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          sku: 'SALE-GENERATED-031',
          purchaseCode: 'SUP-BRAVO-001',
          defaultSupplierCode: 'SUP-BRAVO',
          factoryName: 'Bravo Industrial',
          unit: '',
          defaultPurchasePrice: 12.34,
        }),
      );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({
        body: expect.stringContaining('"salesCodeMode":"generated"'),
      }),
    );
  });

  it('submits tiered sale prices in create product payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 10, sku: 'SKU-TIER-010', status: 'active' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CreateProductForm
        endpoint="http://127.0.0.1:3001/api/products"
        createdBy="Admin"
        actorAccessScopes={{
          modules: ['admin'],
          dataScope: 'all',
          actions: ['master_data.write'],
        }}
      />,
    );

    expect(screen.queryByLabelText('内部编码 Internal Code')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: '采购编码模式 Purchase Code Mode' })).getByRole(
        'button',
        { name: 'manual / 手工填写' },
      ),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(
      within(screen.getByRole('group', { name: '产品编码模式 Product Code Mode' })).getByRole(
        'button',
        { name: 'manual / 手工填写' },
      ),
    );
    fireEvent.change(screen.getByLabelText('产品编码 Product Code'), {
      target: { value: 'SALE-TIER-010' },
    });
    fireEvent.change(screen.getByLabelText('产品名称 Product Name'), {
      target: { value: '阶梯报价商品' },
    });
    fireEvent.change(screen.getByLabelText('英文名称 Name EN'), {
      target: { value: 'Tiered Price Product' },
    });
    fireEvent.change(screen.getByLabelText('单位 Unit'), {
      target: { value: 'pcs' },
    });
    fireEvent.change(screen.getByLabelText('产品阶段 Product Stage'), {
      target: { value: 'formal' },
    });
    fireEvent.click(
      within(screen.getByRole('group', { name: '定价方式 Pricing Mode' })).getByRole('button', {
        name: 'tiered / 阶梯模式',
      }),
    );
    fireEvent.change(screen.getByLabelText('默认销售价 Sale Price'), {
      target: { value: '32.5' },
    });
    fireEvent.change(screen.getByLabelText('默认采购价 Purchase Price'), {
      target: { value: '18.6' },
    });
    fireEvent.change(screen.getByLabelText('最小数量 Min Qty 1'), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText('阶梯售价 Tier Price 1'), {
      target: { value: '30.8' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新增阶梯 Add Tier' }));
    fireEvent.change(screen.getByLabelText('最小数量 Min Qty 2'), {
      target: { value: '1000' },
    });
    fireEvent.change(screen.getByLabelText('阶梯售价 Tier Price 2'), {
      target: { value: '28.2' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新增商品' }));

    await waitFor(() => {
      expect(screen.getByText('新增成功，请刷新查看最新商品。')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({
        body: expect.stringContaining('"sku":"SALE-TIER-010"'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({
        body: expect.stringContaining('"pricingMode":"tiered"'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/products',
      expect.objectContaining({
        body: expect.stringContaining(
          '"salePriceTiers":[{"minQuantity":100,"salePrice":30.8,"currency":"USD"},{"minQuantity":1000,"salePrice":28.2,"currency":"USD"}]',
        ),
      }),
    );
  });

  it('blocks generated purchase code submission until supplier or unit code is provided', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CreateProductForm
        endpoint="http://127.0.0.1:3001/api/products"
        createdBy="Admin"
        actorAccessScopes={{
          modules: ['admin'],
          dataScope: 'all',
          actions: ['master_data.write'],
        }}
      />,
    );

    fireEvent.click(within(screen.getByRole('group', { name: '采购编码模式 Purchase Code Mode' })).getByRole('button', { name: 'generated / 自动生成' }));

    fireEvent.click(
      within(screen.getByRole('group', { name: '产品编码模式 Product Code Mode' })).getByRole(
        'button',
        { name: 'manual / 手工填写' },
      ),
    );
    fireEvent.change(screen.getByLabelText('产品编码 Product Code'), {
      target: { value: 'SALE-NO-PRICE-001' },
    });
    fireEvent.change(screen.getByLabelText('产品名称 Product Name'), {
      target: { value: '测试商品无报价1' },
    });
    fireEvent.change(screen.getByLabelText('单位 Unit'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('产品阶段 Product Stage'), {
      target: { value: 'formal' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新增商品' }));

    expect(
      screen.getByText('自动生成采购编码需要单位编码。请选择供应商自动带出，或切换为手工填写采购编码。'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('inserts the created product into the current list without manual refresh', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/products/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }
      if (url.includes('/products/code-rule')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            strategy: 'composed_segments',
            serialLength: 4,
            serialScope: 'per_supplier_month',
            segments: [
              { key: 'prefix', enabled: true, order: 1, value: 'PD' },
              { key: 'supplier_code', enabled: true, order: 2 },
              { key: 'category_code', enabled: true, order: 3 },
              { key: 'year', enabled: true, order: 4 },
              { key: 'month', enabled: true, order: 5 },
              { key: 'serial', enabled: true, order: 6 },
            ],
            updatedAt: '2026-07-16T00:00:00.000Z',
            updatedBy: 'system',
          }),
        });
      }
      if (url.includes('/counterparties?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [{ code: 'SUP-BRAVO', name: 'Bravo Industrial' }],
            total: 1,
            page: 1,
            pageSize: 200,
          }),
        });
      }
      if (url.includes('/products') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 9,
            sku: 'SALE-CAM-009',
            nameCn: '户外摄像头',
            status: 'active',
            createdAt: '2026-07-18T09:10:00.000Z',
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 1,
              sku: 'SKU-LED-001',
              salesCode: 'SALE-LED-001',
              purchaseCode: 'PUR-LED-001',
              purchaseCodeMode: 'manual',
              productStage: 'formal',
              pricingMode: 'fixed',
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
              ownerName: 'Zoe',
              salePriceTiers: [],
              status: 'active',
              createdAt: '2026-07-11T09:00:00.000Z',
              createdBy: 'system',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppProductsPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: '新增' }));

    fireEvent.click(
      within(screen.getByRole('group', { name: '采购编码模式 Purchase Code Mode' })).getByRole(
        'button',
        { name: 'manual / 手工填写' },
      ),
    );
    fireEvent.click(
      within(screen.getByRole('group', { name: '产品编码模式 Product Code Mode' })).getByRole(
        'button',
        { name: 'manual / 手工填写' },
      ),
    );
    fireEvent.change(screen.getByLabelText('产品编码 Product Code'), {
      target: { value: 'SALE-CAM-009' },
    });
    fireEvent.change(screen.getByLabelText('产品名称 Product Name'), {
      target: { value: '户外摄像头' },
    });
    fireEvent.change(screen.getByLabelText('英文名称 Name EN'), {
      target: { value: 'Outdoor Camera' },
    });
    fireEvent.change(screen.getByLabelText('单位 Unit'), {
      target: { value: 'pcs' },
    });
    fireEvent.change(screen.getByLabelText('产品阶段 Product Stage'), {
      target: { value: 'formal' },
    });
    fireEvent.change(screen.getByLabelText('默认销售价 Sale Price'), {
      target: { value: '39.9' },
    });
    fireEvent.change(screen.getByLabelText('默认采购价 Purchase Price'), {
      target: { value: '21.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新增商品' }));

    await waitFor(() => {
      expect(screen.getByText('户外摄像头')).toBeInTheDocument();
      expect(screen.getByText('SALE-CAM-009')).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog', { name: '新增产品' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('产品“户外摄像头”新增成功');
    expect(screen.queryByText('新增成功，请刷新查看最新商品。')).not.toBeInTheDocument();
  });

  it('renders a delete action for active products', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                sku: 'SKU-LED-001',
                salesCode: 'SALE-LED-001',
                purchaseCode: 'PUR-LED-001',
                purchaseCodeMode: 'manual',
                productStage: 'formal',
                pricingMode: 'fixed',
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
                ownerName: 'Zoe',
                salePriceTiers: [],
                status: 'active',
                createdAt: '2026-07-11T09:00:00.000Z',
                createdBy: 'system',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }),
    );

    render(
      <>
        {await AppProductsPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument();
  });

  it('removes the row locally after a delete action succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 1,
          sku: 'SKU-LED-001',
          salesCode: 'SALE-LED-001',
          purchaseCode: 'PUR-LED-001',
          purchaseCodeMode: 'manual',
          productStage: 'formal',
          pricingMode: 'fixed',
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
          ownerName: 'Zoe',
          salePriceTiers: [],
          status: 'deleted',
          createdAt: '2026-07-11T09:00:00.000Z',
          createdBy: 'system',
          deactivatedReason: '删除商品',
        }),
      }),
    );

    render(
      <table>
        <tbody>
          <ProductTableRow
            item={{
              id: 1,
              sku: 'SKU-LED-001',
              salesCode: 'SALE-LED-001',
              purchaseCode: 'PUR-LED-001',
              purchaseCodeMode: 'manual',
              productStage: 'formal',
              pricingMode: 'fixed',
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
              ownerName: 'Zoe',
              salePriceTiers: [],
              status: 'active',
              createdAt: '2026-07-11T09:00:00.000Z',
              createdBy: 'system',
            }}
            canManageMasterData
            updatedBy="Admin"
            supplierOptions={[{ code: 'SUP-LIGHT', name: '深圳光源制造有限公司' }]}
            requestHeaders={{ 'x-erp-role': 'admin', 'x-erp-user': 'Admin' }}
            apiBaseUrl="http://127.0.0.1:3001/api"
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('智能 LED 灯带')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(screen.queryByText('智能 LED 灯带')).not.toBeInTheDocument();
    });
  });
});
