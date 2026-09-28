import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OrdersPage from '../app/app/sales/orders/page';
import QuotesPage from '../app/app/sales/quotes/page';
import InquiriesPage from '../app/app/sales/inquiries/page';
import SamplesPage from '../app/app/sales/samples/page';
import PurchasePage from '../app/app/purchase-orders/page';
import ShipmentPage from '../app/app/shipment-batches/page';
import AfterSalesPage from '../app/app/after-sales/page';

vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
afterEach(() => vi.unstubAllGlobals());
const pages = [
  ['销售单', OrdersPage], ['需求和报价', QuotesPage], ['询价单', InquiriesPage],
  ['样品单', SamplesPage], ['采购单', PurchasePage], ['发货批次', ShipmentPage], ['售后单', AfterSalesPage],
] as const;

describe('正式业务列表请求状态', () => {
  it.each(pages)('%s HTTP failure does not show preview rows or successful zero metrics', async (label, Page) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => url === '/api/formal-todos/count' ? { ok: true, json: async () => ({ count: 0 }) } : { ok: false }));
    render(<>{await Page({})}</>);
    expect(screen.getByText(`${label}列表暂不可用，请重试。`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `重试${label}列表` })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '查询结果' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('summary-strip')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 00')).toBeInTheDocument());
  });

  it.each(pages)('%s network failure is retryable', async (label, Page) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<>{await Page({})}</>);
    expect(screen.getByRole('button', { name: `重试${label}列表` })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 暂不可用')).toBeInTheDocument());
  });

  it.each(pages)('%s genuinely empty response still shows a successful zero result', async (_, Page) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 1, pageSize: 20, count: 0 }) }));
    render(<>{await Page({})}</>);
    expect(within(screen.getByRole('region', { name: '查询结果' })).getByText('共 0 条')).toBeInTheDocument();
    expect(screen.getByLabelText('summary-strip')).toBeInTheDocument();
    expect(screen.queryByText(/列表暂不可用/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 00')).toBeInTheDocument());
  });
});
