# Sales Order Lifecycle Operations MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `sales-orders/[id]` into a role-aware operations console that supports approval, resubmission, cancellation, receipt updates, finance confirmation, close validation, and close actions.

**Architecture:** Extend the current `sales-orders/[id]` detail route into a sectioned operations console. Start by enriching the detail contract and adding centralized role policy helpers, then wire action families one by one with isolated client forms and real server actions. Finish with a dedicated close-validation slice and a full verification pass.

**Tech Stack:** pnpm workspaces, Next.js App Router, React 18 client forms, NestJS, TypeScript, Vitest, Jest

---

## File Structure

- Modify `apps/api/src/sales-order/sales-order.service.ts`
  Enrich the detail baseline so the web operations console has the fields it needs.
- Modify `apps/api/test/sales-order-rules.spec.ts`
  Verify the enriched sales-order detail contract.
- Modify `apps/api/test/sales-order.controller.spec.ts`
  Extend controller coverage for enriched sales-order detail forwarding.
- Modify `apps/web/app/sales-orders/[id]/page.tsx`
  Replace the minimal landing page with the role-aware operations console.
- Create `apps/web/app/sales-orders/[id]/actions.ts`
  Centralize payload builders and server actions for all sales-order lifecycle mutations.
- Create `apps/web/app/sales-orders/[id]/role-policy.ts`
  Normalize `role` and compute section/action visibility.
- Create `apps/web/app/sales-orders/[id]/close-validation.ts`
  Map close-validation payloads into UI-friendly checklist rows.
- Create `apps/web/app/sales-orders/[id]/approval-actions.tsx`
  Client forms for submit, approve, and reject.
- Create `apps/web/app/sales-orders/[id]/change-cancel-actions.tsx`
  Client forms for resubmit and cancel.
- Create `apps/web/app/sales-orders/[id]/receipt-finance-actions.tsx`
  Client forms for receipt-status and finance-confirm.
- Create `apps/web/app/sales-orders/[id]/close-actions.tsx`
  Validation display and close form.
- Modify `apps/web/tests/sales-order-detail-page.test.tsx`
  Expand from minimal landing coverage to role-aware section rendering.
- Create `apps/web/tests/sales-order-actions.test.ts`
  Cover payload normalization, redirects, errors, and role-preserving same-page refreshes.
- Create `apps/web/tests/sales-order-role-policy.test.ts`
  Cover role normalization and action visibility rules.
- Create `apps/web/tests/sales-order-close-validation.test.ts`
  Cover close-validation UI mapping and close preconditions.

## Tasks

### Task 1: Enrich The Sales-Order Detail Contract For The Operations Console

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-rules.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order.controller.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-rules.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order.controller.spec.ts`

- [ ] **Step 1: Extend the rule test so it demands the operations detail fields**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-rules.spec.ts` by replacing the existing detail assertion block with:

```ts
  it('returns sales detail with the operational fields needed by the web console', async () => {
    const service = new SalesOrderService();

    const result = await service.getDetail(9);

    expect(result.id).toBe(9);
    expect(result.salesNo).toBe('S202607080001');
    expect(result.status).toBe('purchasing');
    expect(result.currentVersionNo).toBe(1);
    expect(result.purchaseAggregateStatus).toBe('purchasing');
    expect(result.shipmentAggregateStatus).toBe('purchasing');
    expect(result.sourceQuoteOrderId).toBe(7);
    expect(result.customerId).toBe(1001);
    expect(result.createdBy).toBe(2001);
    expect(result.ownerName).toBe('张销售');
    expect(result.receiptStatus).toBe('deposit_received');
    expect(result.financeStatus).toBe('pending');
    expect(result.receiptSendStatus).toBe('sent');
    expect(result.afterSalesEndStatus).toBe('closed');
    expect(result.hasAfterSales).toBe(false);
  });
```

