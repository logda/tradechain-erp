import { InquiryService } from '../src/inquiry/inquiry.service';

describe('InquiryService runtime persistence', () => {
  it('persists inquiry status transitions in runtime mode', async () => {
    delete process.env.ERP_STORAGE_MODE;
    const service = new InquiryService();

    const submitted = await service.submitForComparison({
      inquiryId: 1,
      items: [
        {
          itemId: 10,
          supplierQuotes: [
            {
              supplierSourceMode: 'counterparty',
              supplierId: 2,
              supplierCode: 'SUP-BRAVO',
              supplierName: 'Bravo Industrial',
              purchasePrice: 18.6,
            },
            {
              supplierSourceMode: 'manual',
              supplierName: '深圳快联电子',
              purchasePrice: 19.2,
            },
          ],
        },
      ],
    });
    const confirmed = await service.confirmByBoss({
      inquiryId: 1,
      items: [
        {
          itemId: 10,
          supplierQuoteCount: 2,
          confirmedSalePrice: 28.8,
          selectedSupplierQuoteIndex: 0,
        },
      ],
    });
    const listed = await service.list({
      status: 'boss_confirmed',
      page: 1,
      pageSize: 20,
    });
    const detail = await service.getById(1);

    expect(submitted.status).toBe('pending_boss_review');
    expect(confirmed.status).toBe('boss_confirmed');
    expect(listed.items.map((item) => item.inquiryNo)).toContain('IQ202607080001');
    expect(detail.supplierCount).toBe(2);
    expect(detail.items[0]?.confirmedSalePrice).toBe(28.8);
    expect(detail.items[0]?.supplierQuotes).toEqual([
      expect.objectContaining({
        supplierName: 'Bravo Industrial',
        purchasePrice: 18.6,
      }),
      expect.objectContaining({
        supplierName: '深圳快联电子',
        purchasePrice: 19.2,
      }),
    ]);
  });
});
