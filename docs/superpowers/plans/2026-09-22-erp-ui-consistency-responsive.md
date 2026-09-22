# ERP UI Consistency And Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every formal ERP page a consistent lightweight visual system and responsive desktop layout without changing any business behavior.

**Architecture:** Add one CSS foundation scoped to the formal ERP shell, then move layout responsibility from scattered inline dimensions into semantic classes at shared component boundaries. Migrate list pages and forms in route groups so each group remains testable while the existing server components, API calls, permissions, and actions stay unchanged.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, plain CSS, Vitest, Testing Library, local browser validation.

**Spec:** `docs/superpowers/specs/2026-09-22-erp-ui-consistency-responsive-design.md`

**Execution status (2026-09-22):** Tasks 1–7 completed without commits. Automated tests, production build, diff validation, and the 12-route × 5-viewport in-app Chromium matrix passed. Chrome extension automation was unavailable during the final compatibility pass; Edge and Safari were not connected, so those browser-specific checks remain manual.

## Global Constraints

- Modify only `/Users/zhongzheng/Desktop/erp`.
- Preserve every existing uncommitted change; do not revert or overwrite unrelated work.
- Use local Git only; do not access, pull from, or push to Gitee.
- Do not modify business workflows, APIs, permissions, data structures, runtime storage, Prisma storage, or deployment.
- Do not introduce a large UI library or redesign legacy preview routes.
- Do not commit, push, publish, or deploy.
- Formal default control height is 40px; compact row actions are 32px.
- Formal control radius is 8px; card radius is 12px or 16px.
- Formal page titles remain within 24–32px.
- Support Chrome, Edge, and Safari at 1280, 1366, 1440, 1920, and 2560 widths with 80%, 100%, and 125% zoom where available.
- Run `pnpm build` only after stopping the Web development server that owns `apps/web/.next`.

## Review Focus

- Long bilingual labels at 1280px must wrap above controls without changing single-line control height; Task 4 adds page assertions and Task 7 measures rendered controls.
- Tables with 760–1180px minimum widths must scroll inside their table body instead of expanding the document; Task 3 tests the wrapper and Task 7 measures document overflow.
- At 200% effective scaling the fixed sidebar must not hide or squeeze primary actions; Task 2 pins the narrow-shell breakpoint and Task 7 validates the rendered layout.
- Safari-native `select`, date input, and button metrics must inherit the same font and box sizing without removing useful native affordances; Task 1 pins the scoped normalization rules and Task 7 records Safari availability/results.
- Permission-hidden or disabled actions must remain unchanged while visual classes are added; Tasks 4–6 rerun the existing permission and workflow tests.

---

### Task 1: Formal UI Foundation

**Files:**
- Create: `apps/web/app/formal-ui.css`
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/tests/formal-ui-foundation.test.ts`

**Interfaces:**
- Consumes: no prior task output.
- Produces: the `.erp-app` scope and the `erp-button`, `erp-control`, `erp-form-grid`, `erp-card`, `erp-toolbar`, `erp-chip`, `erp-status`, and `erp-table-scroll` class contracts used by later tasks.

- [ ] **Step 1: Write the failing foundation test**

Create `apps/web/tests/formal-ui-foundation.test.ts` with source-level assertions because JSDOM does not calculate media-query layout:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appRoot = resolve(process.cwd(), 'app');

describe('formal UI foundation', () => {
  it('loads the formal stylesheet and declares the document language', () => {
    const layout = readFileSync(resolve(appRoot, 'layout.tsx'), 'utf8');

    expect(layout).toContain("import './formal-ui.css'");
    expect(layout).toContain('<html lang="zh-CN">');
  });

  it('defines scoped tokens, consistent controls and accessibility fallbacks', () => {
    const css = readFileSync(resolve(appRoot, 'formal-ui.css'), 'utf8');

    expect(css).toContain('.erp-app');
    expect(css).toContain('--erp-control-height: 40px');
    expect(css).toContain('--erp-control-height-compact: 32px');
    expect(css).toContain('.erp-button:focus-visible');
    expect(css).toContain('.erp-table-scroll');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('-webkit-backdrop-filter');
  });
});
```

