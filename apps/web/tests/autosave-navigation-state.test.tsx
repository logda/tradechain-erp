import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateSalesOrderForm } from '../app/app/sales/orders/new/create-sales-order-form';
import { CreateFormalQuoteForm } from '../app/app/sales/quotes/new/create-formal-quote-form';
import { autosaveSalesOrderDraftAction, createSalesOrderAction } from '../app/app/sales/orders/new/actions';
import { autosaveFormalQuoteDraftAction } from '../app/app/sales/quotes/new/actions';
vi.mock('../app/app/sales/orders/new/actions', () => ({ autosaveSalesOrderDraftAction: vi.fn(), createSalesOrderAction: vi.fn(), updateSalesOrderDraftAction: vi.fn() }));
vi.mock('../app/app/sales/quotes/new/actions', () => ({ autosaveFormalQuoteDraftAction: vi.fn(), createFormalQuoteAction: vi.fn(), updateFormalQuoteDraftAction: vi.fn() }));
const salesProps = { customerOptions: [], productOptions: [], salesUsers: [{ id: 57, label: '员工' }], defaultSalesUserId: 57, createdBy: 57, role: 'sales', user: '员工' };
const quoteProps = { ...salesProps, sourceOptions: [], actorUserId: 57 };

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); sessionStorage.clear();
  vi.mocked(autosaveSalesOrderDraftAction).mockResolvedValue({ error: null, salesOrderId: 21 });
  vi.mocked(autosaveFormalQuoteDraftAction).mockResolvedValue({ error: null, quoteId: 22 });
  URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.useRealTimers());
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(1500); });

