# After Sales And Finance MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next ERP vertical slice for after-sales order lifecycle, receipt and finance confirmation updates, close validation, and a minimal after-sales workspace page.

**Architecture:** Extend the current modular monolith with the same thin-slice pattern used for samples and shipments. Start by stabilizing shared after-sales and finance runtime contracts, then add Prisma models and rule-first NestJS services/controllers, and finish with a minimal Next.js workspace page that exposes the closure-related lifecycle without overbuilding UI.

**Tech Stack:** pnpm workspaces, NestJS, Next.js App Router, Prisma, TypeScript, Vitest, Jest

---

### Task 1: Add Shared After-Sales And Finance Status Contracts

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/after-sales-status.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/after-sales-status.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/after-sales-status.spec.ts`

- [ ] **Step 1: Write the failing shared status test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/after-sales-status.spec.ts`:

```ts
import {
  afterSalesStatuses,
  financeConfirmStatuses,
  receiptCollectionStatuses,
} from './after-sales-status.js';

describe('after sales and finance statuses', () => {
  it('exposes the full after-sales lifecycle in order', () => {
    expect(afterSalesStatuses).toEqual([
      'pending_submit',
      'pending_approval',
      'processing',
      'finance_reviewing',
      'finished',
      'closed',
    ]);
  });

  it('exposes the receipt collection statuses in order', () => {
    expect(receiptCollectionStatuses).toEqual([
      'unpaid',
      'deposit_received',
      'fully_paid',
      'prepaid_deducted',
    ]);
  });

  it('exposes the finance confirmation statuses in order', () => {
    expect(financeConfirmStatuses).toEqual(['pending', 'confirmed']);
  });
});
```

- [ ] **Step 2: Run the shared package test to verify it fails**

Run: `CI=true pnpm --filter @erp/shared test`
Expected: FAIL because `after-sales-status.ts` does not exist yet

- [ ] **Step 3: Write the minimal shared runtime implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/after-sales-status.ts`:

```ts
export const afterSalesStatuses = [
  'pending_submit',
  'pending_approval',
  'processing',
  'finance_reviewing',
  'finished',
  'closed',
] as const;

export const receiptCollectionStatuses = [
  'unpaid',
  'deposit_received',
  'fully_paid',
  'prepaid_deducted',
] as const;

export const financeConfirmStatuses = ['pending', 'confirmed'] as const;

export type AfterSalesStatus = (typeof afterSalesStatuses)[number];
export type ReceiptCollectionStatus = (typeof receiptCollectionStatuses)[number];
export type FinanceConfirmStatus = (typeof financeConfirmStatuses)[number];
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`:

```ts
export * from './quote-status.js';
export * from './inquiry-status.js';
export * from './sales-order-status.js';
export * from './purchase-order-status.js';
export * from './sample-order-status.js';
export * from './shipment-batch-status.js';
export * from './after-sales-status.js';
```

- [ ] **Step 4: Run the shared package test to verify it passes**

Run: `CI=true pnpm --filter @erp/shared test`
Expected: PASS with the after-sales status spec included

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/after-sales-status.ts packages/shared/src/after-sales-status.spec.ts packages/shared/src/index.ts
git commit -m "feat: add shared after sales status contracts"
```

### Task 2: Add After-Sales Prisma Model And Sales Close Fields

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/prisma/schema.prisma`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/after-sales-schema.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/after-sales-schema.spec.ts`

