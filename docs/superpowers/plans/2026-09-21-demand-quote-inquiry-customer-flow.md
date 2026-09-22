# Demand, Quote, Inquiry, and Customer Feedback Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three approved demand/quote paths, supplier-level inquiry fields, customer-feedback version loop, candidate-product lifecycle, permissions, auditability, and equivalent runtime/Prisma behavior.

**Architecture:** Keep `business_document.payload` as the workflow aggregate so no Prisma schema migration is required for workflow fields. Add one focused pure workflow module for explicit states and transitions, keep orchestration in the existing quote/inquiry/product/sales-order services, and make every cross-record Prisma workflow run inside a transaction. Runtime follows the same transition functions and performs fully validated, idempotent store updates.

**Tech Stack:** TypeScript, NestJS 10, Next.js 15, React 18, Prisma 7/MariaDB, JSON runtime stores, Jest, Vitest.

**Spec:** `docs/development-prompts/demand-quote-inquiry-customer-flow.md`

## Global Constraints

- Modify only `/Users/zhongzheng/Desktop/erp`.
- Use local Git only; do not access, push to, or pull from Gitee.
- Preserve all existing uncommitted changes and build on the current supplier-price visibility work.
- Local storage remains `runtime`; production storage remains `prisma`; both paths must have the same observable behavior.
- Do not change deployment configuration, publish, commit, or push.
- Treat `docs/flowcharts/demand-quote-flow.png` as the final business flow.
- Use the smallest direct change and do not refactor unrelated code.
- Preserve historical documents: normalize missing new fields on read, but enforce new rules on new creation and draft resubmission.
- Do not add separate sampling-time or sampling-fee fields; those values belong in supplier quote `remark`.

## Confirmed Design Rulings

1. Persist the two independent creation dimensions as `documentType: 'demand' | 'quote'` and `productSource: 'existing' | 'candidate'`. Also retain the per-line `productSource` so mixed or malformed API payloads can be rejected deterministically.
2. A manually entered demand remains a demand record. After inquiry boss confirmation, create one linked BJ-numbered quote record and mark the demand `converted_to_quote`; do not mutate the XQ-numbered demand into a quote.
3. The linked quote owns one business chain and one `versionHistory`. A price-problem response opens/reuses a linked inquiry for `currentVersionNo + 1`; the quote version advances only when the boss confirms the new price.
4. A product-library quote may reference an active `formal` or active `quote_candidate` product. A product-library demand requires an active `formal` product with an available sale price; it does not require the sales user to see procurement data.
5. Existing `active/inactive/deleted` remains product availability; `quote_candidate/formal` remains product stage.
6. Existing permission actions are reused: `boss.confirm` for demand approval and boss price confirmation, `sales.quote.write` for sales feedback, and `sales.order.write` for conversion. No bypass endpoint is added.
7. Sales and purchase codes use separate configurable rules. The sales rule reuses the existing composed-segment engine and UI patterns but has independent storage and sequence scope, allows prefix/category/year/month/serial, and intentionally excludes `supplier_code` to prevent procurement leakage. Candidate products receive a unique sales code from ProductService only when conversion to `formal` succeeds; existing codes and historical products are not recalculated.
8. No boss-rejection path is invented because the current demand workflow has no reusable rejection/return mechanism. The new demand approval endpoint only implements approval; historical rejection data, if present, remains readable and non-convertible.

## State Model

```ts
export type DemandQuoteWorkflowStatus =
  | 'draft'
  | 'pending_boss_approval'          // demand + existing
  | 'boss_approved'                  // demand + existing
  | 'inquiry_in_progress'            // demand + candidate
  | 'converted_to_quote'             // source demand after linked quote creation
  | 'pending_boss_price_confirmation'// quote + existing, initial submit
  | 'pending_customer_feedback'      // any quote after boss price confirmation
  | 'customer_accepted'
  | 'customer_no_follow_up'
  | 'repricing_in_progress'
  | 'ordered';

export type CustomerFeedbackResult =
  | 'accepted'
  | 'no_follow_up'
  | 'price_issue';
```

Historical statuses such as `submitted`, `pending_boss_confirm`, and `boss_confirmed` remain displayable. Only new or edited drafts enter the explicit state model above.

## File Structure

- Create `apps/api/src/quote/quote-workflow.ts`: shared types, status labels, legal-transition assertions, convertibility predicates, and history snapshot builders.
- Create `apps/api/test/quote-workflow.spec.ts`: pure state-machine regression tests.
- Modify `apps/api/src/quote/dto/create-quote.dto.ts`: explicit `productSource` and candidate line payload.
- Modify `apps/api/src/quote/quote.service.ts`: creation validation, the three submit paths, approval/price/feedback endpoints' service methods, quote version history, idempotent inquiry/quote creation, visibility sanitization, and audit writes.
- Modify `apps/api/src/quote/quote.controller.ts`: add boss-demand-approval, boss-price-confirmation, and customer-feedback endpoints with existing permission style.
- Modify `apps/api/src/inquiry/inquiry-list.data.ts`, `inquiry.service.ts`, and `inquiry.controller.ts`: supplier fields, resourcing/version context, boss-confirm orchestration, transaction support, and sanitized reads/logs.
- Modify `apps/api/src/product/product.service.ts`: find-or-create candidate and candidate-to-formal operations using product validation, unique codes, optional Prisma transaction client, and existing product audit style.
- Modify the shared product-code rule, runtime rule store, product endpoints, and product-code-rule page to configure independent purchase and sales rules without duplicating the rule engine.
- Modify `apps/api/src/sales-order/sales-order.service.ts`: strict convertibility, idempotent conversion, candidate formalization, and atomic Prisma conversion.
- Modify shared quote/list status files only where UI/list typing requires the new statuses.
- Modify the formal quote create page/actions/validation so document type and product source are independent and drafts restore both.
- Modify formal inquiry forms/detail to capture and display supplier-level fields.
- Add focused formal quote detail forms for the three independent operations: boss demand approval, boss quote price confirmation, and sales customer feedback.
- Extend existing API and web tests; do not replace current coverage.

## Review Focus

