import { render, screen } from '@testing-library/react';
import ShipmentBatchesPage from '../app/shipment-batches/page';

describe('ShipmentBatchesPage', () => {
  it('renders the shipment batch advanced filter form and default results', async () => {
    render(<>{await ShipmentBatchesPage({ searchParams: Promise.resolve({}) })}</>);

    expect(
      screen.getByRole('heading', { name: '发货履约中心' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('支持分批发货、货代推进和回单发送留痕'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('当前展示：发货高级筛选、结果摘要与回单状态预览'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('关键词')).toBeInTheDocument();
    expect(screen.getByLabelText('单号')).toBeInTheDocument();
    expect(screen.getByLabelText('状态')).toBeInTheDocument();
    expect(screen.getByText('高级筛选')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重置' })).toHaveAttribute(
      'href',
      '/shipment-batches',
    );
    expect(screen.getByText('SH202607080001')).toBeInTheDocument();
    expect(screen.getByText('SH202607080002')).toBeInTheDocument();
  });

  it('expands advanced filters and narrows results from search params', async () => {
    const { container } = render(
      <>
        {await ShipmentBatchesPage({
          searchParams: Promise.resolve({
            supplierName: 'Acme',
            receiptSendStatus: 'sent',
            hasException: 'yes',
            purchaseOrderNo: 'P202607080001',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).toBe(true);
    expect(screen.getByText('receiptSendStatus: sent')).toBeInTheDocument();
    expect(screen.getByText('hasException: yes')).toBeInTheDocument();
    expect(screen.getByText('SH202607080001')).toBeInTheDocument();
    expect(screen.queryByText('SH202607080002')).not.toBeInTheDocument();
  });

  it('treats invalid tri-state params as all instead of filtering them out', async () => {
    const { container } = render(
      <>
        {await ShipmentBatchesPage({
          searchParams: Promise.resolve({
            hasException: 'bogus',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).not.toBe(true);
    expect(screen.queryByText('hasException: bogus')).not.toBeInTheDocument();
    expect(screen.getByText('SH202607080001')).toBeInTheDocument();
    expect(screen.getByText('SH202607080002')).toBeInTheDocument();
    expect(screen.getByText('SH202607080003')).toBeInTheDocument();
  });
});
