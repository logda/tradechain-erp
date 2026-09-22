# Sample Advanced Filter MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the final ERP list-query slice by adding shared list query contracts plus advanced filtering for the `samples` API and page.

**Architecture:** Reuse the same thin-slice pattern already established for `quotes`, `purchase-orders`, `after-sales`, and `shipment-batches`. Add one shared contract layer in `@erp/shared`, one in-memory filtered list endpoint in the sample module, and one URL-driven Next.js page that renders basic filters, advanced filters, filtered results, and empty-state behavior without introducing real persistence or client-side data fetching.

**Tech Stack:** pnpm workspaces, TypeScript, NestJS, Next.js App Router, Vitest, Jest

---

## File Structure

- Create `packages/shared/src/sample-list.ts`
  Shared sample query type, result item type, and runtime option arrays.
- Create `packages/shared/src/sample-list.spec.ts`
  Shared runtime contract tests for the new sample list options.
- Modify `packages/shared/src/index.ts`
  Export the new shared sample list contracts.
- Create `apps/api/src/sample-order/sample-order-list.data.ts`
  Holds semantic static sample list records for filtering.
- Create `apps/api/src/sample-order/dto/list-sample-orders-query.dto.ts`
  Encodes the accepted query string fields for `GET /samples`.
- Modify `apps/api/src/sample-order/sample-order.service.ts`
  Add the in-memory list query method and helpers.
- Modify `apps/api/src/sample-order/sample-order.controller.ts`
  Add the list endpoint and query normalization.
- Create `apps/api/test/sample-order-list.spec.ts`
  Verifies the sample service list filtering and pagination rules.
- Create `apps/api/test/sample-order-list.controller.spec.ts`
  Verifies controller query normalization and forwarding.
- Create `apps/web/app/samples/sample-order-preview.ts`
  Holds static preview records plus the same filter semantics for the page.
- Modify `apps/web/app/samples/page.tsx`
  Replace the current placeholder with a real filter form and results list.
- Modify `apps/web/tests/samples-page.test.tsx`
  Verify default render plus filtered render with advanced parameters.

## Tasks

### Task 1: Add Shared Sample List Query Contracts

- [ ] Add a failing shared contract test for sort fields plus replacement and cancellation tri-state options.
- [ ] Implement `sample-list.ts` with:
  `sampleListSortFields = ['createdAt', 'docNo', 'customerName']`
  `sampleIsReplacementOptions = ['all', 'yes', 'no']`
  `sampleIsCancelledOptions = ['all', 'yes', 'no']`
- [ ] Model query fields:
  common: `keyword`, `docNo`, `status`, `dateFrom`, `dateTo`
  relationship: `customerName`, `createdBy`, `ownerName`
  module-specific: `quoteNo`, `isReplacement`, `isCancelled`
- [ ] Export the new shared contracts from `packages/shared/src/index.ts`.
- [ ] Run focused shared tests.

### Task 2: Add Sample API List Filtering

- [ ] Add failing API tests for:
  advanced field filtering + applied filters
  shared `status` filtering + pagination
  controller normalization of `sortBy`, `page`, `pageSize`, `isReplacement`, `isCancelled`
- [ ] Create semantic static data in `sample-order-list.data.ts` with at least 3 records and enough variation to prove:
  customer filtering
  creator filtering
  owner filtering
  quote filtering
  replacement tri-state filtering
  cancellation tri-state filtering
- [ ] Add `list(query)` to `SampleOrderService` using the same semantics as the web preview helper.
- [ ] Add `GET /samples` to `SampleOrderController` with safe normalization.
- [ ] Run focused API tests, then full API tests.

### Task 3: Add URL-Driven Sample Advanced Filter Page

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
  `customerName`, `createdBy`, `ownerName`, `quoteNo`, `isReplacement`, `isCancelled`
- [ ] Add `sample-order-preview.ts` with filtering behavior aligned to the service.
- [ ] Update the page test to cover:
  default render with default results
  advanced-filter render that auto-expands `<details>`
  invalid tri-state fallback to `all`
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
- [ ] Commit only the sample advanced filter slice.
