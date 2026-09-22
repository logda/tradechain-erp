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

import { QuoteCustomerFeedbackForm } from '../app/app/sales/quotes/[id]/quote-customer-feedback-form';

describe('QuoteCustomerFeedbackForm', () => {
  beforeEach(() => {
    refreshMock.mockClear();
    submitFormalJsonMutationActionMock.mockReset();
  });

  it('records a price issue against the current version and starts repricing', async () => {
    submitFormalJsonMutationActionMock.mockResolvedValue({ ok: true, result: {} });

    render(
      <QuoteCustomerFeedbackForm
        endpoint="http://127.0.0.1:3001/api/quotes/9/customer-feedback"
        currentVersionNo={3}
        requestHeaders={{ 'x-erp-role': 'sales', 'x-erp-user': 'Zoe' }}
      />,
    );

    fireEvent.click(screen.getByLabelText('价格有问题'));
    fireEvent.change(screen.getByLabelText('客户反馈备注'), {
      target: { value: '客户希望降价 5%' },
    });
    expect(screen.getByLabelText('客户反馈备注')).toHaveClass('erp-control');
    expect(screen.getByRole('button', { name: '保存客户反馈' })).toHaveClass(
      'erp-button--primary',
    );
    fireEvent.click(screen.getByRole('button', { name: '保存客户反馈' }));

    await waitFor(() => {
      expect(submitFormalJsonMutationActionMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/quotes/9/customer-feedback',
        'POST',
        {
          currentVersionNo: 3,
          result: 'price_issue',
          remark: '客户希望降价 5%',
        },
        { 'x-erp-role': 'sales', 'x-erp-user': 'Zoe' },
      );
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });
});
