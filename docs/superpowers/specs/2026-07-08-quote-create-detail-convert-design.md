# Quote Create Detail Convert Design

**Date:** 2026-07-08

**Goal:** Turn the quote module into the first end-to-end operational ERP frontstage flow by connecting quote creation, quote detail viewing, and quote-to-sales conversion through real web-to-API integration.

**Scope:** `quotes/new`, `quotes/[id]`, quote-to-sales action on quote detail, and a minimal `sales-orders/[id]` landing page

---

## 1. Context And Problem

The current workspace already has:

- a quote list page with URL-driven advanced filtering
- a placeholder quote creation page
- quote API endpoints for `POST /quotes` and `GET /quotes/:id`
- a conversion endpoint `POST /quotes/:id/convert-to-sales`
- a sales order detail API endpoint `GET /sales-orders/:id`

The missing piece is operational continuity in the web app. Users can discover quote records from the list, but they cannot yet:

- submit a quote form into the API and land on the created quote
- open a real quote detail page from the list
- convert a quote into a sales order from a detail view
- land on a sales order detail page after conversion

This design closes that gap without expanding into editable detail pages, multi-version switching, or full sales workflow actions.

---

## 2. Scope And Non-Goals

### 2.1 In Scope

- connect `quotes/new` to `POST /quotes`
- add `quotes/[id]` as a server-rendered detail page
- add a quote detail action area with a minimal convert-to-sales form
- connect conversion to `POST /quotes/:id/convert-to-sales`
- redirect successful conversion to `sales-orders/[id]`
- add `sales-orders/[id]` as a minimal server-rendered landing page
- add focused tests for web actions, detail rendering, and redirect behavior

### 2.2 Out Of Scope

- editing quote details
- quote version switchers or history tabs
- inquiry comparison UI
- full sales order detail operations such as approval, resubmission, finance confirmation, or close
- generalized API SDK abstraction for all modules
- real master-data selectors for customers, users, or source codes

---

## 3. Approach Options

### Option A: Page-Local Server Integration

Each page owns its server action or fetch helper and maps directly to the existing NestJS endpoints.

Pros:

- fastest path to a real operational loop
- matches the current thin-slice architecture
- avoids premature abstraction

Cons:

- some request mapping code is repeated across route segments

### Option B: Shared Web API Client Layer

Introduce `apps/web/lib/api` now and route all quote and sales page calls through it.

Pros:

- cleaner long-term centralization
- easier future migration to a real backend host

Cons:

- adds architectural weight before enough consumers exist
- slows this slice down

### Option C: UI-First Mocked Flow

Implement the pages and redirects first with mock detail data, then integrate the API later.

Pros:

- very fast visual progress

Cons:

- duplicates work
- conflicts with the decision to build real end-to-end flow now

### Recommendation

Use **Option A**.

The repo is still in thin-slice mode and the quote module only needs one operational flow right now. Local server integration keeps the work small, testable, and aligned with existing patterns.

---

## 4. Functional Design

### 4.1 Quote Create Flow

Route: `quotes/new`

Behavior:

- render a server-side form for `customerId`, `salesUserId`, `sourceCode`, and `requirements`
- submit through a server action
- normalize form values into the existing `CreateQuoteDto` shape
- call `POST /quotes`
- on success redirect to `quotes/[id]`

User-visible result:

- users no longer remain on a dead-end placeholder form
- successful creation immediately enters the detail lifecycle

### 4.2 Quote Detail Flow

Route: `quotes/[id]`

Behavior:

- fetch quote detail from `GET /quotes/:id`
- render a compact document summary
- show the main quote fields already returned by the API
- show a dedicated action area for quote-to-sales conversion

Detail page sections:

- page header with quote number
- primary status summary
- source and ownership summary
- requirements snapshot
- conversion action section
- follow-up navigation links back to quote list and forward to created sales order after success

### 4.3 Quote To Sales Flow

Entry point: quote detail page

Behavior:

- render a small convert form on the quote detail page
- submit `quoteVersionNo`, `customerId`, `createdBy`, and `quoteConfirmed`
- call `POST /quotes/:id/convert-to-sales`
- on success redirect to `sales-orders/[id]`

First-version assumptions:

- the default conversion form can prefill `quoteVersionNo=1`
- `quoteConfirmed` defaults to `true` because this slice is focused on the happy-path quote-to-sales handoff
- `existingSalesOrderId` is omitted in first version

Failure behavior:

- if conversion fails due to an API validation error, the quote detail page should show a lightweight error message and keep the user on the same page

### 4.4 Sales Order Landing Detail

Route: `sales-orders/[id]`

Behavior:

- fetch sales order detail from `GET /sales-orders/:id`
- render the newly created sales order as the landing destination after conversion

First-version content:

- sales order number
- current status
- current version number
- purchase aggregate status
- shipment aggregate status
- backlink to the sales order list

This page is intentionally minimal. Its main role in this slice is to provide a truthful landing target after conversion.

