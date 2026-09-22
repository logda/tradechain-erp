# Shipment MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next ERP vertical slice for shipment batch creation, forwarder status progression, receipt upload/send, and a minimal shipment workspace page.

**Architecture:** Extend the current modular monolith using the same thin-slice pattern as sales, purchase, and sample modules. Start by stabilizing shared shipment runtime contracts, then add Prisma shipment models, rule-first NestJS service/controller logic, and finish with a minimal Next.js workspace page that exposes shipment lifecycle states without overbuilding UI.

**Tech Stack:** pnpm workspaces, NestJS, Next.js App Router, Prisma, TypeScript, Vitest, Jest

---

### Task 1: Add Shared Shipment Batch Status Contracts

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/shipment-batch-status.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/shipment-batch-status.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/shipment-batch-status.spec.ts`

- [ ] **Step 1: Write the failing shared shipment status test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/shipment-batch-status.spec.ts`:

```ts
import {
  receiptSendStatuses,
  shipmentBatchStatuses,
} from './shipment-batch-status.js';

describe('shipment batch statuses', () => {
  it('exposes the full shipment batch lifecycle in order', () => {
    expect(shipmentBatchStatuses).toEqual([
      'shipped',
      'to_forwarder',
      'forwarder_shipped',
      'arrived',
      'exception',
    ]);
  });

  it('exposes the receipt sending statuses in order', () => {
    expect(receiptSendStatuses).toEqual(['pending', 'sent']);
  });
});
```

- [ ] **Step 2: Run the shared package test to verify it fails**

Run: `CI=true pnpm --filter @erp/shared test`
Expected: FAIL because `shipment-batch-status.ts` does not exist yet

- [ ] **Step 3: Write the minimal shared runtime implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/shipment-batch-status.ts`:

```ts
export const shipmentBatchStatuses = [
  'shipped',
  'to_forwarder',
  'forwarder_shipped',
  'arrived',
  'exception',
] as const;

export const receiptSendStatuses = ['pending', 'sent'] as const;

export type ShipmentBatchStatus = (typeof shipmentBatchStatuses)[number];
export type ReceiptSendStatus = (typeof receiptSendStatuses)[number];
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`:

```ts
export * from './quote-status.js';
export * from './inquiry-status.js';
export * from './sales-order-status.js';
export * from './purchase-order-status.js';
export * from './sample-order-status.js';
export * from './shipment-batch-status.js';
```

- [ ] **Step 4: Run the shared package test to verify it passes**

Run: `CI=true pnpm --filter @erp/shared test`
Expected: PASS with the shipment batch status spec included

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/shipment-batch-status.ts packages/shared/src/shipment-batch-status.spec.ts packages/shared/src/index.ts
git commit -m "feat: add shared shipment batch status contracts"
```

### Task 2: Add Shipment Batch Prisma Model

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/prisma/schema.prisma`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/shipment-schema.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/shipment-schema.spec.ts`

- [ ] **Step 1: Write the failing schema test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/shipment-schema.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Shipment Prisma schema', () => {
  it('contains shipment batch fields for quantity tracking and receipt sending', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const match = schema.match(/model ShipmentBatch \{[\s\S]*?\n\}/m);

    expect(match).not.toBeNull();

    const shipmentBatch = match?.[0] ?? '';

    expect(schema).toContain('model ShipmentBatch');
    expect(shipmentBatch).toMatch(/batchNo\s+String\s+@unique\s+@db.VarChar\(64\)/);
    expect(shipmentBatch).toMatch(/salesOrderId\s+BigInt/);
    expect(shipmentBatch).toMatch(/purchaseOrderId\s+BigInt/);
    expect(shipmentBatch).toMatch(/status\s+String\s+@db.VarChar\(32\)/);
    expect(shipmentBatch).toMatch(/shippedQty\s+Int/);
    expect(shipmentBatch).toMatch(/accumulatedQty\s+Int/);
    expect(shipmentBatch).toMatch(/remainingQty\s+Int/);
    expect(shipmentBatch).toMatch(/receiptSendStatus\s+String\s+@db.VarChar\(16\)/);
    expect(shipmentBatch).toMatch(/receiptDocUrl\s+String\?\s+@db.VarChar\(255\)/);
    expect(shipmentBatch).toMatch(/receiptSentAt\s+DateTime\?/);
  });
});
```

- [ ] **Step 2: Run the API test to verify it fails**

Run: `CI=true pnpm --filter api test -- shipment-schema.spec.ts`
Expected: FAIL because the shipment model does not exist yet

- [ ] **Step 3: Add the minimal shipment Prisma model**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/prisma/schema.prisma` by adding:

