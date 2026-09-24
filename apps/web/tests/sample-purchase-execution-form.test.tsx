import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { refreshMock, submitFormalJsonMutationActionMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  submitFormalJsonMutationActionMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock('../app/app/_actions/formal-mutation-action', () => ({
  submitFormalJsonMutationAction: (...args: unknown[]) =>
    submitFormalJsonMutationActionMock(...args),
}));

import { SamplePurchaseExecutionForm } from '../app/app/sales/samples/sample-purchase-execution-form';

describe('SamplePurchaseExecutionForm', () => {
  beforeEach(() => {
    refreshMock.mockClear();
    submitFormalJsonMutationActionMock.mockReset();
  });

  it('submits a supplier-selected purchase unit', async () => {
    submitFormalJsonMutationActionMock.mockResolvedValue({
      ok: true,
      result: {
        id: 101,
        currentStatus: 'sampling',
      },
    });

    render(
      <SamplePurchaseExecutionForm
        endpoint="http://127.0.0.1:3001/api/samples/101/start-sampling"
        label="开始打样"
        requestHeaders={{
          'x-erp-role': 'purchase',
          'x-erp-user': 'Leo',
        }}
        currentStatus="pending_sampling"
        supplierOptions={[
          {
            id: 11,
            type: 'supplier',
            code: 'SUP-BLUE',
            name: '深圳星河工厂',
            shortName: '星河',
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '选择往来单位' }));
    fireEvent.click(screen.getByRole('button', { name: '选择采购单位' }));
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    expect(screen.queryByLabelText('采购/工厂产品编码')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('预计完成日期'), {
      target: { value: '2026-07-28' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始打样' }));

    await waitFor(() => {
      expect(submitFormalJsonMutationActionMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/samples/101/start-sampling',
        'POST',
        {
          currentStatus: 'pending_sampling',
          purchaseUnit: '深圳星河工厂',
          estimatedCompletionDate: '2026-07-28',
        },
        {
          'x-erp-role': 'purchase',
          'x-erp-user': 'Leo',
        },
        expect.stringMatching(/^[a-zA-Z0-9_-]{16,128}$/),
      );
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('submits a manually entered purchase unit', async () => {
    submitFormalJsonMutationActionMock.mockResolvedValue({
      ok: true,
      result: {
        id: 101,
        currentStatus: 'sampling',
      },
    });

    render(
      <SamplePurchaseExecutionForm
        endpoint="http://127.0.0.1:3001/api/samples/101/start-sampling"
        label="开始打样"
        requestHeaders={{
          'x-erp-role': 'purchase',
          'x-erp-user': 'Leo',
        }}
        currentStatus="pending_sampling"
        supplierOptions={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '手工填写' }));
    fireEvent.change(screen.getByRole('textbox', { name: '采购单位' }), {
      target: { value: '宁波智造工厂' },
    });
    expect(screen.queryByLabelText('采购/工厂产品编码')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('预计完成日期'), {
      target: { value: '2026-07-28' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始打样' }));

    await waitFor(() => {
      expect(submitFormalJsonMutationActionMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/samples/101/start-sampling',
        'POST',
        {
          currentStatus: 'pending_sampling',
          purchaseUnit: '宁波智造工厂',
          estimatedCompletionDate: '2026-07-28',
        },
        {
          'x-erp-role': 'purchase',
          'x-erp-user': 'Leo',
        },
        expect.stringMatching(/^[a-zA-Z0-9_-]{16,128}$/),
      );
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('submits draft execution fields when sending the sample for approval', async () => {
    submitFormalJsonMutationActionMock.mockResolvedValue({
      ok: true,
      result: {
        id: 101,
        currentStatus: 'pending_approval',
      },
    });

    render(
      <SamplePurchaseExecutionForm
        endpoint="http://127.0.0.1:3001/api/samples/101/save-draft"
        submitEndpoint="http://127.0.0.1:3001/api/samples/101/submit"
        label="保存草稿"
        submitLabel="提交样品审批"
        requestHeaders={{
          'x-erp-role': 'purchase',
          'x-erp-user': 'Leo',
        }}
        currentStatus="draft"
        supplierOptions={[
          {
            id: 11,
            type: 'supplier',
            code: 'SUP-BLUE',
            name: '深圳星河工厂',
            shortName: '星河',
          },
        ]}
        variant="draft"
      />,
    );

    fireEvent.change(screen.getByLabelText('样品要求'), {
      target: { value: 'Need updated shell sample' },
    });
    fireEvent.change(screen.getByLabelText('打样费'), {
      target: { value: '18.5' },
    });
    fireEvent.change(screen.getByLabelText('样品数量'), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: '选择采购单位' }));
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    fireEvent.change(screen.getByLabelText('预计完成日期'), {
      target: { value: '2026-07-28' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交样品审批' }));

    await waitFor(() => {
      expect(submitFormalJsonMutationActionMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/samples/101/submit',
        'POST',
        {
          currentStatus: 'draft',
          sampleRequirements: 'Need updated shell sample',
          samplingCost: 18.5,
          sampleQuantity: 8,
          purchaseUnit: '深圳星河工厂',
          estimatedCompletionDate: '2026-07-28',
        },
        {
          'x-erp-role': 'purchase',
          'x-erp-user': 'Leo',
        },
        expect.stringMatching(/^[a-zA-Z0-9_-]{16,128}$/),
      );
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('retries a failed sample action with one key and locks after success', async () => {
    submitFormalJsonMutationActionMock
      .mockResolvedValueOnce({ ok: false, error: '暂时失败' })
      .mockResolvedValueOnce({ ok: true, result: { currentStatus: 'sampling' } });
    render(<SamplePurchaseExecutionForm
      endpoint="http://127.0.0.1:3001/api/samples/101/start-sampling"
      label="开始打样"
      requestHeaders={{ 'x-erp-role': 'purchase', 'x-erp-user': 'Leo' }}
      currentStatus="pending_sampling"
      supplierOptions={[]}
    />);
    fireEvent.click(screen.getByRole('button', { name: '手工填写' }));
    fireEvent.change(screen.getByRole('textbox', { name: '采购单位' }), {
      target: { value: '宁波智造工厂' },
    });
    fireEvent.change(screen.getByLabelText('预计完成日期'), {
      target: { value: '2026-07-28' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始打样' }));
    await waitFor(() => expect(screen.getByText('暂时失败')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '开始打样' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '开始打样' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: '开始打样' })).toBeDisabled();
    expect(submitFormalJsonMutationActionMock.mock.calls).toHaveLength(2);
    expect(submitFormalJsonMutationActionMock.mock.calls[0][4]).toMatch(/^[a-zA-Z0-9_-]{16,128}$/);
    expect(submitFormalJsonMutationActionMock.mock.calls[1][4])
      .toBe(submitFormalJsonMutationActionMock.mock.calls[0][4]);
  });
});
