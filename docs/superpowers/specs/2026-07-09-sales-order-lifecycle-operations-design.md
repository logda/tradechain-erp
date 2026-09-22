# Sales Order Lifecycle Operations Design

**Date:** 2026-07-09

**Goal:** Turn `sales-orders/[id]` into an operations console that supports the full frontstage lifecycle for approval, resubmission, cancellation, receipt updates, finance confirmation, close validation, and close actions.

**Scope:** `sales-orders/[id]` detail page, role-driven visibility via URL query, all sales-order lifecycle actions already exposed by the API, and the supporting tests needed to keep the page safe to extend.

---

## 1. Context And Problem

The current workspace already has:

- sales-order list filtering and preview
- a minimal `sales-orders/[id]` landing page
- backend endpoints for submit, approve, reject, resubmit, cancel, receipt-status, finance-confirm, close-validation, and close
- backend rule tests for the main sales-order transitions

The missing piece is an operational detail page. Users can land on a sales order after quote conversion, but they still cannot actually operate the document lifecycle from the web app.

This design closes that gap by upgrading `sales-orders/[id]` from a passive landing page into a role-aware operations console.

---

## 2. Scope And Non-Goals

### 2.1 In Scope

- upgrade `sales-orders/[id]` into a multi-section detail page
- support role simulation via `?role=sales|sales_manager|finance`
- show role-based section visibility, field visibility, and action availability
- wire these actions through real server actions:
  - `submit`
  - `approve`
  - `reject`
  - `resubmit`
  - `cancel`
  - `receipt-status`
  - `finance-confirm`
  - `close`
- show close validation both as a persistent section and as a pre-close recheck
- surface lightweight errors and recent action outcomes inside the detail page

### 2.2 Out Of Scope

- real authentication and permission middleware
- persistent operation logs or audit history timeline
- line-item level editing
- shipment, purchase-order, or after-sales detail drill-down pages
- real customer-facing localization or polished production UI wording
- replacing URL role simulation with a real login context

---

## 3. Approach Options

### Option A: Single Large Detail Form

Put all fields and actions into one large page-level form and switch parts on or off by role and status.

Pros:

- fastest initial assembly
- least file count

Cons:

- form state and error state will bleed across unrelated actions
- role logic and action logic will become tightly coupled
- difficult to test and maintain once more states are added

### Option B: Sectioned Operations Console

Keep one detail route, but split it into focused sections with separate client forms and separate server actions.

Pros:

- clean operational boundaries
- easier to test role visibility and action payloads independently
- closest to a maintainable “near production” operations page

Cons:

- more files and more coordination than a single large form

### Option C: Per-Role Variant Pages

Render substantially different layouts for sales, sales manager, and finance roles.

Pros:

- strongest role-specific mental model
- easiest to tailor each role’s surface

Cons:

- duplicates page structure
- highest implementation and test cost
- too heavy for the current thin-slice stage

### Recommendation

Use **Option B: Sectioned Operations Console**.

It supports the desired “near production” role-aware behavior without collapsing the page into a single unstable form or exploding the design into three separate role pages.

---

## 4. Functional Design

### 4.1 Route And Role Simulation

Route:

- `sales-orders/[id]`

Role source:

- `searchParams.role`
- supported values:
  - `sales`
  - `sales_manager`
  - `finance`
- fallback:
  - default to `sales`

Reasoning:

- URL-driven roles are the simplest way to validate visibility rules, test the page, and keep the route deterministic before a real auth system exists

### 4.2 Page Sections

The detail page should be a single route with multiple clearly separated sections:

1. **Document Summary**
   - sales order number
   - current status
   - current version number
   - source quote reference if available
   - customer, creator, owner when data is available
   - purchase aggregate status
   - shipment aggregate status
   - receipt status
   - finance confirm status
   - after-sales indicator if available

2. **Role View Summary**
   - current simulated role
   - list of currently executable actions
   - short list of blocked actions with reasons

3. **Approval Actions**
   - submit
   - approve
   - reject

4. **Change / Cancel Actions**
   - resubmit
   - cancel

5. **Receipt / Finance Actions**
   - update receipt status
   - confirm finance

6. **Close Validation**
   - current close prerequisites
   - can-close result
   - close action

7. **Action Feedback**
   - latest success message
   - latest validation or API error

### 4.3 Role Visibility Rules

#### Section Visibility

