import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { refreshMock, submitFormalJsonMutationActionMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  submitFormalJsonMutationActionMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('../app/app/_actions/formal-mutation-action', () => ({
  submitFormalJsonMutationAction: (...args: unknown[]) =>
    submitFormalJsonMutationActionMock(...args),
}));

import { QuotePriceConfirmForm } from '../app/app/sales/quotes/[id]/quote-price-confirm-form';

describe('QuotePriceConfirmForm', () => {
  beforeEach(() => {
    refreshMock.mockClear();
    submitFormalJsonMutationActionMock.mockReset();
  });

  it('submits one confirmed sale price for every quote line', async () => {
    submitFormalJsonMutationActionMock.mockResolvedValue({ ok: true, result: {} });

    render(
      <QuotePriceConfirmForm
        endpoint="http://127.0.0.1:3001/api/quotes/9/confirm-price"
        currentVersionNo={2}
        requestHeaders={{ 'x-erp-role': 'boss', 'x-erp-user': 'Mia' }}
        items={[
          { lineNo: 1, productName: '产品 A', salePrice: 12 },
          { lineNo: 2, productName: '产品 B', salePrice: 18.5 },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText('行 1 最终售价'), { target: { value: '13.8' } });
    expect(screen.getByLabelText('行 1 最终售价')).toHaveClass('erp-control');
    fireEvent.change(screen.getByLabelText('行 2 最终售价'), { target: { value: '20' } });
    expect(screen.getByRole('button', { name: '确认最终售价' })).toHaveClass(
      'erp-button--primary',
    );
    fireEvent.click(screen.getByRole('button', { name: '确认最终售价' }));

    await waitFor(() => {
      expect(submitFormalJsonMutationActionMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/quotes/9/confirm-price',
        'POST',
        {
          currentVersionNo: 2,
          items: [
            { lineNo: 1, confirmedSalePrice: 13.8 },
            { lineNo: 2, confirmedSalePrice: 20 },
          ],
        },
        { 'x-erp-role': 'boss', 'x-erp-user': 'Mia' },
        expect.any(String),
      );
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });
});
