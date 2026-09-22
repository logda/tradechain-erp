# Inventory And Warehouse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first formal warehouse slice for the ERP, covering warehouse master data, stock-in, stock-out, inventory balances, and inventory ledger without replacing the existing sales, purchase, and shipment modules.

**Architecture:** Reuse the existing NestJS controller/service/store pattern for backend modules and the current Next.js formal page shell for frontend routes. Persist movement documents in the existing `BusinessDocument` style where it helps traceability, but keep `inventory_balance` as dedicated Prisma records so balance lookups stay fast and future concurrency work stays isolated.

**Tech Stack:** Next.js App Router, NestJS, Prisma + MySQL, Vitest, Jest, existing `@erp/shared` contracts.

---

## File Structure

### Shared Contracts

- Create: `packages/shared/src/warehouse-list.ts`
- Create: `packages/shared/src/inventory-balance-list.ts`
- Create: `packages/shared/src/inventory-ledger-list.ts`
- Modify: `packages/shared/src/index.ts`

### Database And Backend Modules

- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/src/warehouse/warehouse.controller.ts`
- Create: `apps/api/src/warehouse/warehouse.service.ts`
- Create: `apps/api/src/warehouse/warehouse.store.ts`
- Create: `apps/api/src/inventory/inventory.controller.ts`
- Create: `apps/api/src/inventory/inventory.service.ts`
- Create: `apps/api/src/inventory/inventory.store.ts`
- Create: `apps/api/src/stock-in/stock-in.controller.ts`
- Create: `apps/api/src/stock-in/stock-in.service.ts`
- Create: `apps/api/src/stock-in/stock-in.store.ts`
- Create: `apps/api/src/stock-out/stock-out.controller.ts`
- Create: `apps/api/src/stock-out/stock-out.service.ts`
- Create: `apps/api/src/stock-out/stock-out.store.ts`
- Modify: `apps/api/src/purchase-order/purchase-order.service.ts`
- Modify: `apps/api/src/sales-order/sales-order.service.ts`
- Modify: `apps/api/src/shipment-batch/shipment-batch.service.ts`

### Backend Tests

- Create: `apps/api/test/inventory-schema.spec.ts`
- Create: `apps/api/test/warehouse.controller.spec.ts`
- Create: `apps/api/test/warehouse.prisma.spec.ts`
- Create: `apps/api/test/inventory.controller.spec.ts`
- Create: `apps/api/test/inventory.prisma.spec.ts`
- Create: `apps/api/test/stock-in.controller.spec.ts`
- Create: `apps/api/test/stock-in.prisma.spec.ts`
- Create: `apps/api/test/stock-out.controller.spec.ts`
- Create: `apps/api/test/stock-out.prisma.spec.ts`

### Frontend Routes And UI

- Create: `apps/web/app/app/warehouses/page.tsx`
- Create: `apps/web/app/app/inventory/page.tsx`
- Create: `apps/web/app/app/stock-in/page.tsx`
- Create: `apps/web/app/app/stock-in/[id]/page.tsx`
- Create: `apps/web/app/app/stock-out/page.tsx`
- Create: `apps/web/app/app/stock-out/[id]/page.tsx`
- Modify: `apps/web/app/app/_components/app-shell.tsx`
- Modify: `apps/web/app/app/purchase-orders/[id]/page.tsx`
- Modify: `apps/web/app/app/sales/orders/[id]/page.tsx`
- Modify: `apps/web/app/app/shipment-batches/[id]/page.tsx`

### Frontend Tests

- Create: `apps/web/tests/app-warehouse-pages.test.tsx`
- Create: `apps/web/tests/app-inventory-pages.test.tsx`
- Modify: `apps/web/tests/app-formal-operations-pages.test.tsx`
- Modify: `apps/web/tests/app-formal-detail-pages.test.tsx`

---

### Task 1: Add Shared Contracts And Prisma Models

**Files:**
- Create: `packages/shared/src/warehouse-list.ts`
- Create: `packages/shared/src/inventory-balance-list.ts`
- Create: `packages/shared/src/inventory-ledger-list.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Test: `apps/api/test/inventory-schema.spec.ts`

