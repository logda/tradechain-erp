# Boss Dashboard And Report MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only boss dashboard and lightweight report APIs so the ERP has a minimal management view after the sales, purchase, shipment, and after-sales slices are in place.

**Architecture:** Keep this slice thin and consistent with the current modular monolith. Add two NestJS read-model services with static-but-semantic aggregate payloads, wire them through small controllers, then add one Next.js boss dashboard page that surfaces the same summary areas without introducing real BI infrastructure.

**Tech Stack:** pnpm workspaces, NestJS, Next.js App Router, TypeScript, Jest, Vitest

---

### Task 1: Add Boss Dashboard API

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/dashboard/dashboard.controller.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/dashboard/dashboard.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/dashboard.service.spec.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/dashboard.controller.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/dashboard.service.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/dashboard.controller.spec.ts`

- [ ] **Step 1: Write the failing dashboard service test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/dashboard.service.spec.ts`:

```ts
import { BossDashboardService } from '../src/dashboard/dashboard.service';

describe('BossDashboardService', () => {
  it('returns boss dashboard aggregates for sales, purchase, shipment, and after-sales follow-up', async () => {
    const service = new BossDashboardService();

    const result = await service.getSummary();

    expect(result.workflowAlerts).toEqual([
      expect.objectContaining({ key: 'quotes_pending_boss_confirm', count: 2 }),
      expect.objectContaining({ key: 'shipment_exceptions', count: 1 }),
      expect.objectContaining({ key: 'after_sales_pending_close', count: 3 }),
    ]);
    expect(result.salesOverview.partiallyShipped).toBe(3);
    expect(result.purchaseOverview.purchasing).toBe(5);
    expect(result.afterSalesOverview.financeReviewing).toBe(1);
    expect(result.financeOverview.pendingConfirmation).toBe(2);
  });
});
```

- [ ] **Step 2: Run the dashboard service test to verify it fails**

Run: `CI=true pnpm --filter api test -- dashboard.service.spec.ts`
Expected: FAIL because `dashboard.service.ts` does not exist yet

- [ ] **Step 3: Write the failing dashboard controller test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/dashboard.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { DashboardController } from '../src/dashboard/dashboard.controller';
import { BossDashboardService } from '../src/dashboard/dashboard.service';

describe('DashboardController', () => {
  it('returns the boss summary read model', async () => {
    const getSummary = jest.fn().mockResolvedValue({
      workflowAlerts: [],
      salesOverview: { totalOrders: 12 },
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: BossDashboardService, useValue: { getSummary } }],
    }).compile();

    const controller = moduleRef.get(DashboardController);
    const result = await controller.getBossDashboard();

    expect(getSummary).toHaveBeenCalled();
    expect(result.salesOverview.totalOrders).toBe(12);
  });
});
```

- [ ] **Step 4: Run the dashboard controller test to verify it fails**

Run: `CI=true pnpm --filter api test -- dashboard.controller.spec.ts`
Expected: FAIL because the dashboard controller does not exist yet

- [ ] **Step 5: Write the minimal dashboard implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/dashboard/dashboard.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class BossDashboardService {
  async getSummary() {
    return {
      generatedAt: '2026-07-08T00:00:00.000Z',
      workflowAlerts: [
        { key: 'quotes_pending_boss_confirm', label: '待老板确认报价', count: 2, severity: 'warning' },
        { key: 'shipment_exceptions', label: '发货异常批次', count: 1, severity: 'critical' },
        { key: 'after_sales_pending_close', label: '售后待闭环', count: 3, severity: 'warning' },
      ],
      salesOverview: {
        totalOrders: 12,
        pendingApproval: 2,
        inProduction: 4,
        partiallyShipped: 3,
        fullyShipped: 3,
      },
      purchaseOverview: {
        totalOrders: 11,
        pendingApproval: 1,
        purchasing: 5,
        partiallyReceived: 3,
        completed: 2,
      },
      afterSalesOverview: {
        openCases: 4,
        pendingApproval: 1,
        processing: 2,
        financeReviewing: 1,
        closedThisMonth: 6,
      },
      financeOverview: {
        pendingConfirmation: 2,
        confirmedThisMonth: 10,
        prepaidDeducted: 3,
      },
    };
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/dashboard/dashboard.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { BossDashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly bossDashboardService: BossDashboardService) {}

  @Get('boss')
  getBossDashboard() {
    return this.bossDashboardService.getSummary();
  }
}
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts` to register `DashboardController` and `BossDashboardService`.