- [ ] **Step 1: Write the failing schema test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/after-sales-schema.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('After sales Prisma schema', () => {
  it('contains after-sales fields for closure and finance traceability', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const getModelBlock = (modelName: string) => {
      const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm'));

      expect(match).not.toBeNull();

      return match?.[0] ?? '';
    };

    const salesOrder = getModelBlock('SalesOrder');
    const afterSalesOrder = getModelBlock('AfterSalesOrder');

    expect(salesOrder).toMatch(/afterSalesEndStatus\s+String\s+@db.VarChar\(32\)/);
    expect(salesOrder).toMatch(/financeStatus\s+String\s+@db.VarChar\(32\)/);
    expect(afterSalesOrder).toMatch(/afterSalesNo\s+String\s+@unique\s+@db.VarChar\(64\)/);
    expect(afterSalesOrder).toMatch(/salesOrderId\s+BigInt/);
    expect(afterSalesOrder).toMatch(/purchaseOrderId\s+BigInt\?/);
    expect(afterSalesOrder).toMatch(/shipmentBatchId\s+BigInt\?/);
    expect(afterSalesOrder).toMatch(/type\s+String\s+@db.VarChar\(32\)/);
    expect(afterSalesOrder).toMatch(/status\s+String\s+@db.VarChar\(32\)/);
    expect(afterSalesOrder).toMatch(/financeReviewStatus\s+String\s+@db.VarChar\(32\)/);
  });
});
```

- [ ] **Step 2: Run the API test to verify it fails**

Run: `CI=true pnpm --filter api test -- after-sales-schema.spec.ts`
Expected: FAIL because the after-sales model and sales close fields do not exist yet

- [ ] **Step 3: Add the minimal Prisma fields and model**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/prisma/schema.prisma` by:

1. Updating `SalesOrder` to include:

```prisma
  afterSalesEndStatus    String              @db.VarChar(32)
```

2. Adding the new model:

```prisma
model AfterSalesOrder {
  id                BigInt   @id @default(autoincrement())
  afterSalesNo      String   @unique @db.VarChar(64)
  salesOrderId      BigInt
  purchaseOrderId   BigInt?
  shipmentBatchId   BigInt?
  type              String   @db.VarChar(32)
  status            String   @db.VarChar(32)
  financeReviewStatus String @db.VarChar(32)
  issueDescription  String   @db.Text
  createdBy         BigInt
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

- [ ] **Step 4: Run the API schema test to verify it passes**

Run: `CI=true pnpm --filter api test -- after-sales-schema.spec.ts`
Expected: PASS with the after-sales schema assertions satisfied

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/test/after-sales-schema.spec.ts
git commit -m "feat: add after sales prisma model"
```

### Task 3: Add After-Sales Lifecycle Service And Controller

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/after-sales/dto/create-after-sales-order.dto.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/after-sales/after-sales.service.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/after-sales/after-sales.controller.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/after-sales-rules.spec.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/after-sales.controller.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/after-sales-rules.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/after-sales.controller.spec.ts`

- [ ] **Step 1: Write the failing after-sales rules test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/after-sales-rules.spec.ts`:

```ts
import { AfterSalesService } from '../src/after-sales/after-sales.service';

describe('AfterSalesService', () => {
  it('creates an after-sales order tied to a sales order and optional shipment batch', async () => {
    const service = new AfterSalesService();

    const result = await service.create({
      salesOrderId: 9,
      purchaseOrderId: 21,
      shipmentBatchId: 3,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2001,
    });

    expect(result.status).toBe('pending_submit');
    expect(result.financeReviewStatus).toBe('pending');
  });

  it('moves an after-sales order through approval, processing, finish, and close', async () => {
    const service = new AfterSalesService();

    const submitted = await service.submit({
      afterSalesOrderId: 5,
      currentStatus: 'pending_submit',
    });
    const approved = await service.approve({
      afterSalesOrderId: 5,
      currentStatus: submitted.status,
    });
    const processing = await service.startProcessing({
      afterSalesOrderId: 5,
      currentStatus: approved.status,
    });
    const finished = await service.finish({
      afterSalesOrderId: 5,
      currentStatus: processing.status,
    });
    const closed = await service.close({
      afterSalesOrderId: 5,
      currentStatus: finished.status,
      financeReviewStatus: 'confirmed',
    });

    expect(submitted.status).toBe('pending_approval');
    expect(approved.status).toBe('processing');
    expect(processing.status).toBe('finance_reviewing');
    expect(finished.status).toBe('finished');
    expect(closed.status).toBe('closed');
  });

  it('rejects close when finance review is not confirmed', async () => {
    const service = new AfterSalesService();

    await expect(
      service.close({
        afterSalesOrderId: 5,
        currentStatus: 'finished',
        financeReviewStatus: 'pending',
      }),
    ).rejects.toThrow('Finance review must be confirmed before closing after sales');
  });
});
```

