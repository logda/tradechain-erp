# Formal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate formal ERP entry under `/app` while keeping all demo pages intact, starting with sales workbench, formal sales lists, and the boss dashboard.

**Architecture:** Build a formal route group with a shared app shell and shared list primitives. Reuse the existing demo data and list contracts for the first slice so we only change layout, navigation, and role-aware entry points. Keep the demo pages untouched unless a shared contract must change.

**Tech Stack:** Next.js App Router, React 18, TypeScript, shared workspace package, Vitest

---

## File Structure

- Create `apps/web/app/app/layout.tsx`
  Formal route-group layout for `/app` pages.
- Create `apps/web/app/app/page.tsx`
  Formal home/workbench.
- Create `apps/web/app/app/sales/page.tsx`
  Sales hub with quote, sales order, and todo entry points.
- Create `apps/web/app/app/sales/quotes/page.tsx`
  Formal quote list page.
- Create `apps/web/app/app/sales/orders/page.tsx`
  Formal sales order list page.
- Create `apps/web/app/app/dashboard/boss/page.tsx`
  Formal boss dashboard page.
- Create `apps/web/app/app/_components/app-shell.tsx`
  Formal shell UI.
- Create `apps/web/app/app/_components/worktile-card.tsx`
  Workbench task card.
- Create `apps/web/app/app/_components/stat-strip.tsx`
  Summary card strip for formal lists.
- Create `apps/web/app/app/_components/filter-panel.tsx`
  Basic/advanced filter wrapper.
- Create `apps/web/app/app/_components/formal-data-table.tsx`
  Table wrapper for formal list pages.
- Create `apps/web/tests/app-home-page.test.tsx`
  Verify formal home rendering and navigation.
- Create `apps/web/tests/app-sales-page.test.tsx`
  Verify sales hub entry points.
- Create `apps/web/tests/app-formal-lists.test.tsx`
  Verify formal quote and sales order list shells.
- Create `apps/web/tests/app-boss-dashboard.test.tsx`
  Verify formal boss dashboard shell.

## Tasks

### Task 1: Add The Formal Shell And Home Page

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/layout.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/_components/app-shell.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/app-home-page.test.tsx`

- [ ] **Step 1: Write the failing home page test**

```ts
import { render, screen } from '@testing-library/react';
import AppHomePage from '../app/app/page';