- [ ] **Step 6: Run the dashboard tests to verify they pass**

Run: `CI=true pnpm --filter api test -- dashboard.service.spec.ts dashboard.controller.spec.ts`
Expected: PASS with the dashboard API tests green

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/dashboard/dashboard.controller.ts apps/api/src/dashboard/dashboard.service.ts apps/api/src/app.module.ts apps/api/test/dashboard.service.spec.ts apps/api/test/dashboard.controller.spec.ts
git commit -m "feat: add boss dashboard api summary"
```

### Task 2: Add Lightweight Report APIs

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/report/report.controller.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/report/report.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/report.service.spec.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/report.controller.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/report.service.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/report.controller.spec.ts`

- [ ] **Step 1: Write the failing report service test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/report.service.spec.ts`:

```ts
import { ReportService } from '../src/report/report.service';

describe('ReportService', () => {
  it('returns sales, gross-profit, and period summaries with consistent rollups', async () => {
    const service = new ReportService();

    const salesSummary = await service.getSalesSummary();
    const grossProfit = await service.getGrossProfitSummary();
    const periodSummary = await service.getPeriodSummary();

    expect(salesSummary.totals.salesOrderCount).toBe(12);
    expect(salesSummary.shipmentBreakdown).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'partially_shipped', count: 3 })]),
    );
    expect(grossProfit.grossProfit).toBe(
      grossProfit.totalRevenue - grossProfit.totalProcurementCost - grossProfit.totalAfterSalesCost,
    );
    expect(periodSummary.reopenedApprovals).toBe(2);
  });
});
```

- [ ] **Step 2: Run the report service test to verify it fails**

Run: `CI=true pnpm --filter api test -- report.service.spec.ts`
Expected: FAIL because `report.service.ts` does not exist yet

- [ ] **Step 3: Write the failing report controller test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/report.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ReportController } from '../src/report/report.controller';
import { ReportService } from '../src/report/report.service';

describe('ReportController', () => {
  it('exposes sales summary, gross profit, and period summary endpoints', async () => {
    const getSalesSummary = jest.fn().mockResolvedValue({ totals: { salesOrderCount: 12 } });
    const getGrossProfitSummary = jest.fn().mockResolvedValue({ grossProfit: 242000 });
    const getPeriodSummary = jest.fn().mockResolvedValue({ reopenedApprovals: 2 });
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        {
          provide: ReportService,
          useValue: { getSalesSummary, getGrossProfitSummary, getPeriodSummary },
        },
      ],
    }).compile();

    const controller = moduleRef.get(ReportController);

    expect((await controller.getSalesSummary()).totals.salesOrderCount).toBe(12);
    expect((await controller.getGrossProfitSummary()).grossProfit).toBe(242000);
    expect((await controller.getPeriodSummary()).reopenedApprovals).toBe(2);
  });
});
```

- [ ] **Step 4: Run the report controller test to verify it fails**

Run: `CI=true pnpm --filter api test -- report.controller.spec.ts`
Expected: FAIL because the report controller does not exist yet

