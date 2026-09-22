import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REDIRECT_ERROR_CODE,
  RedirectType,
} from 'next/dist/client/components/redirect-error';
import {
  buildCreateQuotePayload,
  createQuoteAction,
} from '../app/quotes/new/actions';

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((href: string) => {
    const error = new Error('NEXT_REDIRECT');
    (error as Error & { digest: string }).digest = [
      REDIRECT_ERROR_CODE,
      RedirectType.push,
      href,
      '303',
      '',
    ].join(';');
    throw error;
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('createQuoteAction', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    vi.unstubAllGlobals();
  });

  it('posts the normalized payload and redirects to the created quote detail', async () => {
    const formData = new FormData();
    formData.set('submitMode', 'submit');
    formData.set('customerId', '1001');
    formData.set('salesUserId', '2001');
    formData.set('sourceCode', 'expo');
    formData.set('requirements', 'Need 500 units');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 101, quoteNo: 'Q202607080101' }),
      }),
    );

    await expect(createQuoteAction({ error: null }, formData)).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/quotes/101;303;`,
    });

    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3001/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submitMode: 'submit',
        customerId: 1001,
        salesUserId: 2001,
        sourceCode: 'expo',
        requirements: 'Need 500 units',
      }),
      cache: 'no-store',
    });
  });

  it('returns an error state when the API rejects the quote creation', async () => {
    const formData = new FormData();
    formData.set('submitMode', 'submit');
    formData.set('customerId', '1001');
    formData.set('salesUserId', '2001');
    formData.set('sourceCode', 'expo');
    formData.set('requirements', 'Need 500 units');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Source code is required' }),
      }),
    );

    await expect(
      createQuoteAction({ error: null }, formData),
    ).resolves.toEqual({ error: 'Source code is required' });
  });

  it('returns a generic error when the request fails before a response is received', async () => {
    const formData = new FormData();
    formData.set('submitMode', 'submit');
    formData.set('customerId', '1001');
    formData.set('salesUserId', '2001');
    formData.set('sourceCode', 'expo');
    formData.set('requirements', 'Need 500 units');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(
      createQuoteAction({ error: null }, formData),
    ).resolves.toEqual({ error: '创建报价失败' });
  });

  it('returns a generic error when the success response is not valid json', async () => {
    const formData = new FormData();
    formData.set('submitMode', 'submit');
    formData.set('customerId', '1001');
    formData.set('salesUserId', '2001');
    formData.set('sourceCode', 'expo');
    formData.set('requirements', 'Need 500 units');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('invalid json');
        },
      }),
    );

    await expect(
      createQuoteAction({ error: null }, formData),
    ).resolves.toEqual({ error: '创建报价失败' });
  });

  it('returns a generic error when the created quote id is missing', async () => {
    const formData = new FormData();
    formData.set('submitMode', 'submit');
    formData.set('customerId', '1001');
    formData.set('salesUserId', '2001');
    formData.set('sourceCode', 'expo');
    formData.set('requirements', 'Need 500 units');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ quoteNo: 'Q202607080101' }),
      }),
    );

    await expect(
      createQuoteAction({ error: null }, formData),
    ).resolves.toEqual({ error: '创建报价失败' });
  });

  it('normalizes form data through the shared payload builder', async () => {
    const formData = new FormData();
    formData.set('submitMode', 'draft');
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
});
