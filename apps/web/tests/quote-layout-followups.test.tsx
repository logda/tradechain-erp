import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUOTE_STATUSES } from '@erp/shared';
import QuoteListPage from '../app/app/sales/quotes/page';
import QuoteDetailPage from '../app/app/sales/quotes/[id]/page';

const longName = '超长产品名称：带遥控器的可折叠落地风扇（白色、欧规、包装印客户标识）';
const lines = [
  { lineNo: 1, productId: 1, sku: 'FAN', productName: longName, quantity: 12, unit: '个', salePrice: 40, amount: 480 },
  { lineNo: 2, productId: 2, sku: 'LAMP', productName: '台灯', quantity: 3.5, unit: '箱', salePrice: 80, amount: 280 },
];
const demand = {
  id: 810, quoteNo: 'XQ810', documentType: 'demand', productSource: 'existing',
  status: 'pending_boss_approval', currentVersionNo: 1, customerId: 1,
  customerName: '测试客户', salesUserId: 2001, salesUserName: 'Zoe',
  sourceCode: 'website', requirements: '历史快照', items: lines,
  quoteAttachments: [{ fileName: '规格.pdf', mimeType: 'application/pdf', size: 10, url: '/uploads/spec.pdf' }],
};

function mockApi(detail: Record<string, unknown> = demand, listItems?: Record<string, unknown>[]) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (/\/quotes\/810(?:\?|$)/.test(url)) return { ok: true, json: async () => detail };
    if (/\/quotes\?/.test(url)) return { ok: true, json: async () => ({
      items: listItems ?? [{ ...demand, quoteId: 810, docNo: 'XQ810', title: '不应重复展示的旧标题',
        createdBy: 'Zoe', sourceType: 'website', moduleLabel: '需求单', bossConfirmed: false,
        createdAt: '2026-09-24T01:00:00.000Z', detailHref: '/quotes/810' }], total: 1, page: 1, pageSize: 20,
    }) };
    return { ok: true, json: async () => ({ items: [] }) };
  }));
}

async function renderDetail(detail: Record<string, unknown> = demand, role = 'boss') {
  mockApi(detail);
  render(await QuoteDetailPage({ params: Promise.resolve({ id: '810' }), searchParams: Promise.resolve({ role, user: role === 'sales' ? 'Zoe' : 'Mia' }) }));
}

afterEach(() => vi.unstubAllGlobals());

