import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SamplePage from '../app/app/sales/samples/[id]/page';
vi.mock('../app/app/_components/live-todo-count', () => ({ LiveTodoCount: () => null }));
afterEach(() => vi.unstubAllGlobals());
const sample = { id: 501, sampleNo: 'SAMPLE-501', currentVersionNo: 1, currentStatus: 'sample_sent', sourceQuoteOrderId: 77, sourceQuoteVersionNo: 2 };
function mockSource(value: unknown, ok = true) {
 const fetchMock = vi.fn(async (input: unknown) => ({ ok: String(input).endsWith('/quotes/77') ? ok : true, json: async () => String(input).endsWith('/quotes/77') ? value : String(input).endsWith('/samples/501') ? sample : { items: [], total: 0, modules: [] } }));
 vi.stubGlobal('fetch', fetchMock); return fetchMock;
}
async function show(modules = ['sales']) {
 render(await SamplePage({ params: Promise.resolve({ id: '501' }), searchParams: Promise.resolve({ role: modules.includes('sales') ? 'sales' : 'purchase', user: 'Zoe', access: JSON.stringify({ modules, dataScope: 'all', actions: [] }) }) }));
}
describe('样品来源单号', () => {
 it('shows the actual quote number and keeps the confirmed version', async () => {
  mockSource({ id: 77, quoteNo: 'Q-ACTUAL-77' }); await show();
  expect(screen.getByRole('link', { name: 'Q-ACTUAL-77' })).toHaveAttribute('href', '/app/sales/quotes/77');
  expect(screen.getByText('报价版本：V2')).toBeInTheDocument();
  expect(screen.queryByText('报价单 ID：77')).not.toBeInTheDocument();
 });
 it('does not read or link a source outside sales access', async () => {
  const fetchMock = mockSource({ id: 77, quoteNo: 'Q-SECRET' }); await show(['purchase']);
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/quotes/77'))).toBe(false);
  expect(screen.queryByRole('link', { name: /Q-SECRET|77/ })).not.toBeInTheDocument();
  expect(screen.getByText('报价单 #77（无查看权限）')).toBeInTheDocument();
 });
 it.each([['failed', null, false], ['mismatched', { id: 78, quoteNo: 'Q-WRONG' }, true]] as const)('makes %s source loading explicit without inventing a number', async (_name, value, ok) => {
  mockSource(value, ok); await show();
  expect(screen.getByRole('link', { name: '单号暂不可用 #77' })).toHaveAttribute('href', '/app/sales/quotes/77');
  expect(screen.queryByText('Q-WRONG')).not.toBeInTheDocument();
 });
});
