import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REDIRECT_ERROR_CODE,
  RedirectType,
} from 'next/dist/client/components/redirect-error';
import {
  buildConvertQuotePayload,
  convertQuoteToSalesAction,
} from '../app/quotes/[id]/actions';

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

describe('convertQuoteToSalesAction', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    vi.unstubAllGlobals();
  });

  it('normalizes form data through the shared payload builder', async () => {
    const formData = new FormData();
    formData.set('quoteId', '101');
    formData.set('quoteVersionNo', '1');
    formData.set('customerId', '1001');
    formData.set('customerName', 'Acme Trading');
    formData.set('customerFullName', 'Acme Trading Co., Ltd.');
    formData.set('customerCode', 'CUST-ACME');
    formData.set('customerEntryMode', 'existing');
    formData.set('sourceQuoteNo', 'Q202607080101');
    formData.set('sourceCode', '02 Libuys');
    formData.set('inquiryDate', '2026-05-30');
    formData.set('destination', 'SH Boninoe');
    formData.set('requirements', '单个销售单可能会有多个工厂的产品');
    formData.set('createdBy', '2001');
    formData.set('quoteConfirmed', 'true');
    formData.set(
      'quoteAttachments',
      JSON.stringify([
        {
          key: 'formal-quote-attachments/2026/07/21/quote-spec.pdf',
          fileName: 'quote-spec.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          url: 'http://127.0.0.1:3001/uploads/formal-quote-attachments/2026/07/21/quote-spec.pdf',
        },
      ]),
    );
    formData.set(
      'items',
      JSON.stringify([
        {
          lineNo: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
          amount: 7950,
          imageUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
          ],
        },
      ]),
    );

    await expect(buildConvertQuotePayload(formData)).resolves.toEqual({
      quoteId: 101,
      payload: {
        quoteVersionNo: 1,
        customerId: 1001,
        customerName: 'Acme Trading',
        customerFullName: 'Acme Trading Co., Ltd.',
        customerCode: 'CUST-ACME',
        customerEntryMode: 'existing',
        sourceQuoteNo: 'Q202607080101',
        sourceCode: '02 Libuys',
        inquiryDate: '2026-05-30',
        destination: 'SH Boninoe',
        requirements: '单个销售单可能会有多个工厂的产品',
        createdBy: 2001,
        quoteConfirmed: true,
        quoteAttachments: [
          {
            key: 'formal-quote-attachments/2026/07/21/quote-spec.pdf',
            fileName: 'quote-spec.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            url: 'http://127.0.0.1:3001/uploads/formal-quote-attachments/2026/07/21/quote-spec.pdf',
          },
        ],
        items: [
          {
            lineNo: 1,
            productId: 501,
            sku: 'SKU-LED-001',
            productName: '智能 LED 灯带',
            unit: 'set',
            quantity: 500,
            salePrice: 15.9,
            amount: 7950,
            imageUrls: [
              'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
            ],
          },
        ],
      },
    });
  });

  it('uses boss confirmed sale prices when quote conversion items include them', async () => {
    const formData = new FormData();
    formData.set('quoteId', '101');
    formData.set('quoteVersionNo', '1');
    formData.set('customerId', '1001');
    formData.set('createdBy', '2001');
    formData.set('quoteConfirmed', 'true');
    formData.set(
      'items',
      JSON.stringify([
        {
          lineNo: 1,
          productId: 502,
          sku: 'SKU-CBL-002',
          productName: 'USB-C 线缆',
          unit: 'pcs',
          quantity: 2,
          salePrice: 4.8,
          confirmedSalePrice: 100,
          amount: 9.6,
          confirmedSupplierId: 3002,
          confirmedSupplierCode: 'SUP-BRAVO',
          confirmedSupplierName: 'Bravo Industrial',
          confirmedPurchasePrice: 9.77,
          confirmedProductId: 8802,
        },
      ]),
    );

    await expect(buildConvertQuotePayload(formData)).resolves.toMatchObject({
      payload: {
        items: [
          {
            lineNo: 1,
            productId: 502,
            sku: 'SKU-CBL-002',
            productName: 'USB-C 线缆',
            unit: 'pcs',
            quantity: 2,
            salePrice: 100,
            amount: 200,
            confirmedSupplierId: 3002,
            confirmedSupplierCode: 'SUP-BRAVO',
            confirmedSupplierName: 'Bravo Industrial',
            confirmedPurchasePrice: 9.77,
            confirmedProductId: 8802,
          },
        ],
      },
    });
  });

  it('posts the normalized payload and redirects to the sales order detail', async () => {
    const formData = new FormData();
    formData.set('quoteId', '101');
    formData.set('quoteVersionNo', '1');
    formData.set('customerId', '1001');
    formData.set('customerName', 'Acme Trading');
    formData.set('customerFullName', 'Acme Trading Co., Ltd.');
    formData.set('customerCode', 'CUST-ACME');
    formData.set('customerEntryMode', 'existing');
    formData.set('sourceQuoteNo', 'Q202607080101');
    formData.set('sourceCode', '02 Libuys');
    formData.set('inquiryDate', '2026-05-30');
    formData.set('destination', 'SH Boninoe');
    formData.set('requirements', '单个销售单可能会有多个工厂的产品');
    formData.set('createdBy', '2001');
    formData.set('quoteConfirmed', 'true');
    formData.set(
      'quoteAttachments',
      JSON.stringify([
        {
          key: 'formal-quote-attachments/2026/07/21/quote-spec.pdf',
          fileName: 'quote-spec.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          url: 'http://127.0.0.1:3001/uploads/formal-quote-attachments/2026/07/21/quote-spec.pdf',
        },
      ]),
    );
    formData.set(
      'items',
      JSON.stringify([
        {
          lineNo: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
          amount: 7950,
          imageUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
          ],
        },
      ]),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 501, salesNo: 'S202607080001' }),
      }),
    );

    await expect(
      convertQuoteToSalesAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/sales-orders/501;303;`,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes/101/convert-to-sales',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteVersionNo: 1,
          customerId: 1001,
          customerName: 'Acme Trading',
          customerFullName: 'Acme Trading Co., Ltd.',
          customerCode: 'CUST-ACME',
          customerEntryMode: 'existing',
          sourceQuoteNo: 'Q202607080101',
          sourceCode: '02 Libuys',
          inquiryDate: '2026-05-30',
          destination: 'SH Boninoe',
          requirements: '单个销售单可能会有多个工厂的产品',
          createdBy: 2001,
          quoteConfirmed: true,
          items: [
            {
              lineNo: 1,
              productId: 501,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 500,
              salePrice: 15.9,
              amount: 7950,
              imageUrls: [
                'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
              ],
            },
          ],
          quoteAttachments: [
            {
              key: 'formal-quote-attachments/2026/07/21/quote-spec.pdf',
              fileName: 'quote-spec.pdf',
              mimeType: 'application/pdf',
              size: 1024,
              url: 'http://127.0.0.1:3001/uploads/formal-quote-attachments/2026/07/21/quote-spec.pdf',
            },
          ],
        }),
        cache: 'no-store',
      },
    );
  });

  it('posts quote conversion with dynamic action scopes from the formal access payload', async () => {
    const formData = new FormData();
    formData.set('quoteId', '101');
    formData.set('quoteVersionNo', '1');
    formData.set('customerId', '1001');
    formData.set('createdBy', '2001');
    formData.set('quoteConfirmed', 'true');
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');
    formData.set(
      'access',
      encodeURIComponent(
        JSON.stringify({
          actions: ['sales.order.write'],
        }),
      ),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 502, salesNo: 'S202607080002' }),
      }),
    );

    await expect(
      convertQuoteToSalesAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/sales-orders/502;303;`,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes/101/convert-to-sales',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-erp-role': 'sales',
          'x-erp-user': 'Zoe',
          'x-erp-actions': 'sales.order.write',
          'x-erp-session': expect.any(String),
          'x-erp-session-signature': expect.any(String),
        }),
      }),
    );
  });

  it('returns the API error when quote conversion is rejected', async () => {
    const formData = new FormData();
    formData.set('quoteId', '101');
    formData.set('quoteVersionNo', '1');
    formData.set('customerId', '1001');
    formData.set('createdBy', '2001');
    formData.set('quoteConfirmed', 'false');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          message: 'Only confirmed quote versions can convert to sales orders',
        }),
      }),
    );

    await expect(
      convertQuoteToSalesAction({ error: null }, formData),
    ).resolves.toEqual({
      error: 'Only confirmed quote versions can convert to sales orders',
    });
  });

  it('omits optional numeric fields and still submits when quote id is present', async () => {
    const formData = new FormData();
    formData.set('quoteId', '101');
    formData.set('quoteConfirmed', 'true');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 503, salesNo: 'S202607080003' }),
      }),
    );

    await expect(buildConvertQuotePayload(formData)).resolves.toEqual({
      quoteId: 101,
      payload: {
        quoteConfirmed: true,
      },
    });

    await expect(
      convertQuoteToSalesAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/sales-orders/503;303;`,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes/101/convert-to-sales',
      expect.objectContaining({
        body: JSON.stringify({
          quoteConfirmed: true,
        }),
      }),
    );
  });
});