- [ ] **Step 2: Run the API test to verify it fails**

Run: `CI=true pnpm --filter api test -- after-sales-rules.spec.ts`
Expected: FAIL because the after-sales service does not exist yet

- [ ] **Step 3: Add the minimal after-sales service and DTO**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/after-sales/dto/create-after-sales-order.dto.ts`:

```ts
export type CreateAfterSalesOrderDto = {
  salesOrderId: number;
  purchaseOrderId?: number;
  shipmentBatchId?: number;
  type: string;
  issueDescription: string;
  createdBy: number;
};
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/after-sales/after-sales.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class AfterSalesService {
  async create(payload: {
    salesOrderId: number;
    purchaseOrderId?: number;
    shipmentBatchId?: number;
    type: string;
    issueDescription: string;
    createdBy: number;
  }) {
    return {
      id: payload.salesOrderId,
      afterSalesNo: 'AS202607080001',
      status: 'pending_submit',
      financeReviewStatus: 'pending',
      ...payload,
    };
  }

  async getDetail(id: number) {
    return {
      id,
      afterSalesNo: 'AS202607080001',
      status: 'pending_submit',
      financeReviewStatus: 'pending',
    };
  }

  async submit(payload: { afterSalesOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_submit') {
      throw new BadRequestException('Only pending submit after-sales orders can be submitted');
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'pending_approval',
    };
  }

  async approve(payload: { afterSalesOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_approval') {
      throw new BadRequestException('Only pending approval after-sales orders can be approved');
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'processing',
    };
  }

  async reject(payload: { afterSalesOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_approval') {
      throw new BadRequestException('Only pending approval after-sales orders can be rejected');
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'pending_submit',
    };
  }

  async startProcessing(payload: { afterSalesOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'processing') {
      throw new BadRequestException('Only processing after-sales orders can enter finance review');
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'finance_reviewing',
    };
  }

  async finish(payload: { afterSalesOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'finance_reviewing') {
      throw new BadRequestException('Only finance-reviewing after-sales orders can finish');
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'finished',
    };
  }

  async close(payload: {
    afterSalesOrderId: number;
    currentStatus: string;
    financeReviewStatus: string;
  }) {
    if (payload.currentStatus !== 'finished') {
      throw new BadRequestException('Only finished after-sales orders can be closed');
    }

    if (payload.financeReviewStatus !== 'confirmed') {
      throw new BadRequestException(
        'Finance review must be confirmed before closing after sales',
      );
    }

    return {
      id: payload.afterSalesOrderId,
      status: 'closed',
    };
  }
}
```

- [ ] **Step 4: Run the API rules test to verify it passes**

Run: `CI=true pnpm --filter api test -- after-sales-rules.spec.ts`
Expected: PASS with after-sales lifecycle rules covered

- [ ] **Step 5: Write the failing controller test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/after-sales.controller.spec.ts`:

```ts
import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { AfterSalesController } from '../src/after-sales/after-sales.controller';
import { AfterSalesService } from '../src/after-sales/after-sales.service';

describe('AfterSalesController', () => {
  it('creates an after-sales order from shipment context', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 5,
      afterSalesNo: 'AS202607080001',
      status: 'pending_submit',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [AfterSalesController],
      providers: [{ provide: AfterSalesService, useValue: { create } }],
    }).compile();

    const controller = moduleRef.get(AfterSalesController);
    const result = await controller.create({
      salesOrderId: 9,
      shipmentBatchId: 3,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2001,
    });

    expect(create).toHaveBeenCalled();
    expect(result.status).toBe('pending_submit');
  });

  it('uses ParseIntPipe for the after-sales detail id param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      AfterSalesController,
      'getDetail',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes).toHaveLength(1);
    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
```

- [ ] **Step 6: Run the API controller test to verify it fails**

Run: `CI=true pnpm --filter api test -- after-sales.controller.spec.ts`
Expected: FAIL because the controller does not exist yet

