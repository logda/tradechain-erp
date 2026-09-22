import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppOperationsPage from '../app/app/operations/page';

describe('AppOperationsPage', () => {
  it('renders operations workbench cards and quick actions', async () => {
    render(<>{await AppOperationsPage({})}</>);

    expect(
      screen.getByRole('heading', { name: '运营工作台' }),
    ).toBeInTheDocument();
    expect(screen.getByText('发货待办')).toBeInTheDocument();
    expect(screen.getByText('售后待办')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '发货批次模块' })).toHaveAttribute(
      'href',
      '/app/shipment-batches',
    );
    expect(screen.getByRole('link', { name: '售后模块' })).toHaveAttribute(
      'href',
      '/app/after-sales',
    );
    expect(
      screen.getAllByRole('link', { name: '库存中心' }).some((link) =>
        link.getAttribute('href') === '/app/inventory',
      ),
    ).toBe(true);
    expect(screen.getByRole('link', { name: '新建发货批次' })).toHaveAttribute(
      'href',
      '/app/shipment-batches/new',
    );
    expect(screen.getByRole('link', { name: '待发送回单' })).toHaveAttribute(
      'href',
      '/app/shipment-batches?receiptSendStatus=pending',
    );
    expect(screen.getByRole('link', { name: '新建售后单' })).toHaveAttribute(
      'href',
      '/app/after-sales/new',
    );
  });

  it('blocks sales-only users from the operations workbench', async () => {
    render(
      <>
        {await AppOperationsPage({
          searchParams: Promise.resolve({ role: 'sales', user: 'Zoe' }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '运营工作台' }),
    ).toBeInTheDocument();
    expect(screen.getByText('无权限访问运营工作台')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '发货批次模块' }),
    ).not.toBeInTheDocument();
  });

  it('hides write buttons for module-only operations access', async () => {
    render(
      <>
        {await AppOperationsPage({
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['purchase', 'operations'],
                dataScope: 'purchase_team',
              }),
            ),
          }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '运营工作台' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '新建发货批次' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '新建售后单' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看库存余额' })).toHaveAttribute(
      'href',
      '/app/inventory',
    );
    expect(screen.getByRole('link', { name: '待发送回单' })).toHaveAttribute(
      'href',
      '/app/shipment-batches?receiptSendStatus=pending',
    );
  });
});
