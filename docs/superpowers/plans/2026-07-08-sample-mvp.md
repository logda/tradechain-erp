# Sample MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next ERP vertical slice for sample order creation, version replacement, approval flow, cancellation rules, and a minimal sample workspace page.

**Architecture:** Extend the existing modular monolith with the same thin-slice pattern used for quotes, sales orders, and purchase orders. Start by stabilizing shared sample status contracts, then add Prisma models, rule-first NestJS service/controller logic, and finish with a minimal Next.js workspace page that exposes the sample lifecycle without overbuilding UI.

**Tech Stack:** pnpm workspaces, NestJS, Next.js App Router, Prisma, TypeScript, Vitest, Jest

---

### Task 1: Add Shared Sample Status Contracts

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sample-order-status.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sample-order-status.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sample-order-status.spec.ts`

- [ ] **Step 1: Write the failing shared sample status test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sample-order-status.spec.ts`:

```ts
import { sampleOrderStatuses } from './sample-order-status.js';

describe('sample order statuses', () => {
  it('exposes the full sample lifecycle in order', () => {
    expect(sampleOrderStatuses).toEqual([
      'pending_approval',
      'pending_sampling',
      'sampling',
      'sample_sent',
      'customer_confirmed',
      'canceled',
      'replaced',
    ]);
  });
});
```

- [ ] **Step 2: Run the shared package test to verify it fails**

Run: `CI=true pnpm --filter @erp/shared test`
Expected: FAIL because `sample-order-status.ts` does not exist yet

- [ ] **Step 3: Write the minimal shared runtime implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sample-order-status.ts`:

```ts
export const sampleOrderStatuses = [
  'pending_approval',
  'pending_sampling',
  'sampling',
  'sample_sent',
  'customer_confirmed',
  'canceled',
  'replaced',
] as const;

export type SampleOrderStatus = (typeof sampleOrderStatuses)[number];
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`:

```ts
export * from './quote-status.js';
export * from './inquiry-status.js';
export * from './sales-order-status.js';
export * from './purchase-order-status.js';
export * from './sample-order-status.js';
```

- [ ] **Step 4: Run the shared package test to verify it passes**

Run: `CI=true pnpm --filter @erp/shared test`
Expected: PASS with the sample status spec included

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/sample-order-status.ts packages/shared/src/sample-order-status.spec.ts packages/shared/src/index.ts
git commit -m "feat: add shared sample status contracts"
```

### Task 2: Add Sample Prisma Models

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/prisma/schema.prisma`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sample-schema.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sample-schema.spec.ts`

- [ ] **Step 1: Write the failing schema test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sample-schema.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Sample Prisma schema', () => {
  it('contains versioned sample order models with quote traceability fields', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const getModelBlock = (modelName: string) => {
      const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm'));

      expect(match).not.toBeNull();

      return match?.[0] ?? '';
    };

    const sampleOrder = getModelBlock('SampleOrder');
    const sampleOrderVersion = getModelBlock('SampleOrderVersion');

    expect(schema).toContain('model SampleOrder');
    expect(schema).toContain('model SampleOrderVersion');
    expect(sampleOrder).toMatch(/sourceQuoteOrderId\\s+BigInt/);
    expect(sampleOrder).toMatch(/sourceQuoteVersionId\\s+BigInt\\s+@unique/);
    expect(sampleOrder).toMatch(/currentVersionNo\\s+Int/);
    expect(sampleOrder).toMatch(/versions\\s+SampleOrderVersion\\[\\]/);
    expect(sampleOrderVersion).toMatch(/sampleOrderId\\s+BigInt/);
    expect(sampleOrderVersion).toMatch(/status\\s+String\\s+@db.VarChar\\(32\\)/);
    expect(sampleOrderVersion).toMatch(/cancelReason\\s+String\\?\\s+@db.VarChar\\(255\\)/);
    expect(sampleOrderVersion).toMatch(/replacedVersionNo\\s+Int\\?/);
    expect(sampleOrderVersion).toMatch(/@@unique\\(\\[sampleOrderId,\\s*versionNo\\]\\)/);
  });
});
```

- [ ] **Step 2: Run the API test to verify it fails**

Run: `CI=true pnpm --filter api test -- sample-schema.spec.ts`
Expected: FAIL because the sample models do not exist yet

- [ ] **Step 3: Add the minimal sample models**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/prisma/schema.prisma` by adding:

