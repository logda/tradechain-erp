# Sales And Purchase MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next ERP vertical slice for confirmed-quote-to-sales conversion, sales order approval/version rules, and supplier-split purchase execution.

**Architecture:** Extend the current modular monolith in thin vertical layers. Start by stabilizing shared runtime contracts and Prisma schema, then add rule-first NestJS services/controllers for sales and purchase workflows, and finish with minimal Next.js workspace pages that expose the new modules without overbuilding UI.

**Tech Stack:** pnpm workspaces, NestJS, Next.js App Router, Prisma, TypeScript, Vitest, Jest

---

### Task 1: Stabilize Shared Runtime Contracts For Sales And Purchase Statuses

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-status.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/purchase-order-status.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-status.spec.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/purchase-order-status.spec.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/tsconfig.build.json`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/package.json`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/tsconfig.json`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-status.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/purchase-order-status.spec.ts`

- [ ] **Step 1: Write the failing shared status tests**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-status.spec.ts`:

```ts
import {
  salesApprovalStatuses,
  salesFulfillmentStatuses,
} from './sales-order-status';

describe('sales order statuses', () => {
  it('exposes the full sales approval lifecycle in order', () => {
    expect(salesApprovalStatuses).toEqual([
      'draft',
      'pending_sales_manager_approval',
      'purchasing',
      'void',
    ]);
  });

  it('exposes the full sales fulfillment aggregate status set', () => {
    expect(salesFulfillmentStatuses).toEqual([
      'purchasing',
      'partial_purchasing',
      'partial_shipped',
      'shipped',
      'partial_to_forwarder',
      'to_forwarder',
      'partial_forwarder_shipped',
      'forwarder_shipped',
      'partial_arrived',
      'arrived',
      'partial_exception',
      'exception',
      'closed',
      'void',
    ]);
  });
});
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/purchase-order-status.spec.ts`:

```ts
import {
  purchaseApprovalStatuses,
  purchaseFulfillmentStatuses,
} from './purchase-order-status';

