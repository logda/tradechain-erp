import { render, screen } from '@testing-library/react';
import AfterSalesPage from '../app/after-sales/page';

describe('AfterSalesPage', () => {
  it('renders the after-sales advanced filter form and default results', async () => {
    render(<>{await AfterSalesPage({ searchParams: Promise.resolve({}) })}</>);

    expect(
      screen.getByRole('heading', { name: '售后与财务中心' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('支持售后闭环、收款状态维护和关单前财务确认'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('当前展示：售后高级筛选、结果摘要与财务闭环预览'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('关键词')).toBeInTheDocument();
    expect(screen.getByLabelText('单号')).toBeInTheDocument();
    expect(screen.getByLabelText('状态')).toBeInTheDocument();
    expect(screen.getByText('高级筛选')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重置' })).toHaveAttribute(
      'href',
      '/after-sales',
    );
    expect(screen.getByText('AS202607080001')).toBeInTheDocument();
    expect(screen.getByText('AS202607080002')).toBeInTheDocument();
  });

  it('expands advanced filters and narrows results from search params', async () => {
    const { container } = render(
      <>
        {await AfterSalesPage({
          searchParams: Promise.resolve({
            customerName: 'Acme',
            type: 'refund',
            financeReviewStatus: 'confirmed',
            shipmentBatchNo: 'SB202607080001',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).toBe(true);
    expect(screen.getByText('type: refund')).toBeInTheDocument();
    expect(screen.getByText('financeReviewStatus: confirmed')).toBeInTheDocument();
    expect(screen.getByText('AS202607080001')).toBeInTheDocument();
    expect(screen.queryByText('AS202607080002')).not.toBeInTheDocument();
  });

  it('treats invalid type params as empty instead of applying a fake filter', async () => {
    const { container } = render(
      <>
        {await AfterSalesPage({
          searchParams: Promise.resolve({
            type: 'bogus',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).not.toBe(true);
    expect(screen.queryByText('type: bogus')).not.toBeInTheDocument();
    expect(screen.getByText('AS202607080001')).toBeInTheDocument();
    expect(screen.getByText('AS202607080002')).toBeInTheDocument();
    expect(screen.getByText('AS202607080003')).toBeInTheDocument();
  });
});