- Mixed line sources or `quote + candidate` API payloads must fail before any product/inquiry/document write.
- Repeated submit, boss confirm, feedback, repricing, and convert requests must reuse the existing linked record/version and never duplicate it.
- A stale browser posting a prior quote version must be rejected instead of mutating the current version.
- Historical payloads missing `productSource`, supplier fields, feedback history, or version history must remain readable with safe defaults.
- Sales-facing detail and audit payloads must recursively remove supplier identity, purchase price, selected supplier indexes, and all supplier comparison fields.

---

### Task 1: Pin the Workflow Types and Legal Transitions

**Files:**
- Create: `apps/api/src/quote/quote-workflow.ts`
- Create: `apps/api/test/quote-workflow.spec.ts`
- Modify: `packages/shared/src/quote-status.ts`
- Modify: `packages/shared/src/quote-status.spec.ts`
- Modify: `packages/shared/src/quote-list.ts`

**Interfaces:**
- Produces: `DemandQuoteWorkflowStatus`, `ProductSource`, `CustomerFeedbackResult`, `QuoteVersionSnapshot`, `assertQuoteCreationCombination()`, `resolveSubmittedStatus()`, `assertCustomerFeedbackTransition()`, `isQuoteConvertibleToSales()`, and `resolveWorkflowProgress()`.
- Consumes: no earlier task interfaces.

- [ ] **Step 1: Write failing state-machine tests**

```ts
it.each([
  ['demand', 'existing'],
  ['demand', 'candidate'],
  ['quote', 'existing'],
])('allows %s + %s', (documentType, productSource) => {
  expect(() => assertQuoteCreationCombination({ documentType, productSource })).not.toThrow();
});

it('rejects quote + candidate', () => {
  expect(() =>
    assertQuoteCreationCombination({ documentType: 'quote', productSource: 'candidate' }),
  ).toThrow('报价单只能选择产品库产品');
});

it.each([
  ['demand', 'existing', 'pending_boss_approval'],
  ['demand', 'candidate', 'inquiry_in_progress'],
  ['quote', 'existing', 'pending_boss_price_confirmation'],
])('resolves the submit state', (documentType, productSource, expected) => {
  expect(resolveSubmittedStatus({ documentType, productSource })).toBe(expected);
});

it('allows sales conversion only for boss-approved demand or customer-accepted quote', () => {
  expect(isQuoteConvertibleToSales({ documentType: 'demand', status: 'boss_approved' })).toBe(true);
  expect(isQuoteConvertibleToSales({ documentType: 'quote', status: 'customer_accepted' })).toBe(true);
  expect(isQuoteConvertibleToSales({ documentType: 'quote', status: 'pending_customer_feedback' })).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm --filter api test -- quote-workflow.spec.ts && pnpm --filter @erp/shared test -- quote-status.spec.ts`

Expected: FAIL because the new module/types/statuses do not exist.

- [ ] **Step 3: Implement the minimal pure workflow module and shared status typing**

```ts
export function assertQuoteCreationCombination(input: {
  documentType: 'demand' | 'quote';
  productSource: 'existing' | 'candidate';
}) {
  if (input.documentType === 'quote' && input.productSource === 'candidate') {
    throw new BadRequestException('报价单只能选择产品库产品');
  }
}

export function resolveSubmittedStatus(input: {
  documentType: 'demand' | 'quote';
  productSource: 'existing' | 'candidate';
}): DemandQuoteWorkflowStatus {
  if (input.documentType === 'demand' && input.productSource === 'existing') {
    return 'pending_boss_approval';
  }
  if (input.documentType === 'demand') return 'inquiry_in_progress';
  return 'pending_boss_price_confirmation';
}
```

Keep legacy strings accepted by list/display parsing but exclude them from new transition predicates.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm --filter api test -- quote-workflow.spec.ts && pnpm --filter @erp/shared test -- quote-status.spec.ts`

Expected: PASS.

- [ ] **Step 5: Review the task diff without committing**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only planned and pre-existing dirty files are listed.

### Task 2: Persist Independent Document Type and Product Source

**Files:**
- Modify: `apps/api/src/quote/dto/create-quote.dto.ts`
- Modify: `apps/api/src/quote/quote.service.ts`
- Modify: `apps/api/test/quote.service.spec.ts`
- Modify: `apps/api/test/quote.prisma.spec.ts`
- Modify: `apps/api/test/quote.persistence.spec.ts`

**Interfaces:**
- Consumes: Task 1 combination assertion and status resolver.
- Produces: `QuoteDetailRecord.productSource`, optional candidate line `productId`, normalized legacy source inference, and API enforcement before writes.

- [ ] **Step 1: Add failing runtime and Prisma tests for the four combinations**

```ts
it('creates demand drafts for either existing or candidate products', async () => {
  await expect(service.create(demandExistingPayload)).resolves.toMatchObject({
    documentType: 'demand', productSource: 'existing', status: 'draft',
  });
  await expect(service.create(demandCandidatePayload)).resolves.toMatchObject({
    documentType: 'demand', productSource: 'candidate', status: 'draft',
  });
});

it('rejects a new or re-edited quote candidate before writing', async () => {
  await expect(service.create(quoteCandidatePayload)).rejects.toThrow(
    '报价单只能选择产品库产品',
  );
  expect(store.listQuotes()).toHaveLength(0);
});

it('derives an existing-product demand price from the matching active tier', async () => {
  const created = await service.create({
    ...demandExistingPayload,
    items: [{ ...demandExistingPayload.items[0], quantity: 500, salePrice: 0.01 }],
  });
  expect(created.items[0].salePrice).toBe(15.9);
});
```

Add the same assertion to the Prisma fake and assert `businessDocument.create` and `product.create` were not called.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter api test -- quote.service.spec.ts quote.prisma.spec.ts quote.persistence.spec.ts`

Expected: FAIL because the dimensions are still coupled and candidate products are created while saving drafts.

- [ ] **Step 3: Normalize and validate the dimensions before any write**

```ts
export class CreateQuoteDto {
  documentType?: 'demand' | 'quote';
  productSource?: 'existing' | 'candidate';
  // existing fields remain
}

export type QuoteLineItem = {
  productSource: 'existing' | 'candidate';
  productId?: number;
  // existing fields remain
};
```