- [ ] **Step 7: Add the minimal controller and module wiring**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/after-sales/after-sales.controller.ts`:

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateAfterSalesOrderDto } from './dto/create-after-sales-order.dto';
import { AfterSalesService } from './after-sales.service';

@Controller('after-sales')
export class AfterSalesController {
  constructor(private readonly afterSalesService: AfterSalesService) {}

  @Post()
  create(@Body() body: CreateAfterSalesOrderDto) {
    return this.afterSalesService.create(body);
  }

  @Get(':id')
  getDetail(@Param('id', ParseIntPipe) id: number) {
    return this.afterSalesService.getDetail(id);
  }

  @Post(':id/submit')
  submit(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.afterSalesService.submit({ afterSalesOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.afterSalesService.approve({ afterSalesOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.afterSalesService.reject({ afterSalesOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/start-processing')
  startProcessing(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
  ) {
    return this.afterSalesService.startProcessing({
      afterSalesOrderId: id,
      currentStatus: body.currentStatus,
    });
  }

  @Post(':id/finish')
  finish(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.afterSalesService.finish({ afterSalesOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/close')
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string; financeReviewStatus: string },
  ) {
    return this.afterSalesService.close({
      afterSalesOrderId: id,
      currentStatus: body.currentStatus,
      financeReviewStatus: body.financeReviewStatus,
    });
  }
}
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts` to register `AfterSalesController` and `AfterSalesService`.

- [ ] **Step 8: Run the API controller test to verify it passes**

Run: `CI=true pnpm --filter api test -- after-sales.controller.spec.ts`
Expected: PASS with the after-sales routes wired and ParseIntPipe applied

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/after-sales apps/api/test/after-sales-rules.spec.ts apps/api/test/after-sales.controller.spec.ts
git commit -m "feat: add after sales lifecycle endpoints"
```

### Task 4: Add Sales Receipt, Finance Confirmation, And Close Validation Rules

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.controller.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-rules.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order.controller.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-rules.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order.controller.spec.ts`

- [ ] **Step 1: Add the failing sales-order rules assertions**

Append to `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-rules.spec.ts`:

```ts
  it('updates sales receipt status using the confirmed receipt collection contract', async () => {
    const service = new SalesOrderService();

    const result = await service.updateReceiptStatus({
      salesOrderId: 9,
      receiptStatus: 'fully_paid',
    });

    expect(result.receiptStatus).toBe('fully_paid');
  });

  it('confirms finance only after receipt status is no longer unpaid', async () => {
    const service = new SalesOrderService();

    await expect(
      service.confirmFinance({
        salesOrderId: 9,
        receiptStatus: 'unpaid',
        financeStatus: 'pending',
      }),
    ).rejects.toThrow('Cannot confirm finance before receipt status reaches a paid state');
  });

  it('returns close validation only when shipment, receipt, after-sales, and finance are complete', async () => {
    const service = new SalesOrderService();

    const result = await service.getCloseValidation({
      salesOrderId: 9,
      shipmentAggregateStatus: 'forwarder_shipped',
      receiptSendStatus: 'sent',
      afterSalesEndStatus: 'closed',
      financeStatus: 'confirmed',
      receiptStatus: 'fully_paid',
    });

    expect(result.canClose).toBe(true);
  });
```

- [ ] **Step 2: Run the API rules test to verify it fails**

Run: `CI=true pnpm --filter api test -- sales-order-rules.spec.ts`
Expected: FAIL because the new finance and close methods do not exist yet