---

## 5. API Mapping

### 5.1 Quote Create

Endpoint:

- `POST /quotes`

Request shape:

```ts
type CreateQuotePayload = {
  customerId: number;
  salesUserId: number;
  sourceCode: string;
  requirements: string;
};
```

Expected response fields used by the web app:

```ts
type CreateQuoteResult = {
  id: number;
  quoteNo: string;
  status: string;
  currentVersionNo: number;
};
```

### 5.2 Quote Detail

Endpoint:

- `GET /quotes/:id`

Expected response fields currently required by the web app:

```ts
type QuoteDetailResult = {
  id: number;
  quoteNo: string;
  status: string;
  currentVersionNo: number;
};
```

This response is currently sparse. The web UI should only display fields that truly exist, rather than inventing unavailable detail structure.

### 5.3 Quote To Sales

Endpoint:

- `POST /quotes/:id/convert-to-sales`

Request shape:

```ts
type ConvertQuotePayload = {
  quoteVersionNo: number;
  customerId: number;
  createdBy: number;
  quoteConfirmed: boolean;
};
```

Expected response fields used by the web app:

```ts
type ConvertQuoteResult = {
  id: number;
  salesNo: string;
  status: string;
  currentVersionNo: number;
  sourceQuoteOrderId: number;
  sourceQuoteVersionNo: number;
};
```

### 5.4 Sales Order Detail

Endpoint:

- `GET /sales-orders/:id`

Expected response fields used by the web app:

```ts
type SalesOrderDetailResult = {
  id: number;
  salesNo: string;
  status: string;
  currentVersionNo: number;
  purchaseAggregateStatus: string;
  shipmentAggregateStatus: string;
};
```

---

## 6. Web Architecture

### 6.1 Integration Style

Use page-local server actions and fetch helpers inside route segments instead of introducing a shared API client layer now.

Reasoning:

- only quote create and quote convert need mutation actions in this slice
- detail loading can stay route-local and explicit
- the current codebase favors direct, readable thin slices over generic frameworks

### 6.2 File Boundary Plan

Recommended units:

- `apps/web/app/quotes/new/page.tsx`
  render the create form
- `apps/web/app/quotes/new/actions.ts`
  normalize form data, call create API, handle redirect
- `apps/web/app/quotes/[id]/page.tsx`
  fetch and render quote detail
- `apps/web/app/quotes/[id]/actions.ts`
  submit convert-to-sales action and redirect
- `apps/web/app/sales-orders/[id]/page.tsx`
  fetch and render minimal sales order detail

These route-local files keep responsibilities narrow and avoid creating broad shared abstractions before the app needs them.

---

## 7. Error Handling

### 7.1 Create Quote Errors

If quote creation fails:

- keep the user on `quotes/new`
- display a compact error message above or below the form
- do not clear previously entered values when possible

### 7.2 Quote Detail Load Errors

If quote detail cannot be loaded:

- render a small failure state on `quotes/[id]`
- include a backlink to `/quotes`
- do not attempt to render conversion actions without a valid quote record

### 7.3 Convert To Sales Errors

If conversion fails:

- keep the user on the quote detail page
- show the API error message if it is safe and human-readable
- preserve the form inputs

### 7.4 Sales Detail Load Errors

If the sales order landing page cannot load:

- render a small error state with a link to `/sales-orders`
- avoid implying that conversion failed if the creation already succeeded

---

## 8. Testing Strategy

### 8.1 Web Tests

Add or update tests for:

- quote create page renders required fields
- create action normalizes payload and handles successful redirect path
- quote detail page renders server-loaded summary and conversion form
- convert action sends expected payload and redirects to `sales-orders/[id]`
- sales detail page renders the minimal landing summary

### 8.2 API Tests

Keep the API side lightweight:

- preserve existing quote controller and service tests
- extend where needed so the web flow depends on stable response contracts
- preserve sales order detail expectations for landing-page rendering

### 8.3 Verification

Run at minimum:

- focused `web` tests for quote and sales detail pages
- focused `api` tests for quote controller/service and sales order controller/service if changed
- full `web test`
- full `web build`
- full `api test` if any backend contract changes are made

---

## 9. Delivery Sequence

Recommended implementation order:

1. stabilize the quote create action and redirect behavior
2. add quote detail page and quote detail loading
3. add quote-to-sales action on the quote detail page
4. add minimal sales order detail landing page
5. run focused verification
6. run full verification

This sequence keeps each step usable on its own and ensures the redirect target exists before the final user flow is declared complete.

---

## 10. Success Criteria

This slice is complete when:

- a user can open `quotes/new`, submit a quote, and land on `quotes/[id]`
- a user can open a quote detail page from the list
- a user can convert that quote into a sales order from the detail page
- successful conversion lands on `sales-orders/[id]`
- all touched pages are backed by the existing API, not by local preview mocks
- the focused and full verification commands pass