describe('R05 quote list and detail acceptance', () => {
  it('shows the original demand snapshot and the selected sampling note at the bottom of a derived quote', async () => {
    await renderDetail({
      ...demand,
      quoteNo: 'Q811',
      documentType: 'quote',
      status: 'customer_accepted',
      sourceDemandId: 810,
      sourceDemandNo: 'XQ810',
      sourceDemandSnapshot: demand,
      items: [{ ...lines[0], samplingInfo: '三天出样' }],
    }, 'sales');
    expect(screen.getByText('三天出样')).toBeInTheDocument();
    const source = screen.getByRole('heading', { name: '需求单信息' }).closest('article')!;
    expect(within(source).getByText('历史快照')).toBeInTheDocument();
    expect(within(source).getByText('XQ810')).toBeInTheDocument();
    expect(within(source).getByText(longName)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '转为销售订单' })).toBeInTheDocument();
  });

  it('lets the boss continue customer feedback and sales conversion on a quote', async () => {
    await renderDetail({ ...demand, documentType: 'quote', status: 'customer_accepted' }, 'boss');
    expect(screen.getByRole('button', { name: '转为销售订单' })).toBeInTheDocument();
  });

  it('offers customer feedback to the boss after inquiry pricing succeeds', async () => {
    await renderDetail({ ...demand, documentType: 'quote', status: 'pending_customer_feedback' }, 'boss');
    expect(screen.getByRole('button', { name: '保存客户反馈' })).toBeInTheDocument();
  });

  it('keeps one document row with paired full product names and quantities in eight business columns', async () => {
    mockApi();
    render(await QuoteListPage({ searchParams: Promise.resolve({ role: 'sales', user: 'Zoe' }) }));
    const table = within(screen.getByRole('region', { name: '查询结果' })).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      '单号', '类型 Type', '状态 Status', '客户 Customer', '产品 Product', '数量 Qty', '创建人 Created By', '操作 Action',
    ]);
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(2);
    const cells = within(rows[1]).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('pending_boss_approval / 待老板审批需求单');
    expect(within(cells[4]).getAllByRole('link').map((entry) => entry.textContent)).toEqual([longName, '台灯']);
    expect(within(cells[4]).getByRole('link', { name: longName })).toHaveAttribute('title', longName);
    expect(Array.from(cells[4].children).map((entry) => entry.textContent)).toEqual([`1. ${longName}`, '2. 台灯']);
    expect(Array.from(cells[5].children).map((entry) => entry.textContent)).toEqual(['1. 12 个', '2. 3.5 箱']);
    expect(screen.queryByText('不应重复展示的旧标题')).not.toBeInTheDocument();
    expect(within(cells[7]).getByRole('link', { name: '查看详情' })).toHaveAttribute('href', '/app/sales/quotes/810');
  });

  it('shows bilingual labels for every filter status and legacy secondary statuses', async () => {
    mockApi(demand, [{ docNo: 'Q1', status: 'quoted', secondaryStatus: 'pending_boss_review', customerName: '测试客户', createdBy: 'Zoe', detailHref: '/quotes/1' }]);
    render(await QuoteListPage({ searchParams: Promise.resolve({}) }));
    const options = within(screen.getByLabelText('状态 Status')).getAllByRole('option').slice(1);
    expect(options).toHaveLength(QUOTE_STATUSES.length);
    options.forEach((option) => expect(option.textContent).toMatch(/^[a-z_]+ \/ [\u4e00-\u9fff]/));
    const row = screen.getByText('Q1').closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('pending_boss_review / 待老板确认');
    expect(cells[4]).toHaveTextContent('-');
    expect(cells[5]).toHaveTextContent('-');
  });

  it('places attachments before lines and version after lines, with approval in the same actions panel', async () => {
    await renderDetail();
    const attachments = screen.getByText('附件 Attachments');
    const linesHeading = screen.getByRole('heading', { name: '需求明细' });
    const version = screen.getByText('版本 Version');
    expect(attachments.compareDocumentPosition(linesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(linesHeading.compareDocumentPosition(version) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('pending_boss_approval / 待老板审批需求单')).toBeInTheDocument();
    const actions = screen.getByRole('heading', { name: '需求单操作' }).closest('article')!;
    expect(within(actions).getByRole('button', { name: '审批通过' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '老板审批需求单' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '转为销售订单' })).not.toBeInTheDocument();
  });

  it('keeps a salesperson read-only while boss approval is pending', async () => {
    await renderDetail(demand, 'sales');
    expect(screen.getByText('当前账号仅可查看，等待老板审批。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '审批通过' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '转为销售订单' })).not.toBeInTheDocument();
  });

  it('shows one approved-demand instruction with the conversion action for its salesperson', async () => {
    await renderDetail({ ...demand, status: 'boss_approved' }, 'sales');
    const actions = screen.getByRole('heading', { name: '需求单操作' }).closest('article')!;
    expect(within(actions).getByRole('button', { name: '转为销售订单' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '审批通过' })).not.toBeInTheDocument();
    expect(screen.getAllByText(/需求单已.*可以转为销售单。/)).toHaveLength(1);
  });

  it('does not re-offer conversion after a sales order is linked', async () => {
    await renderDetail({ ...demand, status: 'ordered', linkedSalesOrderId: 900, linkedSalesOrderNo: 'S900' }, 'sales');
    expect(screen.getByRole('link', { name: 'S900' })).toHaveAttribute('href', '/app/sales/orders/900');
    expect(screen.queryByRole('button', { name: '转为销售订单' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '审批通过' })).not.toBeInTheDocument();
  });

  it('translates status and feedback history while retaining their original English codes', async () => {
    await renderDetail({ ...demand, documentType: 'quote', status: 'customer_no_follow_up',
      customerFeedbackResult: 'no_follow_up',
      versionHistory: [{ versionNo: 1, status: 'pending_customer_feedback', items: [] }],
      customerFeedbackHistory: [{ versionNo: 1, result: 'price_issue', operatedBy: 'Zoe', operatedAt: '2026-09-24T01:00:00Z' }],
    });
    expect(screen.getAllByText(/customer_no_follow_up \/ 暂无后续/).length).toBeGreaterThan(0);
    expect(screen.getByText(/pending_customer_feedback \/ 待客户反馈/)).toBeInTheDocument();
    expect(screen.getByText('no_follow_up / 暂无后续')).toBeInTheDocument();
    expect(screen.getByText(/price_issue \/ 价格有问题/)).toBeInTheDocument();
    expect(screen.getByText('报价附件 Quote Attachments')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '报价明细' })).toBeInTheDocument();
  });
});
