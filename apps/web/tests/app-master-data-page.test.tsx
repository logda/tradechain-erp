import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppMasterDataPage from '../app/app/master-data/page';

describe('AppMasterDataPage', () => {
  it('renders the master data hub and quick actions', async () => {
    render(<>{await AppMasterDataPage({})}</>);

    expect(
      screen.getByRole('heading', { name: '主数据中心' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '往来单位' })).toHaveAttribute(
      'href',
      '/app/master-data/counterparties',
    );
    expect(
      screen.getByRole('link', { name: '查看往来单位' }),
    ).toHaveAttribute('href', '/app/master-data/counterparties');
  });

  it('shows product access for admin users', async () => {
    render(
      <>
        {await AppMasterDataPage({
          searchParams: Promise.resolve({ role: 'admin', user: 'Admin' }),
        })}
      </>,
    );

    expect(
      screen.getByRole('link', { name: '商品 / SKU' }),
    ).toHaveAttribute('href', '/app/master-data/products');
    expect(
      screen.getByRole('link', { name: '查看商品 / SKU' }),
    ).toHaveAttribute('href', '/app/master-data/products');
    expect(
      screen.getByRole('link', { name: '产品编码规则' }),
    ).toHaveAttribute('href', '/app/master-data/product-code-rule');
    expect(
      screen.getByRole('link', { name: '单据编号规则' }),
    ).toHaveAttribute('href', '/app/master-data/document-code-rule');
    expect(
      screen.getByRole('link', { name: '报价来源字典' }),
    ).toHaveAttribute('href', '/app/master-data/quote-source');
  });
});
