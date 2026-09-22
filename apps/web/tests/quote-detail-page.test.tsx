import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuoteDetailPage from '../app/quotes/[id]/page';

describe('QuoteDetailPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the quote detail summary and convert action after boss confirmation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          quoteNo: 'Q202607080101',
          status: 'boss_confirmed',
          currentVersionNo: 1,
          customerId: 1001,
          salesUserId: 2001,
          sourceCode: 'expo',
          requirements: 'Need 500 units',
        }),
      }),
    );

    render(
      <>
        {await QuoteDetailPage({
          params: Promise.resolve({ id: '101' }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '报价单 Q202607080101' }),
    ).toBeInTheDocument();
    expect(screen.getByText('状态：boss_confirmed')).toBeInTheDocument();
    expect(screen.getByText('来源：expo')).toBeInTheDocument();
    expect(screen.getByText('需求：Need 500 units')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '转为销售订单' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '转为销售订单' })).toHaveStyle(
      'border-radius: 16px',
    );
  });

  it('hides sales conversion before boss confirmation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          quoteNo: 'Q202607080101',
          status: 'submitted',
          currentVersionNo: 1,
          customerId: 1001,
          salesUserId: 2001,
          sourceCode: 'expo',
          requirements: 'Need 500 units',
        }),
      }),
    );

    render(
      <>
        {await QuoteDetailPage({
          params: Promise.resolve({ id: '101' }),
        })}
      </>,
    );

    expect(
      screen.queryByRole('button', { name: '转为销售订单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('当前为待确认状态：需等待老板确认后，才可转销售单或创建样品单。'),
    ).toBeInTheDocument();
  });

  it('renders a back link to inquiry detail when it is opened from an inquiry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          quoteNo: 'Q202607080101',
          status: 'boss_confirmed',
          currentVersionNo: 1,
          customerId: 1001,
          salesUserId: 2001,
          sourceCode: 'expo',
          requirements: 'Need 500 units',
        }),
      }),
    );

    render(
      <>
        {await QuoteDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            fromInquiryId: '2',
          }),
        })}
      </>,
    );

    expect(
      screen.getByRole('link', { name: '返回询价单详情' }),
    ).toHaveAttribute('href', '/app/sales/inquiries/2');
  });

  it('renders a fallback state and quotes link when loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          message: 'quote missing',
        }),
      }),
    );

    render(
      <>
        {await QuoteDetailPage({
          params: Promise.resolve({ id: '101' }),
        })}
      </>,
    );

    expect(screen.getByText('报价详情加载失败')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回报价列表' })).toHaveAttribute(
      'href',
      '/quotes',
    );
  });
});
