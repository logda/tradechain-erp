import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadActiveCounterpartyOptions } from '../app/app/_lib/counterparty-options';

describe('counterparty options loader', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends formal session headers and uses live counterparty names', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 101,
            type: 'customer',
            code: 'CUST-SHANGHAI',
            name: '上海星河贸易有限公司',
            shortName: '星河贸易',
            status: 'active',
          },
          {
            id: 102,
            type: 'both',
            code: 'CP-GLOBAL',
            name: '环球伙伴有限公司',
            shortName: '环球伙伴',
            status: 'active',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      loadActiveCounterpartyOptions('customer', {
        role: 'sales',
        user: 'Leo',
      }),
    ).resolves.toEqual([
      {
        id: 101,
        type: 'customer',
        code: 'CUST-SHANGHAI',
        name: '上海星河贸易有限公司',
        shortName: '星河贸易',
      },
      {
        id: 102,
        type: 'both',
        code: 'CP-GLOBAL',
        name: '环球伙伴有限公司',
        shortName: '环球伙伴',
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/formal-lookup/counterparties?type=customer&status=active',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'sales',
          'x-erp-user': 'Leo',
        }),
      }),
    );
  });

  it('returns an empty list when the live counterparty request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => null,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadActiveCounterpartyOptions('customer')).resolves.toEqual([]);
  });
});
