# Sales Order Advanced Filter MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first reusable ERP list-query slice by adding shared list query contracts plus advanced filtering for the `sales-orders` API and page.

**Architecture:** Keep the current thin-slice style and add one shared contract layer in `@erp/shared`, one in-memory filtered list endpoint in the sales-order module, and one URL-driven Next.js page that renders basic filters, advanced filters, filtered results, and empty-state behavior without introducing real persistence or client-side data fetching. The page should use `searchParams` plus a simple `GET` form so the filter state is restorable from the URL and easy to port to the other list pages later.

**Tech Stack:** pnpm workspaces, TypeScript, NestJS, Next.js App Router, Vitest, Jest

---

## File Structure

- Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/list-query.ts`
  Shared list-query baseline types such as `CommonListQuery`, `ListQueryResponse`, and tri-state filters.
- Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-list.ts`
  Sales-order-specific query type, result item type, and runtime option arrays.
- Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-list.spec.ts`
  Shared runtime contract tests for the new sales-order list options.
- Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`
  Export the new list-query contracts.
- Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order-list.data.ts`
  Holds semantic static sales-order list records for filtering.
- Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-list.spec.ts`
  Verifies the sales-order service list filtering and pagination rules.
- Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-list.controller.spec.ts`
  Verifies controller query normalization and forwarding.
- Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/dto/list-sales-orders-query.dto.ts`
  Encodes the accepted query string fields for `GET /sales-orders`.
- Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.controller.ts`
  Add the list endpoint and query normalization.
- Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.service.ts`
  Add the in-memory list query method and helpers.
- Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/sales-order-preview.ts`
  Holds static preview records plus the same filter semantics for the page.
- Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/page.tsx`
  Replace the current status-only placeholder with a real filter form and results list.
- Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-orders-page.test.tsx`
  Verify default render plus filtered render with advanced parameters.

---

### Task 1: Add Shared List Query Contracts

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/list-query.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-list.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-list.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-list.spec.ts`

- [ ] **Step 1: Write the failing shared contract test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-list.spec.ts`:

```ts
import {
  salesOrderHasAfterSalesOptions,
  salesOrderListSortFields,
} from './sales-order-list.js';

describe('sales order list query contracts', () => {
  it('exposes the supported sort fields in order', () => {
    expect(salesOrderListSortFields).toEqual([
      'createdAt',
      'docNo',
      'customerName',
    ]);
  });

  it('exposes tri-state after-sales filter options', () => {
    expect(salesOrderHasAfterSalesOptions).toEqual(['all', 'yes', 'no']);
  });
});
```

- [ ] **Step 2: Run the shared test to verify it fails**

Run: `CI=true pnpm --filter @erp/shared test -- sales-order-list.spec.ts`
Expected: FAIL because `sales-order-list.ts` does not exist yet

- [ ] **Step 3: Write the minimal shared runtime contracts**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/list-query.ts`:

```ts
export type TriStateFilter = 'all' | 'yes' | 'no';
export type SortOrder = 'asc' | 'desc';

export type CommonListQuery = {
  keyword?: string;
  docNo?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
};

export type ListQueryResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  appliedFilters: Record<string, string | number | boolean | null>;
};
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/sales-order-list.ts`:

```ts
import type {
  CommonListQuery,
  ListQueryResponse,
  TriStateFilter,
} from './list-query.js';

export const salesOrderListSortFields = [
  'createdAt',
  'docNo',
  'customerName',
] as const;

export const salesOrderHasAfterSalesOptions = ['all', 'yes', 'no'] as const;

export type SalesOrderListSortField = (typeof salesOrderListSortFields)[number];

export type SalesOrderListQuery = CommonListQuery & {
  customerName?: string;
  createdBy?: string;
  ownerName?: string;
  approvalStatus?: string;
  fulfillmentStatus?: string;
  receiptStatus?: string;
  financeConfirmStatus?: string;
  hasAfterSales?: TriStateFilter;
};

export type SalesOrderListItem = {
  moduleLabel: string;
  docNo: string;
  title: string;
  status: string;
  secondaryStatus?: string;
  counterpartyName?: string;
  ownerName?: string;
  createdAt: string;
  detailHref: string;
  createdBy: string;
  approvalStatus: string;
  fulfillmentStatus: string;
  receiptStatus: string;
  financeConfirmStatus: string;
  hasAfterSales: boolean;
};

export type SalesOrderListResponse = ListQueryResponse<SalesOrderListItem>;
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts` by adding:

