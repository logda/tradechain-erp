import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppQuoteSourcePage from '../app/app/master-data/quote-source/page';

describe('quote source master data page', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps disabled quote sources visible in the maintenance list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            { code: 'expo', label: '展会', enabled: true, sortOrder: 1 },
            { code: 'online', label: '线上', enabled: false, sortOrder: 2 },
            { code: 'tiktok', label: 'TikTok', enabled: true, sortOrder: 3 },
          ],
        }),
      }),
    );

    render(
      <>
        {await AppQuoteSourcePage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '报价来源字典' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('online')).toBeInTheDocument();
    expect(screen.getByDisplayValue('线上')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked();
  });

  it('updates the enabled-source summary locally after saving the dictionary', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (init?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              { code: 'expo', label: '展会', enabled: true, sortOrder: 1 },
              { code: 'online', label: '线上', enabled: true, sortOrder: 2 },
              { code: 'tiktok', label: 'TikTok', enabled: true, sortOrder: 3 },
            ],
          }),
        });
      }

      if (url.endsWith('/quote-sources')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              { code: 'expo', label: '展会', enabled: true, sortOrder: 1 },
              { code: 'online', label: '线上', enabled: false, sortOrder: 2 },
              { code: 'tiktok', label: 'TikTok', enabled: true, sortOrder: 3 },
            ],
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppQuoteSourcePage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByText('当前启用来源：2 个')).toBeInTheDocument();
    expect(screen.getByText('展会、TikTok')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: '保存来源字典' }));

    await waitFor(() => {
      expect(screen.getByText('报价来源字典已保存')).toBeInTheDocument();
      expect(screen.getByText('当前启用来源：3 个')).toBeInTheDocument();
      expect(screen.getByText('展会、线上、TikTok')).toBeInTheDocument();
    });
  });
});