| Section | sales | sales_manager | finance |
|---|---|---|---|
| Document Summary | visible | visible | visible |
| Role View Summary | visible | visible | visible |
| Approval Actions | visible | visible | visible as read-only context |
| Change / Cancel Actions | visible | visible | visible as read-only context |
| Receipt / Finance Actions | visible as partial | visible as read-only context | visible |
| Close Validation | visible | visible | visible |
| Action Feedback | visible | visible | visible |

#### Action Availability

| Action | sales | sales_manager | finance | State Gate |
|---|---|---|---|---|
| submit | executable | blocked | blocked | `draft` |
| approve | blocked | executable | blocked | `pending_sales_manager_approval` |
| reject | blocked | executable | blocked | `pending_sales_manager_approval` |
| resubmit | executable | blocked | blocked | `purchasing` and not shipped |
| cancel | executable | blocked | blocked | backend rule permits |
| receipt-status | executable | visible read-only | executable | document exists |
| finance-confirm | blocked | blocked | executable | receipt status already paid enough |
| close | blocked | executable | executable | close validation passes |

#### Failure Visibility

For this slice, failure reasons are shown to the current viewer whenever the related section is visible.

Reasoning:

- this preserves debugging value during role simulation
- it avoids introducing a second layer of per-error visibility rules before real auth exists

### 4.4 Action Forms

The page should not use one global form. Each action or action family gets its own form component and state.

#### Approval Section

- submit form
  - visible current status
  - hidden sales-order id
- approve form
  - visible current status
  - hidden sales-order id
- reject form
  - visible current status
  - hidden sales-order id

#### Change / Cancel Section

- resubmit form
  - visible current status
  - editable `changeReason`
  - editable or explicit boolean `hasShipmentBatches`
- cancel form
  - visible current status
  - visible `hasShipmentBatches`
  - editable `unshippedPurchaseOrderIds`

#### Receipt / Finance Section

- receipt-status form
  - editable `receiptStatus`
- finance-confirm form
  - visible current `receiptStatus`
  - editable `financeStatus`

#### Close Section

- validation panel
  - visible validation inputs and evaluation result
- close form
  - visible `canClose`
  - close button enabled only when page-level validation says close is currently possible
  - submit still rechecks with server-side close validation assumptions

### 4.5 Close Validation Presentation

The user explicitly chose both:

- show close prerequisites continuously
- recheck before actual close

So the page should:

1. load and render a validation summary section during page render
2. show whether close is currently allowed
3. on close action submit, send the most recent `canClose` result back to the backend close endpoint
4. if validation no longer supports close, show a lightweight error instead of closing

Validation inputs that the page should surface:

- shipment aggregate status
- receipt send status
- after-sales end status
- finance status
- receipt status

### 4.6 Error Handling

The page should fail closed:

- invalid role -> fall back to `sales`
- detail fetch fails -> render detail fallback with backlink
- action fetch fails -> show section-local error
- malformed success payload -> treat as action failure
- redirect errors from successful actions should be rethrown, not swallowed
- duplicate submit protection should exist on every client form

---

## 5. Data And API Mapping

### 5.1 Detail Fetch

Endpoint:

- `GET /sales-orders/:id`

Current known response fields from the API:

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

The page may need more fields than are currently returned. For this slice, the frontend should:

- render known fields directly
- support safe fallbacks for fields not yet supplied
- extend the API contract only if the page cannot cleanly support the operational design otherwise

### 5.2 Action Endpoints

#### Submit

- `POST /sales-orders/:id/submit`

```ts
type SubmitPayload = {
  currentStatus: string;
};
```

#### Approve

- `POST /sales-orders/:id/approve`

```ts
type ApprovePayload = {
  currentStatus: string;
};
```

#### Reject

- `POST /sales-orders/:id/reject`

```ts
type RejectPayload = {
  currentStatus: string;
};
```

#### Resubmit

- `POST /sales-orders/:id/resubmit`

```ts
type ResubmitPayload = {
  currentStatus: string;
  changeReason: string;
  hasShipmentBatches: boolean;
};
```

#### Cancel

- `POST /sales-orders/:id/cancel`

```ts
type CancelPayload = {
  currentStatus: string;
  hasShipmentBatches: boolean;
  unshippedPurchaseOrderIds: number[];
};
```

#### Receipt Status

- `POST /sales-orders/:id/receipt-status`

```ts
type ReceiptStatusPayload = {
  receiptStatus: string;
};
```

