import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppProductCodeRulePage from '../app/app/master-data/product-code-rule/page';

describe('AppProductCodeRulePage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-01T00:00:00.000Z'));
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the product code rule page for admin users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          strategy: 'composed_segments',
          serialLength: 4,
          serialScope: 'per_supplier_month',
          segments: [
            { key: 'prefix', enabled: true, order: 1, value: 'PD' },
            { key: 'supplier_code', enabled: true, order: 2 },
            { key: 'category_code', enabled: true, order: 3 },
            { key: 'year', enabled: true, order: 4 },
            { key: 'month', enabled: true, order: 5 },
            { key: 'serial', enabled: true, order: 6 },
          ],
          updatedAt: '2026-07-16T08:00:00.000Z',
          updatedBy: 'Admin',
        }),
      }),
    );

    render(
      <>
        {await AppProductCodeRulePage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '产品编码规则' })).toBeInTheDocument();
    expect(
      screen.getByText('固定前缀 + 供应商编码 + 分类编码 + 年 + 月 + 4 位流水号，例如 PD-SUP-BRAVO-ELEC-2026-08-0001'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '采购编码规则' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '产品编码生成规则' })).toBeInTheDocument();
    expect(screen.getByText('采购编码规则段配置')).toBeInTheDocument();
    expect(screen.getByText('产品编码规则段配置')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存采购编码规则' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存产品编码规则' })).toBeInTheDocument();
    expect(screen.getAllByText('生成前提与提示')).toHaveLength(2);
    expect(screen.getAllByText('供应商编码')).toHaveLength(2);
  });

  it('updates the current-rule summary locally after saving the rule', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (init?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            strategy: 'composed_segments',
            serialLength: 5,
            serialScope: 'global_year',
            segments: [
              { key: 'prefix', enabled: true, order: 1, value: 'PD' },
              { key: 'category_code', enabled: true, order: 2 },
              { key: 'year', enabled: true, order: 3 },
              { key: 'serial', enabled: true, order: 4 },
            ],
            updatedAt: '2026-07-18T10:30:00.000Z',
            updatedBy: 'Admin',
          }),
        });
      }

      if (url.endsWith('/products/code-rules')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            strategy: 'composed_segments',
            serialLength: 4,
            serialScope: 'per_supplier_month',
            segments: [
              { key: 'prefix', enabled: true, order: 1, value: 'PD' },
              { key: 'supplier_code', enabled: true, order: 2 },
              { key: 'category_code', enabled: true, order: 3 },
              { key: 'year', enabled: true, order: 4 },
              { key: 'month', enabled: true, order: 5 },
              { key: 'serial', enabled: true, order: 6 },
            ],
            updatedAt: '2026-07-16T08:00:00.000Z',
            updatedBy: 'Admin',
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppProductCodeRulePage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(
      screen.getByText('固定前缀 + 供应商编码 + 分类编码 + 年 + 月 + 4 位流水号，例如 PD-SUP-BRAVO-ELEC-2026-08-0001'),
    ).toBeInTheDocument();
    expect(screen.getByText('最近更新：2026-07-16T08:00:00.000Z / Admin')).toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText('供应商编码')[0]);
    fireEvent.click(screen.getAllByLabelText('月')[0]);
    fireEvent.change(screen.getAllByLabelText('流水位数')[0], {
      target: { value: '5' },
    });
    fireEvent.change(screen.getAllByLabelText('流水范围')[0], {
      target: { value: 'global_year' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存采购编码规则' }));

    await waitFor(() => {
      expect(screen.getByText('采购编码规则已保存')).toBeInTheDocument();
      expect(
        screen.getByText('固定前缀 + 分类编码 + 年 + 5 位流水号，例如 PD-ELEC-2026-00001'),
      ).toBeInTheDocument();
      expect(screen.getByText('最近更新：2026-07-18T10:30:00.000Z / Admin')).toBeInTheDocument();
    });
  });
});
