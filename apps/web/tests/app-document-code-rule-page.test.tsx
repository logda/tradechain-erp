import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('AppDocumentCodeRulePage', () => {
  it('renders the document code rule center with both rule panels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          demandNoRule: {
            strategy: 'composed_segments',
            serialLength: 4,
            serialScope: 'global_day',
            segments: [
              { key: 'prefix', enabled: true, order: 1, value: 'XQ' },
              { key: 'year', enabled: true, order: 2 },
              { key: 'month', enabled: true, order: 3 },
              { key: 'day', enabled: true, order: 4 },
              { key: 'serial', enabled: true, order: 5 },
            ],
            updatedAt: '2026-08-08T00:00:00.000Z',
            updatedBy: 'Admin',
          },
          quoteNoRule: {
            strategy: 'composed_segments',
            serialLength: 4,
            serialScope: 'global_day',
            segments: [
              { key: 'prefix', enabled: true, order: 1, value: 'BJ' },
              { key: 'year', enabled: true, order: 2 },
              { key: 'month', enabled: true, order: 3 },
              { key: 'day', enabled: true, order: 4 },
              { key: 'serial', enabled: true, order: 5 },
            ],
            updatedAt: '2026-08-08T00:00:00.000Z',
            updatedBy: 'Admin',
          },
          customerOrderNoRule: {
            strategy: 'composed_segments',
            serialLength: 4,
            serialScope: 'global_day',
            segments: [
              { key: 'prefix', enabled: true, order: 1, value: 'PO' },
              { key: 'year', enabled: true, order: 2 },
              { key: 'month', enabled: true, order: 3 },
              { key: 'day', enabled: true, order: 4 },
              { key: 'serial', enabled: true, order: 5 },
            ],
            updatedAt: '2026-08-08T00:00:00.000Z',
            updatedBy: 'Admin',
          },
        }),
      }),
    );

    const { default: AppDocumentCodeRulePage } = await import(
      '../app/app/master-data/document-code-rule/page'
    );

    render(
      <>
        {await AppDocumentCodeRulePage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '单据编号规则' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '返回主数据中心' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '需求单号规则' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '报价单号规则' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '客户订单号规则' })).not.toBeInTheDocument();
  });
});