```prisma
model ShipmentBatch {
  id                BigInt   @id @default(autoincrement())
  batchNo           String   @unique @db.VarChar(64)
  salesOrderId      BigInt
  purchaseOrderId   BigInt
  status            String   @db.VarChar(32)
  shippedQty        Int
  accumulatedQty    Int
  remainingQty      Int
  shippedAt         DateTime
  receiptSendStatus String   @db.VarChar(16)
  receiptDocUrl     String?  @db.VarChar(255)
  receiptSentAt     DateTime?
  receiptSentBy     BigInt?
  createdBy         BigInt
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

- [ ] **Step 4: Run the API schema test to verify it passes**

Run: `CI=true pnpm --filter api test -- shipment-schema.spec.ts`
Expected: PASS with the shipment schema assertions satisfied

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/test/shipment-schema.spec.ts
git commit -m "feat: add shipment batch prisma model"
```

### Task 3: Add Shipment Batch Rules Service

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/shipment-batch/dto/create-shipment-batch.dto.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/shipment-batch/shipment-batch.service.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/shipment-batch-rules.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/shipment-batch-rules.spec.ts`

- [ ] **Step 1: Write the failing shipment rules test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/shipment-batch-rules.spec.ts`:

```ts
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';

describe('ShipmentBatchService', () => {
  it('creates a shipment batch and marks the related sales order as locked by first shipment', async () => {
    const service = new ShipmentBatchService();

    const result = await service.create({
      salesOrderId: 9,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-08T12:00:00.000Z',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    expect(result.status).toBe('shipped');
    expect(result.salesOrderLocked).toBe(true);
    expect(result.purchaseOrderStatus).toBe('shipped');
  });

  it('rejects shipment batch creation when accumulated quantity is less than shipped quantity', async () => {
    const service = new ShipmentBatchService();

    await expect(
      service.create({
        salesOrderId: 9,
        purchaseOrderId: 21,
        shippedQty: 40,
        accumulatedQty: 20,
        remainingQty: 80,
        shippedAt: '2026-07-08T12:00:00.000Z',
        createdBy: 2001,
        purchaseOrderCurrentStatus: 'purchasing',
        currentBatchCount: 0,
      }),
    ).rejects.toThrow('Accumulated quantity cannot be less than shipped quantity');
  });

  it('moves a shipment batch through forwarder, forwarder shipped, and arrived statuses', async () => {
    const service = new ShipmentBatchService();

    const toForwarder = await service.markToForwarder({
      shipmentBatchId: 3,
      currentStatus: 'shipped',
    });
    const forwarderShipped = await service.markForwarderShipped({
      shipmentBatchId: 3,
      currentStatus: toForwarder.status,
    });
    const arrived = await service.markArrived({
      shipmentBatchId: 3,
      currentStatus: forwarderShipped.status,
    });

    expect(toForwarder.status).toBe('to_forwarder');
    expect(forwarderShipped.status).toBe('forwarder_shipped');
    expect(arrived.status).toBe('arrived');
  });

  it('requires an uploaded receipt before sending it to the customer', async () => {
    const service = new ShipmentBatchService();

    await expect(
      service.sendReceipt({
        shipmentBatchId: 3,
        receiptDocUrl: null,
        sentBy: 2001,
      }),
    ).rejects.toThrow('Receipt document is required before sending');
  });
});
```

- [ ] **Step 2: Run the API test to verify it fails**

Run: `CI=true pnpm --filter api test -- shipment-batch-rules.spec.ts`
Expected: FAIL because the shipment batch service does not exist yet