describe('自动保存的真实状态', () => {
  it('marks immediate input as unsaved before the debounce and exposes the saved draft on return', async () => {
    const first = render(<CreateSalesOrderForm {...salesProps} />);
    fireEvent.input(screen.getByLabelText('备注 Remark'), { target: { value: '切页前内容' } });
    expect(first.container.querySelector('form')).toHaveAttribute('data-save-state', 'waiting');
    await tick();
    expect(first.container.querySelector('form')).toHaveAttribute('data-save-state', 'saved');
    first.unmount();
    render(<CreateSalesOrderForm {...salesProps} />);
    expect(screen.getByRole('link', { name: '继续编辑已保存草稿' })).toHaveAttribute('href', '/app/sales/orders/21/edit');
  });
  it('does not say saved when selected sales attachments have not uploaded', async () => {
    const view = render(<CreateSalesOrderForm {...salesProps} />);
    fireEvent.input(screen.getByLabelText('备注 Remark'), { target: { value: '备注' } }); await tick();
    fireEvent.change(screen.getByLabelText('销售单附件 Attachments'), { target: { files: [new File(['x'], '附件.pdf')] } });
    expect(screen.getByText('附件或图片尚未上传，请点击保存草稿。')).toBeInTheDocument();
    expect(view.container.querySelector('form')).not.toHaveAttribute('data-save-state', 'saved');
    expect(screen.queryByText(/^已自动保存/)).not.toBeInTheDocument();
  });
  it.each(['sales', 'quote'])('keeps %s save failure visible with a retry action', async (kind) => {
    const save = kind === 'sales' ? autosaveSalesOrderDraftAction : autosaveFormalQuoteDraftAction;
    vi.mocked(save).mockResolvedValueOnce({ error: '网络不可用' });
    const view = render(kind === 'sales' ? <CreateSalesOrderForm {...salesProps} /> : <CreateFormalQuoteForm {...quoteProps} />);
    fireEvent.input(screen.getByLabelText(kind === 'sales' ? '备注 Remark' : '需求说明 Requirements'), { target: { value: '需要保留' } });
    await tick();
    expect(view.container.querySelector('form')).toHaveAttribute('data-save-state', 'error');
    expect(screen.getByText('保存失败：网络不可用')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试保存' })); await tick();
    expect(view.container.querySelector('form')).toHaveAttribute('data-save-state', 'saved');
  });
  it('does not mark a stale request saved after input changes during the request', async () => {
    let finish!: (value: { error: null; salesOrderId: number }) => void;
    vi.mocked(autosaveSalesOrderDraftAction).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<CreateSalesOrderForm {...salesProps} />);
    fireEvent.input(screen.getByLabelText('备注 Remark'), { target: { value: '旧内容' } }); await tick();
    fireEvent.input(screen.getByLabelText('备注 Remark'), { target: { value: '新内容' } });
    await act(async () => finish({ error: null, salesOrderId: 21 }));
    expect(view.container.querySelector('form')).toHaveAttribute('data-save-state', 'waiting');
    expect(screen.queryByText(/^已自动保存/)).not.toBeInTheDocument();
    await tick(); expect(view.container.querySelector('form')).toHaveAttribute('data-save-state', 'saved');
  });
  it.each(['sales', 'quote'])('handles thrown %s requests as a retryable failure', async (kind) => {
    vi.mocked(kind === 'sales' ? autosaveSalesOrderDraftAction : autosaveFormalQuoteDraftAction).mockRejectedValueOnce(new Error('offline'));
    const view = render(kind === 'sales' ? <CreateSalesOrderForm {...salesProps} /> : <CreateFormalQuoteForm {...quoteProps} />);
    fireEvent.input(screen.getByLabelText(kind === 'sales' ? '备注 Remark' : '需求说明 Requirements'), { target: { value: '需要保留' } });
    await tick();
    expect(view.container.querySelector('form')).toHaveAttribute('data-save-state', 'error');
    expect(screen.getByText('保存失败：请检查网络后重试')).toBeInTheDocument();
  });
  it('retains newly selected quote attachments when an older upload finishes', async () => {
    let finish!: (value: any) => void;
    vi.mocked(autosaveFormalQuoteDraftAction).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<CreateFormalQuoteForm {...quoteProps} />);
    const input = screen.getByLabelText('附件 Attachments') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['a'], '原附件.pdf')] } }); await tick();
    const newer = new File(['b'], '新附件.pdf');
    fireEvent.change(input, { target: { files: [newer] } });
    await act(async () => finish({ error: null, quoteId: 22, quoteAttachments: [{ fileName: '原附件.pdf', url: '/old.pdf', mimeType: 'application/pdf', size: 1 }] }));
    expect(input.files?.[0]).toBe(newer);
    expect(screen.getByText('新附件.pdf')).toBeInTheDocument();
    expect(view.container.querySelector('form')).toHaveAttribute('data-save-state', 'waiting');
    expect(screen.queryByText(/^已自动保存/)).not.toBeInTheDocument();
  });

  it('keeps the saved-draft resume link within the actual actor account', async () => {
    const first = render(<CreateSalesOrderForm {...salesProps} />);
    fireEvent.input(screen.getByLabelText('备注 Remark'), { target: { value: '账号57' } }); await tick();
    first.unmount();
    render(<CreateSalesOrderForm {...salesProps} createdBy={58} />);
    expect(screen.queryByRole('link', { name: '继续编辑已保存草稿' })).not.toBeInTheDocument();
  });

  it('does not restore a saved attachment deleted while an older request is running', async () => {
    const attachment = { fileName: '附件A.pdf', url: '/a.pdf', mimeType: 'application/pdf', size: 1 };
    let finish!: (value: any) => void;
    vi.mocked(autosaveFormalQuoteDraftAction).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<CreateFormalQuoteForm {...quoteProps} initialQuote={{ id: 22, quoteAttachments: [attachment] }} />);
    fireEvent.input(screen.getByLabelText('需求说明 Requirements'), { target: { value: '先修改文字' } }); await tick();
    fireEvent.click(screen.getByRole('button', { name: '删除附件附件A.pdf' }));
    await act(async () => finish({ error: null, quoteId: 22, quoteAttachments: [attachment] }));
    expect(screen.queryByRole('button', { name: '删除附件附件A.pdf' })).not.toBeInTheDocument();
    await tick();
    expect(vi.mocked(autosaveFormalQuoteDraftAction).mock.calls.at(-1)?.[0].get('existingQuoteAttachments')).toBe('[]');
  });

  it('marks button-only quote mode changes unsaved and saves the new mode', async () => {
    const view = render(<CreateFormalQuoteForm {...quoteProps} />);
    fireEvent.input(screen.getByLabelText('需求说明 Requirements'), { target: { value: '已经保存' } }); await tick();
    fireEvent.click(screen.getByRole('button', { name: '手填新产品' }));
    expect(view.container.querySelector('form')).toHaveAttribute('data-save-state', 'waiting');
    await tick();
    expect(vi.mocked(autosaveFormalQuoteDraftAction).mock.calls.at(-1)?.[0].get('productEntryMode')).toBe('candidate');
  });
  it('marks a sales customer selected by button unsaved without typing in the picker', async () => {
    const view = render(<CreateSalesOrderForm {...salesProps} customerOptions={[{ id: 2, type: 'customer', code: 'CP-B', name: '乙客户' }]} />);
    fireEvent.input(screen.getByLabelText('备注 Remark'), { target: { value: '已经保存' } }); await tick();
    fireEvent.click(screen.getByRole('button', { name: '选择往来单位' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '选择' }));
    expect(view.container.querySelector('form')).toHaveAttribute('data-save-state', 'waiting');
    await tick();
    expect(vi.mocked(autosaveSalesOrderDraftAction).mock.calls.at(-1)?.[0].get('customerId')).toBe('2');
  });

  it('locks sales inputs during a manual save and unlocks them on failure', async () => {
    let finish!: (value: { error: string }) => void;
    vi.mocked(createSalesOrderAction).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<CreateSalesOrderForm {...salesProps} />);
    fireEvent.submit(view.container.querySelector('form')!);
    expect(screen.getByLabelText('备注 Remark')).toBeDisabled();
    await act(async () => finish({ error: '保存失败' }));
    expect(screen.getByLabelText('备注 Remark')).not.toBeDisabled();
    expect(view.container.querySelector('form')).toHaveAttribute('data-save-state', 'error');
  });

});
