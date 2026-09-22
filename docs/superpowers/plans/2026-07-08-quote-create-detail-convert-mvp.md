# Quote Create Detail Convert MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first end-to-end operational quote flow by wiring quote creation, quote detail rendering, quote-to-sales conversion, and a minimal sales-order landing page through the existing API.

**Architecture:** Keep the implementation thin and route-local. Enrich the quote detail API contract just enough to support the detail and conversion UI, then add server actions plus small client form wrappers in the web app so create and convert mutations can call the API, surface lightweight errors, and redirect on success. Finish by adding a minimal `sales-orders/[id]` page as the conversion landing target.

**Tech Stack:** pnpm workspaces, Next.js App Router, React server actions, NestJS, TypeScript, Vitest, Jest

---

## File Structure

- Create `apps/api/test/quote-flow.service.spec.ts`
  Real-service tests for quote create/detail behavior that the web flow depends on.
- Modify `apps/api/test/quote.controller.spec.ts`
  Broaden controller expectations to include the enriched quote detail fields.
- Modify `apps/api/src/quote/quote.service.ts`
  Add an in-memory quote detail store for newly created quotes and enrich `getDetail`.
- Modify `apps/web/app/quotes/new/actions.ts`
  Replace the current payload-only helper with a real create server action plus a pure payload builder.
- Create `apps/web/app/quotes/new/create-quote-form.tsx`
  Client wrapper that uses `useActionState` to submit the create action and render lightweight errors.
- Modify `apps/web/app/quotes/new/page.tsx`
  Swap the placeholder form for the client form wrapper.
- Modify `apps/web/tests/create-quote-form.test.tsx`
  Cover both the page render and the payload builder.
- Create `apps/web/tests/quote-create-actions.test.ts`
  Verify create action fetches the API, redirects on success, and returns an error state on failure.
- Create `apps/web/app/quotes/[id]/actions.ts`
  Add the quote-to-sales server action plus a pure payload builder.
- Create `apps/web/app/quotes/[id]/convert-quote-form.tsx`
  Client wrapper for the convert action and inline errors.
- Create `apps/web/app/quotes/[id]/page.tsx`
  Server-rendered quote detail page that fetches `GET /quotes/:id`.
- Create `apps/web/tests/quote-detail-page.test.tsx`
  Verify quote detail render and load-failure handling.
- Create `apps/web/tests/quote-detail-actions.test.ts`
  Verify convert action fetches the API, redirects to the sales detail page, and returns an error state on failure.
- Create `apps/web/app/sales-orders/[id]/page.tsx`
  Minimal landing page for successful quote-to-sales conversion.
- Create `apps/web/tests/sales-order-detail-page.test.tsx`
  Verify the sales landing page and its failure state.

## Tasks

### Task 1: Enrich Quote Detail API For The Web Flow

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/quote-flow.service.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/quote.controller.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/quote.service.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/quote-flow.service.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/quote.controller.spec.ts`

- [ ] **Step 1: Write the failing real-service quote flow test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/quote-flow.service.spec.ts`:

```ts
import { QuoteService } from '../src/quote/quote.service';

describe('QuoteService operational flow', () => {
  it('returns the created quote detail fields after draft creation', async () => {
    const service = new QuoteService();

    const created = await service.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
    });
    const detail = await service.getDetail(created.id);

    expect(created.status).toBe('draft');
    expect(detail.id).toBe(created.id);
    expect(detail.customerId).toBe(1001);
    expect(detail.salesUserId).toBe(2001);
    expect(detail.sourceCode).toBe('expo');
    expect(detail.requirements).toBe('Need 500 units');
  });
});
```

- [ ] **Step 2: Extend the quote controller test so it demands the enriched detail contract**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/quote.controller.spec.ts` by replacing the mocked `getDetail` payload and assertions in `returns quote detail for a numeric id`:

```ts
getDetail: jest.fn().mockResolvedValue({
  id: 7,
  quoteNo: 'Q202607070001',
  status: 'draft',
  currentVersionNo: 1,
  customerId: 1001,
  salesUserId: 2001,
  sourceCode: 'expo',
  requirements: 'Need 500 units',
}),
```

and update the assertions to:

```ts
expect(result.id).toBe(7);
expect(result.status).toBe('draft');
expect(result.customerId).toBe(1001);
expect(result.sourceCode).toBe('expo');
expect(result.requirements).toBe('Need 500 units');
```

- [ ] **Step 3: Run the focused API tests to verify they fail for the right reason**

Run: `CI=true pnpm --filter api test -- quote-flow.service.spec.ts quote.controller.spec.ts`
Expected: FAIL because `QuoteService.getDetail()` does not yet expose `customerId`, `salesUserId`, `sourceCode`, or `requirements`

- [ ] **Step 4: Implement the minimal in-memory quote detail store**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/quote.service.ts` by adding a narrow runtime store near the imports:

