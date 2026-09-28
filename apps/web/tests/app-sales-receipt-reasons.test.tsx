import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMutationPayload } from '../app/app/_lib/mutation-action';
import AppSalesOrderDetailPage from '../app/app/sales/orders/[id]/page';

const mutation = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true, result: { receiptStatus: 'deposit_received' } }));
vi.mock('../app/app/_actions/formal-mutation-action', () => ({ submitFormalMutationAction: mutation }));
const access = JSON.stringify({ modules: ['sales'], dataScope: 'all', actions: ['sales.order.write', 'finance.confirm'] });
const base = {
  id: 104, salesNo: 'S104', status: 'partial_shipped', currentVersionNo: 1,
  purchaseAggregateStatus: 'purchasing', shipmentAggregateStatus: 'partial_shipped',
  receiptStatus: 'unpaid', financeStatus: 'pending', salesUserId: 2001, createdBy: 2001,
  title: 'Test sale', customerName: 'Customer', items: [], versionHistory: [], linkedPurchaseOrders: [],
};
async function show(overrides: Record<string, unknown> = {}, impact: unknown = { canCancel: true, hasShipmentBatches: false, purchaseOrders: [{ id: 301, purchaseNo: 'P301', status: 'purchasing' }] }) {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes('/cancellation-impact')) return { ok: impact !== null, json: async () => impact };
    if (url.includes('/cost-warning')) return { ok: true, json: async () => ({ productNames: [] }) };
    return { ok: true, json: async () => ({ ...base, ...overrides }) };
  }));
  render(await AppSalesOrderDetailPage({ params: Promise.resolve({ id: '104' }), searchParams: Promise.resolve({ role: 'boss', user: 'Mia', userId: '2000', access }) }));
}

describe('sales receipt and real operation reasons', () => {
  beforeEach(() => { vi.unstubAllGlobals(); mutation.mockClear(); });
  it('requires an explicit receipt choice and submits the selected deposit without promoting it to full payment', async () => {
    await show();
    const select = screen.getByRole('combobox', { name: /本次登记收款状态/ });
    expect(select).toHaveValue('');
    expect(select).toBeRequired();
    fireEvent.change(select, { target: { value: 'deposit_received' } });
    const button = screen.getByRole('button', { name: '登记收款' });
    fireEvent.submit(button.closest('form')!);
    await waitFor(() => expect(mutation).toHaveBeenCalled());
    const form = mutation.mock.calls[0][2];
    expect(form).toBeInstanceOf(FormData);
    expect(buildMutationPayload(form, mutation.mock.calls[0][1])).toEqual({ receiptStatus: 'deposit_received' });
    expect(screen.queryByRole('button', { name: '财务复核' })).not.toBeInTheDocument();
    expect(screen.getByText('收款已登记：已收定金')).toBeInTheDocument();
  });
  it('finance review sends no receipt override', async () => {
    await show({ receiptStatus: 'deposit_received' });
    const button = screen.getByRole('button', { name: '财务复核' });
    const form = button.closest('form')!;
    expect(within(form).queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.submit(form);
    await waitFor(() => expect(mutation).toHaveBeenCalled());
    expect(buildMutationPayload(mutation.mock.calls[0][2], mutation.mock.calls[0][1])).toEqual({});
  });
  it('requires a supervisor modification request before rejection', async () => {
    await show({ status: 'pending_sales_manager_approval' });
    const input = screen.getByRole('textbox', { name: /驳回修改要求/ });
    expect(input).toBeRequired(); expect(input).toHaveValue('');
  });
  it('shows the saved modification request to the sales user', async () => {
    await show({ status: 'partial_shipped', rejectionReason: '请核对单价和交期' });
    expect(screen.getByText('请核对单价和交期')).toBeInTheDocument();
  });
  it('requires a real cancellation reason and shows actual affected purchase numbers before confirmation', async () => {
    await show({ status: 'purchasing', shipmentAggregateStatus: 'not_started' });
    expect(screen.getByRole('textbox', { name: /作废原因/ })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /作废原因/ })).toBeRequired();
    const button = screen.getByRole('button', { name: '作废销售单' });
    fireEvent.change(screen.getByRole('textbox', { name: /作废原因/ }), { target: { value: '规格更改，客户要求撤销' } });
    fireEvent.submit(button.closest('form')!);
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('P301');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('已发货后不可作废');
  });
  it('disables cancellation when the real linked-document preview fails to load', async () => {
    await show({ status: 'purchasing', shipmentAggregateStatus: 'not_started' }, null);
    expect(screen.queryByRole('button', { name: '作废销售单' })).not.toBeInTheDocument();
    expect(screen.getByText(/作废关联检查暂不可用/)).toBeInTheDocument();
  });
  it('does not offer cancellation when the real linked-document check finds a shipment', async () => {
    await show({ status: 'purchasing', shipmentAggregateStatus: 'not_started' }, { canCancel: false, hasShipmentBatches: true, purchaseOrders: [] });
    expect(screen.queryByRole('button', { name: '作废销售单' })).not.toBeInTheDocument();
    expect(screen.getByText(/已发货后不可作废/)).toBeInTheDocument();
  });
});
