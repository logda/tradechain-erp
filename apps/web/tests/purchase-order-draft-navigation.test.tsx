import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PurchaseOrderDraftForm } from '../app/app/purchase-orders/[id]/purchase-order-draft-form';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => { vi.unstubAllGlobals(); refresh.mockReset(); });

describe('采购草稿保存导航状态', () => {
  it('disables draft edits and the separate submit action during save, then enables them after failure', async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise((resolve) => { finish = resolve; })));
    render(<PurchaseOrderDraftForm endpoint="http://127.0.0.1:3001/api/purchase-orders/1/draft"
      currentStatus="draft" currentOwnerName="Leo" currentSupplierId={0} currentSupplierName="供应商A"
      supplierOptions={[]} items={[{ lineNo: 1, sku: 'A', productName: '产品A', unitPrice: 10 }]}
      submitAction={<button type="button">提交审批</button>}
      requestHeaders={{ 'x-erp-role': 'purchase', 'x-erp-user': 'Leo' }} />);
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(screen.getByLabelText('手动供应商名称 Manual Supplier')).toBeDisabled();
    expect(screen.getByRole('button', { name: '从往来单位选择' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '提交审批' })).toBeDisabled();
    await waitFor(() => expect(typeof finish).toBe('function'));
    finish({ ok: false, status: 503, json: async () => ({ message: '保存失败' }) });
    await waitFor(() => expect(screen.getByLabelText('手动供应商名称 Manual Supplier')).toBeEnabled());
    expect(screen.getByRole('button', { name: '提交审批' })).toBeEnabled();
  });

  it('keeps edits after failure and clears dirty before refresh after success', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ message: '暂时无法保存' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) }));
    const mounted = render(<PurchaseOrderDraftForm endpoint="http://127.0.0.1:3001/api/purchase-orders/1/draft"
      currentStatus="draft" currentOwnerName="Leo" currentSupplierId={0} currentSupplierName="供应商A"
      supplierOptions={[]} items={[{ lineNo: 1, sku: 'A', productName: '产品A', unitPrice: 10 }]}
      requestHeaders={{ 'x-erp-role': 'purchase', 'x-erp-user': 'Leo' }} />);
    const form = mounted.container.querySelector('form')!;
    fireEvent.input(screen.getByLabelText('手动供应商名称 Manual Supplier'), { target: { value: '供应商B' } });
    expect(form.dataset.saveState).toBe('waiting');
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(form.dataset.saveState).toBe('error'));
    refresh.mockImplementationOnce(() => expect(form.dataset.saveState).toBe('saved'));
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(form.dataset.saveState).toBe('saved'));
    fireEvent.click(screen.getByRole('button', { name: '从往来单位选择' }));
    expect(form.dataset.saveState).toBe('waiting');
  });
});
