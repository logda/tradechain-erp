import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CounterpartyTableRow } from '../app/app/master-data/counterparties/counterparty-table-row';
import { CreateCounterpartyForm } from '../app/app/master-data/counterparties/create-counterparty-form';
import { UpdateCounterpartyForm } from '../app/app/master-data/counterparties/update-counterparty-form';
import AppCounterpartiesPage from '../app/app/master-data/counterparties/page';

const mockAssignableUsers = [
  {
    id: 1,
    username: 'admin',
    realName: '系统管理员',
    roleCode: 'admin',
    status: 'active',
    fullAccess: true,
  },
  {
    id: 2,
    username: 'mia',
    realName: 'Mia',
    roleCode: 'boss',
    status: 'active',
    fullAccess: true,
  },
  {
    id: 3,
    username: 'sara',
    realName: 'Sara',
    roleCode: 'sales_manager',
    status: 'active',
    fullAccess: false,
  },
  {
    id: 4,
    username: 'zoe',
    realName: 'Zoe',
    roleCode: 'sales',
    status: 'active',
    fullAccess: false,
  },
  {
    id: 5,
    username: 'peter',
    realName: 'Peter',
    roleCode: 'purchase_manager',
    status: 'active',
    fullAccess: false,
  },
  {
    id: 6,
    username: 'leo',
    realName: 'Leo',
    roleCode: 'purchase',
    status: 'active',
    fullAccess: false,
  },
];