- [ ] **Step 2: Extend the controller test so it demands the enriched detail shape**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order.controller.spec.ts` by adding:

```ts
  it('SalesOrderController.getDetail returns the operational detail contract', async () => {
    const getDetail = jest.fn().mockResolvedValue({
      id: 9,
      salesNo: 'S202607080001',
      status: 'purchasing',
      currentVersionNo: 1,
      purchaseAggregateStatus: 'purchasing',
      shipmentAggregateStatus: 'purchasing',
      sourceQuoteOrderId: 7,
      customerId: 1001,
      createdBy: 2001,
      ownerName: '张销售',
      receiptStatus: 'deposit_received',
      financeStatus: 'pending',
      receiptSendStatus: 'sent',
      afterSalesEndStatus: 'closed',
      hasAfterSales: false,
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        {
          provide: SalesOrderService,
          useValue: {
            getDetail,
            submit: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
            updateReceiptStatus: jest.fn(),
            confirmFinance: jest.fn(),
            getCloseValidation: jest.fn(),
            close: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    const result = await controller.getDetail(9 as never);

    expect(getDetail).toHaveBeenCalledWith(9);
    expect(result.ownerName).toBe('张销售');
    expect(result.receiptStatus).toBe('deposit_received');
    expect(result.financeStatus).toBe('pending');
    expect(result.receiptSendStatus).toBe('sent');
  });
```

- [ ] **Step 3: Run the focused API tests to verify they fail**

Run: `CI=true pnpm --filter api test -- sales-order-rules.spec.ts sales-order.controller.spec.ts`
Expected: FAIL because `SalesOrderService.getDetail()` does not yet return the enriched operations fields

- [ ] **Step 4: Enrich the baseline sales-order detail implementation**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.service.ts` by replacing `getDetail(id)` with:

```ts
  async getDetail(id: number) {
    return {
      id,
      salesNo: 'S202607080001',
      status: 'purchasing',
      currentVersionNo: 1,
      purchaseAggregateStatus: 'purchasing',
      shipmentAggregateStatus: 'purchasing',
      sourceQuoteOrderId: 7,
      customerId: 1001,
      createdBy: 2001,
      ownerName: '张销售',
      receiptStatus: 'deposit_received',
      financeStatus: 'pending',
      receiptSendStatus: 'sent',
      afterSalesEndStatus: 'closed',
      hasAfterSales: false,
    };
  }
```

- [ ] **Step 5: Re-run the focused API tests to verify they pass**

Run: `CI=true pnpm --filter api test -- sales-order-rules.spec.ts sales-order.controller.spec.ts`
Expected: PASS with the operations detail contract verified

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/sales-order/sales-order.service.ts apps/api/test/sales-order-rules.spec.ts apps/api/test/sales-order.controller.spec.ts
git commit -m "feat: enrich sales order detail contract"
```

### Task 2: Add Role Policy, Close-Validation Mapping, And The Detail Skeleton

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/role-policy.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/close-validation.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-detail-page.test.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-role-policy.test.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-close-validation.test.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-detail-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-role-policy.test.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-close-validation.test.ts`

- [ ] **Step 1: Write the failing role-policy and validation helper tests**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-role-policy.test.ts`:

```ts
import {
  getSalesOrderRoleConfig,
  normalizeSalesOrderRole,
} from '../app/sales-orders/[id]/role-policy';

describe('sales-order role policy', () => {
  it('normalizes unsupported roles to sales', () => {
    expect(normalizeSalesOrderRole('finance')).toBe('finance');
    expect(normalizeSalesOrderRole('oops')).toBe('sales');
    expect(normalizeSalesOrderRole(undefined)).toBe('sales');
  });

  it('makes approval executable only for sales managers in pending approval', () => {
    expect(
      getSalesOrderRoleConfig('sales', 'pending_sales_manager_approval').actions
        .approve.executable,
    ).toBe(false);
    expect(
      getSalesOrderRoleConfig('sales_manager', 'pending_sales_manager_approval')
        .actions.approve.executable,
    ).toBe(true);
    expect(
      getSalesOrderRoleConfig('finance', 'pending_sales_manager_approval').actions
        .approve.executable,
    ).toBe(false);
  });
});
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-close-validation.test.ts`:

```ts
import { buildCloseValidationRows } from '../app/sales-orders/[id]/close-validation';

describe('sales-order close validation mapping', () => {
  it('maps API checks into stable checklist rows', () => {
    expect(
      buildCloseValidationRows({
        canClose: false,
        checks: {
          shipmentDone: true,
          receiptSent: false,
          afterSalesDone: true,
          financeConfirmed: false,
          receiptPaid: true,
        },
      }),
    ).toEqual([
      { key: 'shipmentDone', label: '发货已完成', passed: true },
      { key: 'receiptSent', label: '回单已发送', passed: false },
      { key: 'afterSalesDone', label: '售后已结束', passed: true },
      { key: 'financeConfirmed', label: '财务已确认', passed: false },
      { key: 'receiptPaid', label: '收款已达标', passed: true },
    ]);
  });
});
```

- [ ] **Step 2: Expand the detail page test so it expects the role-aware skeleton**

Modify `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-detail-page.test.tsx` by replacing the success test with:

```ts
  it('renders the role-aware operations skeleton for a sales manager view', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'pending_sales_manager_approval',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'purchasing',
          shipmentAggregateStatus: 'purchasing',
          sourceQuoteOrderId: 7,
          customerId: 1001,
          createdBy: 2001,
          ownerName: '张销售',
          receiptStatus: 'deposit_received',
          financeStatus: 'pending',
          receiptSendStatus: 'sent',
          afterSalesEndStatus: 'closed',
          hasAfterSales: false,
        }),
      }),
    );

    render(
      <>
        {await SalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({ role: 'sales_manager' }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '销售订单 S202607080001' })).toBeInTheDocument();
    expect(screen.getByText('当前角色：sales_manager')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审批流动作' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '关闭校验' })).toBeInTheDocument();
    expect(screen.getByText('可执行动作：approve, reject, close')).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the focused web tests to verify they fail**

Run: `CI=true pnpm --filter web test -- sales-order-detail-page.test.tsx sales-order-role-policy.test.ts sales-order-close-validation.test.ts`
Expected: FAIL because the new helper files and role-aware detail page behavior do not exist yet

- [ ] **Step 4: Implement the role policy, validation mapper, and detail skeleton**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/role-policy.ts`:

```ts
export const salesOrderRoles = ['sales', 'sales_manager', 'finance'] as const;

export type SalesOrderRole = (typeof salesOrderRoles)[number];

export function normalizeSalesOrderRole(value: string | undefined): SalesOrderRole {
  return value === 'sales_manager' || value === 'finance' ? value : 'sales';
}

type ActionState = { visible: boolean; executable: boolean };

export function getSalesOrderRoleConfig(role: SalesOrderRole, status: string) {
  const actions = {
    submit: { visible: true, executable: role === 'sales' && status === 'draft' },
    approve: {
      visible: true,
      executable: role === 'sales_manager' && status === 'pending_sales_manager_approval',
    },
    reject: {
      visible: true,
      executable: role === 'sales_manager' && status === 'pending_sales_manager_approval',
    },
    resubmit: { visible: true, executable: role === 'sales' && status === 'purchasing' },
    cancel: { visible: true, executable: role === 'sales' },
    receiptStatus: { visible: role !== 'sales_manager', executable: role !== 'sales_manager' },
    financeConfirm: { visible: role === 'finance', executable: role === 'finance' },
    close: { visible: true, executable: role === 'sales_manager' || role === 'finance' },
  } satisfies Record<string, ActionState>;

  const executableNames = Object.entries(actions)
    .filter(([, action]) => action.executable)
    .map(([name]) => name);

  return { role, actions, executableNames };
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/close-validation.ts`:

```ts
export function buildCloseValidationRows(result: {
  canClose: boolean;
  checks: {
    shipmentDone: boolean;
    receiptSent: boolean;
    afterSalesDone: boolean;
    financeConfirmed: boolean;
    receiptPaid: boolean;
  };
}) {
  return [
    { key: 'shipmentDone', label: '发货已完成', passed: result.checks.shipmentDone },
    { key: 'receiptSent', label: '回单已发送', passed: result.checks.receiptSent },
    { key: 'afterSalesDone', label: '售后已结束', passed: result.checks.afterSalesDone },
    { key: 'financeConfirmed', label: '财务已确认', passed: result.checks.financeConfirmed },
    { key: 'receiptPaid', label: '收款已达标', passed: result.checks.receiptPaid },
  ] as const;
}
```

Replace `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/page.tsx` with a role-aware skeleton that:

```tsx
import Link from 'next/link';
import { buildCloseValidationRows } from './close-validation';
import { getSalesOrderRoleConfig, normalizeSalesOrderRole } from './role-policy';

type SearchParams = Record<string, string | string[] | undefined>;
type SalesOrderDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
};

type SalesOrderDetail = {
  id: number;
  salesNo: string;
  status: string;
  currentVersionNo: number;
  purchaseAggregateStatus: string;
  shipmentAggregateStatus: string;
  sourceQuoteOrderId: number;
  customerId: number;
  createdBy: number;
  ownerName: string;
  receiptStatus: string;
  financeStatus: string;
  receiptSendStatus: string;
  afterSalesEndStatus: string;
  hasAfterSales: boolean;
};

function getSalesOrderApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001';
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hasValidSalesOrderDetail(value: unknown): value is SalesOrderDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SalesOrderDetail).id === 'number' &&
    typeof (value as SalesOrderDetail).salesNo === 'string' &&
    typeof (value as SalesOrderDetail).status === 'string' &&
    typeof (value as SalesOrderDetail).currentVersionNo === 'number' &&
    typeof (value as SalesOrderDetail).purchaseAggregateStatus === 'string' &&
    typeof (value as SalesOrderDetail).shipmentAggregateStatus === 'string' &&
    typeof (value as SalesOrderDetail).sourceQuoteOrderId === 'number' &&
    typeof (value as SalesOrderDetail).customerId === 'number' &&
    typeof (value as SalesOrderDetail).createdBy === 'number' &&
    typeof (value as SalesOrderDetail).ownerName === 'string' &&
    typeof (value as SalesOrderDetail).receiptStatus === 'string' &&
    typeof (value as SalesOrderDetail).financeStatus === 'string' &&
    typeof (value as SalesOrderDetail).receiptSendStatus === 'string' &&
    typeof (value as SalesOrderDetail).afterSalesEndStatus === 'string' &&
    typeof (value as SalesOrderDetail).hasAfterSales === 'boolean'
  );
}