```prisma
model SampleOrder {
  id                   BigInt               @id @default(autoincrement())
  sampleNo             String               @unique @db.VarChar(64)
  sourceQuoteOrderId   BigInt
  sourceQuoteVersionId BigInt               @unique
  customerId           BigInt
  currentVersionNo     Int
  currentStatus        String               @db.VarChar(32)
  createdBy            BigInt
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt
  versions             SampleOrderVersion[]
}

model SampleOrderVersion {
  id                BigInt      @id @default(autoincrement())
  sampleOrderId     BigInt
  versionNo         Int
  status            String      @db.VarChar(32)
  sampleRequirements String     @db.Text
  samplingCost      Decimal?    @db.Decimal(18, 2)
  changeReason      String?     @db.VarChar(255)
  cancelReason      String?     @db.VarChar(255)
  replacedVersionNo Int?
  createdBy         BigInt
  createdAt         DateTime    @default(now())
  sampleOrder       SampleOrder @relation(fields: [sampleOrderId], references: [id])

  @@unique([sampleOrderId, versionNo])
}
```

- [ ] **Step 4: Run the API schema test to verify it passes**

Run: `CI=true pnpm --filter api test -- sample-schema.spec.ts`
Expected: PASS with the sample schema assertions satisfied

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/test/sample-schema.spec.ts
git commit -m "feat: add sample prisma models"
```

### Task 3: Add Sample Order Rules Service

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sample-order/sample-order.service.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sample-order/dto/create-sample-order.dto.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sample-order/dto/create-sample-order-version.dto.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sample-order-rules.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sample-order-rules.spec.ts`

- [ ] **Step 1: Write the failing sample rules test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sample-order-rules.spec.ts`:

```ts
import { SampleOrderService } from '../src/sample-order/sample-order.service';

describe('SampleOrderService', () => {
  it('creates a sample order only from a confirmed quote version', async () => {
    const service = new SampleOrderService();

    const result = await service.create({
      quoteOrderId: 7,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      sampleRequirements: 'Need gold-plated sample',
      samplingCost: 1200,
    });

    expect(result.currentStatus).toBe('pending_approval');
    expect(result.currentVersionNo).toBe(1);
    expect(result.sourceQuoteOrderId).toBe(7);
  });

  it('creates a replacement version and marks the prior version as replaced', async () => {
    const service = new SampleOrderService();

    const result = await service.createVersion({
      sampleOrderId: 9,
      currentStatus: 'sample_sent',
      currentVersionNo: 1,
      createdBy: 2001,
      changeReason: 'Customer requested new color',
      sampleRequirements: 'Need blue variant sample',
    });

    expect(result.currentStatus).toBe('pending_approval');
    expect(result.currentVersionNo).toBe(2);
    expect(result.replacedVersionNo).toBe(1);
  });

  it('rejects creation when the quote version is not confirmed', async () => {
    const service = new SampleOrderService();

    await expect(
      service.create({
        quoteOrderId: 7,
        quoteVersionNo: 3,
        customerId: 1001,
        createdBy: 2001,
        quoteConfirmed: false,
        sampleRequirements: 'Need sample',
      }),
    ).rejects.toThrow('Only confirmed quote versions can create sample orders');
  });

  it('moves an approved sample through sampling, sent, and customer confirmed', async () => {
    const service = new SampleOrderService();

    const approved = await service.approve({
      sampleOrderId: 9,
      currentStatus: 'pending_approval',
    });
    const started = await service.startSampling({
      sampleOrderId: 9,
      currentStatus: approved.currentStatus,
    });
    const sent = await service.markSent({
      sampleOrderId: 9,
      currentStatus: started.currentStatus,
    });
    const confirmed = await service.markCustomerConfirmed({
      sampleOrderId: 9,
      currentStatus: sent.currentStatus,
    });

    expect(approved.currentStatus).toBe('pending_sampling');
    expect(started.currentStatus).toBe('sampling');
    expect(sent.currentStatus).toBe('sample_sent');
    expect(confirmed.currentStatus).toBe('customer_confirmed');
  });

  it('rejects cancellation after production has started', async () => {
    const service = new SampleOrderService();

    await expect(
      service.cancel({
        sampleOrderId: 9,
        currentStatus: 'sampling',
        hasProductionStarted: true,
        cancelReason: 'Supplier cannot continue',
      }),
    ).rejects.toThrow('Cannot cancel after sampling has started');
  });
});
```

- [ ] **Step 2: Run the API rules test to verify it fails**

Run: `CI=true pnpm --filter api test -- sample-order-rules.spec.ts`
Expected: FAIL because the sample service does not exist yet

- [ ] **Step 3: Add the minimal sample service implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sample-order/dto/create-sample-order.dto.ts`:

