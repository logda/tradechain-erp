# After Sales Advanced Filter MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next reusable ERP list-query slice by adding shared list query contracts plus advanced filtering for the `after-sales` API and page.

**Architecture:** Reuse the same thin-slice pattern already established for `sales-orders` and `purchase-orders`. Add one shared contract layer in `@erp/shared`, one in-memory filtered list endpoint in the after-sales module, and one URL-driven Next.js page that renders basic filters, advanced filters, filtered results, and empty-state behavior without introducing real persistence or client-side data fetching.

**Tech Stack:** pnpm workspaces, TypeScript, NestJS, Next.js App Router, Vitest, Jest

---

## File Structure

- Create `packages/shared/src/after-sales-list.ts`
  Shared after-sales query type, result item type, and runtime option arrays.
- Create `packages/shared/src/after-sales-list.spec.ts`
  Shared runtime contract tests for the new after-sales list options.
- Modify `packages/shared/src/index.ts`
  Export the new after-sales list contracts.
- Create `apps/api/src/after-sales/after-sales-list.data.ts`
  Holds semantic static after-sales list records for filtering.
- Create `apps/api/src/after-sales/dto/list-after-sales-query.dto.ts`
  Encodes the accepted query string fields for `GET /after-sales`.
- Modify `apps/api/src/after-sales/after-sales.service.ts`
  Add the in-memory list query method and helpers.
- Modify `apps/api/src/after-sales/after-sales.controller.ts`
  Add the list endpoint and query normalization.
- Create `apps/api/test/after-sales-list.spec.ts`
  Verifies the after-sales service list filtering and pagination rules.
- Create `apps/api/test/after-sales-list.controller.spec.ts`
  Verifies controller query normalization and forwarding.
- Create `apps/web/app/after-sales/after-sales-preview.ts`
  Holds static preview records plus the same filter semantics for the page.
- Modify `apps/web/app/after-sales/page.tsx`
  Replace the current status-only placeholder with a real filter form and results list.
- Modify `apps/web/tests/after-sales-page.test.tsx`
  Verify default render plus filtered render with advanced parameters.

## Tasks

### Task 1: Add Shared After-Sales List Query Contracts

- [ ] Add a failing shared contract test for sort fields and runtime filter options.
- [ ] Implement `after-sales-list.ts` with:
  `afterSalesListSortFields = ['createdAt', 'docNo', 'customerName']`
  `afterSalesTypes = ['customer_complaint', 'return', 'refund', 'rework']`
- [ ] Model query fields:
  common: `keyword`, `docNo`, `status`, `dateFrom`, `dateTo`
  relationship: `customerName`, `supplierName`, `createdBy`, `ownerName`
  module-specific: `type`, `financeReviewStatus`, `receiptCollectionStatus`, `shipmentBatchNo`
- [ ] Export the new shared contracts from `packages/shared/src/index.ts`.
- [ ] Run focused shared tests, then commit the shared slice.

### Task 2: Add After-Sales API List Filtering

- [ ] Add failing API tests for:
  advanced field filtering + applied filters
  shared `status` mapping + pagination
  controller normalization of `sortBy`, `page`, `pageSize`
- [ ] Create semantic static data in `after-sales-list.data.ts` with at least 3 records and enough variation to prove:
  customer vs supplier filtering
  type filtering
  finance review filtering
  receipt collection filtering
  shipment batch filtering
- [ ] Add `list(query)` to `AfterSalesService` using the same semantics as the web preview helper.
- [ ] Add `GET /after-sales` to `AfterSalesController` with safe normalization.
- [ ] Run focused API tests, then full API tests.

### Task 3: Add URL-Driven After-Sales Advanced Filter Page

- [ ] Replace the placeholder page with an async App Router page that accepts Promise-based `searchParams`.
- [ ] Keep the page structure aligned with the shared list-page pattern:
  page title + summary
  basic filters
  advanced filters in `<details>`
  applied filter summary
  result list
  empty state
  pagination text
- [ ] Basic filters:
  `keyword`, `docNo`, `status`, `dateFrom`, `dateTo`
- [ ] Advanced filters:
  `customerName`, `supplierName`, `createdBy`, `ownerName`, `type`, `financeReviewStatus`, `receiptCollectionStatus`, `shipmentBatchNo`
- [ ] Add `after-sales-preview.ts` with filtering behavior aligned to the service.
- [ ] Update the page test to cover:
  default render with default results
  advanced-filter render that auto-expands `<details>`
- [ ] Run focused web tests, then full web tests and `web build`.

### Task 4: Final Verification And Commit

- [ ] Run:
  `CI=true pnpm --filter @erp/shared test`
  `CI=true pnpm --filter @erp/shared build`
  `CI=true pnpm --filter api test`
  `CI=true pnpm --filter web test`
  `CI=true pnpm --filter web build`
- [ ] Request spec-compliance review on the working tree.
- [ ] Request code-quality review on the working tree.
- [ ] Fix any review findings and re-run affected verification.
- [ ] Commit only the after-sales advanced filter slice.
