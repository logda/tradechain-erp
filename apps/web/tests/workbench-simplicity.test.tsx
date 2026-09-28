import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SalesPage from '../app/app/sales/page';
import PurchasePage from '../app/app/purchase/page';
import OperationsPage from '../app/app/operations/page';

vi.mock('next/navigation', async (original) => ({ ...await original<typeof import('next/navigation')>(), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../app/app/_components/live-todo-count', () => ({ LiveTodoCount: () => null }));
afterEach(() => vi.unstubAllGlobals());

describe('工作台入口去重', () => {
  it.each([
    ['销售', SalesPage, ['/app/sales/quotes']],
    ['采购', PurchasePage, ['/app/warehouses', '/app/todos#purchase']],
    ['运营', OperationsPage, ['/app/inventory']],
  ] as const)('%s keeps one entry per destination and no demonstration copy', async (_name, page, destinations) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { container } = render(await page({}));
    const body = container.querySelector('.erp-shell__body')!;
    for (const destination of destinations) expect(body.querySelectorAll(`a[href="${destination}"]`)).toHaveLength(1);
    expect(body.textContent).not.toMatch(/正式模块|已接通|演示完整闭环|跳转到正式/);
  });
});