```ts
export * from './list-query.js';
export * from './sales-order-list.js';
```

- [ ] **Step 4: Run the shared test to verify it passes**

Run: `CI=true pnpm --filter @erp/shared test -- sales-order-list.spec.ts`
Expected: PASS with both sales-order list contract assertions green

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/list-query.ts packages/shared/src/sales-order-list.ts packages/shared/src/sales-order-list.spec.ts packages/shared/src/index.ts
git commit -m "feat: add shared sales order list query contracts"
```

### Task 2: Add Sales Order List Filtering In The Service

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order-list.data.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-list.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.service.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-list.spec.ts`

- [ ] **Step 1: Write the failing service list test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-list.spec.ts`:

```ts
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('SalesOrderService list', () => {
  it('filters sales orders by advanced fields and returns applied filters', async () => {
    const service = new SalesOrderService();

    const result = await service.list({
      keyword: 'Acme',
      customerName: 'Acme',
      approvalStatus: 'purchasing',
      hasAfterSales: 'yes',
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.items.map((item) => item.docNo)).toEqual(['S202607080001']);
    expect(result.appliedFilters.hasAfterSales).toBe('yes');
    expect(result.total).toBe(1);
  });

  it('maps the shared status filter to approval or fulfillment status and paginates', async () => {
    const service = new SalesOrderService();

    const result = await service.list({
      status: 'purchasing',
      page: 1,
      pageSize: 1,
      sortBy: 'docNo',
      sortOrder: 'asc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(1);
  });
});
```

- [ ] **Step 2: Run the service list test to verify it fails**

Run: `CI=true pnpm --filter api test -- sales-order-list.spec.ts`
Expected: FAIL because `SalesOrderService.list` does not exist yet

- [ ] **Step 3: Add the static list data and minimal filter implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order-list.data.ts`:

```ts
import type { SalesOrderListItem } from '@erp/shared';

export const salesOrderListData: SalesOrderListItem[] = [
  {
    moduleLabel: '销售订单',
    docNo: 'S202607080001',
    title: 'Acme 夏季风扇补货',
    status: 'purchasing',
    secondaryStatus: 'partial_forwarder_shipped',
    counterpartyName: 'Acme Trading',
    ownerName: 'Zoe',
    createdAt: '2026-07-08T09:00:00.000Z',
    detailHref: '/sales-orders/1',
    createdBy: 'Mia',
    approvalStatus: 'purchasing',
    fulfillmentStatus: 'partial_forwarder_shipped',
    receiptStatus: 'fully_paid',
    financeConfirmStatus: 'confirmed',
    hasAfterSales: true,
  },
  {
    moduleLabel: '销售订单',
    docNo: 'S202607080002',
    title: 'Bravo 插座首单',
    status: 'pending_sales_manager_approval',
    secondaryStatus: 'pending_sales_manager_approval',
    counterpartyName: 'Bravo Retail',
    ownerName: 'Leo',
    createdAt: '2026-07-07T08:30:00.000Z',
    detailHref: '/sales-orders/2',
    createdBy: 'Mia',
    approvalStatus: 'pending_sales_manager_approval',
    fulfillmentStatus: 'pending_sales_manager_approval',
    receiptStatus: 'deposit_received',
    financeConfirmStatus: 'pending',
    hasAfterSales: false,
  },
  {
    moduleLabel: '销售订单',
    docNo: 'S202607080003',
    title: 'Acme 秋季灯具追单',
    status: 'purchasing',
    secondaryStatus: 'partial_shipped',
    counterpartyName: 'Acme Trading',
    ownerName: 'Zoe',
    createdAt: '2026-07-06T13:15:00.000Z',
    detailHref: '/sales-orders/3',
    createdBy: 'Ivy',
    approvalStatus: 'purchasing',
    fulfillmentStatus: 'partial_shipped',
    receiptStatus: 'deposit_received',
    financeConfirmStatus: 'pending',
    hasAfterSales: false,
  },
];
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.service.ts` by:

1. Adding the shared imports at the top:

```ts
import type {
  SalesOrderListQuery,
  SalesOrderListResponse,
} from '@erp/shared';
import { salesOrderListData } from './sales-order-list.data';
```

2. Adding the list method inside `SalesOrderService`:

```ts
  async list(query: SalesOrderListQuery): Promise<SalesOrderListResponse> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const sortBy =
      query.sortBy === 'docNo' || query.sortBy === 'customerName'
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const keyword = query.keyword?.trim().toLowerCase();
    const customerName = query.customerName?.trim().toLowerCase();
    const ownerName = query.ownerName?.trim().toLowerCase();
    const createdBy = query.createdBy?.trim().toLowerCase();
    const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
    const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;

    const filtered = salesOrderListData.filter((item) => {
      if (
        keyword &&
        ![
          item.docNo,
          item.title,
          item.counterpartyName ?? '',
          item.ownerName ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      ) {
        return false;
      }

      if (query.docNo && item.docNo !== query.docNo) {
        return false;
      }

      if (
        query.status &&
        item.approvalStatus !== query.status &&
        item.fulfillmentStatus !== query.status
      ) {
        return false;
      }

      if (
        customerName &&
        !(item.counterpartyName ?? '').toLowerCase().includes(customerName)
      ) {
        return false;
      }

      if (createdBy && !item.createdBy.toLowerCase().includes(createdBy)) {
        return false;
      }

      if (ownerName && !(item.ownerName ?? '').toLowerCase().includes(ownerName)) {
        return false;
      }

      if (query.approvalStatus && item.approvalStatus !== query.approvalStatus) {
        return false;
      }

      if (
        query.fulfillmentStatus &&
        item.fulfillmentStatus !== query.fulfillmentStatus
      ) {
        return false;
      }

      if (query.receiptStatus && item.receiptStatus !== query.receiptStatus) {
        return false;
      }

      if (
        query.financeConfirmStatus &&
        item.financeConfirmStatus !== query.financeConfirmStatus
      ) {
        return false;
      }

      if (query.hasAfterSales && query.hasAfterSales !== 'all') {
        const expected = query.hasAfterSales === 'yes';
        if (item.hasAfterSales !== expected) {
          return false;
        }
      }

      if (dateFrom && item.createdAt < dateFrom) {
        return false;
      }

      if (dateTo && item.createdAt > dateTo) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((left, right) => {
      const leftValue =
        sortBy === 'customerName' ? left.counterpartyName ?? '' : left[sortBy];
      const rightValue =
        sortBy === 'customerName' ? right.counterpartyName ?? '' : right[sortBy];

      if (leftValue === rightValue) {
        return 0;
      }

      const result = leftValue > rightValue ? 1 : -1;
      return sortOrder === 'asc' ? result : result * -1;
    });

    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    return {
      items,
      page,
      pageSize,
      total: filtered.length,
      appliedFilters: {
        keyword: query.keyword ?? null,
        docNo: query.docNo ?? null,
        status: query.status ?? null,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        customerName: query.customerName ?? null,
        createdBy: query.createdBy ?? null,
        ownerName: query.ownerName ?? null,
        approvalStatus: query.approvalStatus ?? null,
        fulfillmentStatus: query.fulfillmentStatus ?? null,
        receiptStatus: query.receiptStatus ?? null,
        financeConfirmStatus: query.financeConfirmStatus ?? null,
        hasAfterSales: query.hasAfterSales ?? 'all',
      },
    };
  }
```

- [ ] **Step 4: Run the service list test to verify it passes**

Run: `CI=true pnpm --filter api test -- sales-order-list.spec.ts`
Expected: PASS with advanced filtering and pagination assertions green

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/sales-order/sales-order-list.data.ts apps/api/src/sales-order/sales-order.service.ts apps/api/test/sales-order-list.spec.ts
git commit -m "feat: add sales order list filtering rules"
```

### Task 3: Add The Sales Order List Endpoint

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/dto/list-sales-orders-query.dto.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-list.controller.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.controller.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-list.controller.spec.ts`

- [ ] **Step 1: Write the failing controller list test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-list.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('SalesOrderController list', () => {
  it('normalizes list query params before forwarding them', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 5,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [{ provide: SalesOrderService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    const result = await controller.list({
      keyword: 'Acme',
      approvalStatus: 'purchasing',
      hasAfterSales: 'yes',
      page: '2',
      pageSize: '5',
      sortBy: 'docNo',
      sortOrder: 'asc',
    });

    expect(list).toHaveBeenCalledWith({
      keyword: 'Acme',
      approvalStatus: 'purchasing',
      hasAfterSales: 'yes',
      page: 2,
      pageSize: 5,
      sortBy: 'docNo',
      sortOrder: 'asc',
    });
    expect(result.page).toBe(2);
  });
});
```

- [ ] **Step 2: Run the controller list test to verify it fails**

Run: `CI=true pnpm --filter api test -- sales-order-list.controller.spec.ts`
Expected: FAIL because `SalesOrderController.list` does not exist yet

- [ ] **Step 3: Add the query DTO and controller endpoint**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/dto/list-sales-orders-query.dto.ts`:

```ts
export class ListSalesOrdersQueryDto {
  keyword?: string;
  docNo?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  customerName?: string;
  createdBy?: string;
  ownerName?: string;
  approvalStatus?: string;
  fulfillmentStatus?: string;
  receiptStatus?: string;
  financeConfirmStatus?: string;
  hasAfterSales?: 'all' | 'yes' | 'no';
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.controller.ts` by:

1. Updating the imports:

```ts
import { salesOrderListSortFields } from '@erp/shared';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ListSalesOrdersQueryDto } from './dto/list-sales-orders-query.dto';
```

2. Adding the list endpoint above `@Get(':id')`:

```ts
  @Get()
  list(@Query() query: ListSalesOrdersQueryDto) {
    const sortBy: (typeof salesOrderListSortFields)[number] = salesOrderListSortFields.includes(
      query.sortBy as (typeof salesOrderListSortFields)[number],
    )
      ? (query.sortBy as (typeof salesOrderListSortFields)[number])
      : 'createdAt';

    return this.salesOrderService.list({
      ...query,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
      sortBy,
      sortOrder: query.sortOrder ?? 'desc',
      hasAfterSales: query.hasAfterSales ?? 'all',
    });
  }
```

- [ ] **Step 4: Run the controller list test to verify it passes**

Run: `CI=true pnpm --filter api test -- sales-order-list.controller.spec.ts`
Expected: PASS with the normalized query forwarding assertion green

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/sales-order/dto/list-sales-orders-query.dto.ts apps/api/src/sales-order/sales-order.controller.ts apps/api/test/sales-order-list.controller.spec.ts
git commit -m "feat: add sales order list query endpoint"
```

### Task 4: Build The Sales Order Advanced Filter Page

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/sales-order-preview.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-orders-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-orders-page.test.tsx`

- [ ] **Step 1: Write the failing page test**

Replace `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-orders-page.test.tsx` with:

```ts
import { render, screen } from '@testing-library/react';
import SalesOrdersPage from '../app/sales-orders/page';

describe('SalesOrdersPage', () => {
  it('renders the sales order advanced filter form and default results', () => {
    render(<SalesOrdersPage searchParams={{}} />);

    expect(
      screen.getByRole('heading', { name: '销售订单中心' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('关键词')).toBeInTheDocument();
    expect(screen.getByLabelText('单号')).toBeInTheDocument();
    expect(screen.getByLabelText('状态')).toBeInTheDocument();
    expect(screen.getByText('高级筛选')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重置' })).toHaveAttribute(
      'href',
      '/sales-orders',
    );
    expect(screen.getByText('S202607080001')).toBeInTheDocument();
    expect(screen.getByText('S202607080002')).toBeInTheDocument();
  });

  it('expands advanced filters and narrows results from search params', () => {
    const { container } = render(
      <SalesOrdersPage
        searchParams={{
          keyword: 'Acme',
          approvalStatus: 'purchasing',
          hasAfterSales: 'yes',
          ownerName: 'Zoe',
        }}
      />,
    );

    expect(container.querySelector('details')?.open).toBe(true);
    expect(screen.getByText('approvalStatus: purchasing')).toBeInTheDocument();
    expect(screen.getByText('hasAfterSales: yes')).toBeInTheDocument();
    expect(screen.getByText('S202607080001')).toBeInTheDocument();
    expect(screen.queryByText('S202607080002')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the page test to verify it fails**

Run: `CI=true pnpm --filter web test -- sales-orders-page.test.tsx`
Expected: FAIL because the current page does not render the filter form or filtered result state

- [ ] **Step 3: Add the preview data and page implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/sales-order-preview.ts`:

```ts
import type {
  SalesOrderListItem,
  SalesOrderListQuery,
  SalesOrderListResponse,
} from '@erp/shared';

const previewSalesOrders: SalesOrderListItem[] = [
  {
    moduleLabel: '销售订单',
    docNo: 'S202607080001',
    title: 'Acme 夏季风扇补货',
    status: 'purchasing',
    secondaryStatus: 'partial_forwarder_shipped',
    counterpartyName: 'Acme Trading',
    ownerName: 'Zoe',
    createdAt: '2026-07-08T09:00:00.000Z',
    detailHref: '/sales-orders/1',
    createdBy: 'Mia',
    approvalStatus: 'purchasing',
    fulfillmentStatus: 'partial_forwarder_shipped',
    receiptStatus: 'fully_paid',
    financeConfirmStatus: 'confirmed',
    hasAfterSales: true,
  },
  {
    moduleLabel: '销售订单',
    docNo: 'S202607080002',
    title: 'Bravo 插座首单',
    status: 'pending_sales_manager_approval',
    secondaryStatus: 'pending_sales_manager_approval',
    counterpartyName: 'Bravo Retail',
    ownerName: 'Leo',
    createdAt: '2026-07-07T08:30:00.000Z',
    detailHref: '/sales-orders/2',
    createdBy: 'Mia',
    approvalStatus: 'pending_sales_manager_approval',
    fulfillmentStatus: 'pending_sales_manager_approval',
    receiptStatus: 'deposit_received',
    financeConfirmStatus: 'pending',
    hasAfterSales: false,
  },
  {
    moduleLabel: '销售订单',
    docNo: 'S202607080003',
    title: 'Acme 秋季灯具追单',
    status: 'purchasing',
    secondaryStatus: 'partial_shipped',
    counterpartyName: 'Acme Trading',
    ownerName: 'Zoe',
    createdAt: '2026-07-06T13:15:00.000Z',
    detailHref: '/sales-orders/3',
    createdBy: 'Ivy',
    approvalStatus: 'purchasing',
    fulfillmentStatus: 'partial_shipped',
    receiptStatus: 'deposit_received',
    financeConfirmStatus: 'pending',
    hasAfterSales: false,
  },
];

export function getSalesOrderPreviewResponse(
  query: SalesOrderListQuery,
): SalesOrderListResponse {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
  const keyword = query.keyword?.trim().toLowerCase();
  const customerName = query.customerName?.trim().toLowerCase();
  const createdBy = query.createdBy?.trim().toLowerCase();
  const ownerName = query.ownerName?.trim().toLowerCase();
  const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
  const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;

  const filtered = previewSalesOrders.filter((item) => {
    if (
      keyword &&
      ![item.docNo, item.title, item.counterpartyName ?? '', item.ownerName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    ) {
      return false;
    }

    if (query.docNo && item.docNo !== query.docNo) {
      return false;
    }

    if (
      query.status &&
      item.approvalStatus !== query.status &&
      item.fulfillmentStatus !== query.status
    ) {
      return false;
    }

    if (
      customerName &&
      !(item.counterpartyName ?? '').toLowerCase().includes(customerName)
    ) {
      return false;
    }

    if (createdBy && !item.createdBy.toLowerCase().includes(createdBy)) {
      return false;
    }

    if (ownerName && !(item.ownerName ?? '').toLowerCase().includes(ownerName)) {
      return false;
    }

    if (query.approvalStatus && item.approvalStatus !== query.approvalStatus) {
      return false;
    }

    if (
      query.fulfillmentStatus &&
      item.fulfillmentStatus !== query.fulfillmentStatus
    ) {
      return false;
    }

    if (query.receiptStatus && item.receiptStatus !== query.receiptStatus) {
      return false;
    }

    if (
      query.financeConfirmStatus &&
      item.financeConfirmStatus !== query.financeConfirmStatus
    ) {
      return false;
    }

    if (query.hasAfterSales && query.hasAfterSales !== 'all') {
      const expected = query.hasAfterSales === 'yes';
      if (item.hasAfterSales !== expected) {
        return false;
      }
    }

    if (dateFrom && item.createdAt < dateFrom) {
      return false;
    }

    if (dateTo && item.createdAt > dateTo) {
      return false;
    }

    return true;
  });

  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: filtered.length,
    appliedFilters: {
      keyword: query.keyword ?? null,
      docNo: query.docNo ?? null,
      status: query.status ?? null,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      customerName: query.customerName ?? null,
      createdBy: query.createdBy ?? null,
      ownerName: query.ownerName ?? null,
      approvalStatus: query.approvalStatus ?? null,
      fulfillmentStatus: query.fulfillmentStatus ?? null,
      receiptStatus: query.receiptStatus ?? null,
      financeConfirmStatus: query.financeConfirmStatus ?? null,
      hasAfterSales: query.hasAfterSales ?? 'all',
    },
  };
}
```

Replace `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/page.tsx` with:

```tsx
import Link from 'next/link';
import {
  salesApprovalStatuses,
  salesFulfillmentStatuses,
  salesOrderHasAfterSalesOptions,
} from '@erp/shared';
import { getSalesOrderPreviewResponse } from './sales-order-preview';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function SalesOrdersPage({
  searchParams = {},
}: {
  searchParams?: SearchParams;
}) {
  const query = {
    keyword: readParam(searchParams.keyword),
    docNo: readParam(searchParams.docNo),
    status: readParam(searchParams.status),
    dateFrom: readParam(searchParams.dateFrom),
    dateTo: readParam(searchParams.dateTo),
    customerName: readParam(searchParams.customerName),
    createdBy: readParam(searchParams.createdBy),
    ownerName: readParam(searchParams.ownerName),
    approvalStatus: readParam(searchParams.approvalStatus),
    fulfillmentStatus: readParam(searchParams.fulfillmentStatus),
    receiptStatus: readParam(searchParams.receiptStatus),
    financeConfirmStatus: readParam(searchParams.financeConfirmStatus),
    hasAfterSales: readParam(searchParams.hasAfterSales) ?? 'all',
    page: Number(readParam(searchParams.page) ?? '1'),
    pageSize: Number(readParam(searchParams.pageSize) ?? '20'),
  } as const;

  const result = getSalesOrderPreviewResponse(query);
  const appliedAdvancedFilters = [
    ['customerName', query.customerName],
    ['createdBy', query.createdBy],
    ['ownerName', query.ownerName],
    ['approvalStatus', query.approvalStatus],
    ['fulfillmentStatus', query.fulfillmentStatus],
    ['receiptStatus', query.receiptStatus],
    ['financeConfirmStatus', query.financeConfirmStatus],
    ['hasAfterSales', query.hasAfterSales !== 'all' ? query.hasAfterSales : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const hasAdvancedFilters = appliedAdvancedFilters.length > 0;

  return (
    <main>
      <h1>销售订单中心</h1>
      <p>支持报价转销售、改单重提、撤销留痕</p>
      <p>当前展示：销售高级筛选、结果摘要与履约状态预览</p>

      <form method="get">
        <label>
          关键词
          <input name="keyword" defaultValue={query.keyword} />
        </label>
        <label>
          单号
          <input name="docNo" defaultValue={query.docNo} />
        </label>
        <label>
          状态
          <select name="status" defaultValue={query.status ?? ''}>
            <option value="">全部</option>
            {salesApprovalStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
            {salesFulfillmentStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          开始日期
          <input name="dateFrom" type="date" defaultValue={query.dateFrom} />
        </label>
        <label>
          结束日期
          <input name="dateTo" type="date" defaultValue={query.dateTo} />
        </label>

        <details open={hasAdvancedFilters}>
          <summary>高级筛选</summary>
          <label>
            客户
            <input name="customerName" defaultValue={query.customerName} />
          </label>
          <label>
            创建人
            <input name="createdBy" defaultValue={query.createdBy} />
          </label>
          <label>
            负责人
            <input name="ownerName" defaultValue={query.ownerName} />
          </label>
          <label>
            审批状态
            <select name="approvalStatus" defaultValue={query.approvalStatus ?? ''}>
              <option value="">全部</option>
              {salesApprovalStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            履约状态
            <select
              name="fulfillmentStatus"
              defaultValue={query.fulfillmentStatus ?? ''}
            >
              <option value="">全部</option>
              {salesFulfillmentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            收款状态
            <input name="receiptStatus" defaultValue={query.receiptStatus} />
          </label>
          <label>
            财务确认状态
            <input
              name="financeConfirmStatus"
              defaultValue={query.financeConfirmStatus}
            />
          </label>
          <label>
            是否有售后
            <select name="hasAfterSales" defaultValue={query.hasAfterSales}>
              {salesOrderHasAfterSalesOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </details>

        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value="20" />
        <button type="submit">查询</button>
        <Link href="/sales-orders">重置</Link>
      </form>

      {hasAdvancedFilters ? (
        <section aria-labelledby="sales-order-applied-filters">
          <h2 id="sales-order-applied-filters">当前筛选</h2>
          <ul>
            {appliedAdvancedFilters.map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="sales-order-results">
        <h2 id="sales-order-results">查询结果</h2>
        <p>共 {result.total} 条</p>

        {result.items.length === 0 ? (
          <p>暂无符合条件的销售订单</p>
        ) : (
          <ul>
            {result.items.map((item) => (
              <li key={item.docNo}>
                <h3>{item.docNo}</h3>
                <p>{item.title}</p>
                <p>主状态：{item.status}</p>
                <p>次状态：{item.secondaryStatus}</p>
                <p>客户：{item.counterpartyName}</p>
                <p>负责人：{item.ownerName}</p>
                <Link href={item.detailHref}>查看详情</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="sales-order-pagination">
        <p>
          第 {result.page} 页 / 每页 {result.pageSize} 条
        </p>
      </nav>
    </main>
  );
}
```

- [ ] **Step 4: Run the page test to verify it passes**

Run: `CI=true pnpm --filter web test -- sales-orders-page.test.tsx`
Expected: PASS with the advanced filter form and filtered result assertions green

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/sales-orders/sales-order-preview.ts apps/web/app/sales-orders/page.tsx apps/web/tests/sales-orders-page.test.tsx
git commit -m "feat: add sales order advanced filter page"
```

### Task 5: Run Full Verification

**Files:**
- Modify: none
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests`

- [ ] **Step 1: Run the shared tests**

Run: `CI=true pnpm --filter @erp/shared test`
Expected: PASS with the new shared list query contract test included

- [ ] **Step 2: Run the shared build**

Run: `CI=true pnpm --filter @erp/shared build`
Expected: PASS with the new list-query exports available to the web package

- [ ] **Step 3: Run the API tests**

Run: `CI=true pnpm --filter api test`
Expected: PASS with the new sales-order list service and controller specs included

- [ ] **Step 4: Run the web tests**

Run: `CI=true pnpm --filter web test`
Expected: PASS with the updated sales orders page test included

- [ ] **Step 5: Run the web build**

Run: `CI=true pnpm --filter web build`
Expected: PASS with the sales orders page rendering the filter form and result list

---

## Plan Self-Review

- Spec coverage: this plan covers the shared query contracts, the `sales-orders` list API, the URL-driven filter page, result rendering, empty-state behavior, and rollout-friendly naming.
- Placeholder scan: there are no `TODO`, `TBD`, or “similar to previous task” placeholders.
- Type consistency: the plan uses `SalesOrderListQuery`, `SalesOrderListItem`, `SalesOrderListResponse`, and `hasAfterSales` naming consistently across shared, API, and web tasks.