describe('purchase order statuses', () => {
  it('exposes the full purchase approval lifecycle in order', () => {
    expect(purchaseApprovalStatuses).toEqual([
      'draft',
      'pending_purchase_manager_approval',
      'purchasing',
      'void',
    ]);
  });

  it('exposes the full purchase fulfillment aggregate status set', () => {
    expect(purchaseFulfillmentStatuses).toEqual([
      'purchasing',
      'partial_shipped',
      'shipped',
      'partial_to_forwarder',
      'to_forwarder',
      'partial_forwarder_shipped',
      'forwarder_shipped',
      'partial_arrived',
      'arrived',
      'partial_exception',
      'exception',
      'void',
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true pnpm --filter @erp/shared test`
Expected: FAIL because the new status source files do not exist yet

- [ ] **Step 3: Write the minimal shared runtime implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-status.ts`:

```ts
export const salesApprovalStatuses = [
  'draft',
  'pending_sales_manager_approval',
  'purchasing',
  'void',
] as const;

export const salesFulfillmentStatuses = [
  'purchasing',
  'partial_purchasing',
  'partial_shipped',
  'shipped',
  'partial_to_forwarder',
  'to_forwarder',
  'partial_forwarder_shipped',
  'forwarder_shipped',
  'partial_arrived',
  'arrived',
  'partial_exception',
  'exception',
  'closed',
  'void',
] as const;

export type SalesApprovalStatus = (typeof salesApprovalStatuses)[number];
export type SalesFulfillmentStatus = (typeof salesFulfillmentStatuses)[number];
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/purchase-order-status.ts`:

```ts
export const purchaseApprovalStatuses = [
  'draft',
  'pending_purchase_manager_approval',
  'purchasing',
  'void',
] as const;

export const purchaseFulfillmentStatuses = [
  'purchasing',
  'partial_shipped',
  'shipped',
  'partial_to_forwarder',
  'to_forwarder',
  'partial_forwarder_shipped',
  'forwarder_shipped',
  'partial_arrived',
  'arrived',
  'partial_exception',
  'exception',
  'void',
] as const;

export type PurchaseApprovalStatus =
  (typeof purchaseApprovalStatuses)[number];
export type PurchaseFulfillmentStatus =
  (typeof purchaseFulfillmentStatuses)[number];
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`:

```ts
export * from './quote-status';
export * from './inquiry-status';
export * from './sales-order-status';
export * from './purchase-order-status';
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/package.json`:

```json
{
  "name": "@erp/shared",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "lint": "echo 'Scaffolding pending: packages/shared lint is not wired yet.'",
    "format": "echo 'Scaffolding pending: packages/shared format is not wired yet.'"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "noEmit": false,
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "node_modules"]
}
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Run the tests and build to verify they pass**

Run: `CI=true pnpm --filter @erp/shared test && CI=true pnpm --filter @erp/shared build`
Expected: PASS, with `dist/index.js` and `dist/index.d.ts` emitted successfully

- [ ] **Step 5: Commit**

```bash
git add packages/shared/package.json packages/shared/tsconfig.json packages/shared/tsconfig.build.json packages/shared/src/index.ts packages/shared/src/sales-order-status.ts packages/shared/src/purchase-order-status.ts packages/shared/src/sales-order-status.spec.ts packages/shared/src/purchase-order-status.spec.ts
git commit -m "feat: add shared sales and purchase status contracts"
```

### Task 2: Extend Prisma Schema For Versioned Sales And Purchase Orders

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/prisma/schema.prisma`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-purchase-schema.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-purchase-schema.spec.ts`

- [ ] **Step 1: Write the failing schema test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-purchase-schema.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('sales and purchase Prisma schema', () => {
  it('contains versioned sales and purchase models with source tracing fields', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('model SalesOrder');
    expect(schema).toContain('model SalesOrderVersion');
    expect(schema).toContain('model SalesOrderItem');
    expect(schema).toContain('model PurchaseOrder');
    expect(schema).toContain('model PurchaseOrderVersion');
    expect(schema).toContain('model PurchaseOrderItem');
    expect(schema).toContain('sourceQuoteOrderId   BigInt?');
    expect(schema).toContain('sourceQuoteVersionId BigInt?');
    expect(schema).toContain('sourceSalesOrderId   BigInt');
    expect(schema).toContain('sourceSalesItemId    BigInt');
    expect(schema).toContain('versions           SalesOrderVersion[]');
    expect(schema).toContain('versions           PurchaseOrderVersion[]');
  });
});
```

- [ ] **Step 2: Run the schema test to verify it fails**

Run: `CI=true pnpm --filter api test -- sales-purchase-schema.spec.ts`
Expected: FAIL because the new models and traceability fields are not in `schema.prisma`

- [ ] **Step 3: Add the minimal versioned schema**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/prisma/schema.prisma` by appending these models after `QuoteInquirySupplierQuote`:

```prisma
model SalesOrder {
  id                    BigInt              @id @default(autoincrement())
  salesNo               String              @unique @db.VarChar(64)
  sourceQuoteOrderId    BigInt?
  sourceQuoteVersionId  BigInt?
  customerId            BigInt
  currentVersionNo      Int
  confirmedVersionNo    Int?
  status                String              @db.VarChar(32)
  purchaseAggregateStatus String            @db.VarChar(32)
  shipmentAggregateStatus String            @db.VarChar(32)
  receiptStatus         String              @db.VarChar(32)
  financeStatus         String              @db.VarChar(32)
  lockedFlag            Boolean             @default(false)
  createdBy             BigInt
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  versions              SalesOrderVersion[]
  purchaseOrders        PurchaseOrder[]
}

model SalesOrderVersion {
  id             BigInt          @id @default(autoincrement())
  salesOrderId   BigInt
  versionNo      Int
  status         String          @db.VarChar(32)
  changeReason   String?         @db.VarChar(255)
  createdBy      BigInt
  createdAt      DateTime        @default(now())
  salesOrder     SalesOrder      @relation(fields: [salesOrderId], references: [id])
  items          SalesOrderItem[]

  @@unique([salesOrderId, versionNo])
}

model SalesOrderItem {
  id                  BigInt            @id @default(autoincrement())
  salesOrderVersionId BigInt
  lineNo              Int
  productId           BigInt
  quantity            Int
  unitPrice           Decimal           @db.Decimal(18, 2)
  totalAmount         Decimal           @db.Decimal(18, 2)
  directEntry         Boolean           @default(false)
  chosenSupplierId    BigInt?
  sourceInquiryItemId BigInt?
  createdAt           DateTime          @default(now())
  salesOrderVersion   SalesOrderVersion @relation(fields: [salesOrderVersionId], references: [id])

  @@unique([salesOrderVersionId, lineNo])
}

model PurchaseOrder {
  id                   BigInt                 @id @default(autoincrement())
  purchaseNo           String                 @unique @db.VarChar(64)
  sourceSalesOrderId   BigInt
  supplierId           BigInt
  currentVersionNo     Int
  status               String                 @db.VarChar(32)
  createdBy            BigInt
  createdAt            DateTime               @default(now())
  updatedAt            DateTime               @updatedAt
  salesOrder           SalesOrder             @relation(fields: [sourceSalesOrderId], references: [id])
  versions             PurchaseOrderVersion[]
}

model PurchaseOrderVersion {
  id               BigInt               @id @default(autoincrement())
  purchaseOrderId  BigInt
  versionNo        Int
  status           String               @db.VarChar(32)
  changeReason     String?              @db.VarChar(255)
  createdBy        BigInt
  createdAt        DateTime             @default(now())
  purchaseOrder    PurchaseOrder        @relation(fields: [purchaseOrderId], references: [id])
  items            PurchaseOrderItem[]

  @@unique([purchaseOrderId, versionNo])
}

model PurchaseOrderItem {
  id                     BigInt                @id @default(autoincrement())
  purchaseOrderVersionId BigInt
  lineNo                 Int
  sourceSalesItemId      BigInt
  productId              BigInt
  quantity               Int
  unitPrice              Decimal               @db.Decimal(18, 2)
  totalAmount            Decimal               @db.Decimal(18, 2)
  createdAt              DateTime              @default(now())
  purchaseOrderVersion   PurchaseOrderVersion  @relation(fields: [purchaseOrderVersionId], references: [id])

  @@unique([purchaseOrderVersionId, lineNo])
}
```

- [ ] **Step 4: Run the schema tests to verify they pass**

Run: `CI=true pnpm --filter api test -- prisma-schema.spec.ts sales-purchase-schema.spec.ts`
Expected: PASS, covering both quote/inquiry models and the new sales/purchase models

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/test/sales-purchase-schema.spec.ts
git commit -m "feat: add sales and purchase prisma models"
```

### Task 3: Implement Sales Order Conversion, Approval, And Cancel Rules

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/dto/convert-quote-to-sales.dto.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/dto/resubmit-sales-order.dto.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.controller.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/quote.controller.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-rules.spec.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order.controller.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-rules.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order.controller.spec.ts`

- [ ] **Step 1: Write the failing sales tests**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-rules.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('SalesOrderService', () => {
  it('converts one confirmed quote version into one draft sales order', async () => {
    const service = new SalesOrderService();

    const result = await service.convertConfirmedQuote({
      quoteOrderId: 9,
      quoteVersionNo: 3,
      quoteConfirmed: true,
      existingSalesOrderId: null,
      customerId: 1001,
      createdBy: 2001,
    });

    expect(result.status).toBe('draft');
    expect(result.currentVersionNo).toBe(1);
    expect(result.sourceQuoteOrderId).toBe(9);
  });

  it('rejects duplicate quote-to-sales conversion', async () => {
    const service = new SalesOrderService();

    await expect(
      service.convertConfirmedQuote({
        quoteOrderId: 9,
        quoteVersionNo: 3,
        quoteConfirmed: true,
        existingSalesOrderId: 88,
        customerId: 1001,
        createdBy: 2001,
      }),
    ).rejects.toThrow('A confirmed quote version can only create one sales order');
  });

  it('submits a draft sales order for manager approval', async () => {
    const service = new SalesOrderService();

    await expect(service.submit({ salesOrderId: 7, currentStatus: 'draft' })).resolves.toEqual({
      id: 7,
      status: 'pending_sales_manager_approval',
    });
  });

  it('rejects sales resubmission after shipment has started', async () => {
    const service = new SalesOrderService();

    await expect(
      service.resubmit({
        salesOrderId: 7,
        currentStatus: 'purchasing',
        hasShipmentBatches: true,
        changeReason: 'Need to revise quantity',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('voids a sales order and marks unshipped purchase orders for auto-void', async () => {
    const service = new SalesOrderService();

    const result = await service.cancel({
      salesOrderId: 7,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      unshippedPurchaseOrderIds: [101, 102],
    });

    expect(result.status).toBe('void');
    expect(result.autoVoidedPurchaseOrderIds).toEqual([101, 102]);
  });
});
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order.controller.spec.ts`:

```ts
import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { QuoteController } from '../src/quote/quote.controller';
import { QuoteService } from '../src/quote/quote.service';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('Sales order controllers', () => {
  it('converts a quote through the quote controller action endpoint', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        { provide: QuoteService, useValue: {} },
        {
          provide: SalesOrderService,
          useValue: {
            convertConfirmedQuote: jest.fn().mockResolvedValue({
              id: 11,
              salesNo: 'S202607080001',
              status: 'draft',
              currentVersionNo: 1,
            }),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuoteController);
    const result = await controller.convertToSales(9 as never, {
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
    });

    expect(result.status).toBe('draft');
  });

  it('uses ParseIntPipe for the quote conversion id param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      QuoteController,
      'convertToSales',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });

  it('uses ParseIntPipe for the sales detail id param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      SalesOrderController,
      'getDetail',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
```

- [ ] **Step 2: Run the sales tests to verify they fail**

Run: `CI=true pnpm --filter api test -- sales-order-rules.spec.ts sales-order.controller.spec.ts`
Expected: FAIL because the sales order module and quote conversion action do not exist yet

- [ ] **Step 3: Write the minimal sales implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/dto/convert-quote-to-sales.dto.ts`:

```ts
export class ConvertQuoteToSalesDto {
  quoteVersionNo!: number;
  customerId!: number;
  createdBy!: number;
  existingSalesOrderId?: number | null;
  quoteConfirmed?: boolean;
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/dto/resubmit-sales-order.dto.ts`:

```ts
export class ResubmitSalesOrderDto {
  changeReason!: string;
  hasShipmentBatches!: boolean;
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';

type ConvertPayload = {
  quoteOrderId: number;
  quoteVersionNo: number;
  quoteConfirmed?: boolean;
  existingSalesOrderId?: number | null;
  customerId: number;
  createdBy: number;
};

type SalesActionPayload = {
  salesOrderId: number;
  currentStatus: string;
};

type SalesResubmitPayload = SalesActionPayload & {
  hasShipmentBatches: boolean;
  changeReason: string;
};

type SalesCancelPayload = SalesActionPayload & {
  hasShipmentBatches: boolean;
  unshippedPurchaseOrderIds: number[];
};

@Injectable()
export class SalesOrderService {
  async convertConfirmedQuote(payload: ConvertPayload) {
    if (payload.quoteConfirmed === false) {
      throw new BadRequestException('Only confirmed quote versions can convert to sales orders');
    }

    if (payload.existingSalesOrderId) {
      throw new BadRequestException('A confirmed quote version can only create one sales order');
    }

    return {
      id: 1,
      salesNo: 'S202607080001',
      status: 'draft',
      currentVersionNo: 1,
      sourceQuoteOrderId: payload.quoteOrderId,
      sourceQuoteVersionNo: payload.quoteVersionNo,
      customerId: payload.customerId,
      createdBy: payload.createdBy,
    };
  }

  async getDetail(id: number) {
    return {
      id,
      salesNo: 'S202607080001',
      status: 'draft',
      currentVersionNo: 1,
      purchaseAggregateStatus: 'purchasing',
      shipmentAggregateStatus: 'purchasing',
    };
  }

  async submit(payload: SalesActionPayload) {
    if (payload.currentStatus !== 'draft') {
      throw new BadRequestException('Only draft sales orders can be submitted');
    }

    return { id: payload.salesOrderId, status: 'pending_sales_manager_approval' };
  }

  async approve(payload: SalesActionPayload) {
    if (payload.currentStatus !== 'pending_sales_manager_approval') {
      throw new BadRequestException('Only pending sales orders can be approved');
    }

    return { id: payload.salesOrderId, status: 'purchasing' };
  }

  async reject(payload: SalesActionPayload) {
    if (payload.currentStatus !== 'pending_sales_manager_approval') {
      throw new BadRequestException('Only pending sales orders can be rejected');
    }

    return { id: payload.salesOrderId, status: 'draft' };
  }

  async resubmit(payload: SalesResubmitPayload) {
    if (payload.currentStatus !== 'purchasing' || payload.hasShipmentBatches) {
      throw new BadRequestException('Only unshipped approved sales orders can be resubmitted');
    }

    return {
      id: payload.salesOrderId,
      status: 'pending_sales_manager_approval',
      nextVersionNo: 2,
      changeReason: payload.changeReason,
    };
  }

  async cancel(payload: SalesCancelPayload) {
    if (payload.currentStatus !== 'purchasing' || payload.hasShipmentBatches) {
      throw new BadRequestException('Only unshipped approved sales orders can be voided');
    }

    return {
      id: payload.salesOrderId,
      status: 'void',
      autoVoidedPurchaseOrderIds: payload.unshippedPurchaseOrderIds,
    };
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.controller.ts`:

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ResubmitSalesOrderDto } from './dto/resubmit-sales-order.dto';
import { SalesOrderService } from './sales-order.service';

@Controller('sales-orders')
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  @Get(':id')
  getDetail(@Param('id', ParseIntPipe) id: number) {
    return this.salesOrderService.getDetail(id);
  }

  @Post(':id/submit')
  submit(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.salesOrderService.submit({ salesOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.salesOrderService.approve({ salesOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.salesOrderService.reject({ salesOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/resubmit')
  resubmit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResubmitSalesOrderDto,
  ) {
    return this.salesOrderService.resubmit({
      salesOrderId: id,
      currentStatus: 'purchasing',
      hasShipmentBatches: dto.hasShipmentBatches,
      changeReason: dto.changeReason,
    });
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string; hasShipmentBatches: boolean; unshippedPurchaseOrderIds: number[] },
  ) {
    return this.salesOrderService.cancel({
      salesOrderId: id,
      currentStatus: body.currentStatus,
      hasShipmentBatches: body.hasShipmentBatches,
      unshippedPurchaseOrderIds: body.unshippedPurchaseOrderIds,
    });
  }
}
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/quote.controller.ts`:

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuoteService } from './quote.service';
import { ConvertQuoteToSalesDto } from '../sales-order/dto/convert-quote-to-sales.dto';

@Controller('quotes')
export class QuoteController {
  constructor(
    private readonly quoteService: QuoteService,
    private readonly salesOrderService: SalesOrderService,
  ) {}

  @Post()
  create(@Body() dto: CreateQuoteDto) {
    return this.quoteService.create(dto);
  }

  @Get(':id')
  getDetail(@Param('id', ParseIntPipe) id: number) {
    return this.quoteService.getDetail(id);
  }

  @Post(':id/convert-to-sales')
  convertToSales(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConvertQuoteToSalesDto,
  ) {
    return this.salesOrderService.convertConfirmedQuote({
      quoteOrderId: id,
      quoteVersionNo: dto.quoteVersionNo,
      quoteConfirmed: dto.quoteConfirmed ?? true,
      existingSalesOrderId: dto.existingSalesOrderId ?? null,
      customerId: dto.customerId,
      createdBy: dto.createdBy,
    });
  }
}
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { InquiryController } from './inquiry/inquiry.controller';
import { InquiryService } from './inquiry/inquiry.service';
import { QuoteController } from './quote/quote.controller';
import { QuoteService } from './quote/quote.service';
import { SalesOrderController } from './sales-order/sales-order.controller';
import { SalesOrderService } from './sales-order/sales-order.service';

@Module({
  controllers: [HealthController, QuoteController, InquiryController, SalesOrderController],
  providers: [QuoteService, InquiryService, SalesOrderService],
})
export class AppModule {}
```

- [ ] **Step 4: Run the sales tests to verify they pass**

Run: `CI=true pnpm --filter api test -- sales-order-rules.spec.ts sales-order.controller.spec.ts quote.controller.spec.ts`
Expected: PASS, covering rule logic plus the new quote conversion route

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/quote/quote.controller.ts apps/api/src/sales-order/dto/convert-quote-to-sales.dto.ts apps/api/src/sales-order/dto/resubmit-sales-order.dto.ts apps/api/src/sales-order/sales-order.controller.ts apps/api/src/sales-order/sales-order.service.ts apps/api/test/sales-order-rules.spec.ts apps/api/test/sales-order.controller.spec.ts
git commit -m "feat: add sales order conversion and approval rules"
```

### Task 4: Implement Supplier-Split Purchase Creation And Resubmit Rules

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/purchase-order/dto/create-purchase-orders-from-sales.dto.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/purchase-order/dto/resubmit-purchase-order.dto.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/purchase-order/purchase-order.controller.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/purchase-order/purchase-order.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/purchase-order-rules.spec.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/purchase-order.controller.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/purchase-order-rules.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/purchase-order.controller.spec.ts`

- [ ] **Step 1: Write the failing purchase tests**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/purchase-order-rules.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';

describe('PurchaseOrderService', () => {
  it('splits a sales order into purchase orders by supplier', async () => {
    const service = new PurchaseOrderService();

    const result = await service.createFromSalesOrder({
      salesOrderId: 7,
      items: [
        { salesItemId: 11, supplierId: 9001, productId: 3001, quantity: 10, unitPrice: 8.5 },
        { salesItemId: 12, supplierId: 9001, productId: 3002, quantity: 5, unitPrice: 9.5 },
        { salesItemId: 13, supplierId: 9002, productId: 3003, quantity: 2, unitPrice: 18.5 },
      ],
      createdBy: 2001,
    });

    expect(result.purchaseOrders).toHaveLength(2);
    expect(result.purchaseOrders[0].currentVersionNo).toBe(1);
  });

  it('rejects purchase creation when any sales item has no supplier selected', async () => {
    const service = new PurchaseOrderService();

    await expect(
      service.createFromSalesOrder({
        salesOrderId: 7,
        items: [
          { salesItemId: 11, supplierId: 0, productId: 3001, quantity: 10, unitPrice: 8.5 },
        ],
        createdBy: 2001,
      }),
    ).rejects.toThrow('Each sales item must resolve to a supplier before purchase splitting');
  });

  it('allows purchase resubmission with supplier change while preserving the source sales chain', async () => {
    const service = new PurchaseOrderService();

    const result = await service.resubmit({
      purchaseOrderId: 12,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      sourceSalesOrderId: 7,
      supplierId: 9003,
      changeReason: 'Original supplier out of stock',
    });

    expect(result.status).toBe('pending_purchase_manager_approval');
    expect(result.sourceSalesOrderId).toBe(7);
    expect(result.supplierId).toBe(9003);
  });

  it('rejects purchase cancellation after shipment has started', async () => {
    const service = new PurchaseOrderService();

    await expect(
      service.cancel({
        purchaseOrderId: 12,
        currentStatus: 'purchasing',
        hasShipmentBatches: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/purchase-order.controller.spec.ts`:

```ts
import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { PurchaseOrderController } from '../src/purchase-order/purchase-order.controller';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';

describe('PurchaseOrderController', () => {
  it('creates supplier-split purchase orders from a sales order', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [
        {
          provide: PurchaseOrderService,
          useValue: {
            createFromSalesOrder: jest.fn().mockResolvedValue({
              purchaseOrders: [
                { id: 1, purchaseNo: 'P202607080001', supplierId: 9001, currentVersionNo: 1 },
              ],
            }),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(PurchaseOrderController);
    const result = await controller.createFromSalesOrder(7 as never, {
      items: [{ salesItemId: 11, supplierId: 9001, productId: 3001, quantity: 10, unitPrice: 8.5 }],
      createdBy: 2001,
    });

    expect(result.purchaseOrders[0].supplierId).toBe(9001);
  });

  it('uses ParseIntPipe for the sales order source id route param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      PurchaseOrderController,
      'createFromSalesOrder',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
```

- [ ] **Step 2: Run the purchase tests to verify they fail**

Run: `CI=true pnpm --filter api test -- purchase-order-rules.spec.ts purchase-order.controller.spec.ts`
Expected: FAIL because the purchase order module does not exist yet

- [ ] **Step 3: Write the minimal purchase implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/purchase-order/dto/create-purchase-orders-from-sales.dto.ts`:

```ts
export class CreatePurchaseOrdersFromSalesDto {
  items!: Array<{
    salesItemId: number;
    supplierId: number;
    productId: number;
    quantity: number;
    unitPrice: number;
  }>;
  createdBy!: number;
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/purchase-order/dto/resubmit-purchase-order.dto.ts`:

```ts
export class ResubmitPurchaseOrderDto {
  currentStatus!: string;
  hasShipmentBatches!: boolean;
  sourceSalesOrderId!: number;
  supplierId!: number;
  changeReason!: string;
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/purchase-order/purchase-order.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';

type SalesSplitItem = {
  salesItemId: number;
  supplierId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
};

@Injectable()
export class PurchaseOrderService {
  async createFromSalesOrder(payload: {
    salesOrderId: number;
    items: SalesSplitItem[];
    createdBy: number;
  }) {
    if (payload.items.some((item) => item.supplierId <= 0)) {
      throw new BadRequestException(
        'Each sales item must resolve to a supplier before purchase splitting',
      );
    }

    const grouped = new Map<number, SalesSplitItem[]>();

    for (const item of payload.items) {
      const current = grouped.get(item.supplierId) ?? [];
      current.push(item);
      grouped.set(item.supplierId, current);
    }

    const purchaseOrders = Array.from(grouped.entries()).map(([supplierId, items], index) => ({
      id: index + 1,
      purchaseNo: `P20260708000${index + 1}`,
      sourceSalesOrderId: payload.salesOrderId,
      supplierId,
      currentVersionNo: 1,
      status: 'draft',
      itemCount: items.length,
      createdBy: payload.createdBy,
    }));

    return { purchaseOrders };
  }

  async getDetail(id: number) {
    return {
      id,
      purchaseNo: 'P202607080001',
      status: 'draft',
      currentVersionNo: 1,
    };
  }

  async submit(payload: { purchaseOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'draft') {
      throw new BadRequestException('Only draft purchase orders can be submitted');
    }

    return { id: payload.purchaseOrderId, status: 'pending_purchase_manager_approval' };
  }

  async approve(payload: { purchaseOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_purchase_manager_approval') {
      throw new BadRequestException('Only pending purchase orders can be approved');
    }

    return { id: payload.purchaseOrderId, status: 'purchasing' };
  }

  async reject(payload: { purchaseOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_purchase_manager_approval') {
      throw new BadRequestException('Only pending purchase orders can be rejected');
    }

    return { id: payload.purchaseOrderId, status: 'draft' };
  }

  async resubmit(payload: {
    purchaseOrderId: number;
    currentStatus: string;
    hasShipmentBatches: boolean;
    sourceSalesOrderId: number;
    supplierId: number;
    changeReason: string;
  }) {
    if (payload.currentStatus !== 'purchasing' || payload.hasShipmentBatches) {
      throw new BadRequestException('Only unshipped purchase orders can be resubmitted');
    }

    return {
      id: payload.purchaseOrderId,
      status: 'pending_purchase_manager_approval',
      nextVersionNo: 2,
      sourceSalesOrderId: payload.sourceSalesOrderId,
      supplierId: payload.supplierId,
      changeReason: payload.changeReason,
    };
  }

  async cancel(payload: {
    purchaseOrderId: number;
    currentStatus: string;
    hasShipmentBatches: boolean;
  }) {
    if (payload.currentStatus !== 'purchasing' || payload.hasShipmentBatches) {
      throw new BadRequestException('Only unshipped purchase orders can be voided');
    }

    return { id: payload.purchaseOrderId, status: 'void' };
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/purchase-order/purchase-order.controller.ts`:

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreatePurchaseOrdersFromSalesDto } from './dto/create-purchase-orders-from-sales.dto';
import { ResubmitPurchaseOrderDto } from './dto/resubmit-purchase-order.dto';
import { PurchaseOrderService } from './purchase-order.service';

@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  @Post('from-sales-order/:salesOrderId')
  createFromSalesOrder(
    @Param('salesOrderId', ParseIntPipe) salesOrderId: number,
    @Body() dto: CreatePurchaseOrdersFromSalesDto,
  ) {
    return this.purchaseOrderService.createFromSalesOrder({
      salesOrderId,
      items: dto.items,
      createdBy: dto.createdBy,
    });
  }

  @Get(':id')
  getDetail(@Param('id', ParseIntPipe) id: number) {
    return this.purchaseOrderService.getDetail(id);
  }

  @Post(':id/submit')
  submit(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.purchaseOrderService.submit({ purchaseOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.purchaseOrderService.approve({ purchaseOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.purchaseOrderService.reject({ purchaseOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/resubmit')
  resubmit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResubmitPurchaseOrderDto,
  ) {
    return this.purchaseOrderService.resubmit({
      purchaseOrderId: id,
      currentStatus: dto.currentStatus,
      hasShipmentBatches: dto.hasShipmentBatches,
      sourceSalesOrderId: dto.sourceSalesOrderId,
      supplierId: dto.supplierId,
      changeReason: dto.changeReason,
    });
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string; hasShipmentBatches: boolean },
  ) {
    return this.purchaseOrderService.cancel({
      purchaseOrderId: id,
      currentStatus: body.currentStatus,
      hasShipmentBatches: body.hasShipmentBatches,
    });
  }
}
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { InquiryController } from './inquiry/inquiry.controller';
import { InquiryService } from './inquiry/inquiry.service';
import { PurchaseOrderController } from './purchase-order/purchase-order.controller';
import { PurchaseOrderService } from './purchase-order/purchase-order.service';
import { QuoteController } from './quote/quote.controller';
import { QuoteService } from './quote/quote.service';
import { SalesOrderController } from './sales-order/sales-order.controller';
import { SalesOrderService } from './sales-order/sales-order.service';

@Module({
  controllers: [
    HealthController,
    QuoteController,
    InquiryController,
    SalesOrderController,
    PurchaseOrderController,
  ],
  providers: [QuoteService, InquiryService, SalesOrderService, PurchaseOrderService],
})
export class AppModule {}
```

- [ ] **Step 4: Run the purchase tests to verify they pass**

Run: `CI=true pnpm --filter api test -- purchase-order-rules.spec.ts purchase-order.controller.spec.ts`
Expected: PASS, covering supplier split, purchase resubmit, and route param parsing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/purchase-order/dto/create-purchase-orders-from-sales.dto.ts apps/api/src/purchase-order/dto/resubmit-purchase-order.dto.ts apps/api/src/purchase-order/purchase-order.controller.ts apps/api/src/purchase-order/purchase-order.service.ts apps/api/test/purchase-order-rules.spec.ts apps/api/test/purchase-order.controller.spec.ts
git commit -m "feat: add purchase split and resubmit workflows"
```

### Task 5: Add Minimal Sales And Purchase Workspace Pages

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/purchase-orders/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-orders-page.test.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/purchase-orders-page.test.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/package.json`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-orders-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/purchase-orders-page.test.tsx`

- [ ] **Step 1: Write the failing workspace page tests**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-orders-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import SalesOrdersPage from '../app/sales-orders/page';

describe('SalesOrdersPage', () => {
  it('renders the sales workspace with versioning and traceability cues', () => {
    render(<SalesOrdersPage />);

    expect(screen.getByRole('heading', { name: '销售订单中心' })).toBeInTheDocument();
    expect(screen.getByText('支持报价转销售、改单重提、撤销留痕')).toBeInTheDocument();
    expect(screen.getByText('当前展示：销售审批与履约汇总状态')).toBeInTheDocument();
  });
});
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/purchase-orders-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import PurchaseOrdersPage from '../app/purchase-orders/page';

describe('PurchaseOrdersPage', () => {
  it('renders the purchase workspace with supplier split context', () => {
    render(<PurchaseOrdersPage />);

    expect(screen.getByRole('heading', { name: '采购执行中心' })).toBeInTheDocument();
    expect(screen.getByText('按供应商拆单，并保留销售来源追溯')).toBeInTheDocument();
    expect(screen.getByText('当前展示：采购审批与履约汇总状态')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the workspace page tests to verify they fail**

Run: `CI=true pnpm --filter web test`
Expected: FAIL because the sales and purchase workspace pages do not exist yet

- [ ] **Step 3: Write the minimal workspace pages**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/package.json`:

```json
{
  "name": "web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "lint": "next lint",
    "format": "prettier --check ."
  },
  "dependencies": {
    "@erp/shared": "workspace:*"
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/page.tsx`:

```tsx
import { salesApprovalStatuses, salesFulfillmentStatuses } from '@erp/shared';

export default function SalesOrdersPage() {
  return (
    <main>
      <h1>销售订单中心</h1>
      <p>支持报价转销售、改单重提、撤销留痕</p>
      <p>当前展示：销售审批与履约汇总状态</p>
      <section aria-label="sales-approval-statuses">
        <h2>审批状态</h2>
        <ul>
          {salesApprovalStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>
      <section aria-label="sales-fulfillment-statuses">
        <h2>履约汇总状态</h2>
        <ul>
          {salesFulfillmentStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/purchase-orders/page.tsx`:

```tsx
import { purchaseApprovalStatuses, purchaseFulfillmentStatuses } from '@erp/shared';

export default function PurchaseOrdersPage() {
  return (
    <main>
      <h1>采购执行中心</h1>
      <p>按供应商拆单，并保留销售来源追溯</p>
      <p>当前展示：采购审批与履约汇总状态</p>
      <section aria-label="purchase-approval-statuses">
        <h2>审批状态</h2>
        <ul>
          {purchaseApprovalStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>
      <section aria-label="purchase-fulfillment-statuses">
        <h2>履约汇总状态</h2>
        <ul>
          {purchaseFulfillmentStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run the workspace page tests to verify they pass**

Run: `CI=true pnpm --filter @erp/shared build && CI=true pnpm --filter web test`
Expected: PASS, proving the web app can consume the built shared runtime package and render the new module entry pages

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/app/sales-orders/page.tsx apps/web/app/purchase-orders/page.tsx apps/web/tests/sales-orders-page.test.tsx apps/web/tests/purchase-orders-page.test.tsx
git commit -m "feat: add sales and purchase workspace pages"
```

### Task 6: Run Slice-Wide Verification

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/docs/superpowers/plans/2026-07-08-sales-purchase-mvp.md`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src`

- [ ] **Step 1: Run package-level verification**

Run: `CI=true pnpm --filter @erp/shared test && CI=true pnpm --filter @erp/shared build && CI=true pnpm --filter api test && CI=true pnpm --filter web test`
Expected: PASS across all three packages

- [ ] **Step 2: Run focused production builds**

Run: `CI=true pnpm --filter web build`
Expected: PASS with the sales and purchase workspace pages included in the app build output

- [ ] **Step 3: Mark completed tasks in the plan**

Update this file so every finished checkbox reflects the actual execution result before handoff or merge.

- [ ] **Step 4: Commit the final slice**

```bash
git add apps/api apps/web packages/shared docs/superpowers/plans/2026-07-08-sales-purchase-mvp.md
git commit -m "feat: deliver sales and purchase mvp slice"
```
