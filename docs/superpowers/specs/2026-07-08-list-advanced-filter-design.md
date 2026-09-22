# ERP List Advanced Filter Design

**Date:** 2026-07-08

**Goal:** Define a unified advanced filtering system for all ERP business list pages so each module can support structured list queries without introducing a global search subsystem.

**Scope:** `quotes`, `samples`, `sales-orders`, `purchase-orders`, `shipment-batches`, `after-sales`

---

## 1. Context And Scope

The current ERP workspace already has thin vertical slices for quote, sample, sales, purchase, shipment, after-sales, finance summary, and boss dashboard. The existing business pages are still lightweight read-only pages and do not yet provide list querying capabilities.

This design does **not** introduce:

- global cross-module search
- saved filter schemes
- export with filter inheritance
- column configuration
- permission-driven dynamic filter hiding
- database optimization or real persistence-backed indexing

This design **does** introduce:

- one list query endpoint per business module
- one shared front-end filtering interaction model
- shared URL query parameter conventions
- module-specific advanced filter fields
- a phased rollout plan so all list pages can converge on one pattern

---

## 2. Design Decisions

### 2.1 Search Boundary

Use advanced filters on each list page instead of a global search entry.

Reasoning:

- ERP users usually enter from a known module and then narrow records inside that module.
- Per-page filtering avoids early over-design around cross-module ranking and mixed schemas.
- It aligns better with module-specific permissions and future field-level visibility boundaries.

### 2.2 Delivery Strategy

Build a shared list filtering pattern once, then roll it out page by page.

Reasoning:

- All six list pages need query capability eventually.
- Writing six separate filter systems would quickly diverge in naming, behavior, and test strategy.
- A shared pattern keeps URL state, reset logic, paging, and result rendering consistent.

### 2.3 First Version Restraint

The first version should optimize for consistency and auditability, not for maximum search power.

First version priorities:

- stable field naming
- predictable URL replay
- reusable page pattern
- semantic static query results
- narrow but complete test coverage

---

## 3. Shared Query Model

### 3.1 Shared Field Layers

| Layer | Fields | Purpose |
|---|---|---|
| Common fields | `keyword`, `docNo`, `status`, `dateFrom`, `dateTo` | Shared entry-level filters across all modules |
| Relationship fields | `customerName`, `supplierName`, `createdBy`, `ownerName` | Narrow records by business relation or responsibility |
| Module-specific fields | Vary by page | Express module-specific approval, fulfillment, finance, or logistics dimensions |

### 3.2 Shared Field Rules

| Field | Rule |
|---|---|
| `keyword` | Broad match only within the current module's important fields; no full-text cross-module search |
| `docNo` | Exact-match first behavior for fast document targeting |
| `status` | Unified UI label as "状态", while API maps it to module-specific status semantics |
| `dateFrom`, `dateTo` | First version always targets record `createdAt`; do not mix approval time, shipment time, or close time yet |
| `ownerName` | Means business owner; if unavailable in a module, may temporarily fall back to creator semantics |
| Boolean-style filters | Use tri-state values like `all / yes / no` rather than binary-only toggles |

---

## 4. Page Filter Matrix

| Page | Common fields | Relationship fields | Module-specific fields |
|---|---|---|---|
| `quotes` | `keyword`, `docNo`, `status`, `dateFrom`, `dateTo` | `customerName`, `createdBy` | `sourceType`, `bossConfirmed` |
| `samples` | `keyword`, `docNo`, `status`, `dateFrom`, `dateTo` | `customerName`, `createdBy`, `ownerName` | `quoteNo`, `isReplacement`, `isCancelled` |
| `sales-orders` | `keyword`, `docNo`, `status`, `dateFrom`, `dateTo` | `customerName`, `createdBy`, `ownerName` | `approvalStatus`, `fulfillmentStatus`, `receiptStatus`, `financeConfirmStatus`, `hasAfterSales` |
| `purchase-orders` | `keyword`, `docNo`, `status`, `dateFrom`, `dateTo` | `supplierName`, `createdBy`, `ownerName` | `approvalStatus`, `fulfillmentStatus`, `salesOrderNo`, `isResubmitted` |
| `shipment-batches` | `keyword`, `docNo`, `status`, `dateFrom`, `dateTo` | `supplierName`, `ownerName` | `salesOrderNo`, `purchaseOrderNo`, `receiptSendStatus`, `hasException` |
| `after-sales` | `keyword`, `docNo`, `status`, `dateFrom`, `dateTo` | `customerName`, `supplierName`, `createdBy`, `ownerName` | `type`, `financeReviewStatus`, `receiptCollectionStatus`, `shipmentBatchNo` |

---

## 5. API Design

### 5.1 Endpoint Set

| Module | Endpoint |
|---|---|
| Quotes | `GET /api/quotes` |
| Sample orders | `GET /api/sample-orders` |
| Sales orders | `GET /api/sales-orders` |
| Purchase orders | `GET /api/purchase-orders` |
| Shipment batches | `GET /api/shipment-batches` |
| After-sales orders | `GET /api/after-sales` |

### 5.2 Shared Query Parameters

```ts
type CommonListQuery = {
  keyword?: string;
  docNo?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};
```

