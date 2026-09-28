import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductMasterDataClient } from '../app/app/master-data/products/product-master-data-client';
import { CreateProductForm } from '../app/app/master-data/products/create-product-form';
import { defaultProductCodeRuleSet } from '../app/app/master-data/products/product-code-rule';

const item = {
  id: 1, sku: 'SKU-1', salesCode: 'SALE-1', purchaseCode: 'PUR-1', nameCn: '灯带', nameEn: 'LED strip',
  category: 'electronics' as const, unit: 'set', currency: 'USD', defaultSalePrice: 15.9,
  defaultPurchasePrice: 8.5, factoryName: '秘密工厂', defaultSupplierCode: 'SUP-1', brand: 'Starlight',
  model: 'SL-1', spec: '5m', singleWeight: 0.85, cartonSpec: '20 pcs / carton', cartonQuantity: 20,
  cartonWeight: 18.5, productStage: 'formal' as const, pricingMode: 'tiered' as const,
  salePriceTiers: [{ id: 1, minQuantity: 100, salePrice: 14.5, currency: 'USD', status: 'active' as const }],
  ownerName: 'Admin', status: 'active' as const, createdAt: '2026-09-28T00:00:00.000Z', createdBy: 'Admin',
};

function library({ salesView = false, total = 1, keyword = '' } = {}) {
  return <ProductMasterDataClient initialItems={[item]} initialTotal={total}
    initialQuery={{ keyword, page: 1, pageSize: 20 }} canManageMasterData={!salesView}
    canConfigureFields={!salesView} salesView={salesView} updatedBy="Admin"
    codeRule={defaultProductCodeRuleSet.purchase} salesCodeRule={defaultProductCodeRuleSet.sales}
    supplierOptions={[]} requestHeaders={{ 'x-erp-user-id': '1', 'x-erp-role': salesView ? 'sales' : 'admin', 'x-erp-data-scope': 'all' }}
    apiBaseUrl="/api" />;
}

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('产品库优先显示查找与记录', () => {
  it('keeps keyword search and create outside folded filters and settings', () => {
    render(library());
    expect(screen.getByLabelText('关键词 Keyword').closest('details')).toBeNull();
    expect(screen.getByRole('button', { name: '新增' }).closest('details')).toBeNull();
    const settings = screen.getByText('产品设置').closest('details');
    expect(settings).not.toHaveAttribute('open');
    expect(settings).toContainElement(screen.getByText('产品编码规则设置'));
    expect(settings).toContainElement(screen.getByText('自定义字段管理'));
    expect(screen.queryByRole('heading', { name: '当前页统计' })).not.toBeInTheDocument();
    expect(screen.getByText('当前页商品')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
  });

  it('folds packaging and full tier prices while keeping edit and other actions together', () => {
    render(library());
    expect(screen.queryByText('20 pcs / carton')).not.toBeInTheDocument();
    expect(screen.queryByText('>=100: 14.5')).not.toBeInTheDocument();
    const actions = screen.getByRole('button', { name: '编辑' }).closest('td');
    expect(actions).toContainElement(screen.getByRole('button', { name: '查看资料' }));
    expect(actions).toContainElement(screen.getByText('更多操作'));
    expect(screen.getByText('更多操作').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: '查看资料' }));
    expect(screen.getByText('20 pcs / carton')).toBeInTheDocument();
    expect(screen.getByText('>=100: 14.5')).toBeInTheDocument();
    expect(screen.getByText('秘密工厂')).toBeInTheDocument();
    expect(screen.getByText('SUP-1')).toBeInTheDocument();
    expect(screen.getByText('8.5 USD')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收起资料' }));
    expect(screen.queryByText('20 pcs / carton')).not.toBeInTheDocument();
  });

  it('keeps supplier, purchase cost and mutations hidden in sales details', () => {
    render(library({ salesView: true }));
    fireEvent.click(screen.getByRole('button', { name: '查看资料' }));
    expect(screen.getByText('20 pcs / carton')).toBeInTheDocument();
    expect(screen.getByText('>=100: 14.5')).toBeInTheDocument();
    expect(screen.queryByText('PUR-1')).not.toBeInTheDocument();
    expect(screen.queryByText('秘密工厂')).not.toBeInTheDocument();
    expect(screen.queryByText('SUP-1')).not.toBeInTheDocument();
    expect(screen.queryByText('8.5 USD')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
    expect(screen.queryByText('更多操作')).not.toBeInTheDocument();
    expect(screen.queryByText('产品设置')).not.toBeInTheDocument();
  });

  it('retains the total but hides page controls for a single page', () => {
    render(library());
    expect(screen.getByText('第 1 / 1 页，共 1 条')).toBeInTheDocument();
    expect(screen.queryByText('上一页')).not.toBeInTheDocument();
    expect(screen.queryByText('下一页')).not.toBeInTheDocument();
  });

  it('summarizes the applied keyword and clears filters without applying pending edits', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [item], total: 1, page: 1, pageSize: 20 }) }));
    render(library({ keyword: 'LED' }));
    const filters = screen.getByLabelText('筛选商品').parentElement!;
    expect(within(filters).getByText('已选：关键词：LED')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('关键词 Keyword'), { target: { value: '未应用' } });
    expect(within(filters).getByText('已选：关键词：LED')).toBeInTheDocument();
    expect(within(filters).queryByText('已选：关键词：未应用')).not.toBeInTheDocument();
    fireEvent.click(within(filters).getByRole('button', { name: '清除筛选' }));
    await waitFor(() => expect(screen.getByLabelText('关键词 Keyword')).toHaveValue(''));
    expect(fetch).toHaveBeenCalledWith('/api/products?page=1&pageSize=20', expect.anything());
    await waitFor(() => expect(within(filters).queryByText('已选：关键词：LED')).not.toBeInTheDocument());
  });

  it('folds create packaging and tiers without discarding their submitted values', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...item, id: 2 }) });
    vi.stubGlobal('fetch', fetch);
    render(<CreateProductForm endpoint="/api/products" createdBy="Admin" />);
    const packaging = screen.getByLabelText('装箱规格 Carton Spec').closest('details');
    expect(packaging).not.toBeNull();
    expect(packaging).not.toHaveAttribute('open');
    expect(screen.getByLabelText('默认销售价 Sale Price').closest('details')).toBeNull();
    fireEvent.click(screen.getByText('包装与重量'));
    fireEvent.change(screen.getByLabelText('产品名称 Product Name'), { target: { value: '折叠包装商品' } });
    fireEvent.change(screen.getByLabelText('产品阶段 Product Stage'), { target: { value: 'formal' } });
    fireEvent.change(screen.getByLabelText('装箱规格 Carton Spec'), { target: { value: '20 pcs / carton' } });
    fireEvent.change(screen.getByLabelText('装箱数量 Carton Qty'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('包装与重量'));
    expect(packaging).not.toHaveAttribute('open');
    fireEvent.click(within(screen.getByRole('group', { name: '定价方式 Pricing Mode' })).getByRole('button', { name: 'tiered / 阶梯模式' }));
    const tiers = screen.getByLabelText('阶梯售价 Tier Price 1').closest('details');
    expect(tiers).not.toBeNull();
    expect(tiers).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('阶梯售价', { exact: true }));
    fireEvent.change(screen.getByLabelText('最小数量 Min Qty 1'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('阶梯售价 Tier Price 1'), { target: { value: '14.5' } });
    fireEvent.click(screen.getByText('阶梯售价', { exact: true }));
    expect(tiers).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: '新增商品' }));
    await screen.findByText('新增成功，请刷新查看最新商品。');
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload).toMatchObject({ cartonSpec: '20 pcs / carton', cartonQuantity: 20, pricingMode: 'tiered', salePriceTiers: [{ minQuantity: 100, salePrice: 14.5, currency: 'USD' }] });
  });
});