```ts
export type CreateSampleOrderDto = {
  quoteOrderId: number;
  quoteVersionNo: number;
  customerId: number;
  createdBy: number;
  sampleRequirements: string;
  samplingCost?: number;
  quoteConfirmed?: boolean;
};
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sample-order/dto/create-sample-order-version.dto.ts`:

```ts
export type CreateSampleOrderVersionDto = {
  currentStatus: string;
  currentVersionNo: number;
  createdBy: number;
  sampleRequirements: string;
  changeReason: string;
  samplingCost?: number;
};
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sample-order/sample-order.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class SampleOrderService {
  async create(payload: {
    quoteOrderId: number;
    quoteVersionNo: number;
    customerId: number;
    createdBy: number;
    sampleRequirements: string;
    samplingCost?: number;
    quoteConfirmed?: boolean;
  }) {
    if (payload.quoteConfirmed === false) {
      throw new BadRequestException(
        'Only confirmed quote versions can create sample orders',
      );
    }

    return {
      id: payload.quoteOrderId,
      sampleNo: 'SP202607080001',
      currentVersionNo: 1,
      currentStatus: 'pending_approval',
      sourceQuoteOrderId: payload.quoteOrderId,
      sourceQuoteVersionNo: payload.quoteVersionNo,
      sampleRequirements: payload.sampleRequirements,
      samplingCost: payload.samplingCost ?? null,
      customerId: payload.customerId,
      createdBy: payload.createdBy,
    };
  }

  async createVersion(payload: {
    sampleOrderId: number;
    currentStatus: string;
    currentVersionNo: number;
    createdBy: number;
    sampleRequirements: string;
    changeReason: string;
    samplingCost?: number;
  }) {
    if (payload.currentStatus === 'canceled') {
      throw new BadRequestException(
        'Cannot create a new sample version from a canceled order',
      );
    }

    return {
      id: payload.sampleOrderId,
      currentVersionNo: payload.currentVersionNo + 1,
      currentStatus: 'pending_approval',
      replacedVersionNo: payload.currentVersionNo,
      changeReason: payload.changeReason,
      sampleRequirements: payload.sampleRequirements,
      samplingCost: payload.samplingCost ?? null,
      createdBy: payload.createdBy,
    };
  }

  async getDetail(id: number) {
    return {
      id,
      sampleNo: 'SP202607080001',
      currentVersionNo: 1,
      currentStatus: 'pending_approval',
    };
  }

  async getVersions(id: number) {
    return [
      {
        sampleOrderId: id,
        versionNo: 1,
        status: 'pending_approval',
      },
    ];
  }

  async submit(payload: { sampleOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_approval') {
      throw new BadRequestException('Only pending approval samples can be submitted');
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'pending_approval',
      submitted: true,
    };
  }

  async approve(payload: { sampleOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_approval') {
      throw new BadRequestException('Only pending approval samples can be approved');
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'pending_sampling',
    };
  }

  async reject(payload: { sampleOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_approval') {
      throw new BadRequestException('Only pending approval samples can be rejected');
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'pending_approval',
      rejected: true,
    };
  }

  async startSampling(payload: { sampleOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'pending_sampling') {
      throw new BadRequestException('Only pending sampling samples can start sampling');
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'sampling',
    };
  }

  async markSent(payload: { sampleOrderId: number; currentStatus: string }) {
    if (payload.currentStatus !== 'sampling') {
      throw new BadRequestException('Only sampling samples can be marked sent');
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'sample_sent',
    };
  }

  async markCustomerConfirmed(payload: {
    sampleOrderId: number;
    currentStatus: string;
  }) {
    if (payload.currentStatus !== 'sample_sent') {
      throw new BadRequestException(
        'Only sent samples can be marked customer confirmed',
      );
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'customer_confirmed',
    };
  }

  async cancel(payload: {
    sampleOrderId: number;
    currentStatus: string;
    hasProductionStarted: boolean;
    cancelReason: string;
  }) {
    if (!payload.cancelReason) {
      throw new BadRequestException('Cancel reason is required');
    }

    if (payload.hasProductionStarted || payload.currentStatus === 'sampling') {
      throw new BadRequestException('Cannot cancel after sampling has started');
    }

    if (
      payload.currentStatus !== 'pending_approval' &&
      payload.currentStatus !== 'pending_sampling'
    ) {
      throw new BadRequestException(
        'Only pending approval or pending sampling samples can be cancelled',
      );
    }

    return {
      id: payload.sampleOrderId,
      currentStatus: 'canceled',
      cancelReason: payload.cancelReason,
    };
  }
}
```