Example module extension:

```ts
type SalesOrderListQuery = CommonListQuery & {
  customerName?: string;
  createdBy?: string;
  ownerName?: string;
  approvalStatus?: string;
  fulfillmentStatus?: string;
  receiptStatus?: string;
  financeConfirmStatus?: string;
  hasAfterSales?: 'all' | 'yes' | 'no';
};
```

### 5.3 Shared Response Shape

```ts
type ListQueryResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  appliedFilters: Record<string, string | number | boolean | null>;
};
```

### 5.4 Shared Result Item Baseline

Each page can extend its result item shape, but all result items should expose at least:

```ts
type BaseListItem = {
  moduleLabel: string;
  docNo: string;
  title: string;
  status: string;
  secondaryStatus?: string;
  counterpartyName?: string;
  ownerName?: string;
  createdAt: string;
  detailHref: string;
};
```

### 5.5 Sorting Rules

First version should keep sorting intentionally small:

- default `sortBy=createdAt`
- default `sortOrder=desc`
- single-field sorting only
- each page exposes only a small allowed sort set
- no relevance sorting in first version

---

## 6. Frontend Interaction Design

### 6.1 Shared Page Structure

Every business list page should follow the same structure:

1. page title and short description
2. basic filters
3. expand/collapse advanced filters trigger
4. advanced filters section
5. actions area with `查询` and `重置`
6. applied filter summary
7. result list
8. empty state
9. pagination area

### 6.2 Basic Filters

The always-visible area should include:

- `keyword`
- `docNo`
- `status`
- `dateFrom`
- `dateTo`

### 6.3 Advanced Filters

The expandable area should contain module-specific and relationship-based fields.

Default behavior:

- collapsed by default
- auto-expanded if any advanced query parameter is present in the URL

### 6.4 Interaction Rules

| Action | Behavior |
|---|---|
| Click `查询` | Sync all filters to URL query string and re-render result state |
| Refresh page | Restore filter state from URL query string |
| Click `重置` | Clear all filters and return to default paging and sorting |
| Change field values | Do not auto-query in first version |
| Change page | Preserve all current filter conditions |
| Change sorting | Preserve all current filter conditions |

### 6.5 Result Rendering

First version does not need a heavy table framework. A lightweight, consistent row/card list is acceptable as long as the returned data shape remains future-friendly.

Each result should visibly show:

- document number
- main title
- main status
- secondary status when applicable
- counterparty
- owner
- created time
- detail navigation target

---

## 7. Implementation Strategy

### 7.1 Recommended Waves

| Wave | Pages | Why |
|---|---|---|
| Wave 1 | `sales-orders` | Most complex status dimensions; best page to pressure-test shared filtering model |
| Wave 2 | `purchase-orders`, `after-sales` | Reuse responsibility, approval, and finance-related patterns |
| Wave 3 | `shipment-batches` | Extend the model to logistics, exception, and receipt-specific fields |
| Wave 4 | `quotes`, `samples` | Backfill simpler pre-sales and sample workflows using the established pattern |

### 7.2 Why Start With Sales Orders

- It has the richest mix of approval, fulfillment, receipt, finance, and after-sales dimensions.
- If the shared filtering model works here, later pages will mostly be a simplification.
- It avoids the false confidence of starting with a simpler page and discovering structural limits later.

---

## 8. First Version Boundaries

### 8.1 Included

- shared filter interaction pattern
- list query endpoints for the target rollout pages
- URL-restorable filters
- result list rendering
- empty-state handling
- pagination that preserves filters
- page-level tests and query parsing tests

### 8.2 Excluded

- saved filter presets
- export inheriting filter conditions
- multi-select state composition
- configurable columns
- permission-driven filter field hiding
- persistence/index optimization
- global search or cross-module ranking

---

## 9. Risks And Mitigations

| Risk | Description | Mitigation |
|---|---|---|
| Status semantics diverge | Different modules all expose a "状态" field but mean different things | Keep UI label unified while mapping status semantics per module in API contract |
| Query explosion | Too many fields create heavy URLs and brittle tests | Keep first version to required fields only |
| Frontend/backend drift | Field names and option values may drift between packages | Centralize shared query names and status option constants where possible |
| Page-level divergence | Teams may handcraft each page's filters differently | Build one shared filter shell and parameter model first |
| Over-design temptation | Global search or generalized query engines may distract from delivery | Enforce the boundary of per-page list filtering only |
| Test sprawl | Six pages can cause duplicated interaction tests | Test shared interaction behavior once and keep per-page tests focused on field wiring and output |

---

## 10. Delivery Recommendation

The next implementation plan should target:

1. the shared list filtering pattern
2. the `sales-orders` advanced filter MVP

After that slice is verified and stable, the same pattern can be rolled out to the other five list pages.

---

## 11. Spec Self-Review

- Placeholder scan: no `TODO`, `TBD`, or intentionally vague implementation gaps remain in this document.
- Internal consistency: the scope stays within per-page list filtering and does not drift into global search.
- Scope check: this spec defines the shared system and rollout order; implementation should still be split into smaller plans and waves.
- Ambiguity check: the first-version date field is explicitly defined as `createdAt`, and boolean-like filters are explicitly tri-state.
