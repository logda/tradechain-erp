export type WarehouseStoreLocation = {
  id: number;
  code: string;
  name: string;
  status: string;
};

export type WarehouseStoreRecord = {
  id: number;
  code: string;
  name: string;
  status: string;
  ownerName: string;
  updatedAt: string;
  locations: WarehouseStoreLocation[];
};

export function resolveWarehouseStore(): WarehouseStoreRecord[] {
  return [
    {
      id: 1,
      code: 'WH-MAIN',
      name: 'Main Warehouse',
      status: 'active',
      ownerName: 'Leo',
      updatedAt: '2026-07-14T08:00:00.000Z',
      locations: [
        {
          id: 11,
          code: 'A-01',
          name: 'A-01',
          status: 'active',
        },
        {
          id: 12,
          code: 'A-02',
          name: 'A-02',
          status: 'active',
        },
      ],
    },
  ];
}