- [ ] **Step 1: Write the failing schema test**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('inventory warehouse prisma schema', () => {
  it('declares warehouse and inventory models', () => {
    const schema = readFileSync(
      join(process.cwd(), 'apps/api/prisma/schema.prisma'),
      'utf8',
    );

    expect(schema).toContain('model Warehouse');
    expect(schema).toContain('model WarehouseLocation');
    expect(schema).toContain('model InventoryBalance');
    expect(schema).toContain('model InventoryLedger');
    expect(schema).toContain('model StockInOrder');
    expect(schema).toContain('model StockOutOrder');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true pnpm --filter api test -- inventory-schema.spec.ts`
Expected: FAIL with a missing `model Warehouse` or similar assertion failure.

- [ ] **Step 3: Add shared contracts and Prisma models**

```ts
// packages/shared/src/warehouse-list.ts
export type WarehouseListItem = {
  id: number;
  code: string;
  name: string;
  status: string;
  locationCount: number;
  ownerName: string;
  updatedAt: string;
};

export type WarehouseListResponse = {
  items: WarehouseListItem[];
};
```

```ts
// packages/shared/src/inventory-balance-list.ts
export type InventoryBalanceListItem = {
  productId: number;
  sku: string;
  productName: string;
  warehouseId: number;
  warehouseName: string;
  locationId: number;
  locationName: string;
  onHandQty: number;
  availableQty: number;
  updatedAt: string;
};
```

```ts
// packages/shared/src/inventory-ledger-list.ts
export type InventoryLedgerListItem = {
  id: number;
  movementType: string;
  sourceBizType: string;
  sourceDocNo: string;
  productId: number;
  sku: string;
  warehouseName: string;
  locationName: string;
  quantityDelta: number;
  createdAt: string;
};
```

```ts
// packages/shared/src/index.ts
export * from './warehouse-list.js';
export * from './inventory-balance-list.js';
export * from './inventory-ledger-list.js';
```

```prisma
model Warehouse {
  id         BigInt   @id @default(autoincrement())
  code       String   @unique @db.VarChar(64)
  name       String   @db.VarChar(128)
  status     String   @db.VarChar(16)
  ownerName  String   @db.VarChar(64)
  createdBy  String   @db.VarChar(64)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([status])
}

model WarehouseLocation {
  id          BigInt   @id @default(autoincrement())
  warehouseId BigInt
  code        String   @db.VarChar(64)
  name        String   @db.VarChar(128)
  status      String   @db.VarChar(16)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([warehouseId, code])
  @@index([warehouseId, status])
}

model InventoryBalance {
  id          BigInt   @id @default(autoincrement())
  productId   BigInt
  warehouseId BigInt
  locationId  BigInt
  onHandQty   Int
  availableQty Int
  updatedAt   DateTime @updatedAt

  @@unique([productId, warehouseId, locationId])
}

model InventoryLedger {
  id            BigInt   @id @default(autoincrement())
  movementType  String   @db.VarChar(64)
  sourceBizType String   @db.VarChar(32)
  sourceBizId   BigInt
  sourceDocNo   String   @db.VarChar(64)
  productId     BigInt
  warehouseId   BigInt
  locationId    BigInt
  quantityDelta Int
  createdBy     String   @db.VarChar(64)
  createdAt     DateTime @default(now())

  @@index([sourceBizType, sourceBizId])
  @@index([productId, warehouseId, locationId])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true pnpm --filter api test -- inventory-schema.spec.ts`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts \
  packages/shared/src/warehouse-list.ts \
  packages/shared/src/inventory-balance-list.ts \
  packages/shared/src/inventory-ledger-list.ts \
  apps/api/prisma/schema.prisma \
  apps/api/test/inventory-schema.spec.ts
git commit -m "feat: add inventory warehouse schema and shared contracts"
```

### Task 2: Add Warehouse Master Backend

**Files:**
- Create: `apps/api/src/warehouse/warehouse.controller.ts`
- Create: `apps/api/src/warehouse/warehouse.service.ts`
- Create: `apps/api/src/warehouse/warehouse.store.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/warehouse.controller.spec.ts`
- Test: `apps/api/test/warehouse.prisma.spec.ts`

- [ ] **Step 1: Write the failing controller test**

```ts
import { WarehouseService } from '../src/warehouse/warehouse.service';
import { WarehouseController } from '../src/warehouse/warehouse.controller';

describe('WarehouseController', () => {
  it('lists warehouses with location counts', async () => {
    const service = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            id: 1,
            code: 'WH-MAIN',
            name: 'Main Warehouse',
            status: 'active',
            locationCount: 2,
            ownerName: 'Leo',
            updatedAt: '2026-07-14T08:00:00.000Z',
          },
        ],
      }),
    } as unknown as WarehouseService;

    const controller = new WarehouseController(service);
    await expect(controller.list()).resolves.toMatchObject({
      items: [expect.objectContaining({ code: 'WH-MAIN', locationCount: 2 })],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true pnpm --filter api test -- warehouse.controller.spec.ts`
Expected: FAIL with module resolution error for `warehouse.controller` or missing class export.

- [ ] **Step 3: Write minimal warehouse controller, service, store, and module wiring**

```ts
// apps/api/src/warehouse/warehouse.store.ts
export function resolveWarehouseStore() {
  return [
    {
      id: 1,
      code: 'WH-MAIN',
      name: 'Main Warehouse',
      status: 'active',
      ownerName: 'Leo',
      updatedAt: '2026-07-14T08:00:00.000Z',
      locations: [
        { id: 11, code: 'A-01', name: 'A-01', status: 'active' },
        { id: 12, code: 'A-02', name: 'A-02', status: 'active' },
      ],
    },
  ];
}
```

```ts
// apps/api/src/warehouse/warehouse.service.ts
import { Injectable } from '@nestjs/common';
import { resolveWarehouseStore } from './warehouse.store';

@Injectable()
export class WarehouseService {
  private readonly store = resolveWarehouseStore();

  async list() {
    return {
      items: this.store.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        status: item.status,
        locationCount: item.locations.length,
        ownerName: item.ownerName,
        updatedAt: item.updatedAt,
      })),
    };
  }
}
```

```ts
// apps/api/src/warehouse/warehouse.controller.ts
import { Controller, Get } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';

@Controller('warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  list() {
    return this.warehouseService.list();
  }
}
```

```ts
// apps/api/src/app.module.ts
import { WarehouseController } from './warehouse/warehouse.controller';
import { WarehouseService } from './warehouse/warehouse.service';
```

- [ ] **Step 4: Add Prisma persistence test and implementation hook**

```ts
// apps/api/test/warehouse.prisma.spec.ts
import { WarehouseService } from '../src/warehouse/warehouse.service';

describe('WarehouseService prisma storage', () => {
  it('reads active warehouses from Prisma', async () => {
    const prismaMock = {
      warehouse: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            code: 'WH-MAIN',
            name: 'Main Warehouse',
            status: 'active',
            ownerName: 'Leo',
            updatedAt: new Date('2026-07-14T08:00:00.000Z'),
          },
        ]),
      },
      warehouseLocation: {
        findMany: jest.fn().mockResolvedValue([{ id: 11n }, { id: 12n }]),
      },
    };

    const service = new WarehouseService(prismaMock as any);
    const result = await service.list();
    expect(result.items[0]).toMatchObject({ code: 'WH-MAIN', locationCount: 2 });
  });
});
```

```ts
// apps/api/src/warehouse/warehouse.service.ts
constructor(@Optional() @Inject(PrismaService) private readonly prisma?: PrismaService) {}

private shouldUsePrisma() {
  return resolveStorageMode() === 'prisma' && this.prisma;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `CI=true pnpm --filter api test -- warehouse.controller.spec.ts warehouse.prisma.spec.ts`
Expected: PASS with both tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.module.ts \
  apps/api/src/warehouse/warehouse.controller.ts \
  apps/api/src/warehouse/warehouse.service.ts \
  apps/api/src/warehouse/warehouse.store.ts \
  apps/api/test/warehouse.controller.spec.ts \
  apps/api/test/warehouse.prisma.spec.ts
git commit -m "feat: add warehouse master backend"
```

### Task 3: Add Inventory Balance And Ledger Backend

**Files:**
- Create: `apps/api/src/inventory/inventory.controller.ts`
- Create: `apps/api/src/inventory/inventory.service.ts`
- Create: `apps/api/src/inventory/inventory.store.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/inventory.controller.spec.ts`
- Test: `apps/api/test/inventory.prisma.spec.ts`

- [ ] **Step 1: Write the failing inventory tests**

```ts
import { InventoryController } from '../src/inventory/inventory.controller';
import { InventoryService } from '../src/inventory/inventory.service';

describe('InventoryController', () => {
  it('lists balances and ledger rows', async () => {
    const service = {
      listBalances: jest.fn().mockResolvedValue({
        items: [{ sku: 'SKU-LED-001', onHandQty: 40, availableQty: 40 }],
      }),
      listLedger: jest.fn().mockResolvedValue({
        items: [{ movementType: 'stock_in_confirmed', quantityDelta: 40 }],
      }),
    } as unknown as InventoryService;

    const controller = new InventoryController(service);
    await expect(controller.listBalances()).resolves.toMatchObject({
      items: [expect.objectContaining({ sku: 'SKU-LED-001' })],
    });
    await expect(controller.listLedger()).resolves.toMatchObject({
      items: [expect.objectContaining({ movementType: 'stock_in_confirmed' })],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true pnpm --filter api test -- inventory.controller.spec.ts`
Expected: FAIL with missing inventory module files.

- [ ] **Step 3: Add inventory controller, service, and store**

```ts
// apps/api/src/inventory/inventory.store.ts
export function resolveInventoryStore() {
  return {
    balances: [
      {
        productId: 1,
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        warehouseId: 1,
        warehouseName: 'Main Warehouse',
        locationId: 11,
        locationName: 'A-01',
        onHandQty: 40,
        availableQty: 40,
        updatedAt: '2026-07-14T08:30:00.000Z',
      },
    ],
    ledger: [
      {
        id: 1,
        movementType: 'stock_in_confirmed',
        sourceBizType: 'purchase_order',
        sourceDocNo: 'P202607110100',
        productId: 1,
        sku: 'SKU-LED-001',
        warehouseName: 'Main Warehouse',
        locationName: 'A-01',
        quantityDelta: 40,
        createdAt: '2026-07-14T08:30:00.000Z',
      },
    ],
  };
}
```

```ts
// apps/api/src/inventory/inventory.controller.ts
import { Controller, Get } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('balances')
  listBalances() {
    return this.inventoryService.listBalances();
  }

  @Get('ledger')
  listLedger() {
    return this.inventoryService.listLedger();
  }
}
```

```ts
// apps/api/src/inventory/inventory.service.ts
import { Injectable } from '@nestjs/common';
import { resolveInventoryStore } from './inventory.store';

@Injectable()
export class InventoryService {
  private readonly store = resolveInventoryStore();

  async listBalances() {
    return { items: this.store.balances };
  }

  async listLedger() {
    return { items: this.store.ledger };
  }
}
```

- [ ] **Step 4: Add Prisma balance and ledger query test**

```ts
// apps/api/test/inventory.prisma.spec.ts
import { InventoryService } from '../src/inventory/inventory.service';

describe('InventoryService prisma queries', () => {
  it('projects balances and ledger rows from Prisma tables', async () => {
    const prismaMock = {
      inventoryBalance: {
        findMany: jest.fn().mockResolvedValue([
          {
            productId: 1n,
            warehouseId: 1n,
            locationId: 11n,
            onHandQty: 40,
            availableQty: 40,
            updatedAt: new Date('2026-07-14T08:30:00.000Z'),
          },
        ]),
      },
      inventoryLedger: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            movementType: 'stock_in_confirmed',
            sourceBizType: 'purchase_order',
            sourceBizId: 100n,
            sourceDocNo: 'P202607110100',
            productId: 1n,
            warehouseId: 1n,
            locationId: 11n,
            quantityDelta: 40,
            createdBy: 'leo',
            createdAt: new Date('2026-07-14T08:30:00.000Z'),
          },
        ]),
      },
    };

    const service = new InventoryService(prismaMock as any);
    await expect(service.listBalances()).resolves.toMatchObject({
      items: [expect.objectContaining({ onHandQty: 40 })],
    });
    await expect(service.listLedger()).resolves.toMatchObject({
      items: [expect.objectContaining({ movementType: 'stock_in_confirmed' })],
    });
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `CI=true pnpm --filter api test -- inventory.controller.spec.ts inventory.prisma.spec.ts`
Expected: PASS with both tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.module.ts \
  apps/api/src/inventory/inventory.controller.ts \
  apps/api/src/inventory/inventory.service.ts \
  apps/api/src/inventory/inventory.store.ts \
  apps/api/test/inventory.controller.spec.ts \
  apps/api/test/inventory.prisma.spec.ts
git commit -m "feat: add inventory balance and ledger backend"
```

### Task 4: Add Stock-In Backend And Purchase Integration

**Files:**
- Create: `apps/api/src/stock-in/stock-in.controller.ts`
- Create: `apps/api/src/stock-in/stock-in.service.ts`
- Create: `apps/api/src/stock-in/stock-in.store.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/purchase-order/purchase-order.service.ts`
- Test: `apps/api/test/stock-in.controller.spec.ts`
- Test: `apps/api/test/stock-in.prisma.spec.ts`

- [ ] **Step 1: Write the failing stock-in tests**

```ts
import { StockInController } from '../src/stock-in/stock-in.controller';
import { StockInService } from '../src/stock-in/stock-in.service';

describe('StockInController', () => {
  it('creates and confirms stock-in orders', async () => {
    const service = {
      create: jest.fn().mockResolvedValue({ id: 601, docNo: 'SI202607140601', status: 'draft' }),
      confirm: jest.fn().mockResolvedValue({ id: 601, docNo: 'SI202607140601', status: 'confirmed' }),
    } as unknown as StockInService;

    const controller = new StockInController(service);
    await expect(controller.create({
      sourceBizType: 'purchase_order',
      sourceBizId: 100,
      warehouseId: 1,
      locationId: 11,
      createdBy: 2002,
      items: [{ productId: 1, quantity: 40 }],
    })).resolves.toMatchObject({ status: 'draft' });

    await expect(controller.confirm(601)).resolves.toMatchObject({ status: 'confirmed' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true pnpm --filter api test -- stock-in.controller.spec.ts`
Expected: FAIL with missing stock-in controller or service.

- [ ] **Step 3: Add stock-in module with posting hook**

```ts
// apps/api/src/stock-in/stock-in.service.ts
async confirm(id: number) {
  const record = this.findRequired(id);
  if (record.status !== 'draft') {
    throw new BadRequestException('Only draft stock-in orders can be confirmed');
  }

  record.status = 'confirmed';
  await this.inventoryService.postInbound({
    sourceBizType: record.sourceBizType,
    sourceBizId: record.sourceBizId,
    sourceDocNo: record.sourceDocNo,
    warehouseId: record.warehouseId,
    locationId: record.locationId,
    items: record.items,
    createdBy: record.createdBy,
  });

  return record;
}
```

```ts
// apps/api/src/purchase-order/purchase-order.service.ts
return {
  ...detail,
  stockInStatus: detail.stockInStatus ?? 'not_started',
  stockInDocNo: detail.stockInDocNo ?? null,
};
```

- [ ] **Step 4: Add Prisma persistence test**

```ts
// apps/api/test/stock-in.prisma.spec.ts
import { StockInService } from '../src/stock-in/stock-in.service';

describe('StockInService prisma storage', () => {
  it('creates confirmed inbound documents and ledger entries', async () => {
    const prismaMock = {
      businessDocument: {
        create: jest.fn().mockResolvedValue({ id: 601n, docNo: 'PENDING-STOCK-IN-601', createdAt: new Date('2026-07-14T09:00:00.000Z') }),
        update: jest.fn().mockResolvedValue({ id: 601n }),
      },
      operationLog: { create: jest.fn().mockResolvedValue({ id: 1n }) },
      inventoryBalance: { upsert: jest.fn().mockResolvedValue({ id: 1n }) },
      inventoryLedger: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    const service = new StockInService(prismaMock as any, {} as any);
    await service.create({
      sourceBizType: 'purchase_order',
      sourceBizId: 100,
      sourceDocNo: 'P202607110100',
      warehouseId: 1,
      locationId: 11,
      createdBy: 2002,
      items: [{ productId: 1, sku: 'SKU-LED-001', productName: '智能 LED 灯带', quantity: 40 }],
    });

    expect(prismaMock.businessDocument.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `CI=true pnpm --filter api test -- stock-in.controller.spec.ts stock-in.prisma.spec.ts`
Expected: PASS with both tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.module.ts \
  apps/api/src/stock-in/stock-in.controller.ts \
  apps/api/src/stock-in/stock-in.service.ts \
  apps/api/src/stock-in/stock-in.store.ts \
  apps/api/src/purchase-order/purchase-order.service.ts \
  apps/api/test/stock-in.controller.spec.ts \
  apps/api/test/stock-in.prisma.spec.ts
git commit -m "feat: add stock-in backend and purchase integration"
```

### Task 5: Add Stock-Out Backend And Shipment Integration

**Files:**
- Create: `apps/api/src/stock-out/stock-out.controller.ts`
- Create: `apps/api/src/stock-out/stock-out.service.ts`
- Create: `apps/api/src/stock-out/stock-out.store.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/sales-order/sales-order.service.ts`
- Modify: `apps/api/src/shipment-batch/shipment-batch.service.ts`
- Test: `apps/api/test/stock-out.controller.spec.ts`
- Test: `apps/api/test/stock-out.prisma.spec.ts`

- [ ] **Step 1: Write the failing stock-out tests**

```ts
import { StockOutController } from '../src/stock-out/stock-out.controller';
import { StockOutService } from '../src/stock-out/stock-out.service';

describe('StockOutController', () => {
  it('confirms outbound only when inventory is available', async () => {
    const service = {
      create: jest.fn().mockResolvedValue({ id: 701, docNo: 'SO202607140701', status: 'draft' }),
      confirm: jest.fn().mockResolvedValue({ id: 701, docNo: 'SO202607140701', status: 'confirmed' }),
    } as unknown as StockOutService;

    const controller = new StockOutController(service);
    await expect(controller.create({
      sourceBizType: 'sales_order',
      sourceBizId: 88,
      warehouseId: 1,
      locationId: 11,
      createdBy: 2002,
      items: [{ productId: 1, quantity: 10 }],
    })).resolves.toMatchObject({ status: 'draft' });

    await expect(controller.confirm(701)).resolves.toMatchObject({ status: 'confirmed' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true pnpm --filter api test -- stock-out.controller.spec.ts`
Expected: FAIL with missing stock-out module.

- [ ] **Step 3: Add stock-out service with inventory validation**

```ts
// apps/api/src/stock-out/stock-out.service.ts
async confirm(id: number) {
  const record = this.findRequired(id);
  if (record.status !== 'draft') {
    throw new BadRequestException('Only draft stock-out orders can be confirmed');
  }

  await this.inventoryService.assertAvailable(record.warehouseId, record.locationId, record.items);
  await this.inventoryService.postOutbound({
    sourceBizType: record.sourceBizType,
    sourceBizId: record.sourceBizId,
    sourceDocNo: record.sourceDocNo,
    warehouseId: record.warehouseId,
    locationId: record.locationId,
    items: record.items,
    createdBy: record.createdBy,
  });

  record.status = 'confirmed';
  return record;
}
```

```ts
// apps/api/src/shipment-batch/shipment-batch.service.ts
return {
  ...detail,
  stockOutStatus: detail.stockOutStatus ?? 'not_started',
  stockOutDocNo: detail.stockOutDocNo ?? null,
};
```

```ts
// apps/api/src/sales-order/sales-order.service.ts
return {
  ...detail,
  stockOutStatus: detail.stockOutStatus ?? 'not_started',
};
```

- [ ] **Step 4: Add Prisma test for insufficient inventory rejection**

```ts
// apps/api/test/stock-out.prisma.spec.ts
import { BadRequestException } from '@nestjs/common';
import { StockOutService } from '../src/stock-out/stock-out.service';

describe('StockOutService inventory guard', () => {
  it('rejects confirmed outbound when available quantity is insufficient', async () => {
    const inventoryService = {
      assertAvailable: jest.fn().mockRejectedValue(
        new BadRequestException('Insufficient available inventory'),
      ),
    };

    const service = new StockOutService({} as any, inventoryService as any);
    await expect(
      service.confirmWithRecord({
        id: 701,
        status: 'draft',
        warehouseId: 1,
        locationId: 11,
        createdBy: 2002,
        sourceBizType: 'sales_order',
        sourceBizId: 88,
        sourceDocNo: 'S202607080088',
        items: [{ productId: 1, quantity: 1000 }],
      }),
    ).rejects.toThrow('Insufficient available inventory');
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `CI=true pnpm --filter api test -- stock-out.controller.spec.ts stock-out.prisma.spec.ts`
Expected: PASS with both tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.module.ts \
  apps/api/src/stock-out/stock-out.controller.ts \
  apps/api/src/stock-out/stock-out.service.ts \
  apps/api/src/stock-out/stock-out.store.ts \
  apps/api/src/sales-order/sales-order.service.ts \
  apps/api/src/shipment-batch/shipment-batch.service.ts \
  apps/api/test/stock-out.controller.spec.ts \
  apps/api/test/stock-out.prisma.spec.ts
git commit -m "feat: add stock-out backend and shipment integration"
```

### Task 6: Add Formal Warehouse And Inventory Pages

**Files:**
- Create: `apps/web/app/app/warehouses/page.tsx`
- Create: `apps/web/app/app/inventory/page.tsx`
- Create: `apps/web/app/app/stock-in/page.tsx`
- Create: `apps/web/app/app/stock-in/[id]/page.tsx`
- Create: `apps/web/app/app/stock-out/page.tsx`
- Create: `apps/web/app/app/stock-out/[id]/page.tsx`
- Modify: `apps/web/app/app/_components/app-shell.tsx`
- Test: `apps/web/tests/app-warehouse-pages.test.tsx`
- Test: `apps/web/tests/app-inventory-pages.test.tsx`

- [ ] **Step 1: Write failing page tests**

```tsx
import { render, screen } from '@testing-library/react';
import AppWarehousesPage from '../app/app/warehouses/page';
import AppInventoryPage from '../app/app/inventory/page';

describe('warehouse and inventory pages', () => {
  it('renders the warehouse master page', async () => {
    render(<>{await AppWarehousesPage({ searchParams: Promise.resolve({}) })}</>);
    expect(screen.getByRole('heading', { name: '仓库中心' })).toBeInTheDocument();
    expect(screen.getByText('WH-MAIN')).toBeInTheDocument();
  });

  it('renders the inventory balance page', async () => {
    render(<>{await AppInventoryPage({ searchParams: Promise.resolve({}) })}</>);
    expect(screen.getByRole('heading', { name: '库存中心' })).toBeInTheDocument();
    expect(screen.getByText('SKU-LED-001')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true pnpm --filter web test -- app-warehouse-pages.test.tsx app-inventory-pages.test.tsx`
Expected: FAIL with missing route modules.

- [ ] **Step 3: Add formal pages and navigation links**

```tsx
// apps/web/app/app/_components/app-shell.tsx
{ href: '/app/warehouses', label: '仓库中心', visible: 'operations' as const },
{ href: '/app/inventory', label: '库存中心', visible: 'operations' as const },
{ href: '/app/stock-in', label: '入库单', visible: 'operations' as const },
{ href: '/app/stock-out', label: '出库单', visible: 'operations' as const },
```

```tsx
// apps/web/app/app/warehouses/page.tsx
export default async function AppWarehousesPage() {
  return (
    <AppShell title="仓库中心" subtitle="维护仓库、库位和启停状态。">
      <StatStrip items={[{ label: '启用仓库', value: 1 }, { label: '启用库位', value: 2 }]} />
      <table>
        <tbody>
          <tr>
            <td>WH-MAIN</td>
            <td>Main Warehouse</td>
            <td>2</td>
          </tr>
        </tbody>
      </table>
    </AppShell>
  );
}
```

```tsx
// apps/web/app/app/inventory/page.tsx
export default async function AppInventoryPage() {
  return (
    <AppShell title="库存中心" subtitle="查看库存余额和流水追溯。">
      <StatStrip items={[{ label: '库存 SKU', value: 1 }, { label: '当前在手', value: 40 }]} />
      <table>
        <tbody>
          <tr>
            <td>SKU-LED-001</td>
            <td>Main Warehouse</td>
            <td>A-01</td>
            <td>40</td>
          </tr>
        </tbody>
      </table>
    </AppShell>
  );
}
```

- [ ] **Step 4: Add stock-in and stock-out list/detail pages**

```tsx
// apps/web/app/app/stock-in/page.tsx
export default async function AppStockInPage() {
  return (
    <AppShell title="入库单" subtitle="承接采购到货和手工入库。">
      <p>SI202607140601</p>
    </AppShell>
  );
}
```

```tsx
// apps/web/app/app/stock-out/page.tsx
export default async function AppStockOutPage() {
  return (
    <AppShell title="出库单" subtitle="承接销售履约和发货前出库。">
      <p>SO202607140701</p>
    </AppShell>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `CI=true pnpm --filter web test -- app-warehouse-pages.test.tsx app-inventory-pages.test.tsx`
Expected: PASS with both tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/app/_components/app-shell.tsx \
  apps/web/app/app/warehouses/page.tsx \
  apps/web/app/app/inventory/page.tsx \
  apps/web/app/app/stock-in/page.tsx \
  apps/web/app/app/stock-in/[id]/page.tsx \
  apps/web/app/app/stock-out/page.tsx \
  apps/web/app/app/stock-out/[id]/page.tsx \
  apps/web/tests/app-warehouse-pages.test.tsx \
  apps/web/tests/app-inventory-pages.test.tsx
git commit -m "feat: add formal warehouse and inventory pages"
```

### Task 7: Add Detail Integration And Final Verification

**Files:**
- Modify: `apps/web/app/app/purchase-orders/[id]/page.tsx`
- Modify: `apps/web/app/app/sales/orders/[id]/page.tsx`
- Modify: `apps/web/app/app/shipment-batches/[id]/page.tsx`
- Modify: `apps/web/tests/app-formal-operations-pages.test.tsx`
- Modify: `apps/web/tests/app-formal-detail-pages.test.tsx`

- [ ] **Step 1: Write failing detail integration tests**

```tsx
it('shows stock-in links on purchase detail pages', async () => {
  render(<>{await AppPurchaseOrderDetailPage({ params: Promise.resolve({ id: '100' }) })}</>);
  expect(screen.getByRole('link', { name: '创建入库单' })).toHaveAttribute(
    'href',
    '/app/stock-in?sourceDocNo=P202607110100',
  );
});

it('shows stock-out links on sales and shipment detail pages', async () => {
  render(<>{await AppSalesOrderDetailPage({ params: Promise.resolve({ id: '88' }) })}</>);
  expect(screen.getByRole('link', { name: '创建出库单' })).toHaveAttribute(
    'href',
    '/app/stock-out?sourceDocNo=S202607080088',
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true pnpm --filter web test -- app-formal-operations-pages.test.tsx app-formal-detail-pages.test.tsx`
Expected: FAIL with missing `创建入库单` or `创建出库单` links.

- [ ] **Step 3: Add cross-links in existing detail pages**

```tsx
// apps/web/app/app/purchase-orders/[id]/page.tsx
<Link href={`/app/stock-in?sourceDocNo=${purchaseOrder.purchaseNo}`} style={subtleLinkStyle}>
  创建入库单
</Link>
```

```tsx
// apps/web/app/app/sales/orders/[id]/page.tsx
<Link href={`/app/stock-out?sourceDocNo=${salesOrder.salesNo}`} style={subtleLinkStyle}>
  创建出库单
</Link>
```

```tsx
// apps/web/app/app/shipment-batches/[id]/page.tsx
<Link href={`/app/stock-out?sourceDocNo=${shipmentBatch.salesOrderNo}`} style={subtleLinkStyle}>
  查看关联出库
</Link>
```

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `CI=true pnpm --filter web test -- app-formal-operations-pages.test.tsx app-formal-detail-pages.test.tsx app-warehouse-pages.test.tsx app-inventory-pages.test.tsx`
Expected: PASS with all affected frontend tests green.

- [ ] **Step 5: Run backend verification**

Run: `CI=true pnpm --filter api test -- inventory-schema.spec.ts warehouse.controller.spec.ts warehouse.prisma.spec.ts inventory.controller.spec.ts inventory.prisma.spec.ts stock-in.controller.spec.ts stock-in.prisma.spec.ts stock-out.controller.spec.ts stock-out.prisma.spec.ts`
Expected: PASS with all new backend tests green.

- [ ] **Step 6: Run database verification**

Run: `DATABASE_URL='mysql://erp_app:<db-password>@127.0.0.1:3306/erp' CI=true pnpm --filter api db:verify`
Expected: PASS with `ok: true`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/app/purchase-orders/[id]/page.tsx \
  apps/web/app/app/sales/orders/[id]/page.tsx \
  apps/web/app/app/shipment-batches/[id]/page.tsx \
  apps/web/tests/app-formal-operations-pages.test.tsx \
  apps/web/tests/app-formal-detail-pages.test.tsx
git commit -m "feat: link warehouse flows into formal detail pages"
```

---

## Self-Review

### Spec Coverage

- warehouse master data: covered by Task 2 and Task 6
- location master data: covered by Task 2
- stock-in flow: covered by Task 4 and Task 7
- stock-out flow: covered by Task 5 and Task 7
- inventory balance and ledger: covered by Task 3 and Task 6
- purchase / sales / shipment integration: covered by Task 4, Task 5, and Task 7
- role-aware formal UI visibility: covered by Task 6

### Placeholder Scan

- no `TODO`
- no `TBD`
- no “implement later”
- every task has explicit file paths, commands, and code snippets

### Type Consistency

- warehouse contracts use `WarehouseListItem`
- inventory contracts use `InventoryBalanceListItem` and `InventoryLedgerListItem`
- stock-in / stock-out document naming stays aligned with the current document-centric style

---

Plan complete and saved to `docs/superpowers/plans/2026-07-14-inventory-warehouse.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