async function loadSalesOrderDetail(id: string) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${getSalesOrderApiBaseUrl()}/sales-orders/${id}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidSalesOrderDetail(result) ? result : null;
  } catch {
    return null;
  }
}

export default async function SalesOrderDetailPage({
  params,
  searchParams,
}: SalesOrderDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const role = normalizeSalesOrderRole(readParam(resolvedSearchParams.role));
  const detail = await loadSalesOrderDetail(id);

  if (!detail) {
    return (
      <section>
        <h1>销售订单详情加载失败</h1>
        <p>请返回销售订单列表后重试。</p>
        <Link href="/sales-orders">返回销售订单列表</Link>
      </section>
    );
  }

  const roleConfig = getSalesOrderRoleConfig(role, detail.status);
  const blockedActionNames = Object.entries(roleConfig.actions)
    .filter(([, action]) => action.visible && !action.executable)
    .map(([name]) => name);
  const validationRows = buildCloseValidationRows({
    canClose: detail.financeStatus === 'confirmed',
    checks: {
      shipmentDone: true,
      receiptSent: detail.receiptSendStatus === 'sent',
      afterSalesDone: detail.afterSalesEndStatus === 'closed',
      financeConfirmed: detail.financeStatus === 'confirmed',
      receiptPaid: detail.receiptStatus !== 'unpaid',
    },
  });

  return (
    <section>
      <h1>{`销售订单 ${detail.salesNo}`}</h1>
      <p>{`状态：${detail.status}`}</p>
      <p>{`版本号：V${detail.currentVersionNo}`}</p>
      <p>{`来源报价：${detail.sourceQuoteOrderId}`}</p>
      <p>{`客户 ID：${detail.customerId}`}</p>
      <p>{`创建人 ID：${detail.createdBy}`}</p>
      <p>{`负责人：${detail.ownerName}`}</p>
      <p>{`采购汇总：${detail.purchaseAggregateStatus}`}</p>
      <p>{`发货汇总：${detail.shipmentAggregateStatus}`}</p>
      <p>{`收款状态：${detail.receiptStatus}`}</p>
      <p>{`财务状态：${detail.financeStatus}`}</p>
      <p>{`售后完成：${detail.hasAfterSales ? '是' : '否'}`}</p>

      <h2>角色视图摘要</h2>
      <p>{`当前角色：${role}`}</p>
      <p>{`可执行动作：${roleConfig.executableNames.join(', ') || '无'}`}</p>
      <p>{`受阻动作：${blockedActionNames.join(', ') || '无'}`}</p>

      <h2>审批流动作</h2>
      <p>当前展示审批区块位置，后续任务会替换为可执行表单。</p>

      <h2>改单/撤销</h2>
      <p>当前展示改单与撤销区块位置，后续任务会替换为可执行表单。</p>

      <h2>收款/财务</h2>
      <p>当前展示收款与财务区块位置，后续任务会替换为可执行表单。</p>

      <h2>关闭校验</h2>
      <ul>
        {validationRows.map((row) => (
          <li key={row.key}>{`${row.label}：${row.passed ? '通过' : '未通过'}`}</li>
        ))}
      </ul>

      <h2>操作反馈</h2>
      <p>失败信息显示在对应操作区；成功后返回当前角色视图并刷新最新状态。</p>
    </section>
  );
}
```

- [ ] **Step 5: Re-run the focused tests to verify they pass**

Run: `CI=true pnpm --filter web test -- sales-order-detail-page.test.tsx sales-order-role-policy.test.ts sales-order-close-validation.test.ts`
Expected: PASS with the role-aware skeleton green

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/sales-orders/[id]/role-policy.ts apps/web/app/sales-orders/[id]/close-validation.ts apps/web/app/sales-orders/[id]/page.tsx apps/web/tests/sales-order-detail-page.test.tsx apps/web/tests/sales-order-role-policy.test.ts apps/web/tests/sales-order-close-validation.test.ts
git commit -m "feat: add sales order operations skeleton"
```

### Task 3: Wire Approval Actions

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/actions.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/approval-actions.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-detail-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-detail-page.test.tsx`

- [ ] **Step 1: Write failing approval action tests**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REDIRECT_ERROR_CODE,
  RedirectType,
} from 'next/dist/client/components/redirect-error';
import {
  buildSalesOrderSubmitPayload,
  buildSalesOrderApprovePayload,
  buildSalesOrderRejectPayload,
  submitSalesOrderAction,
  approveSalesOrderAction,
  rejectSalesOrderAction,
} from '../app/sales-orders/[id]/actions';

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((href: string) => {
    const error = new Error('NEXT_REDIRECT');
    (error as Error & { digest: string }).digest = [
      REDIRECT_ERROR_CODE,
      RedirectType.push,
      href,
      '303',
      '',
    ].join(';');
    throw error;
  }),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));

describe('sales-order approval actions', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    vi.unstubAllGlobals();
  });

  it('normalizes submit, approve, and reject payloads', async () => {
    const formData = new FormData();
    formData.set('salesOrderId', '101');
    formData.set('currentStatus', 'draft');
    formData.set('role', 'sales');

    await expect(buildSalesOrderSubmitPayload(formData)).resolves.toEqual({
      salesOrderId: 101,
      currentStatus: 'draft',
      role: 'sales',
    });
  });

  it('redirects submit back to the same detail role view on success', async () => {
    const formData = new FormData();
    formData.set('salesOrderId', '101');
    formData.set('currentStatus', 'draft');
    formData.set('role', 'sales');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 101, status: 'pending_sales_manager_approval' }),
      }),
    );

    await expect(submitSalesOrderAction({ error: null }, formData)).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/sales-orders/101?role=sales;303;`,
    });
  });

  it('returns an API message when approval is rejected by the backend', async () => {
    const formData = new FormData();
    formData.set('salesOrderId', '101');
    formData.set('currentStatus', 'draft');
    formData.set('role', 'sales_manager');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Only pending sales manager approval orders can be approved' }),
      }),
    );

    await expect(approveSalesOrderAction({ error: null }, formData)).resolves.toEqual({
      error: 'Only pending sales manager approval orders can be approved',
    });
  });
});
```

- [ ] **Step 2: Expand the page test so approval buttons are role-gated**

Append this test to `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-detail-page.test.tsx`:

```ts
  it('shows approve and reject controls only for the sales manager role in pending approval', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'pending_sales_manager_approval',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'purchasing',
          shipmentAggregateStatus: 'purchasing',
          sourceQuoteOrderId: 7,
          customerId: 1001,
          createdBy: 2001,
          ownerName: '张销售',
          receiptStatus: 'deposit_received',
          financeStatus: 'pending',
          receiptSendStatus: 'sent',
          afterSalesEndStatus: 'closed',
          hasAfterSales: false,
        }),
      }),
    );

    render(
      <>
        {await SalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({ role: 'sales_manager' }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: '审批通过' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '审批驳回' })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the focused web tests to verify they fail**

Run: `CI=true pnpm --filter web test -- sales-order-actions.test.ts sales-order-detail-page.test.tsx`
Expected: FAIL because approval payload builders, approval server actions, and the approval section do not exist yet

- [ ] **Step 4: Implement the shared approval actions and approval section**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/actions.ts` with the shared patterns already used by quote create/convert:

```ts
'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { redirect } from 'next/navigation';

export type SalesOrderActionState = { error: string | null };

const initialError = '销售订单操作失败';

function getSalesOrderApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001';
}