describe('AppHomePage', () => {
  it('renders the formal home shell and entry cards', async () => {
    render(<>{await AppHomePage()}</>);

    expect(screen.getByRole('heading', { name: 'ERP 正式工作台' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '销售工作台' })).toHaveAttribute('href', '/app/sales');
    expect(screen.getByRole('link', { name: '老板看板' })).toHaveAttribute('href', '/app/dashboard/boss');
    expect(screen.getByRole('link', { name: '返回演示页' })).toHaveAttribute('href', '/sales-orders');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run tests/app-home-page.test.tsx`
Expected: FAIL because `/app` pages do not exist yet

- [ ] **Step 3: Implement the formal shell and home page**

Create `apps/web/app/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react';

export default function FormalAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
```

Create `apps/web/app/app/_components/app-shell.tsx`:

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main>
      <header>
        <h1>{title}</h1>
        <nav>
          <Link href="/app">首页</Link>
          <Link href="/app/sales">销售</Link>
          <Link href="/app/dashboard/boss">老板看板</Link>
          <Link href="/sales-orders">返回演示页</Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
```

Create `apps/web/app/app/page.tsx`:

```tsx
import Link from 'next/link';
import { AppShell } from './_components/app-shell';

export default function AppHomePage() {
  return (
    <AppShell title="ERP 正式工作台">
      <section>
        <Link href="/app/sales">销售工作台</Link>
        <Link href="/app/dashboard/boss">老板看板</Link>
        <Link href="/sales-orders">返回演示页</Link>
      </section>
    </AppShell>
  );
}
```

- [ ] **Step 4: Re-run the test to verify it passes**

Run: `./node_modules/.bin/vitest run tests/app-home-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/app/layout.tsx apps/web/app/app/_components/app-shell.tsx apps/web/app/app/page.tsx apps/web/tests/app-home-page.test.tsx
git commit -m "feat: add formal app shell"
```

### Task 2: Add The Sales Hub And Formal List Shells

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/sales/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/sales/quotes/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/sales/orders/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/_components/worktile-card.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/_components/stat-strip.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/_components/filter-panel.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/_components/formal-data-table.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/app-sales-page.test.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/app-formal-lists.test.tsx`

- [ ] **Step 1: Write the failing sales hub and formal list tests**

```ts
import { render, screen } from '@testing-library/react';
import AppSalesPage from '../app/app/sales/page';

describe('AppSalesPage', () => {
  it('renders sales workbench entry cards instead of a long list', async () => {
    render(<>{await AppSalesPage()}</>);

    expect(screen.getByRole('heading', { name: '销售工作台' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '报价模块' })).toHaveAttribute('href', '/app/sales/quotes');
    expect(screen.getByRole('link', { name: '销售单模块' })).toHaveAttribute('href', '/app/sales/orders');
    expect(screen.getByRole('link', { name: '销售待办' })).toHaveAttribute('href', '/app/sales#todo');
  });
});
```

```ts
import { render, screen } from '@testing-library/react';
import AppQuoteListPage from '../app/app/sales/quotes/page';
import AppSalesOrdersPage from '../app/app/sales/orders/page';

describe('formal sales list pages', () => {
  it('renders the formal quote list shell', async () => {
    render(<>{await AppQuoteListPage({ searchParams: Promise.resolve({}) })}</>);

    expect(screen.getByRole('heading', { name: '正式报价单' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回工作台' })).toHaveAttribute('href', '/app/sales');
    expect(screen.getByText('当前筛选')).toBeInTheDocument();
  });

  it('renders the formal sales list shell', async () => {
    render(<>{await AppSalesOrdersPage({ searchParams: Promise.resolve({}) })}</>);

    expect(screen.getByRole('heading', { name: '正式销售单' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回工作台' })).toHaveAttribute('href', '/app/sales');
    expect(screen.getByText('查询结果')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./node_modules/.bin/vitest run tests/app-sales-page.test.tsx tests/app-formal-lists.test.tsx`
Expected: FAIL because the formal sales routes and shells do not exist yet

- [ ] **Step 3: Implement the sales hub and the reusable formal list shells**

Create `apps/web/app/app/_components/worktile-card.tsx`:

```tsx
import Link from 'next/link';

export function WorktileCard({
  title,
  href,
  description,
}: {
  title: string;
  href: string;
  description: string;
}) {
  return (
    <article>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link href={href}>{title}</Link>
    </article>
  );
}
```

Create `apps/web/app/app/_components/stat-strip.tsx`:

```tsx
export function StatStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <section aria-label="summary-strip">
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            {item.label}: {item.value}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `apps/web/app/app/_components/filter-panel.tsx`:

```tsx
import type { ReactNode } from 'react';

export function FilterPanel({
  children,
  title = '当前筛选',
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```

Create `apps/web/app/app/_components/formal-data-table.tsx`:

```tsx
import type { ReactNode } from 'react';

export function FormalDataTable({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```

Create `apps/web/app/app/sales/page.tsx`:

```tsx
import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { WorktileCard } from '../_components/worktile-card';

export default function AppSalesPage() {
  return (
    <AppShell title="销售工作台">
      <section>
        <WorktileCard
          title="报价模块"
          href="/app/sales/quotes"
          description="进入正式报价列表与快捷入口"
        />
        <WorktileCard
          title="销售单模块"
          href="/app/sales/orders"
          description="进入正式销售单列表与高级筛选"
        />
        <Link href="/app/sales#todo">销售待办</Link>
      </section>
    </AppShell>
  );
}
```

Create `apps/web/app/app/sales/quotes/page.tsx`:

```tsx
import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import { FilterPanel } from '../../_components/filter-panel';
import { FormalDataTable } from '../../_components/formal-data-table';
import { StatStrip } from '../../_components/stat-strip';

export default async function AppQuoteListPage() {
  return (
    <AppShell title="正式报价单">
      <Link href="/app/sales">返回工作台</Link>
      <StatStrip
        items={[
          { label: '全部', value: 3 },
          { label: '待确认', value: 1 },
          { label: '已确认', value: 2 },
        ]}
      />
      <FilterPanel>
        <p>当前筛选</p>
      </FilterPanel>
      <FormalDataTable title="查询结果">
        <p>复用现有报价列表数据源</p>
      </FormalDataTable>
    </AppShell>
  );
}
```

Create `apps/web/app/app/sales/orders/page.tsx`:

```tsx
import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import { FilterPanel } from '../../_components/filter-panel';
import { FormalDataTable } from '../../_components/formal-data-table';
import { StatStrip } from '../../_components/stat-strip';

export default async function AppSalesOrdersPage() {
  return (
    <AppShell title="正式销售单">
      <Link href="/app/sales">返回工作台</Link>
      <StatStrip
        items={[
          { label: '全部', value: 3 },
          { label: '执行中', value: 2 },
          { label: '待审批', value: 1 },
        ]}
      />
      <FilterPanel>
        <p>当前筛选</p>
      </FilterPanel>
      <FormalDataTable title="查询结果">
        <p>复用现有销售单列表数据源</p>
      </FormalDataTable>
    </AppShell>
  );
}
```

- [ ] **Step 4: Re-run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run tests/app-sales-page.test.tsx tests/app-formal-lists.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/app/sales/page.tsx apps/web/app/app/sales/quotes/page.tsx apps/web/app/app/sales/orders/page.tsx apps/web/app/app/_components/worktile-card.tsx apps/web/app/app/_components/stat-strip.tsx apps/web/app/app/_components/filter-panel.tsx apps/web/app/app/_components/formal-data-table.tsx apps/web/tests/app-sales-page.test.tsx apps/web/tests/app-formal-lists.test.tsx
git commit -m "feat: add formal sales workbench"
```

### Task 3: Add The Formal Boss Dashboard

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/dashboard/boss/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/app-boss-dashboard.test.tsx`

- [ ] **Step 1: Write the failing boss dashboard test**

```ts
import { render, screen } from '@testing-library/react';
import AppBossDashboardPage from '../app/app/dashboard/boss/page';

describe('AppBossDashboardPage', () => {
  it('renders a formal boss dashboard shell', async () => {
    render(<>{await AppBossDashboardPage()}</>);

    expect(screen.getByRole('heading', { name: '老板看板' })).toBeInTheDocument();
    expect(screen.getByText('待办总览')).toBeInTheDocument();
    expect(screen.getByText('销售汇总')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run tests/app-boss-dashboard.test.tsx`
Expected: FAIL because the formal dashboard route does not exist yet

- [ ] **Step 3: Implement the formal boss dashboard page**

Create `apps/web/app/app/dashboard/boss/page.tsx` using `AppShell` and the existing dashboard summary style.

- [ ] **Step 4: Re-run the test to verify it passes**

Run: `./node_modules/.bin/vitest run tests/app-boss-dashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/app/dashboard/boss/page.tsx apps/web/tests/app-boss-dashboard.test.tsx
git commit -m "feat: add formal boss dashboard"
```

### Task 4: Verify The Full Web Test Suite

**Files:**
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests`

- [ ] **Step 1: Run the full web test suite**

Run: `./node_modules/.bin/vitest run`
Expected: PASS, including the existing demo pages and the new formal pages

- [ ] **Step 2: Fix any regressions**

If a regression appears, fix the shared component or page shell that caused it, then re-run the full web suite.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/app apps/web/tests
git commit -m "feat: ship formal app entry"
```