```ts
type QuoteDetailRecord = {
  id: number;
  quoteNo: string;
  status: string;
  currentVersionNo: number;
  customerId: number;
  salesUserId: number;
  sourceCode: string;
  requirements: string;
};

const createdQuoteDetails = new Map<number, QuoteDetailRecord>();
let nextCreatedQuoteId = 100;
```

Then replace `create()` and `getDetail()` with:

```ts
  async create(dto: CreateQuoteDto) {
    const id = nextCreatedQuoteId++;
    const quoteNo = `Q20260708${String(id).padStart(4, '0')}`;
    const created: QuoteDetailRecord = {
      id,
      quoteNo,
      status: 'draft',
      currentVersionNo: 1,
      customerId: dto.customerId,
      salesUserId: dto.salesUserId,
      sourceCode: dto.sourceCode,
      requirements: dto.requirements,
    };

    createdQuoteDetails.set(id, created);

    return created;
  }

  async getDetail(id: number) {
    const created = createdQuoteDetails.get(id);

    if (created) {
      return created;
    }

    return {
      id,
      quoteNo: 'Q202607070001',
      status: 'draft',
      currentVersionNo: 1,
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
    };
  }
```

- [ ] **Step 5: Re-run the focused API tests to verify they pass**

Run: `CI=true pnpm --filter api test -- quote-flow.service.spec.ts quote.controller.spec.ts`
Expected: PASS with the enriched quote detail contract verified

- [ ] **Step 6: Commit**

```bash
git add apps/api/test/quote-flow.service.spec.ts apps/api/test/quote.controller.spec.ts apps/api/src/quote/quote.service.ts
git commit -m "feat: enrich quote detail flow contract"
```

### Task 2: Wire Quote Creation Through A Real Server Action

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/actions.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/create-quote-form.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/create-quote-form.test.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-create-actions.test.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/create-quote-form.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-create-actions.test.ts`

- [ ] **Step 1: Write the failing create-action test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-create-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCreateQuotePayload,
  createQuoteAction,
} from '../app/quotes/new/actions';

const redirectMock = vi.fn((href: string) => {
  throw new Error(`REDIRECT:${href}`);
});

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('createQuoteAction', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    vi.unstubAllGlobals();
  });

  it('posts the normalized payload and redirects to the created quote detail', async () => {
    const formData = new FormData();
    formData.set('customerId', '1001');
    formData.set('salesUserId', '2001');
    formData.set('sourceCode', 'expo');
    formData.set('requirements', 'Need 500 units');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 101, quoteNo: 'Q202607080101' }),
      }),
    );

    await expect(
      createQuoteAction({ error: null }, formData),
    ).rejects.toThrow('REDIRECT:/quotes/101');

    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3001/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: 1001,
        salesUserId: 2001,
        sourceCode: 'expo',
        requirements: 'Need 500 units',
      }),
      cache: 'no-store',
    });
  });

  it('returns an error state when the API rejects the quote creation', async () => {
    const formData = new FormData();
    formData.set('customerId', '1001');
    formData.set('salesUserId', '2001');
    formData.set('sourceCode', 'expo');
    formData.set('requirements', 'Need 500 units');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Source code is required' }),
      }),
    );

    await expect(
      createQuoteAction({ error: null }, formData),
    ).resolves.toEqual({ error: 'Source code is required' });
  });

  it('normalizes form data through the shared payload builder', () => {
    const formData = new FormData();
    formData.set('customerId', '1001');
    formData.set('salesUserId', '2001');
    formData.set('sourceCode', 'expo');
    formData.set('requirements', 'Need 500 units');

    expect(buildCreateQuotePayload(formData)).toEqual({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
    });
  });
});
```

