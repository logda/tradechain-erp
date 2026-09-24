import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

import { InquiryComparisonSubmitForm } from '../app/app/sales/inquiries/[id]/inquiry-comparison-submit-form';

describe('InquiryComparisonSubmitForm', () => {
  beforeEach(() => {
    refreshMock.mockClear();
    submitFormalJsonMutationActionMock.mockReset();
  });

  it('submits selected and manual supplier quotes entered by the user', async () => {
    submitFormalJsonMutationActionMock.mockResolvedValue({
      ok: true,
      result: {
        id: 13,
        status: 'pending_boss_review',
      },
    });

    render(
      <InquiryComparisonSubmitForm
        endpoint="http://127.0.0.1:3001/api/quote-inquiries/13/submit-for-comparison"
        label="提交比价"
        requestHeaders={{
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
        }}
        supplierOptions={[
          {
            id: 2,
            type: 'supplier',
            code: 'SUP-BRAVO',
            name: 'Bravo Industrial',
            shortName: '光源制造',
          },
        ]}
        items={[
          {
            itemId: 1301,
            lineNo: 1,
            productName: 'USB-C 线缆',
            requiredSupplierCount: 2,
            supplierQuotes: [],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '选择供应商' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    fireEvent.change(screen.getByLabelText('行 1 采购价 1'), {
      target: { value: '18.6' },
    });
    expect(screen.getByLabelText('行 1 采购价 1')).toHaveClass('erp-control');
    expect(screen.getByRole('button', { name: '提交比价' })).toHaveClass(
      'erp-button--primary',
    );
    fireEvent.change(screen.getByLabelText('行 1 产品尺寸 1'), {
      target: { value: '40×30×10' },
    });
    fireEvent.change(screen.getByLabelText('行 1 产品材质 1'), {
      target: { value: 'PVC镭射' },
    });
    fireEvent.change(screen.getByLabelText('行 1 产品包装 1'), {
      target: { value: 'OPP袋/个' },
    });
    fireEvent.change(screen.getByLabelText('行 1 产品重量 1'), {
      target: { value: '180' },
    });
    fireEvent.change(screen.getByLabelText('行 1 大货交期 1'), {
      target: { value: '7-10' },
    });
    fireEvent.change(screen.getByLabelText('行 1 装箱数 1'), {
      target: { value: '120' },
    });
    fireEvent.change(screen.getByLabelText('行 1 外箱尺寸 1'), {
      target: { value: '55×45×40' },
    });
    fireEvent.change(screen.getByLabelText('行 1 外箱毛重 1'), {
      target: { value: '24' },
    });
    fireEvent.change(screen.getByLabelText('行 1 备注 1'), {
      target: { value: '打样 2 天，费用 200 元' },
    });
    fireEvent.click(
      within(screen.getByRole('group', { name: '行 1 录入方式 2' })).getByRole('button', {
        name: '手工填写',
      }),
    );
    fireEvent.change(screen.getByLabelText('行 1 手写供应商 2'), {
      target: { value: '深圳快联电子' },
    });
    fireEvent.change(screen.getByLabelText('行 1 采购价 2'), {
      target: { value: '19.2' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交比价' }));

    await waitFor(() => {
      expect(submitFormalJsonMutationActionMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/quote-inquiries/13/submit-for-comparison',
        'POST',
        {
          items: [
            {
              itemId: 1301,
              supplierQuotes: [
                {
                  supplierSourceMode: 'counterparty',
                  supplierId: 2,
                  supplierCode: 'SUP-BRAVO',
                  supplierName: 'Bravo Industrial',
                  purchasePrice: 18.6,
                  productSizeCm: '40×30×10',
                  productMaterial: 'PVC镭射',
                  productPackaging: 'OPP袋/个',
                  productWeightG: 180,
                  bulkLeadTimeDays: '7-10',
                  cartonQuantity: 120,
                  outerCartonSizeCm: '55×45×40',
                  outerCartonGrossWeightKg: 24,
                  remark: '打样 2 天，费用 200 元',
                },
                {
                  supplierSourceMode: 'manual',
                  supplierName: '深圳快联电子',
                  purchasePrice: 19.2,
                  productSizeCm: undefined,
                  productMaterial: undefined,
                  productPackaging: undefined,
                  productWeightG: undefined,
                  bulkLeadTimeDays: undefined,
                  cartonQuantity: undefined,
                  outerCartonSizeCm: undefined,
                  outerCartonGrossWeightKg: undefined,
                  remark: undefined,
                },
              ],
            },
          ],
        },
        {
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
        },
        expect.stringMatching(/^[a-zA-Z0-9_-]{16,128}$/),
      );
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('blocks submission when fewer than two valid supplier quotes are provided', async () => {
    render(
      <InquiryComparisonSubmitForm
        endpoint="http://127.0.0.1:3001/api/quote-inquiries/13/submit-for-comparison"
        label="提交比价"
        supplierOptions={[
          {
            id: 2,
            type: 'supplier',
            code: 'SUP-BRAVO',
            name: 'Bravo Industrial',
            shortName: '光源制造',
          },
        ]}
        items={[
          {
            itemId: 1301,
            lineNo: 1,
            productName: 'USB-C 线缆',
            requiredSupplierCount: 2,
            supplierQuotes: [],
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText('行 1 供应商 1'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('行 1 采购价 1'), {
      target: { value: '18.6' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交比价' }));

    await waitFor(() => {
      expect(
        screen.getByText('第 1 行至少录入 2 条有效供应商报价。'),
      ).toBeInTheDocument();
      expect(submitFormalJsonMutationActionMock).not.toHaveBeenCalled();
    });
  });

  it('disables comparison submission when there are no inquiry items', () => {
    render(
      <InquiryComparisonSubmitForm
        endpoint="http://127.0.0.1:3001/api/quote-inquiries/13/submit-for-comparison"
        label="提交比价"
        supplierOptions={[]}
        items={[]}
      />,
    );

    expect(
      screen.getByText('询价单没有可提交的明细，请先确认来源报价明细。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交比价' })).toBeDisabled();
  });
});