Rules in `create` and `updateDraft`:

- infer missing historical `productSource` from `productId`/candidate payload only when reading an existing record;
- require an explicit valid source for all new or edited drafts;
- require every line to match the header source;
- allow only active library products for `existing`; require `formal` for demands while quotes may use `formal` or `quote_candidate`;
- for an existing-product demand, ignore a client-supplied sale price and resolve the highest active tier whose `minQuantity <= quantity`, falling back to the product default sale price;
- retain candidate text on the draft without calling `ProductService.create`;
- reject `quote + candidate` before manual-customer creation, document-number allocation, product writes, or audit writes.

- [ ] **Step 4: Preserve historical read compatibility**

```ts
function normalizeStoredProductSource(record: QuoteDetailRecord): ProductSource {
  if (record.productSource === 'existing' || record.productSource === 'candidate') {
    return record.productSource;
  }
  return record.items.some((item) => !item.productId) ? 'candidate' : 'existing';
}
```

Apply this only to returned normalized records; do not rewrite historical storage on read.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm --filter api test -- quote.service.spec.ts quote.prisma.spec.ts quote.persistence.spec.ts`

Expected: PASS for both runtime and Prisma cases.

### Task 3: Implement the Three Submit and Boss Action Paths

**Files:**
- Modify: `apps/api/src/quote/quote.controller.ts`
- Modify: `apps/api/src/quote/quote.service.ts`
- Modify: `apps/api/test/quote.controller.spec.ts`
- Modify: `apps/api/test/quote.service.spec.ts`
- Modify: `apps/api/test/quote.prisma.spec.ts`
- Modify: `apps/api/test/formal-role-controller-metadata.spec.ts`

**Interfaces:**
- Consumes: Task 1 transitions and Task 2 persisted source.
- Produces: `approveDemand(id, actor)`, `confirmQuotePrice(id, payload, actor)`, and submit behavior for paths A/B/C.

- [ ] **Step 1: Write failing runtime/Prisma submit-path tests**

```ts
it('submits existing-product demand for boss approval without inquiry', async () => {
  const result = await service.submitDraftQuote(demandId);
  expect(result.status).toBe('pending_boss_approval');
  expect(result.linkedInquiryId).toBeUndefined();
});

it('submits candidate demand to one inquiry and is idempotent', async () => {
  const first = await service.submitDraftQuote(demandId);
  const second = await service.submitDraftQuote(demandId);
  expect(first.status).toBe('inquiry_in_progress');
  expect(second.linkedInquiryId).toBe(first.linkedInquiryId);
});

it('submits existing-product quote for boss price confirmation without inquiry', async () => {
  await expect(service.submitDraftQuote(quoteId)).resolves.toMatchObject({
    status: 'pending_boss_price_confirmation',
    linkedInquiryId: undefined,
  });
});
```

- [ ] **Step 2: Write failing boss-action and permission tests**

```ts
it('approves a demand without accepting price fields', async () => {
  const approved = await service.approveDemand(demandId, { user: 'Boss' });
  expect(approved.status).toBe('boss_approved');
  expect(approved.items[0].confirmedSalePrice).toBeUndefined();
});

it('confirms direct quote prices and enters customer feedback', async () => {
  const confirmed = await service.confirmQuotePrice(quoteId, {
    currentVersionNo: 1,
    items: [{ lineNo: 1, confirmedSalePrice: 12.5 }],
  }, { user: 'Boss' });
  expect(confirmed.status).toBe('pending_customer_feedback');
});
```

Assert controller metadata: boss/admin + `boss.confirm` on both boss endpoints; sales roles cannot invoke them.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `pnpm --filter api test -- quote.controller.spec.ts quote.service.spec.ts quote.prisma.spec.ts formal-role-controller-metadata.spec.ts`

Expected: FAIL because the routes and states do not exist.

- [ ] **Step 4: Add explicit endpoints and guarded service transitions**

```ts
@Post(':id/approve-demand')
@FormalRoles('admin', 'boss')
@FormalActions('boss.confirm')
approveDemand(...) { return this.quoteService.approveDemand(id, session); }

@Post(':id/confirm-price')
@FormalRoles('admin', 'boss')
@FormalActions('boss.confirm')
confirmPrice(...) { return this.quoteService.confirmQuotePrice(id, body, session); }
```

Every method must validate `documentType`, `productSource`, current status, current version, and missing/duplicate action before updating. Prisma updates the quote and operation log in one `$transaction`; runtime validates first, then writes one final aggregate and one log.

- [ ] **Step 5: Record distinct audits**

Use operation types:

```ts
'submit_demand_for_boss_approval'
'approve_demand'
'submit_candidate_demand_for_inquiry'
'submit_quote_for_boss_price_confirmation'
'boss_confirm_quote_price'
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `pnpm --filter api test -- quote.controller.spec.ts quote.service.spec.ts quote.prisma.spec.ts formal-role-controller-metadata.spec.ts`

Expected: PASS.

### Task 4: Save and Display Supplier-Level Inquiry Fields

**Files:**
- Modify: `apps/api/src/inquiry/inquiry-list.data.ts`
- Modify: `apps/api/src/inquiry/inquiry.service.ts`
- Modify: `apps/api/test/inquiry-rules.spec.ts`
- Modify: `apps/api/test/inquiry.persistence.spec.ts`
- Modify: `apps/api/test/inquiry.prisma.spec.ts`

**Interfaces:**
- Produces: optional fields on every `InquirySupplierQuote` and backward-compatible normalizers.
- Consumes: existing supplier quote submit/merge behavior.

- [ ] **Step 1: Write failing round-trip tests**

```ts
const supplierDetails = {
  productSizeCm: '40×30×10',
  productMaterial: 'PVC镭射',
  productPackaging: 'OPP袋/个',
  productWeightG: 180,
  bulkLeadTimeDays: '7-10',
  cartonQuantity: 120,
  outerCartonSizeCm: '55×45×40',
  outerCartonGrossWeightKg: 24,
  remark: '打样 2 天，费用 200 元',
};

expect(saved.items[0].supplierQuotes[0]).toMatchObject(supplierDetails);
```