- [ ] **Step 2: Update the form render test so it expects the real create form wrapper**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/create-quote-form.test.tsx` to:

```ts
import { render, screen } from '@testing-library/react';
import { buildCreateQuotePayload } from '../app/quotes/new/actions';
import NewQuotePage from '../app/quotes/new/page';
```

and change the payload test body to:

```ts
expect(buildCreateQuotePayload(formData)).toEqual({
  customerId: 1001,
  salesUserId: 2001,
  sourceCode: 'expo',
  requirements: 'Need 500 units',
});
```

- [ ] **Step 3: Run the focused web tests to verify they fail**

Run: `CI=true pnpm --filter web test -- create-quote-form.test.tsx quote-create-actions.test.ts`
Expected: FAIL because `buildCreateQuotePayload` and the real server action do not exist yet

- [ ] **Step 4: Implement the create action and client form wrapper**

Replace `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/actions.ts` with:

```ts
'use server';

import { redirect } from 'next/navigation';

export type QuoteFormState = {
  error: string | null;
};

const initialError = '创建报价失败';

function getQuoteApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001';
}

async function readApiError(response: {
  json: () => Promise<unknown>;
}) {
  const body = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;

  if (typeof body?.message === 'string') {
    return body.message;
  }

  if (Array.isArray(body?.message) && typeof body.message[0] === 'string') {
    return body.message[0];
  }

  return initialError;
}

export function buildCreateQuotePayload(formData: FormData) {
  return {
    customerId: Number(formData.get('customerId')),
    salesUserId: Number(formData.get('salesUserId')),
    sourceCode: String(formData.get('sourceCode')),
    requirements: String(formData.get('requirements')),
  };
}

export async function createQuoteAction(
  _prevState: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const payload = buildCreateQuotePayload(formData);
  const response = await fetch(`${getQuoteApiBaseUrl()}/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    return { error: await readApiError(response) };
  }

  const result = (await response.json()) as { id: number };
  redirect(`/quotes/${result.id}`);
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/create-quote-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { createQuoteAction } from './actions';

const initialState = { error: null };

export function CreateQuoteForm() {
  const [state, formAction, pending] = useActionState(
    createQuoteAction,
    initialState,
  );

  return (
    <form action={formAction}>
      <label>
        Customer ID
        <input name="customerId" type="number" />
      </label>
      <label>
        Sales User ID
        <input name="salesUserId" type="number" />
      </label>
      <label>
        Source Code
        <input name="sourceCode" type="text" />
      </label>
      <label>
        Requirements
        <textarea name="requirements" />
      </label>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Submitting...' : 'Submit Quote'}
      </button>
    </form>
  );
}
```

Replace `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/page.tsx` with:

```tsx
import { CreateQuoteForm } from './create-quote-form';

export default function NewQuotePage() {
  return (
    <main>
      <h1>Create Quote</h1>
      <p>Submit a draft quote and continue into the quote detail workflow.</p>
      <CreateQuoteForm />
    </main>
  );
}
```

- [ ] **Step 5: Re-run the focused web tests to verify they pass**

Run: `CI=true pnpm --filter web test -- create-quote-form.test.tsx quote-create-actions.test.ts`
Expected: PASS with the create page and server action green

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/quotes/new/actions.ts apps/web/app/quotes/new/create-quote-form.tsx apps/web/app/quotes/new/page.tsx apps/web/tests/create-quote-form.test.tsx apps/web/tests/quote-create-actions.test.ts
git commit -m "feat: wire quote creation flow"
```

### Task 3: Add Quote Detail Rendering And Convert-To-Sales Action

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/[id]/actions.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/[id]/convert-quote-form.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/[id]/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-detail-actions.test.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-detail-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-detail-actions.test.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-detail-page.test.tsx`

- [ ] **Step 1: Write the failing convert-action test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-detail-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildConvertQuotePayload,
  convertQuoteToSalesAction,
} from '../app/quotes/[id]/actions';

const redirectMock = vi.fn((href: string) => {
  throw new Error(`REDIRECT:${href}`);
});

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('convertQuoteToSalesAction', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    vi.unstubAllGlobals();
  });

  it('posts the conversion payload and redirects to the sales detail page', async () => {
    const formData = new FormData();
    formData.set('quoteId', '101');
    formData.set('quoteVersionNo', '1');
    formData.set('customerId', '1001');
    formData.set('createdBy', '2001');
    formData.set('quoteConfirmed', 'true');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 101, salesNo: 'S202607080001' }),
      }),
    );

    await expect(
      convertQuoteToSalesAction({ error: null }, formData),
    ).rejects.toThrow('REDIRECT:/sales-orders/101');

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/quotes/101/convert-to-sales',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteVersionNo: 1,
          customerId: 1001,
          createdBy: 2001,
          quoteConfirmed: true,
        }),
        cache: 'no-store',
      },
    );
  });

  it('returns an error state when conversion fails', async () => {
    const formData = new FormData();
    formData.set('quoteId', '101');
    formData.set('quoteVersionNo', '1');
    formData.set('customerId', '1001');
    formData.set('createdBy', '2001');
    formData.set('quoteConfirmed', 'true');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          message: 'Only confirmed quote versions can convert to sales orders',
        }),
      }),
    );

    await expect(
      convertQuoteToSalesAction({ error: null }, formData),
    ).resolves.toEqual({
      error: 'Only confirmed quote versions can convert to sales orders',
    });
  });

  it('normalizes conversion form values', () => {
    const formData = new FormData();
    formData.set('quoteId', '101');
    formData.set('quoteVersionNo', '1');
    formData.set('customerId', '1001');
    formData.set('createdBy', '2001');
    formData.set('quoteConfirmed', 'true');

    expect(buildConvertQuotePayload(formData)).toEqual({
      quoteId: 101,
      payload: {
        quoteVersionNo: 1,
        customerId: 1001,
        createdBy: 2001,
        quoteConfirmed: true,
      },
    });
  });
});
```

- [ ] **Step 2: Write the failing quote detail page test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-detail-page.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import QuoteDetailPage from '../app/quotes/[id]/page';

describe('QuoteDetailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the quote summary and convert-to-sales form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          quoteNo: 'Q202607080101',
          status: 'draft',
          currentVersionNo: 1,
          customerId: 1001,
          salesUserId: 2001,
          sourceCode: 'expo',
          requirements: 'Need 500 units',
        }),
      }),
    );

    render(
      <>{await QuoteDetailPage({ params: Promise.resolve({ id: '101' }) })}</>,
    );

    expect(
      screen.getByRole('heading', { name: '报价单 Q202607080101' }),
    ).toBeInTheDocument();
    expect(screen.getByText('状态：draft')).toBeInTheDocument();
    expect(screen.getByText('来源：expo')).toBeInTheDocument();
    expect(screen.getByText('需求：Need 500 units')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '转为销售订单' }),
    ).toBeInTheDocument();
  });

  it('renders a small fallback state when detail loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Quote not found' }),
      }),
    );

    render(
      <>{await QuoteDetailPage({ params: Promise.resolve({ id: '999' }) })}</>,
    );

    expect(screen.getByText('报价详情加载失败')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回报价列表' })).toHaveAttribute(
      'href',
      '/quotes',
    );
  });
});
```