- [ ] **Step 2: Run the test and verify the missing foundation fails**

Run:

```bash
pnpm --filter web test -- formal-ui-foundation.test.ts
```

Expected: FAIL because `formal-ui.css`, its import, and `lang="zh-CN"` do not yet exist.

- [ ] **Step 3: Add the scoped CSS foundation**

Create `apps/web/app/formal-ui.css` with these concrete tokens and base contracts:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-width: 320px;
}

button,
input,
select,
textarea {
  font: inherit;
}

img {
  max-width: 100%;
  height: auto;
}

.erp-app {
  --erp-bg: #f3f6f9;
  --erp-surface: #ffffff;
  --erp-surface-muted: #f8fafc;
  --erp-border: #d8e1ea;
  --erp-text: #0f172a;
  --erp-text-muted: #64748b;
  --erp-primary: #0f172a;
  --erp-primary-hover: #1e293b;
  --erp-danger: #b91c1c;
  --erp-success: #047857;
  --erp-warning: #b45309;
  --erp-focus: #2563eb;
  --erp-control-height: 40px;
  --erp-control-height-compact: 32px;
  --erp-radius-control: 8px;
  --erp-radius-card: 16px;
  --erp-shadow-card: 0 8px 28px rgba(15, 23, 42, 0.06);
  color: var(--erp-text);
  font-family: "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  font-size: 14px;
}

.erp-button {
  min-height: var(--erp-control-height);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--erp-radius-control);
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
}

.erp-button--compact {
  min-height: var(--erp-control-height-compact);
  padding-inline: 12px;
  font-size: 13px;
}

.erp-button--primary {
  background: var(--erp-primary);
  color: #ffffff;
}

.erp-button--secondary {
  border-color: var(--erp-border);
  background: var(--erp-surface);
  color: var(--erp-text);
}

.erp-button--danger {
  background: var(--erp-danger);
  color: #ffffff;
}

.erp-button--ghost,
.erp-button--link {
  background: transparent;
  color: var(--erp-text);
}

.erp-button:focus-visible,
.erp-control:focus-visible,
.erp-app a:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--erp-focus) 35%, transparent);
  outline-offset: 2px;
}

.erp-button:disabled,
.erp-button[aria-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.58;
}

.erp-control {
  width: 100%;
  min-width: 0;
  height: var(--erp-control-height);
  border: 1px solid var(--erp-border);
  border-radius: var(--erp-radius-control);
  padding: 0 12px;
  background: var(--erp-surface);
  color: var(--erp-text);
}

textarea.erp-control {
  min-height: 96px;
  height: auto;
  padding-block: 10px;
  resize: vertical;
}

.erp-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  align-items: end;
  gap: 16px;
}

.erp-card {
  border: 1px solid var(--erp-border);
  border-radius: var(--erp-radius-card);
  background: var(--erp-surface);
  box-shadow: var(--erp-shadow-card);
}

.erp-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.erp-table-scroll {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  -webkit-overflow-scrolling: touch;
}