Add tests that omitted fields normalize to `undefined` and old JSON files still load.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter api test -- inquiry-rules.spec.ts inquiry.persistence.spec.ts inquiry.prisma.spec.ts`

Expected: FAIL because normalizers drop the fields.

- [ ] **Step 3: Extend the supplier quote type and normalizer**

```ts
export type InquirySupplierQuote = {
  // existing identity and purchase fields
  productSizeCm?: string;
  productMaterial?: string;
  productPackaging?: string;
  productWeightG?: number;
  bulkLeadTimeDays?: string;
  cartonQuantity?: number;
  outerCartonSizeCm?: string;
  outerCartonGrossWeightKg?: number;
  remark?: string;
};
```

Trim text, preserve valid zero only where meaningful, require non-negative numeric weights and positive integer carton quantity when supplied, and keep all fields optional. Do not alter the existing two-supplier, supplier, or positive-purchase-price checks.

- [ ] **Step 4: Ensure audit before/after snapshots include the fields**

Use the existing full inquiry snapshot mechanism; add assertions against both runtime and Prisma operation logs.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm --filter api test -- inquiry-rules.spec.ts inquiry.persistence.spec.ts inquiry.prisma.spec.ts`

Expected: PASS.

### Task 5: Create/Reuse Candidate Products and Build the Linked Quote

**Files:**
- Modify: `apps/api/src/product/product.service.ts`
- Modify: `apps/api/src/inquiry/inquiry.service.ts`
- Modify: `apps/api/src/quote/quote.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/test/product.service.spec.ts`
- Modify: `apps/api/test/product.prisma.spec.ts`
- Modify: `apps/api/test/inquiry-rules.spec.ts`
- Modify: `apps/api/test/inquiry.prisma.spec.ts`
- Modify: `apps/api/test/quote.service.spec.ts`

**Interfaces:**
- Consumes: candidate demand records, supplier quote fields, boss-selected supplier and sale price.
- Produces: `findOrCreateQuoteCandidate(input, context)`, linked quote creation/update, source-demand linkage, and atomic Prisma boss-confirm flow.

- [ ] **Step 1: Write failing candidate product idempotency tests**

```ts
it('creates one active quote candidate and reuses it by normalized SKU', async () => {
  const first = await service.findOrCreateQuoteCandidate(candidateInput, context);
  const second = await service.findOrCreateQuoteCandidate(candidateInput, context);
  expect(first.productStage).toBe('quote_candidate');
  expect(second.id).toBe(first.id);
  expect(store.listProducts()).toHaveLength(1);
});
```

Also test incompatible/deleted SKU rejection and preservation of existing formal products.

- [ ] **Step 2: Write failing inquiry boss-confirm orchestration tests**

```ts
it('turns a candidate demand inquiry into one linked quote, not a sales order', async () => {
  const result = await inquiryService.confirmByBoss(confirmPayload, bossSession);
  const demand = await quoteService.getDetail(sourceDemandId);
  const quote = await quoteService.getDetail(result.linkedQuoteId);
  expect(demand.status).toBe('converted_to_quote');
  expect(quote).toMatchObject({
    documentType: 'quote',
    productSource: 'existing',
    status: 'pending_customer_feedback',
    sourceDemandId,
    currentVersionNo: 1,
  });
  expect(quote.items[0].productId).toBeGreaterThan(0);
  expect(salesOrderStore.listSalesOrders()).toHaveLength(0);
});
```

Repeat the boss-confirm call and assert the same candidate and linked quote IDs.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `pnpm --filter api test -- product.service.spec.ts product.prisma.spec.ts inquiry-rules.spec.ts inquiry.prisma.spec.ts quote.service.spec.ts`

Expected: FAIL because current boss confirmation only marks the source quote `boss_confirmed`.

- [ ] **Step 4: Add ProductService-owned candidate creation**

```ts
async findOrCreateQuoteCandidate(input: {
  sku: string;
  nameCn: string;
  category: string;
  unit: string;
  confirmedSalePrice: number;
  confirmedPurchasePrice: number;
  supplierCode?: string;
  operator: string;
}, context?: { db?: ProductDbClient }): Promise<ProductRecord>
```

Resolve by normalized SKU first; otherwise call the same validation/code-generation internals as `create`, set `productStage: 'quote_candidate'`, `status: 'active'`, and write `create_product` audit data. Do not create products when saving the candidate demand draft.

- [ ] **Step 5: Orchestrate boss confirmation atomically**

For Prisma, wrap inquiry update, candidate product creation/update, new BJ document allocation, source-demand update, and all operation logs in one `$transaction(async tx => ...)`. Pass `tx` through the internal ProductService/QuoteService methods. For runtime, validate the entire payload and candidate identities first, then write candidate, linked quote, source demand, inquiry, and audit records; idempotency keys are source demand ID + current inquiry/version.

- [ ] **Step 6: Preserve the source chain and audits**

```ts
source demand -> linkedInquiryId/No -> linkedQuoteId/No
linked quote -> sourceDemandId/No + linkedInquiryId/No
linked quote line -> productId + selected supplier snapshot + confirmedSalePrice
```

Use audits `select_final_supplier`, `boss_confirm_inquiry_price`, `create_quote_candidate_product`, and `convert_demand_to_quote`.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `pnpm --filter api test -- product.service.spec.ts product.prisma.spec.ts inquiry-rules.spec.ts inquiry.prisma.spec.ts quote.service.spec.ts`

Expected: PASS with identical runtime and Prisma results.

### Task 6: Implement Customer Feedback, Repricing, and Version History

**Files:**
- Modify: `apps/api/src/quote/quote.controller.ts`
- Modify: `apps/api/src/quote/quote.service.ts`
- Modify: `apps/api/src/inquiry/inquiry.service.ts`
- Modify: `apps/api/test/quote.controller.spec.ts`
- Modify: `apps/api/test/quote.service.spec.ts`
- Modify: `apps/api/test/quote.prisma.spec.ts`
- Modify: `apps/api/test/inquiry-rules.spec.ts`
- Modify: `apps/api/test/inquiry.prisma.spec.ts`
- Modify: `apps/api/test/formal-role-controller-metadata.spec.ts`

