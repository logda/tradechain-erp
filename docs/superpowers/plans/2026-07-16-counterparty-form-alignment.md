# Counterparty Form Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "新增往来单位" form visually aligned and easier to scan without changing field order, validation behavior, or API payloads.

**Architecture:** Keep the existing `CreateCounterpartyForm` structure and only refine inline layout styles so the form uses a steadier responsive grid, consistent label rows, and consistent control heights. Protect the current behavior with a focused web test that checks the required fields remain unchanged and the form still exposes the aligned field set.

**Tech Stack:** Next.js App Router, React, inline TypeScript style objects, Vitest, Testing Library

---

### Task 1: Lock current create-form behavior with a focused test

**Files:**
- Modify: `apps/web/tests/app-counterparties-page.test.tsx`
- Test: `apps/web/tests/app-counterparties-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that renders `CreateCounterpartyForm`, asserts the required markers remain on `编码 Code`、`单位名称 Name`、`所属人员 Owner`, and asserts optional fields such as `单位简称 Short Name` and `联系人 Contact` do not render required markers.

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true pnpm --filter web test -- app-counterparties-page.test.tsx`
Expected: The new assertion fails before layout cleanup is implemented.

- [ ] **Step 3: Write minimal implementation**

If needed, adjust the rendered label structure in `apps/web/app/app/master-data/counterparties/create-counterparty-form.tsx` so the required markers stay attached only to the three required business fields while layout wrappers are introduced.

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true pnpm --filter web test -- app-counterparties-page.test.tsx`
Expected: PASS

### Task 2: Align the create form layout

**Files:**
- Modify: `apps/web/app/app/master-data/counterparties/create-counterparty-form.tsx`
- Test: `apps/web/tests/app-counterparties-page.test.tsx`

- [ ] **Step 1: Update layout styles**

Refine the inline style objects to use a steadier responsive grid, consistent field container spacing, consistent control min-height, and a label row that keeps Chinese/English text with the required star aligned on one baseline.

- [ ] **Step 2: Keep field order and submission logic unchanged**

Do not touch the payload, validation, owner filtering, or reset logic beyond whatever is required to support the new layout wrappers.

- [ ] **Step 3: Verify the focused test again**

Run: `CI=true pnpm --filter web test -- app-counterparties-page.test.tsx`
Expected: PASS

### Task 3: Final regression verification

**Files:**
- Test: `apps/web/tests/app-counterparties-page.test.tsx`

- [ ] **Step 1: Run the page-level web test**

Run: `CI=true pnpm --filter web test -- app-counterparties-page.test.tsx`
Expected: PASS with the counterparty page scenarios green.

- [ ] **Step 2: Run the full web suite**

Run: `CI=true pnpm --filter web test`
Expected: PASS with no newly introduced failures.
