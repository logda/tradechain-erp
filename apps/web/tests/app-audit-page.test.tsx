import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('AppAuditPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a formal audit center from the unified audit API', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/api/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            modules: [
              { key: 'quotes', label: '报价 Quote', count: 1, failed: false },
              { key: 'sales-orders', label: '销售单 Sales Order', count: 1, failed: false },
            ],
            items: [
              {
                id: 2,
                moduleKey: 'sales-orders',
                moduleLabel: '销售单 Sales Order',
                bizType: 'sales_order',
                bizId: 201,
                operationType: 'finance_confirm',
                operatorId: 9000,
                operatorName: 'Mia',
                beforeData: { financeStatus: 'pending' },
                afterData: { financeStatus: 'confirmed' },
                createdAt: '2026-07-12T11:00:00.000Z',
              },
              {
                id: 1,
                moduleKey: 'quotes',
                moduleLabel: '报价 Quote',
                bizType: 'quote',
                bizId: 101,
                operationType: 'submit',
                operatorId: 2001,
                beforeData: { status: 'draft' },
                afterData: { status: 'pending_boss_confirmation' },
                createdAt: '2026-07-12T10:00:00.000Z',
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: false,
        json: async () => ({ items: [] }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppAuditPage } = await import('../app/app/audit/page');

    render(<>{await AppAuditPage({ searchParams: Promise.resolve({ role: 'admin', user: 'Admin' }) })}</>);

    expect(screen.getByRole('heading', { name: '正式日志中心' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回正式首页' })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(screen.getByText('统一审计 API 已接入，可按板块筛选并追溯最新操作日志。')).toBeInTheDocument();
    expect(screen.getByText('聚合模块')).toBeInTheDocument();
    expect(screen.getByText('审计总数')).toBeInTheDocument();
    expect(screen.getByText('当前筛选')).toBeInTheDocument();
    expect(screen.getByText('加载异常模块')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '全部模块 All (2)' })).toHaveAttribute(
      'href',
      '/app/logs',
    );
    expect(screen.getByRole('link', { name: '销售单 Sales Order (1)' })).toHaveAttribute(
      'href',
      '/app/logs?module=sales-orders',
    );
    expect(screen.getAllByText('报价 Quote').length).toBeGreaterThan(0);
    expect(screen.getAllByText('销售单 Sales Order').length).toBeGreaterThan(0);
    expect(screen.getByText('Submit / submit')).toBeInTheDocument();
    expect(screen.getByText('财务确认 / finance_confirm')).toBeInTheDocument();
    expect(screen.getByText('Mia #9000')).toBeInTheDocument();
    expect(screen.getByText('需求单 / 报价单 #101')).toBeInTheDocument();
    expect(screen.getByText('销售单 #201')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/audit-logs',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
          'x-erp-actions': expect.stringContaining('audit.view'),
        }),
      }),
    );
  });

  it('falls back to per-module aggregation when the unified audit API is unavailable', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/api/audit-logs')) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ items: [] }),
        });
      }

      if (url.includes('/quotes/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                bizType: 'quote',
                bizId: 101,
                operationType: 'submit',
                operatorId: 2001,
                beforeData: { status: 'draft' },
                afterData: { status: 'pending_boss_confirmation' },
                createdAt: '2026-07-12T10:00:00.000Z',
              },
            ],
          }),
        });
      }

      if (url.includes('/sales-orders/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 2,
                bizType: 'sales_order',
                bizId: 201,
                operationType: 'finance_confirm',
                operatorId: 9000,
                beforeData: { financeStatus: 'pending' },
                afterData: { financeStatus: 'confirmed' },
                createdAt: '2026-07-12T11:00:00.000Z',
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ items: [] }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppAuditPage } = await import('../app/app/audit/page');

    render(<>{await AppAuditPage({ searchParams: Promise.resolve({ role: 'admin', user: 'Admin' }) })}</>);

    expect(screen.getByRole('heading', { name: '正式日志中心' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回正式首页' })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(screen.getByText('聚合模块')).toBeInTheDocument();
    expect(screen.getByText('审计总数')).toBeInTheDocument();
    expect(screen.getByText('加载异常模块')).toBeInTheDocument();
    expect(screen.getAllByText('报价 Quote').length).toBeGreaterThan(0);
    expect(screen.getAllByText('销售单 Sales Order').length).toBeGreaterThan(0);
    expect(screen.getByText('Submit / submit')).toBeInTheDocument();
    expect(screen.getByText('财务确认 / finance_confirm')).toBeInTheDocument();
    expect(screen.getByText('需求单 / 报价单 #101')).toBeInTheDocument();
    expect(screen.getByText('销售单 #201')).toBeInTheDocument();
    expect(screen.getByText('统一审计 API 暂不可用，页面已降级为前端聚合各模块日志接口。')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/audit-logs',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes/audit-logs',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
        }),
      }),
    );
  });

  it('filters unified logs by selected module', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        modules: [
          { key: 'quotes', label: '报价 Quote', count: 1, failed: false },
          { key: 'sales-orders', label: '销售单 Sales Order', count: 1, failed: false },
        ],
        items: [
          {
            id: 2,
            moduleKey: 'sales-orders',
            moduleLabel: '销售单 Sales Order',
            bizType: 'sales_order',
            bizId: 201,
            operationType: 'finance_confirm',
            operatorId: 2,
            beforeData: { financeStatus: 'pending' },
            afterData: { financeStatus: 'confirmed' },
            createdAt: '2026-07-12T11:00:00.000Z',
          },
          {
            id: 1,
            moduleKey: 'quotes',
            moduleLabel: '报价 Quote',
            bizType: 'quote',
            bizId: 101,
            operationType: 'submit',
            operatorId: 3,
            beforeData: { status: 'draft' },
            afterData: { status: 'pending_boss_confirmation' },
            createdAt: '2026-07-12T10:00:00.000Z',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppAuditPage } = await import('../app/app/audit/page');

    render(
      <>
        {await AppAuditPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
            module: 'sales-orders',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '销售单 Sales Order最新日志' })).toBeInTheDocument();
    expect(screen.getByText('销售单 #201')).toBeInTheDocument();
    expect(screen.queryByText('报价单 #101')).not.toBeInTheDocument();
  });

  it('blocks sales users from opening the global audit center before loading logs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppAuditPage } = await import('../app/app/audit/page');

    render(
      <>
        {await AppAuditPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByText('无权限访问正式日志中心')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows dynamic sessions with the audit.view action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppAuditPage } = await import('../app/app/audit/page');

    render(
      <>
        {await AppAuditPage({
          searchParams: Promise.resolve({
            role: 'sales_manager',
            user: 'Mia',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['sales'],
                dataScope: 'all',
                actions: ['audit.view'],
              }),
            ),
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式日志中心' })).toBeInTheDocument();
    expect(screen.queryByText('无权限访问正式日志中心')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/audit-logs',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-erp-actions': 'audit.view',
        }),
      }),
    );
  });
});