.erp-app [data-backdrop] {
  background: rgba(255, 255, 255, 0.96);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

@media (prefers-reduced-motion: reduce) {
  .erp-app *,
  .erp-app *::before,
  .erp-app *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

Add the stylesheet import and language change in `apps/web/app/layout.tsx`:

```tsx
import './formal-ui.css';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Run the foundation test**

Run:

```bash
pnpm --filter web test -- formal-ui-foundation.test.ts
```

Expected: PASS.

---

### Task 2: Responsive Formal Shell

**Files:**
- Modify: `apps/web/app/app/_components/app-shell.tsx`
- Modify: `apps/web/app/formal-ui.css`
- Create: `apps/web/tests/formal-ui-shell.test.tsx`

**Interfaces:**
- Consumes: `.erp-app`, token variables, and button classes from Task 1.
- Produces: `.erp-shell`, `.erp-shell__sidebar`, `.erp-shell__content`, `.erp-shell__topbar`, `.erp-shell__nav`, `.erp-shell__title`, and `.erp-shell__body` layout contracts.

- [ ] **Step 1: Write shell structure and breakpoint tests**

```tsx
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppShell } from '../app/app/_components/app-shell';

describe('formal responsive shell', () => {
  it('exposes the shared shell layout without changing navigation', () => {
    render(
      <AppShell title="测试页面" session={{ role: 'admin', user: 'Admin' }}>
        <p>页面内容</p>
      </AppShell>,
    );

    expect(screen.getByRole('main')).toHaveClass('erp-app');
    expect(screen.getByRole('complementary')).toHaveClass('erp-shell__sidebar');
    expect(screen.getByRole('navigation', { name: 'formal-app-nav' })).toHaveClass(
      'erp-shell__nav',
    );
    expect(screen.getByRole('heading', { name: '测试页面' })).toHaveClass(
      'erp-shell__title',
    );
  });

  it('defines desktop, narrow desktop and scaled-view breakpoints', () => {
    const css = readFileSync(resolve(process.cwd(), 'app/formal-ui.css'), 'utf8');

    expect(css).toContain('grid-template-columns: 248px minmax(0, 1fr)');
    expect(css).toContain('@media (max-width: 1366px)');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('grid-template-columns: 1fr');
    expect(css).toContain('font-size: clamp(24px, 2.2vw, 32px)');
  });
});
```

- [ ] **Step 2: Run the shell test and verify failure**

Run:

```bash
pnpm --filter web test -- formal-ui-shell.test.tsx
```

Expected: FAIL because the semantic shell classes and breakpoints are absent.

- [ ] **Step 3: Move shell layout dimensions into semantic classes**

Keep session calculation and navigation filtering unchanged. Replace layout-only inline styles with:

```tsx
<main className="erp-app erp-shell">
  <div className="erp-shell__frame">
    <aside className="erp-shell__sidebar">
      <div className="erp-shell__brand">...</div>
      <nav className="erp-shell__nav" aria-label="formal-app-nav">...</nav>
      <div className="erp-shell__meta">...</div>
    </aside>
    <section className="erp-shell__content">
      <header className="erp-shell__topbar" data-backdrop>
        <div className="erp-shell__title-wrap">
          <p className="erp-shell__eyebrow">正式工作台</p>
          <h2 className="erp-shell__title">{title}</h2>
          {subtitle ? <p className="erp-shell__subtitle">{subtitle}</p> : null}
        </div>
        <div className="erp-shell__user-panel">...</div>
      </header>
      <div className="erp-shell__body">{children}</div>
    </section>
  </div>
</main>
```

Add the concrete shell CSS:

```css
.erp-shell {
  min-height: 100vh;
  background: linear-gradient(180deg, #eef3f8 0%, #f8fafc 28%, #edf2f7 100%);
}

.erp-shell__frame {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 100vh;
}

.erp-shell__sidebar {
  min-width: 0;
  padding: 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: #e2e8f0;
  background: linear-gradient(180deg, #0f172a 0%, #1b273a 100%);
}

.erp-shell__nav {
  display: grid;
  gap: 8px;
}

.erp-shell__content {
  min-width: 0;
  width: 100%;
  padding: 20px clamp(16px, 2vw, 32px) 32px;
}

.erp-shell__topbar,
.erp-shell__body {
  width: min(100%, 1920px);
  margin-inline: auto;
}

.erp-shell__topbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px 24px;
  margin-bottom: 20px;
  padding: 20px 22px;
  border: 1px solid var(--erp-border);
  border-radius: var(--erp-radius-card);
  box-shadow: var(--erp-shadow-card);
}

.erp-shell__title {
  margin: 0;
  font-size: clamp(24px, 2.2vw, 32px);
  line-height: 1.2;
}

.erp-shell__body {
  display: grid;
  gap: 18px;
  min-width: 0;
}

@media (max-width: 1366px) {
  .erp-shell__frame {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .erp-shell__sidebar {
    padding-inline: 14px;
  }
}

@media (max-width: 900px) {
  .erp-shell__frame {
    grid-template-columns: 1fr;
  }

  .erp-shell__sidebar {
    position: static;
  }

  .erp-shell__nav {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .erp-shell__content {
    padding: 16px;
  }
}
```

- [ ] **Step 4: Run shell and existing home tests**

Run:

```bash
pnpm --filter web test -- formal-ui-shell.test.tsx app-home-page.test.tsx app-root-page.test.tsx
```

Expected: PASS with the same navigation and role labels.

---

### Task 3: Shared Cards, Filters, Tables And Pagination

**Files:**
- Modify: `apps/web/app/app/_components/filter-panel.tsx`
- Modify: `apps/web/app/app/_components/formal-data-table.tsx`
- Modify: `apps/web/app/app/_components/formal-pagination.tsx`
- Modify: `apps/web/app/app/_components/stat-strip.tsx`
- Modify: `apps/web/app/app/_components/worktile-card.tsx`
- Modify: `apps/web/app/app/_components/formal-action-button-style.ts`
- Modify: `apps/web/app/formal-ui.css`
- Create: `apps/web/tests/formal-ui-components.test.tsx`

**Interfaces:**
- Consumes: Task 1 tokens and Task 2 shell width constraints.
- Produces: shared card, filter, table-scroll, pagination, stat, and action class behavior used by every formal page.

- [ ] **Step 1: Write shared component class tests**

Render each component with minimal content and assert:

```tsx
expect(screen.getByRole('region', { name: '当前筛选' })).toHaveClass(
  'erp-card',
  'erp-filter-panel',
);
expect(screen.getByTestId('formal-table-scroll')).toHaveClass('erp-table-scroll');
expect(screen.getByRole('navigation', { name: '测试分页' })).toHaveClass(
  'erp-pagination',
);
expect(screen.getByRole('region', { name: 'summary-strip' })).toHaveClass(
  'erp-stat-strip',
);
```

Give `FilterPanel` an `aria-label` equal to its title and add `data-testid="formal-table-scroll"` only to the shared table body wrapper.

- [ ] **Step 2: Run the shared-component test and verify failure**

Run:

```bash
pnpm --filter web test -- formal-ui-components.test.tsx
```

Expected: FAIL because shared components still expose inline-only styling.

- [ ] **Step 3: Convert shared components to the class contracts**

Use these structures without changing public props:

```tsx
<section className="erp-card erp-filter-panel" aria-label={title}>
  <div className="erp-filter-panel__heading">...</div>
  {children}
</section>
```

```tsx
<section className="erp-card erp-data-table">
  <div className="erp-data-table__header">...</div>
  <div
    className="erp-data-table__body erp-table-scroll"
    data-testid="formal-table-scroll"
  >
    {children}
  </div>
</section>
```

```tsx
<nav className="erp-pagination" aria-label={...}>
  ...
  <Link className="erp-button erp-button--secondary erp-button--compact" ...>
    下一页
  </Link>
</nav>
```

Replace `formalActionButtonStyle` layout values with the shared 40px/8px contract while preserving the exported object API for existing callers:

```ts
export const formalActionButtonStyle = {
  minHeight: '40px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #0f172a',
  borderRadius: '8px',
  padding: '0 16px',
  background: '#0f172a',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies CSSProperties;
```

- [ ] **Step 4: Add shared component CSS**

Implement card radius, 16–20px padding, compact shadows, wrapping headers, responsive stat grids, and `.erp-data-table__body { overflow-x: auto; }`. Keep table markup and children untouched.

- [ ] **Step 5: Run shared and formal-list regression tests**

Run:

```bash
pnpm --filter web test -- formal-ui-components.test.tsx app-formal-lists.test.tsx app-formal-detail-pages.test.tsx
```

Expected: PASS; table text, links, and pagination URLs remain unchanged.

---

### Task 4: Formal List Filters And Row Actions

**Files:**
- Modify: `apps/web/app/app/sales/quotes/page.tsx`
- Modify: `apps/web/app/app/sales/orders/page.tsx`
- Modify: `apps/web/app/app/sales/samples/page.tsx`
- Modify: `apps/web/app/app/sales/inquiries/page.tsx`
- Modify: `apps/web/app/app/purchase-orders/page.tsx`
- Modify: `apps/web/app/app/shipment-batches/page.tsx`
- Modify: `apps/web/app/app/after-sales/page.tsx`
- Modify: `apps/web/app/app/master-data/products/product-master-data-client.tsx`
- Modify: `apps/web/app/app/master-data/counterparties/counterparty-filter-form.tsx`
- Modify: `apps/web/app/app/master-data/counterparties/counterparty-master-data-client.tsx`
- Modify: `apps/web/app/formal-ui.css`
- Modify: `apps/web/tests/app-formal-lists.test.tsx`
- Modify: `apps/web/tests/app-formal-inquiry-pages.test.tsx`
- Modify: `apps/web/tests/app-products-page.test.tsx`
- Modify: `apps/web/tests/app-counterparties-page.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3 class contracts.
- Produces: one list-filter pattern: `erp-filter-form`, `erp-form-field`, `erp-control`, `erp-filter-actions`, and compact `erp-row-action`.

- [ ] **Step 1: Add failing list consistency assertions**

In existing render tests, assert the query buttons and controls use common classes:

```tsx
const queryButton = screen.getByRole('button', { name: '查询' });
expect(queryButton).toHaveClass('erp-button', 'erp-button--primary');

for (const control of screen.getAllByRole('textbox')) {
  expect(control).toHaveClass('erp-control');
}
```

Where a page uses native selects, assert `screen.getByLabelText(...)` has `erp-control`. For row actions, assert `查看详情`, `编辑`, and `转销售单` carry `erp-button--compact` without changing their permission-dependent presence.

- [ ] **Step 2: Run the four affected test files and verify failure**

Run:

```bash
pnpm --filter web test -- app-formal-lists.test.tsx app-formal-inquiry-pages.test.tsx app-products-page.test.tsx app-counterparties-page.test.tsx
```

Expected: FAIL on missing shared class names, not on business data.

- [ ] **Step 3: Migrate all filter forms to the same markup contract**

Apply this concrete pattern to every listed filter form:

```tsx
<form className="erp-filter-form erp-form-grid">
  <label className="erp-form-field">
    <span>关键词 Keyword</span>
    <input className="erp-control" name="keyword" defaultValue={query.keyword} />
  </label>
  ...
  <div className="erp-filter-actions">
    <button className="erp-button erp-button--primary" type="submit">
      查询
    </button>
    <Link className="erp-button erp-button--secondary" href={resetHref}>
      重置
    </Link>
  </div>
</form>
```

If a page currently has no reset link, do not invent new behavior; normalize only its existing query action. Remove local dimension properties only when the new classes replace them.

- [ ] **Step 4: Normalize table row actions**

Use:

```tsx
className="erp-button erp-button--secondary erp-button--compact erp-row-action"
```

for existing view/edit/convert actions. Use `erp-button--danger` only for an existing destructive action; do not add or expose any action.

- [ ] **Step 5: Add responsive filter CSS**

```css
.erp-filter-form {
  container-type: inline-size;
}

.erp-form-field {
  min-width: 0;
  display: grid;
  align-content: end;
  gap: 8px;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.erp-filter-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

@container (max-width: 520px) {
  .erp-filter-form {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run list and permission tests**

Run:

```bash
pnpm --filter web test -- app-formal-lists.test.tsx app-formal-inquiry-pages.test.tsx app-products-page.test.tsx app-counterparties-page.test.tsx app-formal-permissions.test.tsx
```

Expected: PASS; all queries, links, row actions, and permission boundaries are unchanged.

---

### Task 5: Sales, Purchase And Workflow Forms

**Files:**
- Modify: `apps/web/app/app/sales/quotes/new/create-formal-quote-form.tsx`
- Modify: `apps/web/app/app/sales/quotes/[id]/quote-price-confirm-form.tsx`
- Modify: `apps/web/app/app/sales/quotes/[id]/quote-customer-feedback-form.tsx`
- Modify: `apps/web/app/app/sales/inquiries/[id]/inquiry-comparison-submit-form.tsx`
- Modify: `apps/web/app/app/sales/inquiries/[id]/inquiry-boss-confirm-form.tsx`
- Modify: `apps/web/app/app/sales/orders/new/create-sales-order-form.tsx`
- Modify: `apps/web/app/app/purchase-orders/new/page.tsx`
- Modify: `apps/web/app/app/purchase-orders/[id]/purchase-order-draft-form.tsx`
- Modify: `apps/web/app/app/purchase-orders/[id]/purchase-shipment-action-form.tsx`
- Modify: `apps/web/app/app/sales/samples/[id]/sample-purchase-execution-form.tsx`
- Modify: `apps/web/app/app/shipment-batches/new/create-formal-shipment-batch-form.tsx`
- Modify: `apps/web/app/app/after-sales/new/create-formal-after-sales-form.tsx`
- Modify: `apps/web/app/formal-ui.css`
- Modify: `apps/web/tests/create-quote-form.test.tsx`
- Modify: `apps/web/tests/app-formal-quote-create.test.tsx`
- Modify: `apps/web/tests/inquiry-comparison-submit-form.test.tsx`
- Modify: `apps/web/tests/inquiry-boss-confirm-form.test.tsx`
- Modify: `apps/web/tests/quote-price-confirm-form.test.tsx`
- Modify: `apps/web/tests/quote-customer-feedback-form.test.tsx`
- Modify: `apps/web/tests/app-formal-sales-order-create.test.tsx`
- Modify: `apps/web/tests/app-formal-purchase-order-create.test.tsx`

**Interfaces:**
- Consumes: the shared form, control, button, card, and toolbar classes.
- Produces: consistent form controls, mode selectors, workflow cards, and submit actions without changing form names, values, validation, or server actions.

- [ ] **Step 1: Add failing workflow-form class assertions**

For each existing form test, pin one representative text input, selector/mode button, secondary action, and submit action:

```tsx
expect(screen.getByLabelText('客户名称 Customer Name')).toHaveClass('erp-control');
expect(screen.getByRole('button', { name: '需求单 / 选产品库' })).toHaveClass(
  'erp-mode-button',
);
expect(screen.getByRole('button', { name: '保存草稿' })).toHaveClass(
  'erp-button--secondary',
);
expect(screen.getByRole('button', { name: '提交' })).toHaveClass(
  'erp-button--primary',
);
```

Use each file's current accessible labels; do not change labels merely to satisfy the test.

- [ ] **Step 2: Run workflow tests and verify the class assertions fail**

Run:

```bash
pnpm --filter web test -- app-formal-quote-create.test.tsx inquiry-comparison-submit-form.test.tsx inquiry-boss-confirm-form.test.tsx quote-price-confirm-form.test.tsx quote-customer-feedback-form.test.tsx app-formal-sales-order-create.test.tsx app-formal-purchase-order-create.test.tsx
```

Expected: FAIL only on absent style classes.

- [ ] **Step 3: Apply classes without touching field behavior**

For each listed form:

- add `erp-form-grid` to responsive field groups;
- add `erp-form-field` to labels;
- add `erp-control` to text, number, date, select, and textarea controls;
- use `erp-mode-button` plus `aria-pressed` for existing mode switches;
- use primary/secondary/danger button classes according to the existing operation;
- use `erp-card erp-workflow-card` for approval/feedback blocks;
- remove only inline height, padding, border-radius, and shadow properties replaced by these classes.

The submit `name`, `value`, `disabled`, `onClick`, `onSubmit`, hidden fields, and server-action binding must remain byte-for-byte equivalent unless TypeScript requires class insertion formatting.

- [ ] **Step 4: Add mode and workflow CSS**

```css
.erp-mode-button {
  min-height: var(--erp-control-height);
  border: 1px solid var(--erp-border);
  border-radius: var(--erp-radius-control);
  padding: 0 14px;
  background: var(--erp-surface);
  color: var(--erp-text);
  font-weight: 700;
}

.erp-mode-button[aria-pressed="true"] {
  border-color: var(--erp-primary);
  background: var(--erp-primary);
  color: #ffffff;
}

.erp-workflow-card {
  padding: clamp(16px, 2vw, 24px);
}

@media (max-width: 720px) {
  .erp-form-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Run workflow and permission regression tests**

Run:

```bash
pnpm --filter web test -- create-quote-form.test.tsx app-formal-quote-create.test.tsx inquiry-comparison-submit-form.test.tsx inquiry-boss-confirm-form.test.tsx quote-price-confirm-form.test.tsx quote-customer-feedback-form.test.tsx app-formal-sales-order-create.test.tsx app-formal-purchase-order-create.test.tsx app-formal-permissions.test.tsx
```

Expected: PASS with identical workflow submissions and visibility.

---

### Task 6: Master Data, Administration And Special Controls

**Files:**
- Modify: `apps/web/app/app/master-data/products/create-product-form.tsx`
- Modify: `apps/web/app/app/master-data/products/update-product-form.tsx`
- Modify: `apps/web/app/app/master-data/products/product-table-row.tsx`
- Modify: `apps/web/app/app/master-data/products/sale-price-tier-editor.tsx`
- Modify: `apps/web/app/app/master-data/counterparties/create-counterparty-form.tsx`
- Modify: `apps/web/app/app/master-data/counterparties/update-counterparty-form.tsx`
- Modify: `apps/web/app/app/master-data/counterparties/counterparty-table-row.tsx`
- Modify: `apps/web/app/app/master-data/product-code-rule/update-product-code-rule-form.tsx`
- Modify: `apps/web/app/app/master-data/document-code-rule/update-document-code-rule-form.tsx`
- Modify: `apps/web/app/app/master-data/quote-source/update-quote-source-form.tsx`
- Modify: `apps/web/app/app/admin/users/create-admin-user-form.tsx`
- Modify: `apps/web/app/app/admin/users/update-user-role-form.tsx`
- Modify: `apps/web/app/app/admin/users/role-permissions-editor.tsx`
- Modify: `apps/web/app/app/_components/counterparty-picker.tsx`
- Modify: `apps/web/app/app/_components/image-preview-gallery.tsx`
- Modify: `apps/web/app/app/login/login-form.tsx`
- Modify: `apps/web/app/formal-ui.css`
- Modify: `apps/web/tests/app-products-page.test.tsx`
- Modify: `apps/web/tests/app-counterparties-page.test.tsx`
- Modify: `apps/web/tests/app-product-code-rule-page.test.tsx`
- Modify: `apps/web/tests/app-document-code-rule-page.test.tsx`
- Modify: `apps/web/tests/app-admin-users-page.test.tsx`
- Modify: `apps/web/tests/app-login-page.test.tsx`

**Interfaces:**
- Consumes: all shared UI contracts from Tasks 1–5.
- Produces: consistent master-data CRUD controls, modal sizing, image behavior, and administrative forms.

- [ ] **Step 1: Add failing representative class and image assertions**

Add assertions for:

```tsx
expect(screen.getByLabelText('产品销售编码 Sales Code')).toHaveClass('erp-control');
expect(screen.getByRole('button', { name: 'generated / 自动生成' })).toHaveClass(
  'erp-mode-button',
);
expect(screen.getByRole('button', { name: /保存|创建/ })).toHaveClass(
  'erp-button--primary',
);
```

In image-preview tests, assert the dialog container has `erp-dialog` and the image has `erp-media-contain`.

- [ ] **Step 2: Run master/admin tests and verify failure**

Run:

```bash
pnpm --filter web test -- app-products-page.test.tsx app-counterparties-page.test.tsx app-product-code-rule-page.test.tsx app-document-code-rule-page.test.tsx app-admin-users-page.test.tsx app-login-page.test.tsx
```

Expected: FAIL on the new class assertions only.

- [ ] **Step 3: Migrate master and admin controls**

Apply the same form, button, mode, card, and row-action classes used in Task 5. Preserve SKU generation, sales/purchase code modes, product stage behavior, supplier selection, role permissions, and login submission unchanged.

For picker/dialog markup use:

```tsx
<div className="erp-dialog" role="dialog" aria-modal="true">
  ...
  <img className="erp-media-contain" ... />
</div>
```

Do not change open/close handlers, keyboard behavior, selected values, or image URLs.

- [ ] **Step 4: Add bounded dialog and image CSS**

```css
.erp-dialog {
  width: min(960px, calc(100vw - 32px));
  max-height: min(88vh, 900px);
  overflow: auto;
  border: 1px solid var(--erp-border);
  border-radius: var(--erp-radius-card);
  background: var(--erp-surface);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.22);
}

.erp-media-contain {
  display: block;
  max-width: 100%;
  max-height: 72vh;
  object-fit: contain;
}
```

- [ ] **Step 5: Run master-data, admin, and full Web tests**

Run:

```bash
pnpm --filter web test -- app-products-page.test.tsx app-counterparties-page.test.tsx app-product-code-rule-page.test.tsx app-document-code-rule-page.test.tsx app-admin-users-page.test.tsx app-login-page.test.tsx
pnpm --filter web test
```

Expected: PASS. Existing product-code generation and workflow tests remain green.

---

### Task 7: Browser Matrix And Final Verification

**Files:**
- Modify only if validation reveals a defect: the smallest owning component/style/test from Tasks 1–6.
- Update checklist state in: `docs/superpowers/plans/2026-09-22-erp-ui-consistency-responsive.md`

**Interfaces:**
- Consumes: completed UI foundation and migrated formal pages.
- Produces: measured browser evidence and a clean verification report.

- [ ] **Step 1: Stop the Web development server before the production build**

Stop only the running Web session on port 3002. Keep the runtime API and its data running. This prevents `.next` development/production chunk conflicts.

- [ ] **Step 2: Run full automated verification**

Run:

```bash
pnpm test
pnpm build
git diff --check
git status --short
```

Expected: all tests and builds pass; `git diff --check` prints no errors; `git status --short` contains existing work plus the intended UI files only.

- [ ] **Step 3: Restart local Web preview in runtime mode**

Run:

```bash
PORT=3002 CI=true ERP_API_BASE_URL='http://127.0.0.1:3003/api' pnpm --filter web dev
```

Expected: Next.js reports ready on `http://localhost:3002` and the runtime API remains healthy.

- [ ] **Step 4: Validate representative route coverage at every viewport**

Use the local browser on these exact routes with the existing Admin session query:

```text
/app
/app/sales/quotes
/app/sales/quotes/new
/app/sales/inquiries
/app/sales/orders
/app/purchase-orders
/app/shipment-batches
/app/after-sales
/app/master-data/products
/app/master-data/counterparties
/app/admin/users
/app/dashboard/boss
```

At 1280×720, 1366×768, 1440×900, 1920×1080, and 2560×1440 measure:

```js
({
  viewportWidth: window.innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  horizontalOverflow:
    document.documentElement.scrollWidth > document.documentElement.clientWidth,
  queryButtonHeights: [...document.querySelectorAll('button')]
    .filter((element) => element.textContent?.trim() === '查询')
    .map((element) => Math.round(element.getBoundingClientRect().height)),
  controlHeights: [...document.querySelectorAll('.erp-control')]
    .filter((element) => element.tagName !== 'TEXTAREA')
    .map((element) => Math.round(element.getBoundingClientRect().height)),
})
```

Expected: no document-level horizontal overflow; query buttons and single-line controls are 40px; wide tables overflow only inside `.erp-table-scroll`.

- [ ] **Step 5: Check zoom/scaling and browser availability**

Check 80%, 100%, 125%, and 200% scaling wherever the active browser surface permits it. Verify that the narrow-shell breakpoint keeps navigation and primary actions visible. Inspect Chrome, Edge, and Safari when locally available; explicitly record any browser that could not be automated or opened rather than claiming coverage.

- [ ] **Step 6: Fix only evidence-backed visual defects and rerun their owning tests**

For each discovered issue, add or strengthen the nearest test first, then modify only the owning CSS/component. Rerun that test file and repeat the affected viewport measurement before moving on.

- [ ] **Step 7: Produce the final report without committing**

Report:

- tokens and visual rules introduced;
- shared components migrated;
- route groups migrated;
- viewport/browser matrix results;
- any unavailable browser or remaining legacy route;
- `pnpm test`, `pnpm build`, `git diff --check`, and `git status --short` results;
- confirmation that no commit, push, Gitee access, deployment, API, database, runtime, or Prisma change occurred.
