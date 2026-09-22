# Formal Pages Design

**Date:** 2026-07-11

**Goal:** Keep the existing demo pages intact while adding a separate formal ERP entry for sales workbench, formal sales lists, and the boss dashboard.

**Scope:** New `/app` formal shell, `/app/sales` workbench, `/app/sales/quotes`, `/app/sales/orders`, and `/app/dashboard/boss`, all built on top of the existing shared list/status/data patterns.

---

## 1. Context

The current workspace already has usable demo pages under:

- `/quotes`
- `/sales-orders`
- `/purchase-orders`
- `/shipment-batches`
- `/after-sales`
- `/dashboard/boss`

Those pages are useful for demo and preview, but they are not organized like a formal ERP front door. They show long lists directly, mix demo language with product language, and do not provide a stable working shell for role-based navigation and task entry.

The goal of this slice is not to rebuild every business module. The goal is to add a second, formal entry that can coexist with the demo entry and become the long-term app shell.

---

## 2. Scope And Non-Goals

### In Scope

- keep existing demo routes unchanged
- add a formal route group under `/app`
- add a formal top shell with global navigation and return-home behavior
- add a sales workbench page that exposes quote, sales order, and todo entry points
- add formal sales quote and sales order list pages
- add a formal boss dashboard page
- reuse the existing shared status, filter, and preview data contracts
- introduce formal layout components that can be reused by later modules

### Out Of Scope

- real login/auth middleware
- backend permission enforcement
- formal purchase, shipment, and after-sales pages in this first slice
- rebuilding all detail pages at once
- changing the existing demo routes to the formal shell
- changing business rules or lifecycle APIs beyond what the formal pages need

---

## 3. Approach

### Recommended Structure

Use a separate formal route tree and a shared component layer:

- demo pages stay at their current routes
- formal pages live under `/app`
- the formal shell provides navigation, breadcrumbs, and return-home behavior
- each formal list page uses the same data model as the current preview pages, but with a stricter table layout and stronger action affordances

### Why This Approach

- demo and formal experiences can evolve independently
- the existing preview work stays valuable
- later modules can copy the same shell without rewiring the demo routes
- the first release can be shipped incrementally

---

## 4. Page Map

| Route | Purpose |
|---|---|
| `/app` | Formal home/workbench |
| `/app/sales` | Sales hub with quote, sales order, and todo entry points |
| `/app/sales/quotes` | Formal quote list |
| `/app/sales/orders` | Formal sales order list |
| `/app/dashboard/boss` | Formal boss dashboard |

The existing demo routes remain:

| Route | Purpose |
|---|---|
| `/quotes` | Demo quote page |
| `/sales-orders` | Demo sales order page |
| `/purchase-orders` | Demo purchase page |
| `/shipment-batches` | Demo shipment page |
| `/after-sales` | Demo after-sales page |

---

## 5. Formal Shell Design

### 5.1 Global Shell

The formal shell should provide:

- system name
- current role label
- current user label
- return-home button
- todo shortcut
- left navigation
- content area

### 5.2 Sales Hub

The sales hub should not show a long sales list on the landing page.

It should show:

- quote entry
- sales order entry
- todo entry
- quick create / convert shortcuts
- small summary cards

### 5.3 Formal List Layout

Formal list pages should standardize on:

- title
- subtitle
- primary action button
- summary cards
- basic filter row
- advanced filter panel
- compact selected filter chips
- square data table
- row actions

### 5.4 Formal Boss Dashboard

The formal boss dashboard should present:

- todo overview
- sales summary
- purchase summary
- finance/receipt summary
- exception overview

---

## 6. Shared Component Boundaries

The first batch should introduce formal reusable UI pieces:

| Component | Responsibility |
|---|---|
| `AppShell` | Formal page frame and navigation |
| `WorktileCard` | Workbench/task shortcut card |
| `StatStrip` | Summary card strip above lists |
| `FilterPanel` | Basic and advanced filter grouping |
| `FormalDataTable` | Square table layout with row actions |
| `DetailSection` | Reusable detail page section wrapper |

These are formal-only components. The demo pages should continue using their existing preview layout unless they are explicitly migrated later.

---

## 7. Data And Behavior Rules

1. Formal pages should reuse the existing shared list and status contracts.
2. Formal pages should preserve the same filter semantics already used by the demo pages, including source mode and tri-state filters where applicable.
3. Formal pages should not duplicate backend business logic.
4. Formal list pages should display Chinese labels first, with English field names only where they improve traceability.
5. Formal pages should support role-aware visibility in the UI, but backend auth is a later step.

---

## 8. Testing Strategy

The first batch should cover:

- route rendering for `/app` and the sales hub
- list rendering for formal quote and sales order pages
- navigation and return-home behavior
- filter preservation across formal list pages
- boss dashboard summary rendering

The demo page tests should remain green and unchanged unless a shared contract changes.

---

## 9. Risks

1. A second route tree can drift from the demo tree if shared components are not extracted early.
2. If the formal shell becomes too generic, it can hide business-specific differences between sales, purchase, shipment, and after-sales.
3. If we try to formalize every module in one pass, the implementation will become too large and fragile.

The first slice avoids that by limiting scope to sales and boss dashboard entry points.