- [ ] **Step 3: Implement the minimal sales close rules**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.service.ts` by adding:

```ts
  async updateReceiptStatus(payload: {
    salesOrderId: number;
    receiptStatus: string;
  }) {
    return {
      id: payload.salesOrderId,
      receiptStatus: payload.receiptStatus,
    };
  }

  async confirmFinance(payload: {
    salesOrderId: number;
    receiptStatus: string;
    financeStatus: string;
  }) {
    if (
      payload.receiptStatus !== 'deposit_received' &&
      payload.receiptStatus !== 'fully_paid' &&
      payload.receiptStatus !== 'prepaid_deducted'
    ) {
      throw new BadRequestException(
        'Cannot confirm finance before receipt status reaches a paid state',
      );
    }

    return {
      id: payload.salesOrderId,
      financeStatus: 'confirmed',
    };
  }

  async getCloseValidation(payload: {
    salesOrderId: number;
    shipmentAggregateStatus: string;
    receiptSendStatus: string;
    afterSalesEndStatus: string;
    financeStatus: string;
    receiptStatus: string;
  }) {
    const shipmentDone =
      payload.shipmentAggregateStatus === 'forwarder_shipped' ||
      payload.shipmentAggregateStatus === 'arrived' ||
      payload.shipmentAggregateStatus === 'closed';
    const receiptPaid =
      payload.receiptStatus === 'deposit_received' ||
      payload.receiptStatus === 'fully_paid' ||
      payload.receiptStatus === 'prepaid_deducted';
    const canClose =
      shipmentDone &&
      payload.receiptSendStatus === 'sent' &&
      payload.afterSalesEndStatus === 'closed' &&
      payload.financeStatus === 'confirmed' &&
      receiptPaid;

    return {
      salesOrderId: payload.salesOrderId,
      canClose,
      checks: {
        shipmentDone,
        receiptSent: payload.receiptSendStatus === 'sent',
        afterSalesDone: payload.afterSalesEndStatus === 'closed',
        financeConfirmed: payload.financeStatus === 'confirmed',
        receiptPaid,
      },
    };
  }

  async close(payload: {
    salesOrderId: number;
    canClose: boolean;
  }) {
    if (!payload.canClose) {
      throw new BadRequestException('Sales order does not meet close conditions');
    }

    return {
      id: payload.salesOrderId,
      status: 'closed',
    };
  }