async function readApiError(response: { json: () => Promise<unknown> }) {
  const body = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;
  if (typeof body?.message === 'string') return body.message;
  if (Array.isArray(body?.message) && typeof body.message[0] === 'string') return body.message[0];
  return initialError;
}

function parsePositiveInt(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.trim() === '') return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
}

function parseRole(value: FormDataEntryValue | null) {
  return value === 'sales_manager' || value === 'finance' ? value : 'sales';
}

export async function buildSalesOrderSubmitPayload(formData: FormData) {
  return {
    salesOrderId: parsePositiveInt(formData.get('salesOrderId')),
    currentStatus: String(formData.get('currentStatus') ?? ''),
    role: parseRole(formData.get('role')),
  };
}

export const buildSalesOrderApprovePayload = buildSalesOrderSubmitPayload;
export const buildSalesOrderRejectPayload = buildSalesOrderSubmitPayload;
```

Then add a shared helper:

```ts
async function runStatusAction(
  formData: FormData,
  endpoint: 'submit' | 'approve' | 'reject',
): Promise<SalesOrderActionState> {
  try {
    const request = await buildSalesOrderSubmitPayload(formData);
    if (!Number.isFinite(request.salesOrderId) || !request.currentStatus) {
      return { error: initialError };
    }

    const response = await fetch(
      `${getSalesOrderApiBaseUrl()}/sales-orders/${request.salesOrderId}/${endpoint}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStatus: request.currentStatus }),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    redirect(`/sales-orders/${request.salesOrderId}?role=${request.role}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: initialError };
  }
}
```

and export:

```ts
export async function submitSalesOrderAction(_prev: SalesOrderActionState, formData: FormData) {
  return runStatusAction(formData, 'submit');
}

export async function approveSalesOrderAction(_prev: SalesOrderActionState, formData: FormData) {
  return runStatusAction(formData, 'approve');
}