- [ ] **Step 4: Run the API rules test to verify it passes**

Run: `CI=true pnpm --filter api test -- sample-order-rules.spec.ts`
Expected: PASS with the sample transitions and cancellation rules covered

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/sample-order/dto/create-sample-order.dto.ts apps/api/src/sample-order/dto/create-sample-order-version.dto.ts apps/api/src/sample-order/sample-order.service.ts apps/api/test/sample-order-rules.spec.ts
git commit -m "feat: add sample order lifecycle rules"
```

### Task 4: Add Sample Order Controller Endpoints

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sample-order/sample-order.controller.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sample-order.controller.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sample-order.controller.spec.ts`

- [ ] **Step 1: Write the failing controller test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sample-order.controller.spec.ts`:

```ts
import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { SampleOrderController } from '../src/sample-order/sample-order.controller';
import { SampleOrderService } from '../src/sample-order/sample-order.service';

describe('SampleOrderController', () => {
  it('creates a sample order from a confirmed quote version', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 9,
      sampleNo: 'SP202607080001',
      currentVersionNo: 1,
      currentStatus: 'pending_approval',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SampleOrderController],
      providers: [{ provide: SampleOrderService, useValue: { create } }],
    }).compile();

    const controller = moduleRef.get(SampleOrderController);
    const result = await controller.create({
      quoteOrderId: 7,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      sampleRequirements: 'Need gold-plated sample',
    });

    expect(create).toHaveBeenCalled();
    expect(result.currentStatus).toBe('pending_approval');
  });

  it('uses ParseIntPipe for the sample detail id param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      SampleOrderController,
      'getDetail',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes).toHaveLength(1);
    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
```

- [ ] **Step 2: Run the API controller test to verify it fails**

Run: `CI=true pnpm --filter api test -- sample-order.controller.spec.ts`
Expected: FAIL because the controller does not exist yet

- [ ] **Step 3: Add the minimal controller and module wiring**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sample-order/sample-order.controller.ts`:

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateSampleOrderDto } from './dto/create-sample-order.dto';
import { CreateSampleOrderVersionDto } from './dto/create-sample-order-version.dto';
import { SampleOrderService } from './sample-order.service';

@Controller('samples')
export class SampleOrderController {
  constructor(private readonly sampleOrderService: SampleOrderService) {}

  @Post()
  create(@Body() body: CreateSampleOrderDto) {
    return this.sampleOrderService.create(body);
  }

  @Get(':id')
  getDetail(@Param('id', ParseIntPipe) id: number) {
    return this.sampleOrderService.getDetail(id);
  }

  @Get(':id/versions')
  getVersions(@Param('id', ParseIntPipe) id: number) {
    return this.sampleOrderService.getVersions(id);
  }