- [ ] **Step 3: Run the focused web tests to verify they fail**

Run: `CI=true pnpm --filter web test -- quote-detail-actions.test.ts quote-detail-page.test.tsx`
Expected: FAIL because the quote detail route and convert action do not exist yet

- [ ] **Step 4: Implement the convert action and detail route**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/[id]/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';

export type ConvertQuoteState = {
  error: string | null;
};

function getQuoteApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001';
}

async function readApiError(response: {
  json: () => Promise<unknown>;
}) {
  const body = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;

  if (typeof body?.message === 'string') {
    return body.message;
  }

  if (Array.isArray(body?.message) && typeof body.message[0] === 'string') {
    return body.message[0];
  }

  return '转销售失败';
}

export function buildConvertQuotePayload(formData: FormData) {
  return {
    quoteId: Number(formData.get('quoteId')),
    payload: {
      quoteVersionNo: Number(formData.get('quoteVersionNo')),
      customerId: Number(formData.get('customerId')),
      createdBy: Number(formData.get('createdBy')),
      quoteConfirmed: String(formData.get('quoteConfirmed')) === 'true',
    },
  };
}

export async function convertQuoteToSalesAction(
  _prevState: ConvertQuoteState,
  formData: FormData,
): Promise<ConvertQuoteState> {
  const { quoteId, payload } = buildConvertQuotePayload(formData);
  const response = await fetch(
    `${getQuoteApiBaseUrl()}/quotes/${quoteId}/convert-to-sales`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    return { error: await readApiError(response) };
  }

  const result = (await response.json()) as { id: number };
  redirect(`/sales-orders/${result.id}`);
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/[id]/convert-quote-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { convertQuoteToSalesAction } from './actions';

const initialState = { error: null };

type ConvertQuoteFormProps = {
  quoteId: number;
  quoteVersionNo: number;
  customerId: number;
  createdBy: number;
};

export function ConvertQuoteForm(props: ConvertQuoteFormProps) {
  const [state, formAction, pending] = useActionState(
    convertQuoteToSalesAction,
    initialState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="quoteId" value={props.quoteId} />
      <input
        type="hidden"
        name="quoteVersionNo"
        value={props.quoteVersionNo}
      />
      <input type="hidden" name="customerId" value={props.customerId} />
      <input type="hidden" name="createdBy" value={props.createdBy} />
      <input type="hidden" name="quoteConfirmed" value="true" />
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? '处理中...' : '转为销售订单'}
      </button>
    </form>
  );
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { ConvertQuoteForm } from './convert-quote-form';

type QuoteDetail = {
  id: number;
  quoteNo: string;
  status: string;
  currentVersionNo: number;
  customerId: number;
  salesUserId: number;
  sourceCode: string;
  requirements: string;
};

async function getQuoteDetail(id: string): Promise<QuoteDetail | null> {
  const apiBaseUrl = process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const response = await fetch(`${apiBaseUrl}/quotes/${id}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as QuoteDetail;
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getQuoteDetail(id);

  if (!detail) {
    return (
      <main>
        <h1>报价详情加载失败</h1>
        <Link href="/quotes">返回报价列表</Link>
      </main>
    );
  }

  return (
    <main>
      <h1>报价单 {detail.quoteNo}</h1>
      <p>状态：{detail.status}</p>
      <p>版本：V{detail.currentVersionNo}</p>
      <p>客户 ID：{detail.customerId}</p>
      <p>销售员 ID：{detail.salesUserId}</p>
      <p>来源：{detail.sourceCode}</p>
      <p>需求：{detail.requirements}</p>

      <section aria-labelledby="quote-convert">
        <h2 id="quote-convert">转销售</h2>
        <p>确认报价后可直接下推为销售订单。</p>
        <ConvertQuoteForm
          quoteId={detail.id}
          quoteVersionNo={detail.currentVersionNo}
          customerId={detail.customerId}
          createdBy={detail.salesUserId}
        />
      </section>

      <p>
        <Link href="/quotes">返回报价列表</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Re-run the focused web tests to verify they pass**

Run: `CI=true pnpm --filter web test -- quote-detail-actions.test.ts quote-detail-page.test.tsx`
Expected: PASS with the detail route and convert action green

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/quotes/[id]/actions.ts apps/web/app/quotes/[id]/convert-quote-form.tsx apps/web/app/quotes/[id]/page.tsx apps/web/tests/quote-detail-actions.test.ts apps/web/tests/quote-detail-page.test.tsx
git commit -m "feat: add quote detail and convert flow"
```

### Task 4: Add The Minimal Sales-Order Landing Detail Page

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-detail-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-detail-page.test.tsx`

- [ ] **Step 1: Write the failing sales detail page test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-detail-page.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SalesOrderDetailPage from '../app/sales-orders/[id]/page';

describe('SalesOrderDetailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the converted sales order landing summary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'draft',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'purchasing',
          shipmentAggregateStatus: 'purchasing',
        }),
      }),
    );

    render(
      <>
        {await SalesOrderDetailPage({ params: Promise.resolve({ id: '101' }) })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '销售订单 S202607080001' }),
    ).toBeInTheDocument();
    expect(screen.getByText('状态：draft')).toBeInTheDocument();
    expect(screen.getByText('采购汇总：purchasing')).toBeInTheDocument();
    expect(screen.getByText('发货汇总：purchasing')).toBeInTheDocument();
  });

  it('renders a small fallback state when the sales detail cannot load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Sales order not found' }),
      }),
    );

    render(
      <>
        {await SalesOrderDetailPage({ params: Promise.resolve({ id: '999' }) })}
      </>,
    );

    expect(screen.getByText('销售订单详情加载失败')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回销售订单列表' })).toHaveAttribute(
      'href',
      '/sales-orders',
    );
  });
});
```

- [ ] **Step 2: Run the focused web test to verify it fails**

Run: `CI=true pnpm --filter web test -- sales-order-detail-page.test.tsx`
Expected: FAIL because the dynamic sales order detail route does not exist yet

- [ ] **Step 3: Implement the minimal landing page**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/page.tsx`:

```tsx
import Link from 'next/link';

type SalesOrderDetail = {
  id: number;
  salesNo: string;
  status: string;
  currentVersionNo: number;
  purchaseAggregateStatus: string;
  shipmentAggregateStatus: string;
};

async function getSalesOrderDetail(id: string): Promise<SalesOrderDetail | null> {
  const apiBaseUrl = process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const response = await fetch(`${apiBaseUrl}/sales-orders/${id}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SalesOrderDetail;
}

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getSalesOrderDetail(id);

  if (!detail) {
    return (
      <main>
        <h1>销售订单详情加载失败</h1>
        <Link href="/sales-orders">返回销售订单列表</Link>
      </main>
    );
  }

  return (
    <main>
      <h1>销售订单 {detail.salesNo}</h1>
      <p>状态：{detail.status}</p>
      <p>版本：V{detail.currentVersionNo}</p>
      <p>采购汇总：{detail.purchaseAggregateStatus}</p>
      <p>发货汇总：{detail.shipmentAggregateStatus}</p>
      <p>
        <Link href="/sales-orders">返回销售订单列表</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Re-run the focused web test to verify it passes**

Run: `CI=true pnpm --filter web test -- sales-order-detail-page.test.tsx`
Expected: PASS with the sales-order landing route green

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/sales-orders/[id]/page.tsx apps/web/tests/sales-order-detail-page.test.tsx
git commit -m "feat: add sales order detail landing page"
```

### Task 5: Full Verification And Final Review

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/quote.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/actions.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/create-quote-form.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/[id]/actions.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/[id]/convert-quote-form.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/[id]/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/page.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/quote-flow.service.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/create-quote-form.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-create-actions.test.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-detail-actions.test.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quote-detail-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-detail-page.test.tsx`

- [ ] **Step 1: Run the focused verification sweep**

Run:

```bash
CI=true pnpm --filter api test -- quote-flow.service.spec.ts quote.controller.spec.ts
CI=true pnpm --filter web test -- create-quote-form.test.tsx quote-create-actions.test.ts quote-detail-actions.test.ts quote-detail-page.test.tsx sales-order-detail-page.test.tsx
```

Expected:

- API focused tests PASS
- web focused tests PASS

- [ ] **Step 2: Run the full verification sweep**

Run:

```bash
CI=true pnpm --filter @erp/shared test
CI=true pnpm --filter @erp/shared build
CI=true pnpm --filter api test
CI=true pnpm --filter web test
CI=true pnpm --filter web build
```

Expected:

- all shared tests PASS
- shared build PASS
- all API tests PASS
- all web tests PASS
- web build PASS

- [ ] **Step 3: Review the final diff for scope hygiene**

Run:

```bash
git diff --stat HEAD~4..HEAD
git status --short
```

Expected:

- only quote create/detail/convert files and the minimal sales detail landing page are included
- `docs/superpowers/plans/` and `outputs/` remain untracked and unstaged

- [ ] **Step 4: Request code review on the working tree**

Review target:

- quote create action redirect flow
- quote detail and convert form hidden-field mapping
- sales landing detail fallback state
- web tests mocking `redirect` and `fetch`

- [ ] **Step 5: Commit the final integrated slice**

```bash
git add apps/api/test/quote-flow.service.spec.ts apps/api/test/quote.controller.spec.ts apps/api/src/quote/quote.service.ts apps/web/app/quotes/new/actions.ts apps/web/app/quotes/new/create-quote-form.tsx apps/web/app/quotes/new/page.tsx apps/web/app/quotes/[id]/actions.ts apps/web/app/quotes/[id]/convert-quote-form.tsx apps/web/app/quotes/[id]/page.tsx apps/web/app/sales-orders/[id]/page.tsx apps/web/tests/create-quote-form.test.tsx apps/web/tests/quote-create-actions.test.ts apps/web/tests/quote-detail-actions.test.ts apps/web/tests/quote-detail-page.test.tsx apps/web/tests/sales-order-detail-page.test.tsx
git commit -m "feat: add quote create detail convert flow"
```

## Self-Review

### Spec Coverage

- quote creation now has a dedicated task with real API mutation and redirect
- quote detail now has a dedicated task with server rendering and fallback state
- quote-to-sales conversion now has a dedicated task with a real mutation and redirect
- minimal sales-order landing detail now has a dedicated task
- focused and full verification are explicitly covered

No spec requirement is missing from the task list.

### Placeholder Scan

- no `TODO`, `TBD`, or “implement later” markers remain
- each task includes exact file paths
- each task includes concrete test and implementation code
- each task includes exact run commands and expected outcomes

### Type Consistency

- `QuoteFormState` is used consistently in the create action and client form
- `ConvertQuoteState` is used consistently in the convert action and client form
- `buildCreateQuotePayload()` and `buildConvertQuotePayload()` are referenced with the same names in implementation and tests
- quote detail fields `customerId`, `salesUserId`, `sourceCode`, and `requirements` are the same across API tests, service implementation, and web page rendering