**Interfaces:**
- Consumes: a quote in `pending_customer_feedback`, existing inquiry creation, and Task 1 transitions.
- Produces: `recordCustomerFeedback(id, payload, session)`, version snapshots, linked repricing inquiry, and version advancement on re-confirmation.

- [ ] **Step 1: Write failing role and transition tests for all feedback results**

```ts
it.each(['sales', 'sales_manager'])('allows %s to record feedback', async (role) => {
  await expect(service.recordCustomerFeedback(id, {
    currentVersionNo: 1, result: 'accepted', remark: '客户确认',
  }, { role, user: 'Sales' })).resolves.toMatchObject({ status: 'customer_accepted' });
});

it('keeps no-follow-up editable', async () => {
  await service.recordCustomerFeedback(id, noFollowUpPayload, salesSession);
  await expect(service.recordCustomerFeedback(id, acceptedPayload, salesSession))
    .resolves.toMatchObject({ status: 'customer_accepted' });
});
```

Test that purchase/boss cannot operate, admin behavior follows the current controller style, and stale/current invalid states reject at service level.

- [ ] **Step 2: Write failing repricing/version tests**

```ts
it('reopens procurement in the same quote chain and advances only after boss confirmation', async () => {
  const feedback = await service.recordCustomerFeedback(id, priceIssuePayload, salesSession);
  expect(feedback.status).toBe('repricing_in_progress');
  expect(feedback.currentVersionNo).toBe(1);
  expect(feedback.linkedInquiryVersionNo).toBe(2);

  const repriced = await inquiryService.confirmByBoss(v2ConfirmPayload, bossSession);
  expect(repriced.currentVersionNo).toBe(2);
  expect(repriced.status).toBe('pending_customer_feedback');
  expect(repriced.versionHistory.map((entry) => entry.versionNo)).toEqual([1, 2]);
});
```

Repeat price-issue and boss-confirm requests to prove one V2 inquiry and one V2 snapshot.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `pnpm --filter api test -- quote.controller.spec.ts quote.service.spec.ts quote.prisma.spec.ts inquiry-rules.spec.ts inquiry.prisma.spec.ts formal-role-controller-metadata.spec.ts`

Expected: FAIL because the feedback endpoint/history/version loop does not exist.

- [ ] **Step 4: Add the sales feedback endpoint**

```ts
@Post(':id/customer-feedback')
@FormalRoles('admin', 'sales_manager', 'sales')
@FormalActions('sales.quote.write')
recordCustomerFeedback(...) {
  return this.quoteService.recordCustomerFeedback(id, body, session);
}
```

Payload is `{ currentVersionNo, result, remark? }`. Persist operator, ISO timestamp, version number, and remark in an append-only `customerFeedbackHistory`; update the current summary fields for display.

- [ ] **Step 5: Implement price-problem reopening and version snapshots**

Create or reuse an inquiry whose `sourceQuoteId` is the same quote and whose `quoteVersionNo` is `currentVersionNo + 1`. On its boss confirmation:

```ts
nextQuote.currentVersionNo = inquiry.quoteVersionNo;
nextQuote.status = 'pending_customer_feedback';
nextQuote.versionHistory = upsertSnapshot(nextQuote.versionHistory, {
  versionNo: inquiry.quoteVersionNo,
  items: nextItems,
  confirmedBy: actor,
  confirmedAt: now,
  sourceInquiryId: inquiry.id,
});
```

Never create a new unrelated quote document during repricing.

- [ ] **Step 6: Add operation logs**

Use `record_customer_feedback`, `reopen_quote_inquiry`, `confirm_repriced_quote`, and `advance_quote_version` with full before/after aggregate snapshots.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `pnpm --filter api test -- quote.controller.spec.ts quote.service.spec.ts quote.prisma.spec.ts inquiry-rules.spec.ts inquiry.prisma.spec.ts formal-role-controller-metadata.spec.ts`

Expected: PASS.

### Task 7: Add an Independent Configurable Sales Code Rule

**Files:**
- Modify: `packages/shared/src/product-code-rule.ts`
- Modify: `packages/shared/src/product-code-rule.spec.ts`
- Modify: `apps/api/src/product/product-code-rule.store.ts`
- Modify: `apps/api/src/product/product.service.ts`
- Modify: `apps/api/src/product/product.controller.ts`
- Modify: `apps/api/test/product.service.spec.ts`
- Modify: `apps/api/test/product.persistence.spec.ts`
- Modify: `apps/api/test/product.prisma.spec.ts`
- Modify: `apps/web/app/app/master-data/product-code-rule/page.tsx`
- Modify: `apps/web/app/app/master-data/product-code-rule/product-code-rule-page-client.tsx`
- Modify: `apps/web/app/app/master-data/product-code-rule/update-product-code-rule-form.tsx`
- Modify: `apps/web/app/app/master-data/products/product-code-rule.ts`
- Modify: `apps/web/tests/app-product-code-rule-page.test.tsx`

**Interfaces:**
- Consumes: the current composed-segment rule engine and purchase-code configuration.
- Produces: `ProductCodeRuleSet`, independent `purchase`/`sales` configurations, `getCodeRules()`, `updateCodeRule(kind, payload)`, and `generateSalesCodeByRule()`.

- [ ] **Step 1: Write failing shared-rule tests**

```ts
it('builds a sales code from prefix, category, date, and serial', () => {
  expect(buildProductCodePreview(salesRule, {
    category: 'electronics', now: '2026-09-22T00:00:00.000Z', sequence: 7,
  })).toBe('SALE-ELEC-2026-09-007');
});

it('rejects supplier code in a sales rule', () => {
  expect(validateProductCodeRule(salesRuleWithSupplier, { kind: 'sales' }))
    .toEqual({ ok: false, error: '销售编码规则不能使用供应商编码段' });
});
```

- [ ] **Step 2: Run shared tests and verify RED**

Run: `pnpm --filter @erp/shared test -- product-code-rule.spec.ts`

Expected: FAIL because rules do not have a kind and only one default exists.

- [ ] **Step 3: Extend the shared rule model without duplicating the engine**

```ts
export type ProductCodeRuleKind = 'purchase' | 'sales';
export type ProductCodeRuleSet = {
  purchase: ProductCodeRule;
  sales: ProductCodeRule;
};
```