describe('formal counterparty master data page', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders customer and supplier master data for admin users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/admin/users?')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: mockAssignableUsers,
              total: mockAssignableUsers.length,
              page: 1,
              pageSize: 200,
            }),
          });
        }
        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 1,
                  bizType: 'counterparty',
                  bizId: 1,
                  operationType: 'create_counterparty',
                  operatorId: 1,
                  beforeData: null,
                  afterData: { code: 'CUST-ACME' },
                  createdAt: '2026-07-13T09:00:00.000Z',
                },
              ],
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
            {
              id: 1,
              type: 'customer',
              code: 'CUST-ACME',
              name: 'Acme Trading',
              shortName: '',
              contactName: 'Amy Chen',
              phone: '+1-202-555-0101',
              region: 'United States',
              address: 'Los Angeles Harbor 88 号',
              bankName: 'Bank of America',
              bankAccount: '1234567890',
              remark: '北美客户',
              ownerName: 'Zoe',
              status: 'active',
              createdAt: '2026-07-11T09:00:00.000Z',
              createdBy: 'system',
            },
            {
              id: 2,
              type: 'supplier',
              code: 'SUP-BRAVO',
              name: 'Bravo Industrial',
              shortName: '',
              contactName: 'Ben Li',
              phone: '+86-755-5555-0102',
              region: 'Shenzhen',
              address: 'Shenzhen Baoan 99 号',
              bankName: '平安银行深圳分行',
              bankAccount: '6222000000000002',
              remark: '华南供应商',
              ownerName: 'Leo',
              status: 'active',
              createdAt: '2026-07-11T09:05:00.000Z',
              createdBy: 'system',
              },
            {
              id: 3,
              type: 'customer',
              code: 'CUST-BLANK',
              name: 'Blank Trading',
              shortName: 'Blank',
              contactName: '',
              phone: '',
              region: '',
              address: '',
              bankName: '',
              bankAccount: '',
              remark: '',
              ownerName: '',
              status: 'inactive',
              createdAt: '2026-07-11T09:06:00.000Z',
              createdBy: 'system',
              deactivatedReason: '业务停用',
              },
            ],
            total: 3,
            page: 1,
            pageSize: 20,
          }),
        });
      }),
    );

    render(
      <>
        {await AppCounterpartiesPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '往来单位主数据' })).toBeInTheDocument();
    expect(screen.getByText('Acme Trading')).toBeInTheDocument();
    expect(screen.getByText('Bravo Industrial')).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === '中文名称: 星河贸易'),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === '中文名称: 光源制造'),
    ).toBeInTheDocument();
    expect(screen.getByText('Bank of America')).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Zoe / 销售' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Leo / 采购' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('未填写').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '新增往来单位' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toHaveClass(
      'erp-button',
      'erp-button--primary',
    );
    expect(screen.getByRole('textbox', { name: '筛选关键词 Keyword' })).toHaveClass(
      'erp-control',
    );
    expect(screen.getAllByRole('button', { name: '停用' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '启用' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '单位名称 / 中文名称' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建往来单位 / create_counterparty')).toBeInTheDocument();
  });

  it('keeps list row editors collapsed by default and expands on demand', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/admin/users?')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: mockAssignableUsers,
              total: mockAssignableUsers.length,
              page: 1,
              pageSize: 200,
            }),
          });
        }
        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                type: 'customer',
                code: 'CUST-ACME',
                name: 'Acme Trading',
                shortName: 'Acme',
                contactName: 'Amy Chen',
                phone: '+1-202-555-0101',
                region: 'United States',
                address: 'Los Angeles Harbor 88 号',
                bankName: 'Bank of America',
                bankAccount: '1234567890',
                remark: '北美客户',
                ownerName: 'Zoe',
                status: 'active',
                createdAt: '2026-07-11T09:00:00.000Z',
                createdBy: 'system',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }),
    );

    render(
      <>
        {await AppCounterpartiesPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.queryByRole('button', { name: '保存编辑' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));

    expect(screen.getByRole('button', { name: '保存编辑' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起编辑' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭面板' })).toBeInTheDocument();
  });

  it('passes pagination params to the counterparty api and renders pagination controls', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/admin/users?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: mockAssignableUsers,
            total: mockAssignableUsers.length,
            page: 1,
            pageSize: 200,
          }),
        });
      }
      if (url.includes('/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 21,
              type: 'customer',
              code: 'CUST-021',
              name: 'Paged Customer',
              shortName: 'Paged',
              contactName: 'Amy',
              phone: '13800000000',
              region: 'Shenzhen',
              address: 'Shenzhen Nanshan 18 号',
              bankName: '招商银行深圳分行',
              bankAccount: '6222000000000021',
              remark: '分页测试',
              ownerName: 'Zoe',
              status: 'active',
              createdAt: '2026-07-11T09:00:00.000Z',
              createdBy: 'system',
            },
          ],
          total: 25,
          page: 2,
          pageSize: 20,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppCounterpartiesPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
            page: '2',
            pageSize: '20',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/counterparties?page=2&pageSize=20'),
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(screen.getByText('第 2 / 2 页，共 25 条')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '上一页' })).toHaveAttribute(
      'href',
      expect.stringContaining('page=1'),
    );
  });

  it('limits sales users to customer records by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppCounterpartiesPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/counterparties?type=customer'),
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(screen.getByText('当前角色默认查看：客户 Customer')).toBeInTheDocument();
  });

  it('hides counterparty maintenance actions from sales users without master data write scope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                type: 'customer',
                code: 'CUST-ACME',
                name: 'Acme Trading',
                shortName: 'Acme',
                region: 'United States',
                contactName: 'Amy Chen',
                phone: '+1-202-555-0101',
                address: 'Los Angeles Harbor 88 号',
                bankName: 'Bank of America',
                bankAccount: '1234567890',
                remark: '北美客户',
                ownerName: 'Zoe',
                status: 'active',
                createdAt: '2026-07-11T09:00:00.000Z',
                createdBy: 'system',
              },
            ],
          }),
        });
      }),
    );

    render(
      <>
        {await AppCounterpartiesPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['sales'],
                dataScope: 'own_sales',
                actions: ['sales.quote.write', 'sales.order.write'],
              }),
            ),
          }),
        })}
      </>,
    );

    expect(screen.getByText('Acme Trading')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '只读权限说明' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '新增往来单位' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '新增往来单位' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '保存' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '停用' }),
    ).not.toBeInTheDocument();
  });

  it('submits create counterparty form payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 9, code: 'CUST-OMEGA', status: 'active' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CreateCounterpartyForm
        endpoint="http://127.0.0.1:3001/api/counterparties"
        createdBy="Admin"
        allowedTypes={['customer', 'supplier', 'both']}
        ownerOptions={mockAssignableUsers}
        actorAccessScopes={{
          modules: ['admin'],
          dataScope: 'all',
          actions: ['master_data.write'],
        }}
      />,
    );

    fireEvent.change(screen.getAllByLabelText('类型 Type')[0]!, {
      target: { value: 'customer' },
    });
    fireEvent.change(screen.getByLabelText('编码 Code'), {
      target: { value: 'CUST-OMEGA' },
    });
    fireEvent.change(screen.getByLabelText('单位名称 Name'), {
      target: { value: 'Omega Retail' },
    });
    fireEvent.change(screen.getByLabelText('中文名称 Chinese Name'), {
      target: { value: 'Omega' },
    });
    fireEvent.change(screen.getByLabelText('所属区域 Region'), {
      target: { value: 'Shanghai' },
    });
    fireEvent.change(screen.getByLabelText('所属人员 Owner'), {
      target: { value: 'Zoe' },
    });
    fireEvent.change(screen.getByLabelText('联系人 Contact'), {
      target: { value: 'Olivia' },
    });
    fireEvent.change(screen.getByLabelText('联系号码 Phone'), {
      target: { value: '13900000000' },
    });
    fireEvent.change(screen.getByLabelText('地址 Address'), {
      target: { value: 'Shanghai Pudong 88 号' },
    });
    fireEvent.change(screen.getByLabelText('开户银行 Bank'), {
      target: { value: '招商银行上海分行' },
    });
    fireEvent.change(screen.getByLabelText('银行账号 Bank Account'), {
      target: { value: '6222000000000088' },
    });
    fireEvent.change(screen.getByLabelText('备注 Remark'), {
      target: { value: '演示客户' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新增往来单位' }));

    await waitFor(() => {
      expect(screen.getByText('新增成功，请刷新查看最新往来单位。')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/counterparties',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('CUST-OMEGA'),
        headers: expect.objectContaining({
          'x-erp-actions': 'master_data.write',
        }),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: expect.stringContaining('"shortName":"Omega"'),
    });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: expect.stringContaining('"bankAccount":"6222000000000088"'),
    });
  });

  it('inserts the created counterparty into the current list without manual refresh', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/admin/users?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: mockAssignableUsers,
            total: mockAssignableUsers.length,
            page: 1,
            pageSize: 200,
          }),
        });
      }
      if (url.includes('/counterparties/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }
      if (url.includes('/counterparties') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 9,
            code: 'CUST-OMEGA',
            status: 'active',
            createdAt: '2026-07-18T09:00:00.000Z',
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 1,
              type: 'customer',
              code: 'CUST-ACME',
              name: 'Acme Trading',
              shortName: 'Acme',
              region: 'United States',
              ownerName: 'Zoe',
              contactName: 'Amy Chen',
              phone: '+1-202-555-0101',
              address: 'Los Angeles Harbor 88 号',
              bankName: 'Bank of America',
              bankAccount: '1234567890',
              remark: '北美客户',
              status: 'active',
              createdAt: '2026-07-11T09:00:00.000Z',
              createdBy: 'system',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppCounterpartiesPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    fireEvent.change(screen.getAllByLabelText('类型 Type')[0]!, {
      target: { value: 'customer' },
    });
    fireEvent.change(screen.getByLabelText('编码 Code'), {
      target: { value: 'CUST-OMEGA' },
    });
    fireEvent.change(screen.getByLabelText('单位名称 Name'), {
      target: { value: 'Omega Retail' },
    });
    fireEvent.change(screen.getByLabelText('所属人员 Owner'), {
      target: { value: 'Zoe' },
    });
    fireEvent.change(screen.getByLabelText('联系人 Contact'), {
      target: { value: 'Olivia' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新增往来单位' }));

    await waitFor(() => {
      expect(screen.getByText('Omega Retail')).toBeInTheDocument();
      expect(screen.getByText('CUST-OMEGA')).toBeInTheDocument();
    });
    expect(screen.queryByText('新增成功，请刷新查看最新往来单位。')).not.toBeInTheDocument();
  });

  it('filters owner options by counterparty type in create form', () => {
    render(
      <CreateCounterpartyForm
        endpoint="http://127.0.0.1:3001/api/counterparties"
        createdBy="Admin"
        allowedTypes={['customer', 'supplier', 'both']}
        ownerOptions={mockAssignableUsers}
      />,
    );

    expect(screen.getByRole('option', { name: 'Zoe / 销售' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Leo / 采购' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('类型 Type'), {
      target: { value: 'supplier' },
    });

    expect(screen.getByRole('option', { name: 'Leo / 采购' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Zoe / 销售' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('类型 Type'), {
      target: { value: 'both' },
    });

    expect(screen.getByRole('option', { name: 'Zoe / 销售' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Leo / 采购' })).toBeInTheDocument();
  });

  it('shows unified required field validation before submitting create form', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CreateCounterpartyForm
        endpoint="http://127.0.0.1:3001/api/counterparties"
        createdBy="Admin"
        allowedTypes={['customer', 'supplier', 'both']}
        ownerOptions={mockAssignableUsers}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '新增往来单位' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          '请完整填写以下必填项：单位编码、单位名称',
        ),
      ).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps create form core required fields and aligned control heights', () => {
    render(
      <CreateCounterpartyForm
        endpoint="http://127.0.0.1:3001/api/counterparties"
        createdBy="Admin"
        allowedTypes={['customer', 'supplier', 'both']}
        ownerOptions={mockAssignableUsers}
      />,
    );

    expect(screen.getByLabelText('编码 Code')).toHaveStyle({ minHeight: '46px' });
    expect(screen.getByLabelText('单位名称 Name')).toHaveStyle({ minHeight: '46px' });
    expect(screen.getByLabelText('所属人员 Owner')).toHaveStyle({ minHeight: '46px' });

    expect(screen.getByText(/编码 Code/).parentElement).toHaveTextContent('*');
    expect(screen.getByText(/单位名称 Name/).parentElement).toHaveTextContent('*');
    expect(screen.getByText(/所属人员 Owner/).parentElement).toHaveTextContent('*');
    expect(screen.getByText(/中文名称 Chinese Name/).parentElement).not.toHaveTextContent('*');
    expect(screen.getByText(/联系人 Contact/).parentElement).not.toHaveTextContent('*');
  });

  it('renders labeled edit fields and owner select in update form', () => {
    render(
      <UpdateCounterpartyForm
        endpoint="http://127.0.0.1:3001/api/counterparties/1"
        updatedBy="Admin"
        allowedTypes={['customer', 'supplier', 'both']}
        ownerOptions={mockAssignableUsers}
        item={{
          id: 1,
          type: 'customer',
          code: 'CUST-ACME',
          name: 'Acme Trading',
          shortName: 'Acme',
          region: 'Shanghai',
          ownerName: 'Zoe',
          contactName: '王经理',
          phone: '13800000001',
          address: '',
          bankName: '',
          bankAccount: '',
          remark: '',
        }}
      />,
    );

    expect(screen.getByText('单位编码 Code')).toBeInTheDocument();
    expect(screen.getByText('地址 Address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入地址')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入开户银行')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sara / 销售主管' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Leo / 采购' })).not.toBeInTheDocument();
  });

  it('keeps update form core required fields and aligned control heights', () => {
    render(
      <UpdateCounterpartyForm
        endpoint="http://127.0.0.1:3001/api/counterparties/1"
        updatedBy="Admin"
        allowedTypes={['customer', 'supplier', 'both']}
        ownerOptions={mockAssignableUsers}
        item={{
          id: 1,
          type: 'customer',
          code: 'CUST-ACME',
          name: 'Acme Trading',
          shortName: 'Acme',
          region: 'Shanghai',
          ownerName: 'Zoe',
          contactName: 'Amy',
          phone: '13800000000',
          address: '',
          bankName: '',
          bankAccount: '',
          remark: '',
        }}
      />,
    );

    expect(screen.getByLabelText('编码 Code CUST-ACME')).toHaveStyle({ minHeight: '42px' });
    expect(screen.getByLabelText('单位名称 Name CUST-ACME')).toHaveStyle({ minHeight: '42px' });
    expect(screen.getByLabelText('所属人员 Owner CUST-ACME')).toHaveStyle({ minHeight: '42px' });

    expect(screen.getByText(/单位编码 Code/).parentElement).toHaveTextContent('*');
    expect(screen.getByText(/单位名称 Name/).parentElement).toHaveTextContent('*');
    expect(screen.getByText(/所属人员 Owner/).parentElement).toHaveTextContent('*');
    expect(screen.getByText(/中文名称 Chinese Name/).parentElement).not.toHaveTextContent('*');
    expect(screen.getByText(/联系人 Contact/).parentElement).not.toHaveTextContent('*');
  });

  it('shows unified required field validation before submitting update form', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <UpdateCounterpartyForm
        endpoint="http://127.0.0.1:3001/api/counterparties/1"
        updatedBy="Admin"
        allowedTypes={['customer', 'supplier', 'both']}
        ownerOptions={mockAssignableUsers}
        item={{
          id: 1,
          type: 'customer',
          code: 'CUST-ACME',
          name: 'Acme Trading',
          shortName: 'Acme',
          region: 'Shanghai',
          ownerName: '',
          contactName: 'Amy',
          phone: '13800000000',
          address: '',
          bankName: '',
          bankAccount: '',
          remark: '',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '保存编辑' }));

    await waitFor(() => {
      expect(
        screen.getByText('请完整填写以下必填项：所属人员'),
      ).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('updates the row locally after a deactivate action succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 1,
          type: 'customer',
          code: 'CUST-ACME',
          name: 'Acme Trading',
          shortName: 'Acme',
          region: 'Shanghai',
          ownerName: 'Zoe',
          contactName: 'Amy',
          phone: '13800000000',
          address: '',
          bankName: '',
          bankAccount: '',
          remark: '',
          status: 'inactive',
          createdAt: '2026-07-11T09:00:00.000Z',
          createdBy: 'system',
          deactivatedReason: '业务停用',
        }),
      }),
    );

    render(
      <table>
        <tbody>
          <CounterpartyTableRow
            item={{
              id: 1,
              type: 'customer',
              code: 'CUST-ACME',
              name: 'Acme Trading',
              shortName: 'Acme',
              region: 'Shanghai',
              ownerName: 'Zoe',
              contactName: 'Amy',
              phone: '13800000000',
              address: '',
              bankName: '',
              bankAccount: '',
              remark: '',
              status: 'active',
              createdAt: '2026-07-11T09:00:00.000Z',
              createdBy: 'system',
            }}
            canManageMasterData
            allowedTypes={['customer', 'supplier', 'both']}
            ownerOptions={mockAssignableUsers}
            updatedBy="Admin"
            requestHeaders={{ 'x-erp-role': 'admin', 'x-erp-user': 'Admin' }}
            apiBaseUrl="http://127.0.0.1:3001/api"
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByRole('button', { name: '停用' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '启用' })).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
      expect(screen.getByText('业务停用')).toBeInTheDocument();
    });
  });
});