```

- [ ] **Step 4: Run the API rules test to verify it passes**

Run: `CI=true pnpm --filter api test -- sales-order-rules.spec.ts`
Expected: PASS with the finance and close validation assertions included

- [ ] **Step 5: Add the failing controller assertions**

Append to `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order.controller.spec.ts`:

```ts
  it('SalesOrderController.updateReceiptStatus forwards the receipt collection contract', async () => {
    const updateReceiptStatus = jest.fn().mockResolvedValue({
      id: 9,
      receiptStatus: 'fully_paid',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        {
          provide: SalesOrderService,
          useValue: {
            getDetail: jest.fn(),
            submit: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
            updateReceiptStatus,
            confirmFinance: jest.fn(),
            getCloseValidation: jest.fn(),
            close: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    const result = await controller.updateReceiptStatus(9 as never, {
      receiptStatus: 'fully_paid',
    });

    expect(updateReceiptStatus).toHaveBeenCalledWith({
      salesOrderId: 9,
      receiptStatus: 'fully_paid',
    });
    expect(result.receiptStatus).toBe('fully_paid');
  });
```

- [ ] **Step 6: Run the API controller test to verify it fails**

Run: `CI=true pnpm --filter api test -- sales-order.controller.spec.ts`
Expected: FAIL because the new controller methods do not exist yet

- [ ] **Step 7: Implement the minimal sales controller endpoints**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.controller.ts` by adding:

```ts
  @Get(':id/close-validation')
  getCloseValidation(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      shipmentAggregateStatus: string;
      receiptSendStatus: string;
      afterSalesEndStatus: string;
      financeStatus: string;
      receiptStatus: string;
    },
  ) {
    return this.salesOrderService.getCloseValidation({
      salesOrderId: id,
      shipmentAggregateStatus: body.shipmentAggregateStatus,
      receiptSendStatus: body.receiptSendStatus,
      afterSalesEndStatus: body.afterSalesEndStatus,
      financeStatus: body.financeStatus,
      receiptStatus: body.receiptStatus,
    });
  }

  @Post(':id/receipt-status')
  updateReceiptStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { receiptStatus: string },
  ) {
    return this.salesOrderService.updateReceiptStatus({
      salesOrderId: id,
      receiptStatus: body.receiptStatus,
    });
  }

  @Post(':id/finance-confirm')
  confirmFinance(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { receiptStatus: string; financeStatus: string },
  ) {
    return this.salesOrderService.confirmFinance({
      salesOrderId: id,
      receiptStatus: body.receiptStatus,
      financeStatus: body.financeStatus,
    });
  }

  @Post(':id/close')
  close(@Param('id', ParseIntPipe) id: number, @Body() body: { canClose: boolean }) {
    return this.salesOrderService.close({
      salesOrderId: id,
      canClose: body.canClose,
    });
  }
```

- [ ] **Step 8: Run the API controller test to verify it passes**

Run: `CI=true pnpm --filter api test -- sales-order.controller.spec.ts`
Expected: PASS with the sales finance and close endpoints wired

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/sales-order/sales-order.service.ts apps/api/src/sales-order/sales-order.controller.ts apps/api/test/sales-order-rules.spec.ts apps/api/test/sales-order.controller.spec.ts
git commit -m "feat: add sales finance and close validation rules"
```

### Task 5: Add A Minimal After-Sales Workspace Page

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/after-sales/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/after-sales-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/after-sales-page.test.tsx`

- [ ] **Step 1: Write the failing web test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/after-sales-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import AfterSalesPage from '../app/after-sales/page';

describe('AfterSalesPage', () => {
  it('renders the after-sales workspace with finance closure cues', () => {
    render(<AfterSalesPage />);

    expect(screen.getByRole('heading', { name: '售后与财务中心' })).toBeInTheDocument();
    expect(screen.getByText('支持售后闭环、收款状态维护和关单前财务确认')).toBeInTheDocument();
    expect(screen.getByText('pending_submit')).toBeInTheDocument();
    expect(screen.getByText('prepaid_deducted')).toBeInTheDocument();
    expect(screen.getByText('confirmed')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the web test to verify it fails**

Run: `CI=true pnpm --filter web test`
Expected: FAIL because the after-sales workspace page does not exist yet

- [ ] **Step 3: Add the minimal workspace page**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/after-sales/page.tsx`:

```tsx
import {
  afterSalesStatuses,
  financeConfirmStatuses,
  receiptCollectionStatuses,
} from '@erp/shared';

export default function AfterSalesPage() {
  return (
    <main>
      <h1>售后与财务中心</h1>
      <p>支持售后闭环、收款状态维护和关单前财务确认</p>
      <p>当前展示：售后状态、收款状态与财务确认状态</p>

      <section aria-labelledby="after-sales-statuses">
        <h2 id="after-sales-statuses">售后状态</h2>
        <ul>
          {afterSalesStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="receipt-collection-statuses">
        <h2 id="receipt-collection-statuses">收款状态</h2>
        <ul>
          {receiptCollectionStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="finance-confirm-statuses">
        <h2 id="finance-confirm-statuses">财务确认状态</h2>
        <ul>
          {financeConfirmStatuses.map((status) => (
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
Expected: PASS with the new after-sales page test included

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/after-sales/page.tsx apps/web/tests/after-sales-page.test.tsx
git commit -m "feat: add after sales workspace page"
```

### Task 6: Run Slice-Wide Verification

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/docs/superpowers/plans/2026-07-08-after-sales-finance-mvp.md`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests`

- [ ] **Step 1: Run package-level verification**

Run: `CI=true pnpm --filter @erp/shared test && CI=true pnpm --filter @erp/shared build && CI=true pnpm --filter api test && CI=true pnpm --filter web test`
Expected: PASS across shared, api, and web

- [ ] **Step 2: Run the focused web production build**

Run: `CI=true pnpm --filter web build`
Expected: PASS with `/after-sales` included in the build output

- [ ] **Step 3: Mark completed tasks in the plan**

Update this file so every finished checkbox reflects the actual execution result before handoff or merge.

- [ ] **Step 4: Commit the final after-sales and finance slice**

```bash
git add apps/api apps/web packages/shared docs/superpowers/plans/2026-07-08-after-sales-finance-mvp.md
git commit -m "feat: deliver after sales and finance mvp slice"
```