Keep `buildProductCodePreview()` generic. Make validation accept a rule kind and reject `supplier_code` only for sales. Add a default sales rule using `SALE + category + year + month + serial`; preserve the current purchase default and legacy normalization.

- [ ] **Step 4: Write failing API/runtime/Prisma persistence tests**

Test that purchase and sales updates do not overwrite one another, old single-rule runtime JSON becomes `{ purchase: oldRule, sales: defaultSalesRule }`, and Prisma-mode service behavior exposes the same rule set. Test `generateSalesCodeByRule()` increments independently and skips existing collisions.

- [ ] **Step 5: Run API tests and verify RED**

Run: `pnpm --filter api test -- product.service.spec.ts product.persistence.spec.ts product.prisma.spec.ts product.controller.spec.ts`

Expected: FAIL because the store/controller expose only one rule.

- [ ] **Step 6: Implement independent persistence and endpoints**

Use one backward-compatible runtime file containing both rules. Expose `GET /products/code-rules` and `PATCH /products/code-rules/:kind`; retain the old purchase endpoints as compatibility aliases. Store rule configuration in the existing runtime rule store for both modes so production and local rule behavior remain identical; product records remain Prisma-backed in production. Write `update_product_sales_code_rule` and `update_product_purchase_code_rule` audit entries.

- [ ] **Step 7: Write failing rule-center UI tests**

Assert the page renders separate “采购编码规则” and “销售编码规则” panels, that sales segment choices omit “供应商编码”, previews update independently, and saving one panel targets its rule-kind endpoint.

- [ ] **Step 8: Run web tests and verify RED**

Run: `pnpm --filter web test -- app-product-code-rule-page.test.tsx`

Expected: FAIL because the page supports only the purchase rule.

- [ ] **Step 9: Reuse the existing editor for both rule kinds**

Parameterize the form with `kind`, allowed segment keys, labels, and endpoint. Do not fork two implementations. Preserve the current purchase screen behavior and add the independent sales panel/preview.

- [ ] **Step 10: Run focused tests and verify GREEN**

Run: `pnpm --filter @erp/shared test -- product-code-rule.spec.ts && pnpm --filter api test -- product.service.spec.ts product.persistence.spec.ts product.prisma.spec.ts product.controller.spec.ts && pnpm --filter web test -- app-product-code-rule-page.test.tsx`

Expected: PASS.

### Task 8: Enforce Sales Conversion and Candidate Formalization

**Files:**
- Modify: `apps/api/src/product/product.service.ts`
- Modify: `apps/api/src/sales-order/sales-order.service.ts`
- Modify: `apps/api/test/product.service.spec.ts`
- Modify: `apps/api/test/product.prisma.spec.ts`
- Modify: `apps/api/test/sales-order-rules.spec.ts`
- Modify: `apps/api/test/sales-order.prisma.spec.ts`
- Modify: `apps/api/test/sales-order.persistence.spec.ts`

**Interfaces:**
- Consumes: Task 1 convertibility predicate and quote-linked candidate product IDs.
- Consumes: Task 7 sales-code rule generation in addition to the workflow predicate and candidate product IDs.
- Produces: strict conversion state checks, one-sales-order idempotency, candidate `formal` conversion, and rule-generated automatic sales code.

- [ ] **Step 1: Write failing convertibility and duplicate tests**

```ts
it.each([
  ['pending_boss_approval'],
  ['pending_boss_price_confirmation'],
  ['pending_customer_feedback'],
  ['customer_no_follow_up'],
  ['repricing_in_progress'],
])('rejects conversion from %s', async (status) => {
  await expect(convert(status)).rejects.toThrow('当前单据状态不可转销售单');
});

it('allows boss-approved demand and customer-accepted quote once', async () => {
  await expect(convertApprovedDemand()).resolves.toMatchObject({ sourceDocumentType: 'demand' });
  await expect(convertAcceptedQuote()).resolves.toMatchObject({ sourceDocumentType: 'quote' });
  await expect(convertAcceptedQuote()).rejects.toThrow('只能生成一张销售单');
});
```

- [ ] **Step 2: Write failing candidate formalization tests**

```ts
it('allocates a unique sales code and converts a candidate only after sales conversion succeeds', async () => {
  const order = await service.convertConfirmedQuote(payload);
  const product = await productService.findById(candidateId);
  expect(order.id).toBeGreaterThan(0);
  expect(product).toMatchObject({ productStage: 'formal', status: 'active' });
  expect(product?.salesCode).toMatch(/^SALE-ELEC-2026-09-\d{3}$/);
});
```

Test rollback/no partial mutation when a candidate lacks category/SKU/name or when sales-order creation fails.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `pnpm --filter api test -- product.service.spec.ts product.prisma.spec.ts sales-order-rules.spec.ts sales-order.prisma.spec.ts sales-order.persistence.spec.ts`

Expected: FAIL because current conversion accepts `submitted` demand/`boss_confirmed` quote and does not formalize products.

- [ ] **Step 4: Extend ProductService conversion with the configured sales-code allocator**

```ts
async ensureFormalForSalesOrder(
  id: number,
  payload: { operatedBy: string },
  context?: { db?: ProductDbClient },
): Promise<ProductRecord>
```

If already formal, return unchanged. If candidate, validate formal-required fields, generate `salesCode` from the active sales rule with an independent sequence, retry the next sequence on a uniqueness collision, set `productStage: 'formal'`, and log `generate_product_sales_code` plus `convert_product_to_formal`. The allocator must use the supplied transaction client/runtime store and must never rewrite an existing sales code.

- [ ] **Step 5: Make conversion atomic and state-driven**

For Prisma, transactionally re-read the quote/version, assert convertibility and no sales order, formalize every distinct candidate product, create the sales document/log, then mark the source ordered/log. Runtime performs all validation first, deduplicates product IDs, then writes each final record once.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `pnpm --filter api test -- product.service.spec.ts product.prisma.spec.ts sales-order-rules.spec.ts sales-order.prisma.spec.ts sales-order.persistence.spec.ts`

Expected: PASS.

### Task 9: Close Procurement Visibility and Audit-Log Leaks

