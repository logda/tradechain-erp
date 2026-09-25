import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PurchaseAssignmentsPage from '../app/app/purchase-orders/assignments/page';

describe('stage 09 purchase assignment page', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('shows pending sales and purchaser choices to a purchase manager', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve({
        ok: true,
        json: async () => String(input).includes('owner-options')
          ? [{ id: 2002, realName: 'Leo', status: 'active' }]
          : [{ id: 901, salesNo: 'S2609250901', title: 'New order', customerName: 'Customer' }],
      }),
    ));
    const access = JSON.stringify({
      modules: ['purchase'], dataScope: 'purchase_team', actions: ['purchase.order.approve'],
    });
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve({
      role: 'purchase_manager', user: 'Manager', access,
    }) })}</>);
    expect(screen.getByText('S2609250901')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Leo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '指定并生成采购单' })).toBeInTheDocument();
  });

  it('does not load pending assignments for sales managers', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve({
      role: 'sales_manager', user: 'Sales Manager',
    }) })}</>);
    expect(screen.getByText('当前角色无权分配采购负责人。')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps a sourced purchaser fixed if purchase creation needs a retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => Promise.resolve({
      ok: true,
      json: async () => String(input).includes('owner-options')
        ? [
          { id: 2002, realName: 'Leo', status: 'active' },
          { id: 2003, realName: 'Nina', status: 'active' },
        ]
        : [{ id: 901, salesNo: 'S2609250901', title: 'New order', customerName: 'Customer', purchaseOwnerName: 'Leo' }],
    })));
    const access = JSON.stringify({
      modules: ['purchase'], dataScope: 'purchase_team', actions: ['purchase.order.approve'],
    });
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve({
      role: 'purchase_manager', user: 'Manager', access,
    }) })}</>);
    expect(screen.getByRole('option', { name: 'Leo' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Nina' })).not.toBeInTheDocument();
  });
});