- [ ] **Step 3: Add the minimal shipment rules service**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/shipment-batch/dto/create-shipment-batch.dto.ts`:

```ts
export type CreateShipmentBatchDto = {
  salesOrderId: number;
  purchaseOrderId: number;
  shippedQty: number;
  accumulatedQty: number;
  remainingQty: number;
  shippedAt: string;
  createdBy: number;
  purchaseOrderCurrentStatus: string;
  currentBatchCount: number;
};
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/shipment-batch/shipment-batch.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class ShipmentBatchService {
  async create(payload: {
    salesOrderId: number;
    purchaseOrderId: number;
    shippedQty: number;
    accumulatedQty: number;
    remainingQty: number;
    shippedAt: string;
    createdBy: number;
    purchaseOrderCurrentStatus: string;
    currentBatchCount: number;
  }) {
    if (payload.purchaseOrderCurrentStatus !== 'purchasing') {
      throw new BadRequestException('Only purchasing purchase orders can create shipment batches');
    }

    if (payload.accumulatedQty < payload.shippedQty) {
      throw new BadRequestException(
        'Accumulated quantity cannot be less than shipped quantity',
      );
    }

    if (payload.remainingQty < 0) {
      throw new BadRequestException('Remaining quantity cannot be negative');
    }

    return {
      id: payload.purchaseOrderId,
      batchNo: 'SH202607080001',
      status: 'shipped',
      shippedQty: payload.shippedQty,
      accumulatedQty: payload.accumulatedQty,
      remainingQty: payload.remainingQty,
      shippedAt: payload.shippedAt,
      purchaseOrderStatus: 'shipped',
      salesOrderLocked: payload.currentBatchCount === 0,
      createdBy: payload.createdBy,
      salesOrderId: payload.salesOrderId,
    };
  }

  async getDetail(id: number) {
    return {
      id,
      batchNo: 'SH202607080001',
      status: 'shipped',
      receiptSendStatus: 'pending',
    };
  }

  async markToForwarder(payload: {
    shipmentBatchId: number;
    currentStatus: string;
  }) {
    if (payload.currentStatus !== 'shipped') {
      throw new BadRequestException('Only shipped batches can be moved to forwarder');
    }

    return {
      id: payload.shipmentBatchId,
      status: 'to_forwarder',
    };
  }

  async markForwarderShipped(payload: {
    shipmentBatchId: number;
    currentStatus: string;
  }) {
    if (payload.currentStatus !== 'to_forwarder') {
      throw new BadRequestException(
        'Only to-forwarder batches can be marked forwarder shipped',
      );
    }

    return {
      id: payload.shipmentBatchId,
      status: 'forwarder_shipped',
    };
  }

  async markArrived(payload: {
    shipmentBatchId: number;
    currentStatus: string;
  }) {
    if (payload.currentStatus !== 'forwarder_shipped') {
      throw new BadRequestException(
        'Only forwarder-shipped batches can be marked arrived',
      );
    }

    return {
      id: payload.shipmentBatchId,
      status: 'arrived',
    };
  }

  async markException(payload: {
    shipmentBatchId: number;
    currentStatus: string;
    reason: string;
  }) {
    if (payload.currentStatus === 'arrived') {
      throw new BadRequestException('Arrived batches cannot be marked exception');
    }

    return {
      id: payload.shipmentBatchId,
      status: 'exception',
      reason: payload.reason,
    };
  }

  async uploadReceipt(payload: {
    shipmentBatchId: number;
    receiptDocUrl: string;
  }) {
    if (!payload.receiptDocUrl) {
      throw new BadRequestException('Receipt document url is required');
    }

    return {
      id: payload.shipmentBatchId,
      receiptDocUrl: payload.receiptDocUrl,
      receiptSendStatus: 'pending',
    };
  }

  async sendReceipt(payload: {
    shipmentBatchId: number;
    receiptDocUrl: string | null;
    sentBy: number;
  }) {
    if (!payload.receiptDocUrl) {
      throw new BadRequestException('Receipt document is required before sending');
    }

    return {
      id: payload.shipmentBatchId,
      receiptSendStatus: 'sent',
      receiptSentBy: payload.sentBy,
    };
  }
}
```

- [ ] **Step 4: Run the API test to verify it passes**

Run: `CI=true pnpm --filter api test -- shipment-batch-rules.spec.ts`
Expected: PASS with shipment creation, status transitions, and receipt sending rules covered

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/shipment-batch/dto/create-shipment-batch.dto.ts apps/api/src/shipment-batch/shipment-batch.service.ts apps/api/test/shipment-batch-rules.spec.ts
git commit -m "feat: add shipment batch lifecycle rules"
```