**Files:**
- Modify: `apps/api/src/quote/quote.service.ts`
- Modify: `apps/api/src/quote/quote.controller.ts`
- Modify: `apps/api/src/inquiry/inquiry.service.ts`
- Modify: `apps/api/src/inquiry/inquiry.controller.ts`
- Modify: `apps/api/test/quote.service.spec.ts`
- Modify: `apps/api/test/quote.controller.spec.ts`
- Modify: `apps/api/test/inquiry-rules.spec.ts`
- Modify: `apps/api/test/inquiry-list.controller.spec.ts`

**Interfaces:**
- Consumes: full internal quote/inquiry aggregates and session role.
- Produces: recursively sanitized sales detail/list/audit responses while boss/admin/purchase retain intended access.

- [ ] **Step 1: Write failing deep-redaction tests**

```ts
const serialized = JSON.stringify(await service.listAuditLogs(salesSession));
expect(serialized).not.toContain('SUP-001');
expect(serialized).not.toContain('purchasePrice');
expect(serialized).not.toContain('supplierQuotes');
expect(serialized).not.toContain('confirmedSupplier');
expect(serialized).toContain('confirmedSalePrice');
```

Cover nested `beforeData`, `afterData`, version history, and linked inquiry snapshots. Confirm boss/admin/purchase responses still contain permitted procurement fields.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter api test -- quote.service.spec.ts quote.controller.spec.ts inquiry-rules.spec.ts inquiry-list.controller.spec.ts`

Expected: FAIL because quote audit logs currently ignore the caller session and new nested fields are not redacted.

- [ ] **Step 3: Add one recursive procurement sanitizer per service boundary**

Strip keys matching supplier identity, purchase price, selected supplier index, supplier quote arrays, and the eight internal supplier quote fields from sales/sales-manager responses. Keep confirmed sale price, quote version, customer feedback, product identity, and normal sales fields. Pass the formal session from both audit controllers into their services.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm --filter api test -- quote.service.spec.ts quote.controller.spec.ts inquiry-rules.spec.ts inquiry-list.controller.spec.ts`

Expected: PASS.

### Task 10: Split the Create Form and Restore Draft Modes

**Files:**
- Modify: `apps/web/app/app/sales/quotes/new/create-formal-quote-form.tsx`
- Modify: `apps/web/app/app/sales/quotes/new/actions.ts`
- Modify: `apps/web/app/app/sales/quotes/new/formal-quote-validation.ts`
- Modify: `apps/web/app/app/sales/quotes/new/page.tsx`
- Modify: `apps/web/app/app/sales/quotes/page.tsx`
- Modify: `apps/web/tests/app-formal-quote-create.test.tsx`
- Modify: `apps/web/tests/quote-create-actions.test.ts`
- Modify: `apps/web/tests/app-formal-lists.test.tsx`

**Interfaces:**
- Consumes: API `documentType` + `productSource` contract.
- Produces: independent selectors, quote-fixed library UI, and exact draft restoration.

- [ ] **Step 1: Write failing interaction and payload tests**

```ts
expect(screen.getByRole('button', { name: '需求单' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '报价单' })).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: '需求单' }));
expect(screen.getByRole('button', { name: '产品库产品' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '手填新产品' })).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: '报价单' }));
expect(screen.queryByRole('button', { name: '手填新产品' })).not.toBeInTheDocument();
expect(screen.getByLabelText('产品库 Product')).toBeInTheDocument();
```

Assert draft initial values restore `demand + candidate` and that action payload includes both fields.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter web test -- app-formal-quote-create.test.tsx quote-create-actions.test.ts app-formal-lists.test.tsx`

Expected: FAIL because the current segmented buttons bind type and source together.

- [ ] **Step 3: Implement independent controls and validation**

```ts
const [documentType, setDocumentType] = useState(initialQuote?.documentType ?? 'demand');
const [productSource, setProductSource] = useState(
  initialQuote?.productSource ?? inferInitialProductSource(initialQuote),
);

useEffect(() => {
  if (documentType === 'quote') setProductSource('existing');
}, [documentType]);
```

Render the source selector only for demands. Submit hidden inputs for both fields. Validation requires a product option for `existing`, candidate name/SKU/category for `candidate`, and rejects `quote + candidate` even if a crafted FormData bypasses the UI.

- [ ] **Step 4: Update sales-center/list copy**

Describe demand as either library or new-product need, quote as library-only, and explain the boss/customer flow without implying that quote means hand-entered product.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm --filter web test -- app-formal-quote-create.test.tsx quote-create-actions.test.ts app-formal-lists.test.tsx`

Expected: PASS.

### Task 11: Add Inquiry Supplier Fields to Both Purchase and Boss Views

**Files:**
- Modify: `apps/web/app/app/sales/inquiries/[id]/inquiry-comparison-submit-form.tsx`
- Modify: `apps/web/app/app/sales/inquiries/[id]/inquiry-boss-confirm-form.tsx`
- Modify: `apps/web/app/app/sales/inquiries/[id]/page.tsx`
- Modify: `apps/web/tests/inquiry-comparison-submit-form.test.tsx`
- Modify: `apps/web/tests/inquiry-boss-confirm-form.test.tsx`
- Modify: `apps/web/tests/app-formal-detail-pages.test.tsx`

**Interfaces:**
- Consumes: Task 4 supplier fields.
- Produces: per-supplier editable inputs, payload serialization, and backward-compatible detail display.

- [ ] **Step 1: Write failing form and display tests**

```ts
expect(screen.getAllByLabelText(/产品尺寸/)).toHaveLength(2);
expect(screen.getAllByLabelText(/产品材质/)).toHaveLength(2);
expect(screen.getAllByLabelText(/产品包装/)).toHaveLength(2);
expect(screen.getAllByLabelText(/产品重量/)).toHaveLength(2);
expect(screen.getAllByLabelText(/大货交期/)).toHaveLength(2);
expect(screen.getAllByLabelText(/装箱数/)).toHaveLength(2);
expect(screen.getAllByLabelText(/外箱尺寸/)).toHaveLength(2);
expect(screen.getAllByLabelText(/外箱毛重/)).toHaveLength(2);
expect(screen.getAllByLabelText(/备注/)).toHaveLength(2);
expect(screen.queryByText('打样时间')).not.toBeInTheDocument();
expect(screen.queryByText('打样费用')).not.toBeInTheDocument();
```