#### Finance Confirm

- `POST /sales-orders/:id/finance-confirm`

```ts
type FinanceConfirmPayload = {
  receiptStatus: string;
  financeStatus: string;
};
```

#### Close Validation

- `GET /sales-orders/:id/close-validation`

```ts
type CloseValidationInput = {
  shipmentAggregateStatus: string;
  receiptSendStatus: string;
  afterSalesEndStatus: string;
  financeStatus: string;
  receiptStatus: string;
};
```

#### Close

- `POST /sales-orders/:id/close`

```ts
type ClosePayload = {
  canClose: boolean;
};
```

### 5.3 Response Handling Rule

All lifecycle server actions should follow the same behavior:

- on success with a state-changing response:
  - either stay on the same detail page and refresh state
  - or redirect back to the same detail route with role preserved
- on failure:
  - return `{ error: string }`
- on malformed success payload:
  - return a generic lightweight error

For this slice, the recommended behavior is:

- stay on the same detail page
- use `redirect('/sales-orders/:id?role=...')` after successful actions so the server re-renders the latest state

This keeps the page behavior deterministic and avoids complicated client-side state patching.

---

## 6. Proposed File Structure

Recommended web files:

- `apps/web/app/sales-orders/[id]/page.tsx`
  - orchestrates detail fetch, role resolution, and section composition
- `apps/web/app/sales-orders/[id]/actions.ts`
  - all sales-order lifecycle server actions and payload builders
- `apps/web/app/sales-orders/[id]/role-policy.ts`
  - role normalization and visibility/executability rules
- `apps/web/app/sales-orders/[id]/close-validation.ts`
  - close validation display mapping helpers
- `apps/web/app/sales-orders/[id]/approval-actions.tsx`
  - submit / approve / reject forms
- `apps/web/app/sales-orders/[id]/change-cancel-actions.tsx`
  - resubmit / cancel forms
- `apps/web/app/sales-orders/[id]/receipt-finance-actions.tsx`
  - receipt-status / finance-confirm forms
- `apps/web/app/sales-orders/[id]/close-actions.tsx`
  - validation display and close form

Recommended test files:

- `apps/web/tests/sales-order-detail-page.test.tsx`
- `apps/web/tests/sales-order-actions.test.ts`
- `apps/web/tests/sales-order-role-policy.test.ts`
- `apps/web/tests/sales-order-close-validation.test.ts`

---

## 7. Testing Strategy

### 7.1 Server Action Tests

Verify:

- payload normalization
- role-preserving redirect target
- API error propagation
- malformed response fallback
- redirect error passthrough

### 7.2 Role Policy Tests

Verify:

- unsupported roles normalize to `sales`
- visible sections per role
- executable actions per role and status
- blocked reasons for unavailable actions

### 7.3 Page Render Tests

Verify:

- detail success render
- detail failure fallback
- per-role section visibility
- per-status action visibility

### 7.4 Close Validation Tests

Verify:

- validation display mapping
- close button enabled/disabled behavior
- failed close response handling

---

## 8. Delivery Plan Shape

Recommended implementation phases:

1. page skeleton + role policy + summary sections
2. approval actions
3. resubmit + cancel actions
4. receipt + finance actions
5. close validation + close action
6. full verification and final review

This keeps the riskiest conditional logic segmented by operational domain instead of mixing everything into one large task.

---

## 9. Risks And Pending Questions

### Risks

- current sales-order detail API may not expose enough fields for the intended role-aware console
- too many actions in one route can create brittle tests if role policy is not centralized
- repeated client-form patterns can drift unless action behavior is standardized

### Pending Questions

1. should `cancel` settle on a final visible status label of `cancelled` in the frontend, or should the UI preserve whatever exact backend wording is returned?
2. should `close` remain executable by both `sales_manager` and `finance`, or should one role become primary later?
3. should `receipt-status` remain editable by both `sales` and `finance` after real auth is introduced, or is that only a temporary slice decision?
4. should failure reasons later be narrowed by action ownership, or is “visible within the current visible section” acceptable for the near-term ERP console?

---

## 10. Recommendation Summary

Build the sales-order lifecycle console as a single detail route with clearly separated operational sections, URL-driven role simulation, explicit role policy mapping, section-local action forms, and dual-layer close validation. This yields a near-production operations surface without prematurely introducing authentication infrastructure or separate role-specific pages.
