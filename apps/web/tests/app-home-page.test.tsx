import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppHomePage from '../app/app/page';

describe('AppHomePage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the formal home shell, entry cards, and live todo summary', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'quote-Q-RUNTIME-001',
            docNo: 'Q-RUNTIME-001',
            title: 'Runtime quote todo',
            domain: 'sales',
            moduleLabel: '报价',
            statusLabel: '待老板确认',
            ownerName: 'Zoe',
            href: '/app/sales/quotes/77',
            priority: 'high',
            description: 'Runtime API generated todo',
          },
          {
            id: 'purchase-P-RUNTIME-001',
            docNo: 'P-RUNTIME-001',
            title: 'Runtime purchase todo',
            domain: 'purchase',
            moduleLabel: '采购单',
            statusLabel: '待采购主管审批',
            ownerName: 'Leo',
            href: '/app/purchase-orders/99',
            priority: 'high',
            description: 'Runtime API generated purchase todo',
          },
          {
            id: 'after-sales-AS-RUNTIME-001',
            docNo: 'AS-RUNTIME-001',
            title: 'Runtime after-sales todo',
            domain: 'after_sales',
            moduleLabel: '售后',
            statusLabel: '财务复核中',
            ownerName: 'Leo',
            href: '/app/after-sales/55',
            priority: 'medium',
            description: 'Runtime API generated after-sales todo',
          },
        ],
        total: 3,
        closedTotal: 1,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<>{await AppHomePage({})}</>);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/todos/formal?role=boss&user=Mia',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );
    expect(
      screen.getByRole('heading', { name: 'ERP 正式工作台' }),
    ).toBeInTheDocument();
    expect(screen.getByText('正式工作台')).toBeInTheDocument();
    expect(screen.getByText('消息待办 Todo: 03')).toBeInTheDocument();
    expect(screen.getByText('首页待办摘要')).toBeInTheDocument();
    expect(screen.getAllByText('销售待办').length).toBeGreaterThan(0);
    expect(screen.getByText('采购运营待办')).toBeInTheDocument();
    expect(screen.getByText('已自动收口')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '登录页' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '销售工作台' })).toHaveAttribute(
      'href',
      '/app/sales',
    );
    expect(
      screen.getAllByRole('link', { name: '主数据中心' }).some((link) =>
        link.getAttribute('href') === '/app/master-data',
      ),
    ).toBe(true);
    const sidebarNav = screen.getByRole('navigation', { name: 'formal-app-nav' });
    expect(
      within(sidebarNav).getByRole('link', { name: '主数据中心' }),
    ).toHaveAttribute('href', expect.stringContaining('/app/master-data?role=boss&user=Mia'));
    expect(
      within(sidebarNav).queryByRole('link', { name: '往来单位主数据' }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebarNav).queryByRole('link', { name: '商品 / SKU 主数据' }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebarNav).queryByRole('link', { name: '正式报价单' }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebarNav).queryByRole('link', { name: '正式询价单' }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebarNav).queryByRole('link', { name: '正式销售单' }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebarNav).queryByRole('link', { name: '正式样品单' }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebarNav).queryByRole('link', { name: '正式采购单' }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebarNav).queryByRole('link', { name: '正式发货批次' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '老板看板' })).toHaveAttribute(
      'href',
      '/app/dashboard/boss',
    );
    expect(
      screen.getAllByRole('link', { name: '财务中心' }).some((link) =>
        link.getAttribute('href') === '/app/finance',
      ),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: '报表中心' }).some((link) =>
        link.getAttribute('href') === '/app/reports',
      ),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: '日志中心' }).some((link) =>
        link.getAttribute('href') === '/app/logs',
      ),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: '正式待办中心' }).some((link) =>
        link.getAttribute('href') === '/app/todos',
      ),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: '全链路验收中心' }).some((link) =>
        link.getAttribute('href') === '/app/mvp',
      ),
    ).toBe(true);
    expect(screen.getByRole('link', { name: '采购工作台' })).toHaveAttribute(
      'href',
      '/app/purchase',
    );
    expect(screen.getByRole('link', { name: '运营工作台' })).toHaveAttribute(
      'href',
      '/app/operations',
    );
    expect(
      screen.getAllByRole('link', { name: '正式发货批次' }).some((link) =>
        link.getAttribute('href') === '/app/shipment-batches',
      ),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: '正式售后单' }).some((link) =>
        link.getAttribute('href') === '/app/after-sales',
      ),
    ).toBe(true);
    expect(
      screen.queryByRole('link', { name: '返回演示页' }),
    ).not.toBeInTheDocument();
  });

  it('hides restricted worktiles for sales users', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        closedTotal: 0,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppHomePage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/todos/formal?role=sales&user=Zoe',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'sales',
          'x-erp-user': 'Zoe',
        }),
      }),
    );
    expect(screen.getByRole('link', { name: '销售工作台' })).toHaveAttribute(
      'href',
      '/app/sales',
    );
    expect(
      screen.queryByRole('link', { name: '用户管理' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '商品 / SKU 主数据' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '采购工作台' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '运营工作台' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '财务中心' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '日志中心' }),
    ).not.toBeInTheDocument();
  });
});