### Task 4: Add Shipment Batch Controller Endpoints

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/shipment-batch/shipment-batch.controller.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/shipment-batch.controller.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/shipment-batch.controller.spec.ts`

- [ ] **Step 1: Write the failing controller test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/shipment-batch.controller.spec.ts`:

```ts
import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ShipmentBatchController } from '../src/shipment-batch/shipment-batch.controller';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';

describe('ShipmentBatchController', () => {
  it('creates a shipment batch from purchase execution context', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 3,
      batchNo: 'SH202607080001',
      status: 'shipped',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [ShipmentBatchController],
      providers: [{ provide: ShipmentBatchService, useValue: { create } }],
    }).compile();

    const controller = moduleRef.get(ShipmentBatchController);
    const result = await controller.create({
      salesOrderId: 9,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-08T12:00:00.000Z',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    expect(create).toHaveBeenCalled();
    expect(result.status).toBe('shipped');
  });

  it('uses ParseIntPipe for the shipment batch detail id param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      ShipmentBatchController,
      'getDetail',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes).toHaveLength(1);
    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
```

- [ ] **Step 2: Run the API test to verify it fails**

Run: `CI=true pnpm --filter api test -- shipment-batch.controller.spec.ts`
Expected: FAIL because the shipment controller does not exist yet

- [ ] **Step 3: Add the minimal controller and module wiring**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/shipment-batch/shipment-batch.controller.ts`:

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateShipmentBatchDto } from './dto/create-shipment-batch.dto';
import { ShipmentBatchService } from './shipment-batch.service';

@Controller('shipment-batches')
export class ShipmentBatchController {
  constructor(private readonly shipmentBatchService: ShipmentBatchService) {}

  @Post()
  create(@Body() body: CreateShipmentBatchDto) {
    return this.shipmentBatchService.create(body);
  }

  @Get(':id')
  getDetail(@Param('id', ParseIntPipe) id: number) {
    return this.shipmentBatchService.getDetail(id);
  }

  @Post(':id/mark-to-forwarder')
  markToForwarder(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.shipmentBatchService.markToForwarder({
      shipmentBatchId: id,
      currentStatus: body.currentStatus,
    });
  }

  @Post(':id/mark-forwarder-shipped')
  markForwarderShipped(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
  ) {
    return this.shipmentBatchService.markForwarderShipped({
      shipmentBatchId: id,
      currentStatus: body.currentStatus,
    });
  }

  @Post(':id/mark-arrived')
  markArrived(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.shipmentBatchService.markArrived({
      shipmentBatchId: id,
      currentStatus: body.currentStatus,
    });
  }

  @Post(':id/mark-exception')
  markException(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string; reason: string },
  ) {
    return this.shipmentBatchService.markException({
      shipmentBatchId: id,
      currentStatus: body.currentStatus,
      reason: body.reason,
    });
  }

  @Post(':id/upload-receipt')
  uploadReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { receiptDocUrl: string },
  ) {
    return this.shipmentBatchService.uploadReceipt({
      shipmentBatchId: id,
      receiptDocUrl: body.receiptDocUrl,
    });
  }

  @Post(':id/send-receipt')
  sendReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { receiptDocUrl: string | null; sentBy: number },
  ) {
    return this.shipmentBatchService.sendReceipt({
      shipmentBatchId: id,
      receiptDocUrl: body.receiptDocUrl,
      sentBy: body.sentBy,
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
import { SampleOrderController } from './sample-order/sample-order.controller';
import { SampleOrderService } from './sample-order/sample-order.service';
import { SalesOrderController } from './sales-order/sales-order.controller';
import { SalesOrderService } from './sales-order/sales-order.service';
import { ShipmentBatchController } from './shipment-batch/shipment-batch.controller';
import { ShipmentBatchService } from './shipment-batch/shipment-batch.service';

@Module({
  controllers: [
    HealthController,
    QuoteController,
    InquiryController,
    SalesOrderController,
    PurchaseOrderController,
    SampleOrderController,
    ShipmentBatchController,
  ],
  providers: [
    QuoteService,
    InquiryService,
    SalesOrderService,
    PurchaseOrderService,
    SampleOrderService,
    ShipmentBatchService,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Run the API test to verify it passes**

Run: `CI=true pnpm --filter api test -- shipment-batch.controller.spec.ts`
Expected: PASS with the shipment routes wired and ParseIntPipe applied

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/shipment-batch/shipment-batch.controller.ts apps/api/test/shipment-batch.controller.spec.ts
git commit -m "feat: add shipment batch controller endpoints"
```