  @Post(':id/versions')
  createVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateSampleOrderVersionDto,
  ) {
    return this.sampleOrderService.createVersion({
      sampleOrderId: id,
      ...body,
    });
  }

  @Post(':id/submit')
  submit(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.sampleOrderService.submit({ sampleOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.sampleOrderService.approve({ sampleOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.sampleOrderService.reject({ sampleOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/start-sampling')
  startSampling(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.sampleOrderService.startSampling({ sampleOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/mark-sent')
  markSent(@Param('id', ParseIntPipe) id: number, @Body() body: { currentStatus: string }) {
    return this.sampleOrderService.markSent({ sampleOrderId: id, currentStatus: body.currentStatus });
  }

  @Post(':id/mark-customer-confirmed')
  markCustomerConfirmed(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
  ) {
    return this.sampleOrderService.markCustomerConfirmed({
      sampleOrderId: id,
      currentStatus: body.currentStatus,
    });
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string; hasProductionStarted: boolean; cancelReason: string },
  ) {
    return this.sampleOrderService.cancel({
      sampleOrderId: id,
      currentStatus: body.currentStatus,
      hasProductionStarted: body.hasProductionStarted,
      cancelReason: body.cancelReason,
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

@Module({
  controllers: [
    HealthController,
    QuoteController,
    InquiryController,
    SalesOrderController,
    PurchaseOrderController,
    SampleOrderController,
  ],
  providers: [
    QuoteService,
    InquiryService,
    SalesOrderService,
    PurchaseOrderService,
    SampleOrderService,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Run the API controller test to verify it passes**

Run: `CI=true pnpm --filter api test -- sample-order.controller.spec.ts`
Expected: PASS with the sample routes wired and ParseIntPipe applied

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/sample-order/sample-order.controller.ts apps/api/test/sample-order.controller.spec.ts
git commit -m "feat: add sample order controller endpoints"
```

### Task 5: Add A Minimal Sample Workspace Page

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/samples/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/samples-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/samples-page.test.tsx`

- [ ] **Step 1: Write the failing sample page test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/samples-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import SamplesPage from '../app/samples/page';

describe('SamplesPage', () => {
  it('renders the sample workspace with status and versioning cues', () => {
    render(<SamplesPage />);

    expect(screen.getByRole('heading', { name: '样品管理中心' })).toBeInTheDocument();
    expect(screen.getByText('支持依附确认报价版本的样品申请、替代版本和取消留痕')).toBeInTheDocument();
    expect(screen.getByText('pending_approval')).toBeInTheDocument();
    expect(screen.getByText('customer_confirmed')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the web test to verify it fails**

Run: `CI=true pnpm --filter web test`
Expected: FAIL because the samples workspace page does not exist yet

- [ ] **Step 3: Add the minimal sample workspace page**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/samples/page.tsx`:

```tsx
import { sampleOrderStatuses } from '@erp/shared';

export default function SamplesPage() {
  return (
    <main>
      <h1>样品管理中心</h1>
      <p>支持依附确认报价版本的样品申请、替代版本和取消留痕</p>
      <p>当前展示：样品审批与打样生命周期状态</p>

      <section aria-labelledby="sample-statuses">
        <h2 id="sample-statuses">样品状态</h2>
        <ul>
          {sampleOrderStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run the web test to verify it passes**

Run: `CI=true pnpm --filter web test`
Expected: PASS with the new samples page test included

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/samples/page.tsx apps/web/tests/samples-page.test.tsx
git commit -m "feat: add sample workspace page"
```

### Task 6: Run Slice-Wide Verification

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/docs/superpowers/plans/2026-07-08-sample-mvp.md`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests`

- [ ] **Step 1: Run package-level verification**

Run: `CI=true pnpm --filter @erp/shared test && CI=true pnpm --filter @erp/shared build && CI=true pnpm --filter api test && CI=true pnpm --filter web test`
Expected: PASS across shared, api, and web

- [ ] **Step 2: Run the focused web production build**

Run: `CI=true pnpm --filter web build`
Expected: PASS with `/samples` included in the build output

- [ ] **Step 3: Mark completed tasks in the plan**

Update this file so every finished checkbox reflects the actual execution result before handoff or merge.

- [ ] **Step 4: Commit the final sample slice**

```bash
git add apps/api apps/web packages/shared docs/superpowers/plans/2026-07-08-sample-mvp.md
git commit -m "feat: deliver sample mvp slice"
```
