import { render, screen } from '@testing-library/react';
import PurchaseOrdersPage from '../app/purchase-orders/page';

describe('PurchaseOrdersPage', () => {
  it('renders the purchase order advanced filter form and default results', async () => {
    render(<>{await PurchaseOrdersPage({ searchParams: Promise.resolve({}) })}</>);

    expect(
      screen.getByRole('heading', { name: '采购执行中心' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('按供应商拆单，并保留销售来源追溯'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('当前展示：采购高级筛选、结果摘要与履约状态预览'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('关键词')).toBeInTheDocument();
    expect(screen.getByLabelText('单号')).toBeInTheDocument();
    expect(screen.getByLabelText('状态')).toBeInTheDocument();
    expect(screen.getByText('高级筛选')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重置' })).toHaveAttribute(
      'href',
      '/purchase-orders',
    );
    expect(screen.getByText('P202607080001')).toBeInTheDocument();
    expect(screen.getByText('P202607080002')).toBeInTheDocument();
  });

  it('expands advanced filters and narrows results from search params', async () => {
    const { container } = render(
      <>
        {await PurchaseOrdersPage({
          searchParams: Promise.resolve({
            keyword: 'Acme',
            approvalStatus: 'purchasing',
            isResubmitted: 'yes',
            ownerName: 'Zoe',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).toBe(true);
    expect(screen.getByText('approvalStatus: purchasing')).toBeInTheDocument();
    expect(screen.getByText('isResubmitted: yes')).toBeInTheDocument();
    expect(screen.getByText('P202607080001')).toBeInTheDocument();
    expect(screen.queryByText('P202607080002')).not.toBeInTheDocument();
  });

  it('treats invalid tri-state params as all instead of filtering them out', async () => {
    const { container } = render(
      <>
        {await PurchaseOrdersPage({
          searchParams: Promise.resolve({
            isResubmitted: 'bogus',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).not.toBe(true);
    expect(screen.queryByText('isResubmitted: bogus')).not.toBeInTheDocument();
    expect(screen.getByText('P202607080001')).toBeInTheDocument();
    expect(screen.getByText('P202607080002')).toBeInTheDocument();
    expect(screen.getByText('P202607080003')).toBeInTheDocument();
  });
});