### Task 5: Add A Minimal Shipment Workspace Page

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/shipment-batches/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/shipment-batches-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/shipment-batches-page.test.tsx`

- [ ] **Step 1: Write the failing shipment page test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/shipment-batches-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import ShipmentBatchesPage from '../app/shipment-batches/page';

describe('ShipmentBatchesPage', () => {
  it('renders the shipment workspace with batch and receipt cues', () => {
    render(<ShipmentBatchesPage />);

    expect(screen.getByRole('heading', { name: '发货履约中心' })).toBeInTheDocument();
    expect(screen.getByText('支持分批发货、货代推进和回单发送留痕')).toBeInTheDocument();
    expect(screen.getByText('shipped')).toBeInTheDocument();
    expect(screen.getByText('forwarder_shipped')).toBeInTheDocument();
    expect(screen.getByText('sent')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the web test to verify it fails**

Run: `CI=true pnpm --filter web test`
Expected: FAIL because the shipment workspace page does not exist yet

- [ ] **Step 3: Add the minimal shipment workspace page**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/shipment-batches/page.tsx`:

```tsx
import { receiptSendStatuses, shipmentBatchStatuses } from '@erp/shared';

export default function ShipmentBatchesPage() {
  return (
    <main>
      <h1>发货履约中心</h1>
      <p>支持分批发货、货代推进和回单发送留痕</p>
      <p>当前展示：发货批次状态与回单发送状态</p>

      <section aria-labelledby="shipment-batch-statuses">
        <h2 id="shipment-batch-statuses">批次状态</h2>
        <ul>
          {shipmentBatchStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="receipt-send-statuses">
        <h2 id="receipt-send-statuses">回单发送状态</h2>
        <ul>
          {receiptSendStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run the web test to verify it passes**

Run: `CI=true pnpm --filter @erp/shared build && CI=true pnpm --filter web test`
Expected: PASS with the new shipment page test included

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/shipment-batches/page.tsx apps/web/tests/shipment-batches-page.test.tsx
git commit -m "feat: add shipment workspace page"
```

### Task 6: Run Slice-Wide Verification

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/docs/superpowers/plans/2026-07-08-shipment-mvp.md`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests`

- [ ] **Step 1: Run package-level verification**

Run: `CI=true pnpm --filter @erp/shared test && CI=true pnpm --filter @erp/shared build && CI=true pnpm --filter api test && CI=true pnpm --filter web test`
Expected: PASS across shared, api, and web

- [ ] **Step 2: Run the focused web production build**

Run: `CI=true pnpm --filter web build`
Expected: PASS with `/shipment-batches` included in the build output

- [ ] **Step 3: Mark completed tasks in the plan**

Update this file so every finished checkbox reflects the actual execution result before handoff or merge.

- [ ] **Step 4: Commit the final shipment slice**

```bash
git add apps/api apps/web packages/shared docs/superpowers/plans/2026-07-08-shipment-mvp.md
git commit -m "feat: deliver shipment mvp slice"
```
