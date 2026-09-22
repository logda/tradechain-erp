# Shipment Batch Advanced Filter MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next reusable ERP list-query slice by adding shared list query contracts plus advanced filtering for the `shipment-batches` API and page.

**Architecture:** Reuse the same thin-slice pattern already established for `sales-orders`, `purchase-orders`, and `after-sales`. Add one shared contract layer in `@erp/shared`, one in-memory filtered list endpoint in the shipment-batch module, and one URL-driven Next.js page that renders basic filters, advanced filters, filtered results, and empty-state behavior without introducing real persistence or client-side data fetching.

**Tech Stack:** pnpm workspaces, TypeScript, NestJS, Next.js App Router, Vitest, Jest

---

## File Structure

- Create `packages/shared/src/shipment-batch-list.ts`
  Shared shipment-batch query type, result item type, and runtime option arrays.
- Create `packages/shared/src/shipment-batch-list.spec.ts`
  Shared runtime contract tests for the new shipment-batch list options.
- Modify `packages/shared/src/index.ts`
  Export the new shipment-batch list contracts.
- Create `apps/api/src/shipment-batch/shipment-batch-list.data.ts`
  Holds semantic static shipment-batch list records for filtering.
- Create `apps/api/src/shipment-batch/dto/list-shipment-batches-query.dto.ts`
  Encodes the accepted query string fields for `GET /shipment-batches`.
- Modify `apps/api/src/shipment-batch/shipment-batch.service.ts`
  Add the in-memory list query method and helpers.
- Modify `apps/api/src/shipment-batch/shipment-batch.controller.ts`
  Add the list endpoint and query normalization.
- Create `apps/api/test/shipment-batch-list.spec.ts`
  Verifies the shipment-batch service list filtering and pagination rules.
- Create `apps/api/test/shipment-batch-list.controller.spec.ts`
  Verifies controller query normalization and forwarding.
- Create `apps/web/app/shipment-batches/shipment-batch-preview.ts`
  Holds static preview records plus the same filter semantics for the page.
- Modify `apps/web/app/shipment-batches/page.tsx`
  Replace the current status-only placeholder with a real filter form and results list.
- Modify `apps/web/tests/shipment-batches-page.test.tsx`
  Verify default render plus filtered render with advanced parameters.

## Tasks

### Task 1: Add Shared Shipment-Batch List Query Contracts

- [ ] Add a failing shared contract test for sort fields and tri-state exception filter options.
- [ ] Implement `shipment-batch-list.ts` with:
  `shipmentBatchListSortFields = ['createdAt', 'docNo', 'supplierName']`
  `shipmentBatchHasExceptionOptions = ['all', 'yes', 'no']`
- [ ] Model query fields:
  common: `keyword`, `docNo`, `status`, `dateFrom`, `dateTo`
  relationship: `supplierName`, `ownerName`
  module-specific: `salesOrderNo`, `purchaseOrderNo`, `receiptSendStatus`, `hasException`
- [ ] Export the new shared contracts from `packages/shared/src/index.ts`.
- [ ] Run focused shared tests, then commit the shared slice.

### Task 2: Add Shipment-Batch API List Filtering

- [ ] Add failing API tests for:
  advanced field filtering + applied filters
  shared `status` filtering + pagination
  controller normalization of `sortBy`, `page`, `pageSize`, `hasException`
- [ ] Create semantic static data in `shipment-batch-list.data.ts` with at least 3 records and enough variation to prove:
  supplier filtering
  owner filtering
  sales order vs purchase order filtering
  receipt send status filtering
  exception tri-state filtering
- [ ] Add `list(query)` to `ShipmentBatchService` using the same semantics as the web preview helper.
- [ ] Add `GET /shipment-batches` to `ShipmentBatchController` with safe normalization.
- [ ] Run focused API tests, then full API tests.

### Task 3: Add URL-Driven Shipment-Batch Advanced Filter Page

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
  `supplierName`, `ownerName`, `salesOrderNo`, `purchaseOrderNo`, `receiptSendStatus`, `hasException`
- [ ] Add `shipment-batch-preview.ts` with filtering behavior aligned to the service.
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
- [ ] Commit only the shipment-batch advanced filter slice.
