import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AppPurchaseOrderDetailPage from '../app/app/purchase-orders/[id]/page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setupFetch() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    const data = url.endsWith('/purchase-orders/502')
      ? {
          id: 502, purchaseNo: 'C502', status: 'pending_purchase_claim',
          currentVersionNo: 1, sourceSalesOrderId: 901, salesOrderNo: 'S901',
          ownerName: 'Leo', needsPurchaseAssignment: true, items: [],
        }
      : url.endsWith('/purchase-orders/owner-options')
        ? [
            { id: 2002, realName: 'Leo', username: 'leo', roleCode: 'purchase', status: 'active' },
            { id: 2003, realName: 'Nina', username: 'nina', roleCode: 'purchase', status: 'active' },
          ]
        : { items: [], total: 0 };
    return Promise.resolve({ ok: true, json: async () => data });
  }));
}

it('requires an explicit manager assignment on an existing direct purchase order before claim', async () => {
  setupFetch();
  const managerAccess = JSON.stringify({
    modules: ['purchase'], dataScope: 'purchase_team', actions: ['purchase.order.approve'],
  });
  render(<>{await AppPurchaseOrderDetailPage({
    params: Promise.resolve({ id: '502' }),
    searchParams: Promise.resolve({ role: 'purchase_manager', user: 'Mia', access: managerAccess }),
  })}</>);
  expect(screen.getByRole('button', { name: '分配采购负责人' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /采购负责人/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '认领并提交采购审批' })).not.toBeInTheDocument();
  cleanup();

  const purchaserAccess = JSON.stringify({
    modules: ['purchase'], dataScope: 'own', actions: ['purchase.order.submit'],
  });
  render(<>{await AppPurchaseOrderDetailPage({
    params: Promise.resolve({ id: '502' }),
    searchParams: Promise.resolve({ role: 'purchase', user: 'Leo', access: purchaserAccess }),
  })}</>);
  expect(screen.queryByRole('button', { name: '分配采购负责人' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '认领并提交采购审批' })).not.toBeInTheDocument();
  expect(screen.getByText('待采购主管分配采购负责人')).toBeInTheDocument();
});
