import { render, screen } from '@testing-library/react';
import SamplesPage from '../app/samples/page';

describe('SamplesPage', () => {
  it('renders the sample advanced filter form and default results', async () => {
    render(<>{await SamplesPage({ searchParams: Promise.resolve({}) })}</>);

    expect(
      screen.getByRole('heading', { name: '样品管理中心' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('支持依附确认报价版本的样品申请、替代版本和取消留痕'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('当前展示：样品高级筛选、结果摘要与替代/取消状态预览'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('关键词')).toBeInTheDocument();
    expect(screen.getByLabelText('单号')).toBeInTheDocument();
    expect(screen.getByLabelText('状态')).toBeInTheDocument();
    expect(screen.getByText('高级筛选')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重置' })).toHaveAttribute(
      'href',
      '/samples',
    );
    expect(screen.getByText('SP202607080001')).toBeInTheDocument();
    expect(screen.getByText('SP202607080002')).toBeInTheDocument();
  });

  it('expands advanced filters and narrows results from search params', async () => {
    const { container } = render(
      <>
        {await SamplesPage({
          searchParams: Promise.resolve({
            customerName: 'Acme',
            ownerName: 'Zoe',
            quoteNo: 'Q202607080001',
            isReplacement: 'no',
            isCancelled: 'no',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).toBe(true);
    expect(screen.getByText('quoteNo: Q202607080001')).toBeInTheDocument();
    expect(screen.getByText('isReplacement: no')).toBeInTheDocument();
    expect(screen.getByText('isCancelled: no')).toBeInTheDocument();
    expect(screen.getByText('SP202607080001')).toBeInTheDocument();
    expect(screen.queryByText('SP202607080002')).not.toBeInTheDocument();
  });

  it('treats invalid tri-state params as all instead of filtering them out', async () => {
    const { container } = render(
      <>
        {await SamplesPage({
          searchParams: Promise.resolve({
            isReplacement: 'bogus',
            isCancelled: 'bogus',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).not.toBe(true);
    expect(screen.queryByText('isReplacement: bogus')).not.toBeInTheDocument();
    expect(screen.queryByText('isCancelled: bogus')).not.toBeInTheDocument();
    expect(screen.getByText('SP202607080001')).toBeInTheDocument();
    expect(screen.getByText('SP202607080002')).toBeInTheDocument();
    expect(screen.getByText('SP202607080003')).toBeInTheDocument();
  });
});