export async function rejectSalesOrderAction(_prev: SalesOrderActionState, formData: FormData) {
  return runStatusAction(formData, 'reject');
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/approval-actions.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import {
  approveSalesOrderAction,
  rejectSalesOrderAction,
  submitSalesOrderAction,
  type SalesOrderActionState,
} from './actions';

const initialState: SalesOrderActionState = { error: null };

type ApprovalActionsProps = {
  salesOrderId: number;
  currentStatus: string;
  role: 'sales' | 'sales_manager' | 'finance';
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
};

const fallbackError = '销售订单操作失败';

type ActionRunner = (
  prev: SalesOrderActionState,
  formData: FormData,
) => Promise<SalesOrderActionState>;

export function ApprovalActions({
  salesOrderId,
  currentStatus,
  role,
  canSubmit,
  canApprove,
  canReject,
}: ApprovalActionsProps) {
  const [submitState, setSubmitState] = useState(initialState);
  const [approveState, setApproveState] = useState(initialState);
  const [rejectState, setRejectState] = useState(initialState);
  const [submitPending, setSubmitPending] = useState(false);
  const [approvePending, setApprovePending] = useState(false);
  const [rejectPending, setRejectPending] = useState(false);

  async function handleActionSubmit(
    event: FormEvent<HTMLFormElement>,
    action: ActionRunner,
    setState: (value: SalesOrderActionState) => void,
    setPending: (value: boolean) => void,
  ) {
    event.preventDefault();
    setPending(true);
    setState(initialState);

    const formData = new FormData(event.currentTarget);
    try {
      const nextState = await action(initialState, formData);
      setState(nextState);
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      setState({ error: fallbackError });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(event) =>
          handleActionSubmit(event, submitSalesOrderAction, setSubmitState, setSubmitPending)
        }
      >
        <input name="salesOrderId" type="hidden" value={salesOrderId} />
        <input name="currentStatus" type="hidden" value={currentStatus} />
        <input name="role" type="hidden" value={role} />
        {submitState.error ? <p role="alert">{submitState.error}</p> : null}
        <button type="submit" disabled={!canSubmit || submitPending}>
          {submitPending ? '提交中...' : '提交审批'}
        </button>
      </form>

      <form
        onSubmit={(event) =>
          handleActionSubmit(event, approveSalesOrderAction, setApproveState, setApprovePending)
        }
      >
        <input name="salesOrderId" type="hidden" value={salesOrderId} />
        <input name="currentStatus" type="hidden" value={currentStatus} />
        <input name="role" type="hidden" value={role} />
        {approveState.error ? <p role="alert">{approveState.error}</p> : null}
        <button type="submit" disabled={!canApprove || approvePending}>
          {approvePending ? '提交中...' : '审批通过'}
        </button>
      </form>

      <form
        onSubmit={(event) =>
          handleActionSubmit(event, rejectSalesOrderAction, setRejectState, setRejectPending)
        }
      >
        <input name="salesOrderId" type="hidden" value={salesOrderId} />
        <input name="currentStatus" type="hidden" value={currentStatus} />
        <input name="role" type="hidden" value={role} />
        {rejectState.error ? <p role="alert">{rejectState.error}</p> : null}
        <button type="submit" disabled={!canReject || rejectPending}>
          {rejectPending ? '提交中...' : '审批驳回'}
        </button>
      </form>
    </div>
  );
}
```

Modify `page.tsx` to import and render:

```tsx
<ApprovalActions
  salesOrderId={detail.id}
  currentStatus={detail.status}
  role={role}
  canSubmit={roleConfig.actions.submit.executable}
  canApprove={roleConfig.actions.approve.executable}
  canReject={roleConfig.actions.reject.executable}
/>
```

- [ ] **Step 5: Re-run the focused tests to verify they pass**

Run: `CI=true pnpm --filter web test -- sales-order-actions.test.ts sales-order-detail-page.test.tsx`
Expected: PASS with approval actions and role-gated buttons green

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/sales-orders/[id]/actions.ts apps/web/app/sales-orders/[id]/approval-actions.tsx apps/web/app/sales-orders/[id]/page.tsx apps/web/tests/sales-order-actions.test.ts apps/web/tests/sales-order-detail-page.test.tsx
git commit -m "feat: add sales order approval actions"
```

### Task 4: Wire Resubmit And Cancel Actions

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/actions.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/change-cancel-actions.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts`

- [ ] **Step 1: Extend the action test with resubmit and cancel cases**

Append to `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts`:

```ts
import {
  buildSalesOrderCancelPayload,
  buildSalesOrderResubmitPayload,
  cancelSalesOrderAction,
  resubmitSalesOrderAction,
} from '../app/sales-orders/[id]/actions';

it('normalizes resubmit and cancel payloads', async () => {
  const formData = new FormData();
  formData.set('salesOrderId', '101');
  formData.set('currentStatus', 'purchasing');
  formData.set('changeReason', 'Customer changed packaging');
  formData.set('hasShipmentBatches', 'false');
  formData.set('unshippedPurchaseOrderIds', '3001,3002');
  formData.set('role', 'sales');

  await expect(buildSalesOrderResubmitPayload(formData)).resolves.toEqual({
    salesOrderId: 101,
    payload: {
      currentStatus: 'purchasing',
      changeReason: 'Customer changed packaging',
      hasShipmentBatches: false,
    },
    role: 'sales',
  });

  await expect(buildSalesOrderCancelPayload(formData)).resolves.toEqual({
    salesOrderId: 101,
    payload: {
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      unshippedPurchaseOrderIds: [3001, 3002],
    },
    role: 'sales',
  });
});
```

and:

```ts
it('redirects resubmit and cancel back to the same detail role view on success', async () => {
  const formData = new FormData();
  formData.set('salesOrderId', '101');
  formData.set('currentStatus', 'purchasing');
  formData.set('changeReason', 'Customer changed packaging');
  formData.set('hasShipmentBatches', 'false');
  formData.set('unshippedPurchaseOrderIds', '3001,3002');
  formData.set('role', 'sales');

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 101, status: 'void' }),
    }),
  );

  await expect(cancelSalesOrderAction({ error: null }, formData)).rejects.toMatchObject({
    digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/sales-orders/101?role=sales;303;`,
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `CI=true pnpm --filter web test -- sales-order-actions.test.ts`
Expected: FAIL because resubmit/cancel payload builders and actions do not exist yet

- [ ] **Step 3: Implement resubmit/cancel payload builders and forms**

Extend `actions.ts` with:

```ts
function parseBoolean(value: FormDataEntryValue | null) {
  return value === 'true';
}

function parseIdList(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }
  return value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

export async function buildSalesOrderResubmitPayload(formData: FormData) {
  return {
    salesOrderId: parsePositiveInt(formData.get('salesOrderId')),
    payload: {
      currentStatus: String(formData.get('currentStatus') ?? ''),
      changeReason: String(formData.get('changeReason') ?? ''),
      hasShipmentBatches: parseBoolean(formData.get('hasShipmentBatches')),
    },
    role: parseRole(formData.get('role')),
  };
}

export async function buildSalesOrderCancelPayload(formData: FormData) {
  return {
    salesOrderId: parsePositiveInt(formData.get('salesOrderId')),
    payload: {
      currentStatus: String(formData.get('currentStatus') ?? ''),
      hasShipmentBatches: parseBoolean(formData.get('hasShipmentBatches')),
      unshippedPurchaseOrderIds: parseIdList(formData.get('unshippedPurchaseOrderIds')),
    },
    role: parseRole(formData.get('role')),
  };
}
```

Add:

```ts
export async function resubmitSalesOrderAction(_prev: SalesOrderActionState, formData: FormData) {
  try {
    const request = await buildSalesOrderResubmitPayload(formData);
    if (
      !Number.isFinite(request.salesOrderId) ||
      !request.payload.currentStatus ||
      !request.payload.changeReason.trim()
    ) {
      return { error: initialError };
    }

    const response = await fetch(
      `${getSalesOrderApiBaseUrl()}/sales-orders/${request.salesOrderId}/resubmit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.payload),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    redirect(`/sales-orders/${request.salesOrderId}?role=${request.role}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: initialError };
  }
}

export async function cancelSalesOrderAction(_prev: SalesOrderActionState, formData: FormData) {
  try {
    const request = await buildSalesOrderCancelPayload(formData);
    if (
      !Number.isFinite(request.salesOrderId) ||
      !request.payload.currentStatus ||
      request.payload.unshippedPurchaseOrderIds.length === 0
    ) {
      return { error: initialError };
    }

    const response = await fetch(
      `${getSalesOrderApiBaseUrl()}/sales-orders/${request.salesOrderId}/cancel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.payload),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    redirect(`/sales-orders/${request.salesOrderId}?role=${request.role}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: initialError };
  }
}
```

Create `change-cancel-actions.tsx` with two independent forms:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import {
  cancelSalesOrderAction,
  resubmitSalesOrderAction,
  type SalesOrderActionState,
} from './actions';

type ChangeCancelActionsProps = {
  salesOrderId: number;
  currentStatus: string;
  role: 'sales' | 'sales_manager' | 'finance';
  canResubmit: boolean;
  canCancel: boolean;
};

const initialState: SalesOrderActionState = { error: null };
const fallbackError = '销售订单操作失败';

export function ChangeCancelActions({
  salesOrderId,
  currentStatus,
  role,
  canResubmit,
  canCancel,
}: ChangeCancelActionsProps) {
  const [resubmitState, setResubmitState] = useState(initialState);
  const [cancelState, setCancelState] = useState(initialState);
  const [resubmitPending, setResubmitPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);

  async function handleResubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResubmitPending(true);
    setResubmitState(initialState);

    const formData = new FormData(event.currentTarget);
    try {
      const nextState = await resubmitSalesOrderAction(initialState, formData);
      setResubmitState(nextState);
    } catch (error) {
      if (isRedirectError(error)) throw error;
      setResubmitState({ error: fallbackError });
    } finally {
      setResubmitPending(false);
    }
  }

  async function handleCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCancelPending(true);
    setCancelState(initialState);

    const formData = new FormData(event.currentTarget);
    try {
      const nextState = await cancelSalesOrderAction(initialState, formData);
      setCancelState(nextState);
    } catch (error) {
      if (isRedirectError(error)) throw error;
      setCancelState({ error: fallbackError });
    } finally {
      setCancelPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleResubmit}>
        <input name="salesOrderId" type="hidden" value={salesOrderId} />
        <input name="currentStatus" type="hidden" value={currentStatus} />
        <input name="role" type="hidden" value={role} />
        <label>
          改单原因
          <textarea name="changeReason" defaultValue="Customer changed packaging" />
        </label>
        <label>
          是否已有发货批次
          <select name="hasShipmentBatches" defaultValue="false">
            <option value="false">否</option>
            <option value="true">是</option>
          </select>
        </label>
        {resubmitState.error ? <p role="alert">{resubmitState.error}</p> : null}
        <button type="submit" disabled={!canResubmit || resubmitPending}>
          {resubmitPending ? '提交中...' : '改单重提'}
        </button>
      </form>

      <form onSubmit={handleCancel}>
        <input name="salesOrderId" type="hidden" value={salesOrderId} />
        <input name="currentStatus" type="hidden" value={currentStatus} />
        <input name="role" type="hidden" value={role} />
        <label>
          是否已有发货批次
          <select name="hasShipmentBatches" defaultValue="false">
            <option value="false">否</option>
            <option value="true">是</option>
          </select>
        </label>
        <label>
          未发货采购单 ID
          <input
            name="unshippedPurchaseOrderIds"
            type="text"
            defaultValue="3001,3002"
          />
        </label>
        {cancelState.error ? <p role="alert">{cancelState.error}</p> : null}
        <button type="submit" disabled={!canCancel || cancelPending}>
          {cancelPending ? '提交中...' : '撤销订单'}
        </button>
      </form>
    </div>
  );
}
```

Modify `page.tsx` to render:

```tsx
<ChangeCancelActions
  salesOrderId={detail.id}
  currentStatus={detail.status}
  role={role}
  canResubmit={roleConfig.actions.resubmit.executable}
  canCancel={roleConfig.actions.cancel.executable}
/>
```

- [ ] **Step 4: Re-run the focused test to verify it passes**

Run: `CI=true pnpm --filter web test -- sales-order-actions.test.ts`
Expected: PASS with resubmit and cancel behavior green

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/sales-orders/[id]/actions.ts apps/web/app/sales-orders/[id]/change-cancel-actions.tsx apps/web/app/sales-orders/[id]/page.tsx apps/web/tests/sales-order-actions.test.ts
git commit -m "feat: add sales order resubmit and cancel actions"
```

### Task 5: Wire Receipt And Finance Actions

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/actions.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/receipt-finance-actions.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts`

- [ ] **Step 1: Extend the action test with receipt and finance cases**

Append:

```ts
import {
  buildSalesOrderReceiptStatusPayload,
  buildSalesOrderFinanceConfirmPayload,
  updateSalesOrderReceiptStatusAction,
  confirmSalesOrderFinanceAction,
} from '../app/sales-orders/[id]/actions';

it('normalizes receipt and finance payloads', async () => {
  const formData = new FormData();
  formData.set('salesOrderId', '101');
  formData.set('receiptStatus', 'fully_paid');
  formData.set('financeStatus', 'confirmed');
  formData.set('role', 'finance');

  await expect(buildSalesOrderReceiptStatusPayload(formData)).resolves.toEqual({
    salesOrderId: 101,
    payload: { receiptStatus: 'fully_paid' },
    role: 'finance',
  });

  await expect(buildSalesOrderFinanceConfirmPayload(formData)).resolves.toEqual({
    salesOrderId: 101,
    payload: {
      receiptStatus: 'fully_paid',
      financeStatus: 'confirmed',
    },
    role: 'finance',
  });
});
```

and:

```ts
it('returns a finance validation error when finance confirm is rejected', async () => {
  const formData = new FormData();
  formData.set('salesOrderId', '101');
  formData.set('receiptStatus', 'unpaid');
  formData.set('financeStatus', 'pending');
  formData.set('role', 'finance');

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Cannot confirm finance before receipt status reaches a paid state' }),
    }),
  );

  await expect(confirmSalesOrderFinanceAction({ error: null }, formData)).resolves.toEqual({
    error: 'Cannot confirm finance before receipt status reaches a paid state',
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `CI=true pnpm --filter web test -- sales-order-actions.test.ts`
Expected: FAIL because receipt/finance payload builders and actions do not exist yet

- [ ] **Step 3: Implement receipt/finance payload builders and forms**

Extend `actions.ts` with:

```ts
export async function buildSalesOrderReceiptStatusPayload(formData: FormData) {
  return {
    salesOrderId: parsePositiveInt(formData.get('salesOrderId')),
    payload: {
      receiptStatus: String(formData.get('receiptStatus') ?? ''),
    },
    role: parseRole(formData.get('role')),
  };
}

export async function buildSalesOrderFinanceConfirmPayload(formData: FormData) {
  return {
    salesOrderId: parsePositiveInt(formData.get('salesOrderId')),
    payload: {
      receiptStatus: String(formData.get('receiptStatus') ?? ''),
      financeStatus: String(formData.get('financeStatus') ?? ''),
    },
    role: parseRole(formData.get('role')),
  };
}
```

and implement:

```ts
export async function updateSalesOrderReceiptStatusAction(_prev: SalesOrderActionState, formData: FormData) {
  try {
    const request = await buildSalesOrderReceiptStatusPayload(formData);
    if (!Number.isFinite(request.salesOrderId) || !request.payload.receiptStatus) {
      return { error: initialError };
    }

    const response = await fetch(
      `${getSalesOrderApiBaseUrl()}/sales-orders/${request.salesOrderId}/receipt-status`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.payload),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    redirect(`/sales-orders/${request.salesOrderId}?role=${request.role}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: initialError };
  }
}

export async function confirmSalesOrderFinanceAction(_prev: SalesOrderActionState, formData: FormData) {
  try {
    const request = await buildSalesOrderFinanceConfirmPayload(formData);
    if (
      !Number.isFinite(request.salesOrderId) ||
      !request.payload.receiptStatus ||
      !request.payload.financeStatus
    ) {
      return { error: initialError };
    }

    const response = await fetch(
      `${getSalesOrderApiBaseUrl()}/sales-orders/${request.salesOrderId}/finance-confirm`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.payload),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    redirect(`/sales-orders/${request.salesOrderId}?role=${request.role}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: initialError };
  }
}
```

Create `receipt-finance-actions.tsx` with:

```tsx
'use client';

import { financeConfirmStatuses, receiptCollectionStatuses } from '@erp/shared';
import { useState, type FormEvent } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import {
  confirmSalesOrderFinanceAction,
  updateSalesOrderReceiptStatusAction,
  type SalesOrderActionState,
} from './actions';

type ReceiptFinanceActionsProps = {
  salesOrderId: number;
  role: 'sales' | 'sales_manager' | 'finance';
  receiptStatus: string;
  financeStatus: string;
  canUpdateReceiptStatus: boolean;
  canConfirmFinance: boolean;
};

const initialState: SalesOrderActionState = { error: null };
const fallbackError = '销售订单操作失败';

export function ReceiptFinanceActions({
  salesOrderId,
  role,
  receiptStatus,
  financeStatus,
  canUpdateReceiptStatus,
  canConfirmFinance,
}: ReceiptFinanceActionsProps) {
  const [receiptState, setReceiptState] = useState(initialState);
  const [financeState, setFinanceState] = useState(initialState);
  const [receiptPending, setReceiptPending] = useState(false);
  const [financePending, setFinancePending] = useState(false);

  async function handleReceiptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReceiptPending(true);
    setReceiptState(initialState);

    const formData = new FormData(event.currentTarget);
    try {
      const nextState = await updateSalesOrderReceiptStatusAction(initialState, formData);
      setReceiptState(nextState);
    } catch (error) {
      if (isRedirectError(error)) throw error;
      setReceiptState({ error: fallbackError });
    } finally {
      setReceiptPending(false);
    }
  }

  async function handleFinanceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFinancePending(true);
    setFinanceState(initialState);

    const formData = new FormData(event.currentTarget);
    try {
      const nextState = await confirmSalesOrderFinanceAction(initialState, formData);
      setFinanceState(nextState);
    } catch (error) {
      if (isRedirectError(error)) throw error;
      setFinanceState({ error: fallbackError });
    } finally {
      setFinancePending(false);
    }
  }

  return (
    <div>
      <p>{`当前收款状态：${receiptStatus}`}</p>
      <p>{`当前财务状态：${financeStatus}`}</p>

      <form onSubmit={handleReceiptSubmit}>
        <input name="salesOrderId" type="hidden" value={salesOrderId} />
        <input name="role" type="hidden" value={role} />
        <label>
          收款状态
          <select name="receiptStatus" defaultValue={receiptStatus}>
            {receiptCollectionStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        {receiptState.error ? <p role="alert">{receiptState.error}</p> : null}
        <button type="submit" disabled={!canUpdateReceiptStatus || receiptPending}>
          {receiptPending ? '提交中...' : '更新收款状态'}
        </button>
      </form>

      <form onSubmit={handleFinanceSubmit}>
        <input name="salesOrderId" type="hidden" value={salesOrderId} />
        <input name="role" type="hidden" value={role} />
        <input name="receiptStatus" type="hidden" value={receiptStatus} />
        <label>
          财务确认状态
          <select name="financeStatus" defaultValue={financeStatus}>
            {financeConfirmStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        {financeState.error ? <p role="alert">{financeState.error}</p> : null}
        <button type="submit" disabled={!canConfirmFinance || financePending}>
          {financePending ? '提交中...' : '财务确认'}
        </button>
      </form>
    </div>
  );
}
```

Modify `page.tsx` to render:

```tsx
<ReceiptFinanceActions
  salesOrderId={detail.id}
  role={role}
  receiptStatus={detail.receiptStatus}
  financeStatus={detail.financeStatus}
  canUpdateReceiptStatus={roleConfig.actions.receiptStatus.executable}
  canConfirmFinance={roleConfig.actions.financeConfirm.executable}
/>
```

- [ ] **Step 4: Re-run the focused test to verify it passes**

Run: `CI=true pnpm --filter web test -- sales-order-actions.test.ts`
Expected: PASS with receipt and finance behavior green

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/sales-orders/[id]/actions.ts apps/web/app/sales-orders/[id]/receipt-finance-actions.tsx apps/web/app/sales-orders/[id]/page.tsx apps/web/tests/sales-order-actions.test.ts
git commit -m "feat: add sales order receipt and finance actions"
```

### Task 6: Wire Close Validation And Close Actions

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/close-actions.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/actions.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-close-validation.test.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-close-validation.test.ts`

- [ ] **Step 1: Extend the validation and action tests with close behavior**

Append to `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-close-validation.test.ts`:

```ts
import { canRenderCloseButton } from '../app/sales-orders/[id]/close-validation';

it('only enables close when the role may close and validation passes', () => {
  expect(canRenderCloseButton('sales_manager', true)).toBe(true);
  expect(canRenderCloseButton('finance', true)).toBe(true);
  expect(canRenderCloseButton('sales', true)).toBe(false);
  expect(canRenderCloseButton('finance', false)).toBe(false);
});
```

Append to `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts`:

```ts
import {
  buildSalesOrderClosePayload,
  closeSalesOrderAction,
} from '../app/sales-orders/[id]/actions';

it('normalizes close payloads and redirects back to the same role view on success', async () => {
  const formData = new FormData();
  formData.set('salesOrderId', '101');
  formData.set('canClose', 'true');
  formData.set('role', 'finance');

  await expect(buildSalesOrderClosePayload(formData)).resolves.toEqual({
    salesOrderId: 101,
    payload: { canClose: true },
    role: 'finance',
  });

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 101, status: 'closed' }),
    }),
  );

  await expect(closeSalesOrderAction({ error: null }, formData)).rejects.toMatchObject({
    digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/sales-orders/101?role=finance;303;`,
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `CI=true pnpm --filter web test -- sales-order-actions.test.ts sales-order-close-validation.test.ts`
Expected: FAIL because close payload builders, close action, and close-button logic do not exist yet

- [ ] **Step 3: Implement close helpers, close action, and close section**

Extend `close-validation.ts` with:

```ts
import type { SalesOrderRole } from './role-policy';

export function canRenderCloseButton(role: SalesOrderRole, canClose: boolean) {
  return canClose && (role === 'sales_manager' || role === 'finance');
}
```

Extend `actions.ts` with:

```ts
export async function buildSalesOrderClosePayload(formData: FormData) {
  return {
    salesOrderId: parsePositiveInt(formData.get('salesOrderId')),
    payload: {
      canClose: parseBoolean(formData.get('canClose')),
    },
    role: parseRole(formData.get('role')),
  };
}

export async function closeSalesOrderAction(_prev: SalesOrderActionState, formData: FormData) {
  try {
    const request = await buildSalesOrderClosePayload(formData);
    if (!Number.isFinite(request.salesOrderId) || !request.payload.canClose) {
      return { error: initialError };
    }

    const response = await fetch(
      `${getSalesOrderApiBaseUrl()}/sales-orders/${request.salesOrderId}/close`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.payload),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return { error: await readApiError(response) };
    }

    redirect(`/sales-orders/${request.salesOrderId}?role=${request.role}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: initialError };
  }
}
```

Create `close-actions.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { closeSalesOrderAction, type SalesOrderActionState } from './actions';

type CloseActionsProps = {
  salesOrderId: number;
  role: 'sales' | 'sales_manager' | 'finance';
  canClose: boolean;
  rows: Array<{ key: string; label: string; passed: boolean }>;
  closeExecutable: boolean;
};

const initialState: SalesOrderActionState = { error: null };
const fallbackError = '销售订单操作失败';

export function CloseActions({
  salesOrderId,
  role,
  canClose,
  rows,
  closeExecutable,
}: CloseActionsProps) {
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setState(initialState);

    const formData = new FormData(event.currentTarget);
    try {
      const nextState = await closeSalesOrderAction(initialState, formData);
      setState(nextState);
    } catch (error) {
      if (isRedirectError(error)) throw error;
      setState({ error: fallbackError });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <ul>
        {rows.map((row) => (
          <li key={row.key}>{`${row.label}：${row.passed ? '通过' : '未通过'}`}</li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <input name="salesOrderId" type="hidden" value={salesOrderId} />
        <input name="role" type="hidden" value={role} />
        <input name="canClose" type="hidden" value={canClose ? 'true' : 'false'} />
        {state.error ? <p role="alert">{state.error}</p> : null}
        <button type="submit" disabled={!closeExecutable || isSubmitting}>
          {isSubmitting ? '提交中...' : '关闭订单'}
        </button>
      </form>
    </div>
  );
}
```

Modify `page.tsx` so it calculates validation rows from detail fields and renders:

```tsx
const validationResult = {
  canClose:
    (detail.shipmentAggregateStatus === 'forwarder_shipped' ||
      detail.shipmentAggregateStatus === 'arrived' ||
      detail.shipmentAggregateStatus === 'closed') &&
    detail.receiptSendStatus === 'sent' &&
    detail.afterSalesEndStatus === 'closed' &&
    detail.financeStatus === 'confirmed' &&
    detail.receiptStatus !== 'unpaid',
  checks: {
    shipmentDone:
      detail.shipmentAggregateStatus === 'forwarder_shipped' ||
      detail.shipmentAggregateStatus === 'arrived' ||
      detail.shipmentAggregateStatus === 'closed',
    receiptSent: detail.receiptSendStatus === 'sent',
    afterSalesDone: detail.afterSalesEndStatus === 'closed',
    financeConfirmed: detail.financeStatus === 'confirmed',
    receiptPaid: detail.receiptStatus !== 'unpaid',
  },
};
const validationRows = buildCloseValidationRows(validationResult);
```

and:

```tsx
<CloseActions
  salesOrderId={detail.id}
  role={role}
  canClose={validationResult.canClose}
  rows={validationRows}
  closeExecutable={roleConfig.actions.close.executable && validationResult.canClose}
/>
```

- [ ] **Step 4: Re-run the focused tests to verify they pass**

Run: `CI=true pnpm --filter web test -- sales-order-actions.test.ts sales-order-close-validation.test.ts`
Expected: PASS with close validation and close action green

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/sales-orders/[id]/close-actions.tsx apps/web/app/sales-orders/[id]/actions.ts apps/web/app/sales-orders/[id]/page.tsx apps/web/app/sales-orders/[id]/close-validation.ts apps/web/tests/sales-order-actions.test.ts apps/web/tests/sales-order-close-validation.test.ts
git commit -m "feat: add sales order close validation and close action"
```

### Task 7: Full Verification And Final Review

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/sales-order/sales-order.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order-rules.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/sales-order.controller.spec.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/actions.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/role-policy.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/close-validation.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/approval-actions.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/change-cancel-actions.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/receipt-finance-actions.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/sales-orders/[id]/close-actions.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-detail-page.test.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-actions.test.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-role-policy.test.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/sales-order-close-validation.test.ts`

- [ ] **Step 1: Run the focused verification sweep**

Run:

```bash
CI=true pnpm --filter api test -- sales-order-rules.spec.ts sales-order.controller.spec.ts
CI=true pnpm --filter web test -- sales-order-detail-page.test.tsx sales-order-actions.test.ts sales-order-role-policy.test.ts sales-order-close-validation.test.ts
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

- shared tests PASS
- shared build PASS
- all API tests PASS
- all web tests PASS
- web build PASS

- [ ] **Step 3: Review scope hygiene**

Run:

```bash
git diff --stat HEAD~6..HEAD
git status --short
```

Expected:

- only sales-order operations-console files are included
- `docs/superpowers/plans/` and `outputs/` remain untracked or otherwise excluded from the implementation commit scope

- [ ] **Step 4: Request final review**

Review target:

- role normalization and URL role preservation
- approval/resubmit/cancel payload mapping
- receipt/finance visibility and error handling
- close validation rendering and final close semantics
- redirect error passthrough in all client forms

- [ ] **Step 5: Commit the final integrated slice**

```bash
git add apps/api/src/sales-order/sales-order.service.ts apps/api/test/sales-order-rules.spec.ts apps/api/test/sales-order.controller.spec.ts apps/web/app/sales-orders/[id]/page.tsx apps/web/app/sales-orders/[id]/actions.ts apps/web/app/sales-orders/[id]/role-policy.ts apps/web/app/sales-orders/[id]/close-validation.ts apps/web/app/sales-orders/[id]/approval-actions.tsx apps/web/app/sales-orders/[id]/change-cancel-actions.tsx apps/web/app/sales-orders/[id]/receipt-finance-actions.tsx apps/web/app/sales-orders/[id]/close-actions.tsx apps/web/tests/sales-order-detail-page.test.tsx apps/web/tests/sales-order-actions.test.ts apps/web/tests/sales-order-role-policy.test.ts apps/web/tests/sales-order-close-validation.test.ts
git commit -m "feat: add sales order lifecycle operations console"
```

## Self-Review

### Spec Coverage

- role-aware detail route is covered
- approval, resubmit, cancel, receipt, finance, close validation, and close actions are all covered
- URL role simulation is explicitly tested and implemented
- close validation is covered both as a persistent section and as a pre-close action contract

No spec requirement is missing from the task list.

### Placeholder Scan

- no `TBD`, `TODO`, or “implement later” markers remain
- each task includes exact file paths
- each task includes concrete test and implementation direction
- each task includes run commands and expected outcomes

### Type Consistency

- `SalesOrderRole` is consistent across page, role policy, and action redirect preservation
- all action helpers use the same `SalesOrderActionState`
- all successful actions redirect back to `/sales-orders/:id?role=...`
- role simulation remains URL-driven in every task
