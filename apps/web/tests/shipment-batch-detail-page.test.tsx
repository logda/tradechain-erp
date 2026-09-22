import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShipmentBatchDetailPage from '../app/shipment-batches/[id]/page';

describe('ShipmentBatchDetailPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the shipment batch detail with stock out trace information', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          batchNo: 'SH202607080101',
          status: 'forwarder_shipped',
          receiptSendStatus: 'sent',
          salesOrderId: 88,
          purchaseOrderId: 21,
          stockOutStatus: 'confirmed',
          stockOutDocNo: 'SO202607080101',
          receiptDocUrl: 'https://files.example.com/receipt-101.pdf',
          items: [
            {
              lineNo: 1,
              purchaseLineNo: 1,
              sourceSalesItemId: 1,
              productId: 501,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              shippedQty: 40,
              purchaseQty: 500,
            },
          ],
        }),
      }),
    );

    render(
      <>
        {await ShipmentBatchDetailPage({
          params: Promise.resolve({ id: '101' }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '发货批次 SH202607080101' }),
    ).toBeInTheDocument();
    expect(screen.getByText('出库汇总：confirmed')).toBeInTheDocument();
    expect(screen.getByText('出库单号：SO202607080101')).toBeInTheDocument();
    expect(screen.getByText('SKU-LED-001')).toBeInTheDocument();
    expect(screen.getByText('智能 LED 灯带')).toBeInTheDocument();
    expect(screen.getByText('https://files.example.com/receipt-101.pdf')).toBeInTheDocument();
  });
});
