import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FormEvent } from 'react';
import {
  REDIRECT_ERROR_CODE,
  RedirectType,
} from 'next/dist/client/components/redirect-error';
import { vi } from 'vitest';
import {
  buildCreateQuotePayload,
  createQuoteAction,
} from '../app/quotes/new/actions';
import { CreateQuoteForm } from '../app/quotes/new/create-quote-form';
import NewQuotePage from '../app/quotes/new/page';

vi.mock('../app/quotes/new/actions', async () => {
  const actual = await vi.importActual<typeof import('../app/quotes/new/actions')>(
    '../app/quotes/new/actions',
  );

  return {
    ...actual,
    createQuoteAction: vi.fn(actual.createQuoteAction),
  };
});

describe('NewQuotePage', () => {
  it('shows required quote form fields', () => {
    render(<NewQuotePage />);

    expect(screen.getByLabelText('Customer ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Sales User ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Source Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Requirements')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Quote' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/.+/)).toHaveLength(4);
  });

  it('normalizes the quote creation form payload', async () => {
    const formData = new FormData();
    formData.set('customerId', '1001');
    formData.set('salesUserId', '2001');
    formData.set('sourceCode', 'expo');
    formData.set('requirements', 'Need 500 units');

    await expect(buildCreateQuotePayload(formData)).resolves.toEqual({
      submitMode: 'draft',
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
    });
  });

  it('locks submission and surfaces returned errors', async () => {
    const actionMock = vi.mocked(createQuoteAction);
    let resolveAction: ((value: { error: string | null }) => void) | undefined;
    actionMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(<CreateQuoteForm />);

    fireEvent.change(screen.getByLabelText('Customer ID'), {
      target: { value: '1001' },
    });
    fireEvent.change(screen.getByLabelText('Sales User ID'), {
      target: { value: '2001' },
    });
    fireEvent.change(screen.getByLabelText('Source Code'), {
      target: { value: 'expo' },
    });
    fireEvent.change(screen.getByLabelText('Requirements'), {
      target: { value: 'Need 500 units' },
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Submit Quote' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Submitting...' }).closest('form')!);
    expect(actionMock).toHaveBeenCalledTimes(1);

    resolveAction?.({ error: '创建报价失败' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('创建报价失败');
      expect(screen.getByRole('button', { name: 'Submit Quote' })).not.toBeDisabled();
    });
  });

  it('does not swallow redirect errors from a successful submission', async () => {
    const actionMock = vi.mocked(createQuoteAction);
    const redirectError = new Error('NEXT_REDIRECT') as Error & {
      digest: string;
    };
    redirectError.digest = [
      REDIRECT_ERROR_CODE,
      RedirectType.push,
      '/quotes/101',
      '303',
      '',
    ].join(';');

    actionMock.mockRejectedValueOnce(redirectError);

    render(<CreateQuoteForm />);

    fireEvent.change(screen.getByLabelText('Customer ID'), {
      target: { value: '1001' },
    });
    fireEvent.change(screen.getByLabelText('Sales User ID'), {
      target: { value: '2001' },
    });
    fireEvent.change(screen.getByLabelText('Source Code'), {
      target: { value: 'expo' },
    });
    fireEvent.change(screen.getByLabelText('Requirements'), {
      target: { value: 'Need 500 units' },
    });

    const form = screen.getByRole('button', { name: 'Submit Quote' }).closest('form');
    expect(form).not.toBeNull();

    const reactPropsKey = Object.keys(form!).find((key) =>
      key.startsWith('__reactProps$'),
    );
    expect(reactPropsKey).toBeDefined();

    const onSubmit = (
      form as HTMLFormElement & {
        [key: string]: { onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> };
      }
    )[reactPropsKey!].onSubmit;

    let thrownError: unknown;
    await act(async () => {
      try {
        await onSubmit({
          preventDefault() {},
          currentTarget: form!,
        } as FormEvent<HTMLFormElement>);
      } catch (error) {
        thrownError = error;
      }
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit Quote' })).not.toBeDisabled();
    });

    expect(thrownError).toBe(redirectError);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
