import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { refreshMock, submitFormalJsonMutationActionMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  submitFormalJsonMutationActionMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock('../app/app/_actions/formal-mutation-action', () => ({
  submitFormalJsonMutationAction: (...args: unknown[]) =>
    submitFormalJsonMutationActionMock(...args),
}));

import { InquiryBossConfirmForm } from '../app/app/sales/inquiries/[id]/inquiry-boss-confirm-form';

describe('InquiryBossConfirmForm', () => {
  beforeEach(() => {
    refreshMock.mockClear();
    submitFormalJsonMutationActionMock.mockReset();
  });

  it('submits final sale prices entered by the boss', async () => {
    submitFormalJsonMutationActionMock.mockResolvedValue({
      ok: true,
      result: {
        id: 2,
        status: 'boss_confirmed',
      },
    });

    render(
      <InquiryBossConfirmForm
        endpoint="http://127.0.0.1:3001/api/quote-inquiries/2/boss-confirm"
        label="老板确认"
        requestHeaders={{
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }}
        quoteNo="Q202607080002"
        quoteVersionNo={2}
        customerName="Bravo Retail"
        items={[
          {
            itemId: 11,
            lineNo: 1,
            sku: 'SKU-PLUG-001',
            productName: '多孔插座',
            requiredSupplierCount: 2,
            supplierQuotes: [
              {
                supplierSourceMode: 'counterparty',
                supplierId: 2,
                supplierCode: 'SUP-BRAVO',
                supplierName: 'Bravo Industrial',
                purchasePrice: 19.6,
              },
              {
                supplierSourceMode: 'manual',
                supplierName: '东莞优联工厂',
                purchasePrice: 20.1,
              },
            ],
            confirmedSalePrice: 19.6,
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: '老板确认' })).toBeInTheDocument();
    expect(screen.getByText('报价单 Q202607080002')).toBeInTheDocument();
    expect(screen.getByText('客户：博瑞零售 / Bravo Retail')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('行 1 最终售价'), {
      target: { value: '28.8' },
    });
    fireEvent.click(screen.getByRole('button', { name: '老板确认' }));

    await waitFor(() => {
      expect(submitFormalJsonMutationActionMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/quote-inquiries/2/boss-confirm',
        'POST',
        {
          items: [
        {
          itemId: 11,
          supplierQuoteCount: 2,
          confirmedSalePrice: 28.8,
          selectedSupplierQuoteIndex: 0,
        },
      ],
        },
        {
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        },
      );
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('disables boss confirmation when there are no inquiry items', () => {
    render(
      <InquiryBossConfirmForm
        endpoint="http://127.0.0.1:3001/api/quote-inquiries/2/boss-confirm"
        label="老板确认"
        quoteNo="Q202607080002"
        quoteVersionNo={2}
        customerName="Bravo Retail"
        items={[]}
      />,
    );

    expect(
      screen.getByText('询价单没有可确认的明细，请先确认供应商比价明细。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '老板确认' })).toBeDisabled();
  });
});