- [ ] **Step 5: Write the minimal report implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/report/report.service.ts` with three methods: `getSalesSummary`, `getGrossProfitSummary`, and `getPeriodSummary`. Use a static `generatedAt` timestamp and semantic aggregate fields:

```ts
{
  totals: {
    salesOrderCount: 12,
    submittedAmount: 880000,
    shippedAmount: 520000,
    receivedAmount: 430000,
  }
}
```

```ts
{
  totalRevenue: 880000,
  totalProcurementCost: 620000,
  totalAfterSalesCost: 18000,
  grossProfit: 242000,
  grossMargin: 0.275,
}
```

```ts
{
  salesOrdersCreated: 12,
  purchaseOrdersCreated: 11,
  shipmentBatchesCreated: 8,
  afterSalesCreated: 4,
  closedOrders: 6,
  reopenedApprovals: 2,
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/report/report.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { ReportService } from './report.service';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('sales-summary')
  getSalesSummary() {
    return this.reportService.getSalesSummary();
  }

  @Get('gross-profit')
  getGrossProfitSummary() {
    return this.reportService.getGrossProfitSummary();
  }

  @Get('period-summary')
  getPeriodSummary() {
    return this.reportService.getPeriodSummary();
  }
}
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts` to register `ReportController` and `ReportService`.

- [ ] **Step 6: Run the report tests to verify they pass**

Run: `CI=true pnpm --filter api test -- report.service.spec.ts report.controller.spec.ts`
Expected: PASS with all report endpoint tests green

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/report/report.controller.ts apps/api/src/report/report.service.ts apps/api/src/app.module.ts apps/api/test/report.service.spec.ts apps/api/test/report.controller.spec.ts
git commit -m "feat: add dashboard report summaries"
```

### Task 3: Add Boss Dashboard Workspace Page

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/dashboard/boss/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/boss-dashboard-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/boss-dashboard-page.test.tsx`

- [ ] **Step 1: Write the failing boss dashboard page test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/boss-dashboard-page.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import BossDashboardPage from '../app/dashboard/boss/page';

describe('BossDashboardPage', () => {
  it('renders the read-only management dashboard sections', () => {
    render(<BossDashboardPage />);

    expect(screen.getByRole('heading', { name: '老板经营看板' })).toBeInTheDocument();
    expect(screen.getByText('只读查看销售、采购、发货、售后与财务汇总')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '风险提醒' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '销售汇总' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '采购汇总' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '售后与财务' })).toBeInTheDocument();
    expect(screen.getByText('partially_shipped')).toBeInTheDocument();
    expect(screen.getByText('purchasing')).toBeInTheDocument();
    expect(screen.getByText('finance_reviewing')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the web page test to verify it fails**

Run: `CI=true pnpm --filter web test -- boss-dashboard-page.test.tsx`
Expected: FAIL because the boss dashboard page does not exist yet

- [ ] **Step 3: Write the minimal dashboard page**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/dashboard/boss/page.tsx` with a simple read-only page that:
- imports `afterSalesStatuses`, `purchaseOrderStatuses`, `salesOrderStatuses`, and `shipmentBatchStatuses` from `@erp/shared`
- renders the headings `老板经营看板`, `风险提醒`, `销售汇总`, `采购汇总`, and `售后与财务`
- includes read-only alert cards for `待老板确认报价`, `发货异常批次`, and `售后待闭环`
- shows a few shared status values including `partially_shipped`, `purchasing`, and `finance_reviewing`

- [ ] **Step 4: Run the web page test to verify it passes**

Run: `CI=true pnpm --filter web test -- boss-dashboard-page.test.tsx`
Expected: PASS with the boss dashboard page rendered

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/dashboard/boss/page.tsx apps/web/tests/boss-dashboard-page.test.tsx
git commit -m "feat: add boss dashboard workspace page"
```

### Task 4: Run Full Verification

**Files:**
- Modify: none
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests`

- [ ] **Step 1: Run shared package tests**

Run: `CI=true pnpm --filter @erp/shared test`
Expected: PASS

- [ ] **Step 2: Run shared package build**

Run: `CI=true pnpm --filter @erp/shared build`
Expected: PASS

- [ ] **Step 3: Run API tests**

Run: `CI=true pnpm --filter api test`
Expected: PASS with the new dashboard and report tests included

- [ ] **Step 4: Run web tests**

Run: `CI=true pnpm --filter web test`
Expected: PASS with the boss dashboard page test included

- [ ] **Step 5: Run web build**

Run: `CI=true pnpm --filter web build`
Expected: PASS with `/dashboard/boss` included in app routes
