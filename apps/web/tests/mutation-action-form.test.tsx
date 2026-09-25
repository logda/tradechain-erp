import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MutationActionForm } from '../app/app/_components/mutation-action-form';

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

describe('MutationActionForm', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    pushMock.mockClear();
    refreshMock.mockClear();
    window.history.replaceState({}, '', '/app/sales/orders/1?role=sales&user=Zoe');
  });

  it('sends the formal role and user headers from the current URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'draft' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MutationActionForm
        endpoint="http://127.0.0.1:3001/api/sales-orders/1/resubmit"
        label="重提审批"
        fields={[
          {
            name: 'currentStatus',
            value: 'draft',
          },
          {
            name: 'changeReason',
            value: '接口权限测试',
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '重提审批' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/sales-orders/1/resubmit',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-erp-role': 'sales',
            'x-erp-user': 'Zoe',
          }),
        }),
      );
    });
  });

  it('disables the action button when the current session lacks the required action permission', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(
      {},
      '',
      `/app/sales/orders/1?role=sales&user=Zoe&access=${encodeURIComponent(
        JSON.stringify({
          modules: ['sales'],
          dataScope: 'own_sales',
          actions: ['sales.quote.write'],
        }),
      )}`,
    );

    render(
      <MutationActionForm
        endpoint="http://127.0.0.1:3001/api/sales-orders/1/resubmit"
        label="重提审批"
        requiredAction="sales.order.write"
        requiredActionLabel="销售单操作"
        fields={[
          {
            name: 'currentStatus',
            value: 'draft',
          },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: '重提审批' })).toBeDisabled();
    expect(screen.getByText('无权限执行：销售单操作')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重提审批' }));

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('keeps legacy demo actions usable when there is no formal session in the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ financeStatus: 'confirmed' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/sales-orders/1');

    render(
      <MutationActionForm
        endpoint="http://127.0.0.1:3001/api/sales-orders/1/finance-confirm"
        label="财务确认"
        requiredAction="finance.confirm"
        requiredActionLabel="财务确认"
        fields={[
          {
            name: 'financeStatus',
            value: 'pending',
          },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: '财务确认' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '财务确认' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/sales-orders/1/finance-confirm',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  it('redirects to the created document detail page after a successful mutation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 601,
        docNo: 'SI202607140601',
        status: 'draft',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/app/purchase-orders/101?role=purchase&user=Leo');

    render(
      <MutationActionForm
        endpoint="http://127.0.0.1:3001/api/stock-in"
        label="生成收货单"
        successRedirectBasePath="/app/stock-in"
        fields={[
          {
            name: 'sourceBizType',
            value: 'purchase_order',
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '生成收货单' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith('/app/stock-in/601');
    });
  });

  it('calls the local success callback after a successful mutation without redirecting', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 88,
        status: 'inactive',
        deactivatedReason: '业务停用',
      }),
    });
    const onSuccess = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MutationActionForm
        endpoint="http://127.0.0.1:3001/api/counterparties/88/deactivate"
        label="停用"
        fields={[
          { name: 'operatedBy', value: 'Admin' },
          { name: 'reason', value: '业务停用' },
        ]}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '停用' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith({
        id: 88,
        status: 'inactive',
        deactivatedReason: '业务停用',
      });
      expect(pushMock).not.toHaveBeenCalled();
      expect(refreshMock).not.toHaveBeenCalled();
    });
  });

  it('refreshes the current page after a successful mutation when no local callback or redirect is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 101,
        status: 'pending_sales_manager_approval',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MutationActionForm
        endpoint="http://127.0.0.1:3001/api/sales-orders/101/resubmit"
        label="重提审批"
        fields={[
          { name: 'currentStatus', value: 'purchasing' },
          { name: 'changeReason', value: '正式页重提审批' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '重提审批' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(refreshMock).toHaveBeenCalledTimes(1);
      expect(pushMock).not.toHaveBeenCalled();
    });
  });

  it('asks for confirmation before creating a sample draft and redirects to its detail page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 601,
        currentStatus: 'draft',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MutationActionForm
        endpoint="http://127.0.0.1:3001/api/samples"
        label="创建样品单"
        confirmMessage="该报价单已存在 2 张样品单，确认继续创建新的样品单？"
        successRedirectBasePath="/app/sales/samples"
        fields={[
          { name: 'quoteOrderId', value: 7, dataType: 'number' },
          { name: 'quoteVersionNo', value: 3, dataType: 'number' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '创建样品单' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('该报价单已存在 2 张样品单，确认继续创建新的样品单？');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '创建样品单' }));
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith('/app/sales/samples/601');
    });
  });

  it('renders editable action fields and submits updated values', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 101,
        currentStatus: 'sampling',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/app/sales/samples/101?role=purchase&user=Leo');

    render(
      <MutationActionForm
        endpoint="http://127.0.0.1:3001/api/samples/101/start-sampling"
        label="开始打样"
        fields={[
          { name: 'currentStatus', value: 'pending_sampling' },
          {
            name: 'purchaseUnit',
            value: '深圳星河工厂',
            display: 'input',
            label: '采购单位',
            required: true,
          },
          {
            name: 'estimatedCompletionDate',
            value: '2026-07-28',
            display: 'input',
            label: '预计完成日期',
            inputType: 'date',
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^采购单位 \*/), {
      target: { value: '宁波智造工厂' },
    });
    fireEvent.change(screen.getByLabelText('预计完成日期'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始打样' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as { body?: string };
    expect(JSON.parse(requestInit.body ?? '{}')).toMatchObject({
      currentStatus: 'pending_sampling',
      purchaseUnit: '宁波智造工厂',
      estimatedCompletionDate: '2026-08-01',
    });
  });

  it('shows generated purchase order numbers in the project dialog and refreshes after dismissal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 101,
        status: 'purchasing',
        purchaseOrders: [
          { id: 301, purchaseNo: 'P202607110301' },
          { id: 302, purchaseNo: 'P202607110302' },
        ],
      }),
    });
    const alertMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('alert', alertMock);

    render(
      <MutationActionForm
        endpoint="http://127.0.0.1:3001/api/sales-orders/101/approve"
        label="审批通过"
        fields={[
          { name: 'currentStatus', value: 'pending_sales_manager_approval' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '审批通过' }));

    const notice = await screen.findByRole('alertdialog');
    expect(notice).toHaveTextContent('已生成 2 张采购单');
    expect(notice).toHaveTextContent('P202607110301');
    expect(notice).toHaveTextContent('P202607110302');
    expect(notice).toHaveTextContent('请提醒销售和采购及时跟进');
    expect(alertMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '知道了' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '审批通过' })).toBeDisabled();
  });

  it('locks a successful action while its old view remains and sends one request key', async () => {
    let finish!: (response: unknown) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => {
      finish = resolve;
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<MutationActionForm
      endpoint="http://127.0.0.1:3001/api/sales-orders/101/approve"
      label="审批通过"
      fields={[{ name: 'currentStatus', value: 'pending_sales_manager_approval' }]}
    />);
    const button = screen.getByRole('button', { name: '审批通过' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: '提交中...' })).toBeDisabled();

    finish({ ok: true, json: async () => ({ status: 'purchasing' }) });
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: '审批通过' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '审批通过' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(headers['Idempotency-Key']).toMatch(/^[a-zA-Z0-9_-]{16,128}$/);
  });

  it('allows retry after failure with the same request key', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ message: '暂时失败' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'submitted' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<MutationActionForm
      endpoint="http://127.0.0.1:3001/api/sales-orders/101/submit"
      label="提交审批"
      fields={[{ name: 'currentStatus', value: 'draft' }]}
    />);

    fireEvent.click(screen.getByRole('button', { name: '提交审批' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('暂时失败'));
    expect(screen.getByRole('button', { name: '提交审批' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '提交审批' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '提交审批' })).toBeDisabled());
    const firstHeaders = (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    const secondHeaders = (fetchMock.mock.calls[1][1] as { headers: Record<string, string> }).headers;
    expect(secondHeaders['Idempotency-Key']).toBe(firstHeaders['Idempotency-Key']);
  });
});