Assert exact payload values and `-` for every missing historical field.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter web test -- inquiry-comparison-submit-form.test.tsx inquiry-boss-confirm-form.test.tsx app-formal-detail-pages.test.tsx`

Expected: FAIL because the fields are absent.

- [ ] **Step 3: Extend the draft model and purchase form**

Add the nine optional properties to `DraftSupplierQuote`, initialize from server values, preserve values when switching supplier-entry mode, render units alongside inputs, and serialize empty values as omitted rather than `NaN`/empty numeric fields.

- [ ] **Step 4: Render a compact supplier-spec grid in detail and boss confirmation**

Use the existing cards/table styles. Show dimensions with `cm`, product weight with `g`, delivery with `天`, carton quantity with `个`, carton gross weight with `kg`, and `-` when missing. Keep supplier identity and purchase price inside the permission-restricted inquiry page.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm --filter web test -- inquiry-comparison-submit-form.test.tsx inquiry-boss-confirm-form.test.tsx app-formal-detail-pages.test.tsx`

Expected: PASS.

### Task 12: Add Separate Detail Actions and Customer Feedback UI

**Files:**
- Create: `apps/web/app/app/sales/quotes/[id]/demand-boss-approval-form.tsx`
- Create: `apps/web/app/app/sales/quotes/[id]/quote-boss-price-form.tsx`
- Create: `apps/web/app/app/sales/quotes/[id]/customer-feedback-form.tsx`
- Modify: `apps/web/app/app/sales/quotes/[id]/page.tsx`
- Modify: `apps/web/app/quotes/[id]/convert-quote-form.tsx`
- Modify: `apps/web/tests/app-formal-detail-pages.test.tsx`
- Create: `apps/web/tests/quote-workflow-action-forms.test.tsx`
- Modify: `apps/web/tests/quote-detail-page.test.tsx`

**Interfaces:**
- Consumes: Tasks 3, 6, and 7 endpoints/states/history.
- Produces: explicit next-action display, independent action sections, feedback result entry, version history, and guarded conversion UI.

- [ ] **Step 1: Write failing page-state tests**

```ts
expect(existingDemandPage).toContain('老板审批需求单');
expect(existingDemandPage).not.toContain('老板确认售价');
expect(directQuotePage).toContain('老板确认最终售价');
expect(customerFeedbackPage).toContain('客户反馈');
expect(customerFeedbackPage).toContain('待反馈');
expect(repricingPage).toContain('重新询价中');
expect(versionedPage).toContain('V1');
expect(versionedPage).toContain('V2');
```

Assert the convert form renders only for `boss_approved` demand or `customer_accepted` quote and never trusts query parameters to imply confirmation.

- [ ] **Step 2: Write failing action-form tests**

Test request URLs, bodies, headers, success/error messages, disabled repeated submit, and all three feedback outcomes. The feedback form must include `currentVersionNo` to allow stale-version rejection.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `pnpm --filter web test -- app-formal-detail-pages.test.tsx quote-workflow-action-forms.test.tsx quote-detail-page.test.tsx`

Expected: FAIL because the independent action regions and feedback history are absent.

- [ ] **Step 4: Implement status-driven sections**

Render:

- demand approval only for boss/admin at `pending_boss_approval`;
- quote price confirmation only for boss/admin at `pending_boss_price_confirmation`;
- inquiry link/progress for candidate demands and repricing quotes;
- customer feedback controls only for sales/sales-manager/admin at `pending_customer_feedback` or `customer_no_follow_up`;
- read-only feedback result for boss/admin;
- quote version and history on every quote;
- conversion only at legal states.

- [ ] **Step 5: Make the current state and next action explicit**

Use `currentProgress` plus a short next-action sentence derived from state. Keep the existing page style and separate the three semantic action areas instead of reusing a generic boss-confirm block.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `pnpm --filter web test -- app-formal-detail-pages.test.tsx quote-workflow-action-forms.test.tsx quote-detail-page.test.tsx`

Expected: PASS.

### Task 13: Cross-Storage Acceptance and Final Regression

**Files:**
- Modify only tests or implementation files implicated by failures from this task.
- Do not change deployment files, environment files, or unrelated modules.

**Interfaces:**
- Consumes: all preceding tasks.
- Produces: evidence that the complete workflow is coherent, buildable, and clean without committing or deploying.

- [ ] **Step 1: Add/finish one end-to-end service acceptance test per path**

In `apps/api/test/quote-flow.service.spec.ts`, cover:

```ts
Path A: demand existing -> submit -> boss approve -> sales order
Path B: demand candidate -> inquiry -> compare -> boss confirm -> linked quote
        -> no follow-up -> price issue -> V2 inquiry -> boss confirm -> accept
        -> sales order + candidate formal
Path C: quote existing -> submit without inquiry -> boss price -> accept -> sales order
```

Run the same expectation helper once with runtime stores and once with the Prisma fake, and compare externally visible states/link IDs/version counts.

- [ ] **Step 2: Run the acceptance test and verify failures are feature-specific**

Run: `pnpm --filter api test -- quote-flow.service.spec.ts`

Expected: PASS after Tasks 1-12; if not, fix only the owning task's code under TDD and rerun its focused suite first.

- [ ] **Step 3: Run all user-requested verification commands**

Run:

```bash
pnpm test
pnpm build
git diff --check
git status --short
```

Expected: tests and build exit 0; diff check prints nothing; status contains the preserved pre-existing edits plus this feature's planned edits and no generated artifacts.

- [ ] **Step 4: Perform a final security/state review**

Check the diff for:

```text
- no quote + candidate creation route
- no sales conversion from unapproved/unaccepted state
- no duplicate inquiry/version/product/sales order path
- no supplier/purchase leakage to sales detail or audit
- no sample-time/sample-fee fields
- no Gitee/network/deploy/commit action
```

- [ ] **Step 5: Report completion with evidence**

Report changed behavior, the exact four command results, any preserved dirty files, and the sales-code allocation ruling. Do not claim deployment and do not commit.
