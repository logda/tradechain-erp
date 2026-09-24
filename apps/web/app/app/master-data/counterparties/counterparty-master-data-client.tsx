'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { FormalPagination } from '../../_components/formal-pagination';
import { CreateCounterpartyForm } from './create-counterparty-form';
import { CounterpartyTableRow } from './counterparty-table-row';
import { normalizeCounterpartyDisplayItem } from './counterparty-display';
import { CounterpartyCustomFieldManager } from './counterparty-custom-field-manager';
import type { CounterpartyCustomField, CounterpartyExtraValues } from './counterparty-extra-fields';
import type { CounterpartyAssignableUser, CounterpartyType } from './owner-options';

type CounterpartyListItem = CounterpartyExtraValues & {
  id: number;
  type: CounterpartyType;
  code: string;
  name: string;
  shortName: string;
  region: string;
  ownerName: string;
  contactName: string;
  phone: string;
  address: string;
  bankName: string;
  bankAccount: string;
  remark: string;
  status: 'active' | 'inactive';
  createdAt: string;
  createdBy: string;
  updatedBy?: string;
  deactivatedReason?: string;
};

type CounterpartyMasterDataClientProps = {
  initialItems: CounterpartyListItem[];
  initialTotal: number;
  page: number;
  pageSize: number;
  canManageMasterData: boolean;
  canChangeStatus?: boolean;
  canConfigureFields?: boolean;
  actorRole?: string;
  allowedTypes: CounterpartyType[];
  createTypes?: CounterpartyType[];
  assignableUsers: CounterpartyAssignableUser[];
  customFields?: CounterpartyCustomField[];
  updatedBy: string;
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  requestHeaders: Record<string, string>;
  apiBaseUrl: string;
  paginationParams: {
    role: string;
    user: string;
    access?: string;
    type?: string;
    status?: string;
    keyword?: string;
    ownerName?: string;
  };
  filters: {
    type?: string | null;
    status?: string;
    keyword?: string;
    ownerName?: string;
  };
  filterSlot?: ReactNode;
};

const sectionStyle = {
  border: '1px solid #cfd8e3',
  borderRadius: '20px',
  padding: '24px',
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
  boxShadow: '0 14px 40px rgba(15, 23, 42, 0.04)',
} satisfies React.CSSProperties;

const tableWrapStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '760px',
} satisfies React.CSSProperties;

const headCellStyle = {
  textAlign: 'left' as const,
  fontSize: '12px',
  letterSpacing: '0.04em',
  color: '#334155',
  background: '#eef3f8',
  borderBottom: '1px solid #cfd8e3',
  borderRight: '1px solid #d8e1ea',
  padding: '10px',
} satisfies React.CSSProperties;

const listHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
  marginBottom: '14px',
} satisfies React.CSSProperties;

const listFilterPanelStyle = {
  display: 'grid',
  gap: '12px',
  marginBottom: '18px',
  padding: '16px 0 18px',
  borderTop: '1px solid #e2e8f0',
  borderBottom: '1px solid #e2e8f0',
} satisfies React.CSSProperties;

function matchesCounterpartyFilters(
  item: CounterpartyListItem,
  filters: CounterpartyMasterDataClientProps['filters'],
) {
  if (filters.type && item.type !== filters.type && item.type !== 'both') {
    return false;
  }

  if (filters.status && item.status !== filters.status) {
    return false;
  }

  if (filters.ownerName && item.ownerName !== filters.ownerName) {
    return false;
  }

  const keyword = filters.keyword?.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  return [
    item.code,
    item.name,
    item.shortName,
    item.region,
    item.ownerName,
    item.contactName,
    item.phone,
    item.address,
    item.bankName,
    item.bankAccount,
    item.remark,
  ]
    .join(' ')
    .toLowerCase()
    .includes(keyword);
}

export function CounterpartyMasterDataClient({
  initialItems,
  initialTotal,
  page,
  pageSize,
  canManageMasterData,
  canChangeStatus = true,
  canConfigureFields = false,
  actorRole = 'admin',
  allowedTypes,
  createTypes,
  assignableUsers,
  customFields: initialCustomFields = [],
  updatedBy,
  actorAccessScopes,
  requestHeaders,
  apiBaseUrl,
  paginationParams,
  filters,
  filterSlot,
}: CounterpartyMasterDataClientProps) {
  const [items, setItems] = useState(() =>
    initialItems.map(normalizeCounterpartyDisplayItem),
  );
  const [total, setTotal] = useState(initialTotal);
  const [customFields, setCustomFields] = useState(initialCustomFields);

  function handleCreated(nextItem: CounterpartyListItem) {
    const normalizedItem = normalizeCounterpartyDisplayItem(nextItem);
    const matches = matchesCounterpartyFilters(normalizedItem, filters);
    if (!matches) {
      return;
    }

    setTotal((current) => current + 1);
    if (page !== 1) {
      return;
    }

    setItems((current) =>
      [normalizedItem, ...current.filter((item) => item.id !== normalizedItem.id)].slice(0, pageSize),
    );
  }

  return (
    <>
      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>{canManageMasterData ? '新增往来单位' : '往来单位'}</h3>
        {canManageMasterData ? (
          <CreateCounterpartyForm
            endpoint={`${apiBaseUrl}/counterparties`}
            createdBy={updatedBy}
            actorRole={actorRole}
            allowedTypes={createTypes ?? allowedTypes}
            ownerOptions={assignableUsers}
            customFields={customFields}
            actorAccessScopes={actorAccessScopes}
            onSuccess={handleCreated}
          />
        ) : (
          <p style={{ color: '#64748b', marginBottom: 0 }}>
            当前账号无往来单位维护权限。
          </p>
        )}
      </section>

      {canConfigureFields ? (
        <CounterpartyCustomFieldManager
          fields={customFields}
          onChange={setCustomFields}
          endpoint={`${apiBaseUrl}/counterparties/custom-fields`}
          requestHeaders={requestHeaders}
        />
      ) : null}

      <section style={sectionStyle}>
        <div style={listHeaderStyle}>
          <h3 style={{ margin: 0 }}>往来单位列表</h3>
          <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
            共 {total} 条
          </span>
        </div>
        {filterSlot ? (
          <div style={listFilterPanelStyle}>
            <h4 style={{ margin: 0, color: '#0f172a' }}>查询筛选</h4>
            {filterSlot}
          </div>
        ) : null}
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={headCellStyle}>类型 Type</th>
                <th style={headCellStyle}>编码 Code</th>
                <th style={headCellStyle}>单位简称 / 单位全称</th>
                <th style={headCellStyle}>所属人员</th>
                <th style={headCellStyle}>状态</th>
                <th style={headCellStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <CounterpartyTableRow
                  key={item.id}
                  item={item}
                  canManageMasterData={canManageMasterData}
                  canChangeStatus={canChangeStatus}
                  actorRole={actorRole}
                  allowedTypes={allowedTypes}
                  ownerOptions={assignableUsers}
                  customFields={customFields}
                  updatedBy={updatedBy}
                  actorAccessScopes={actorAccessScopes}
                  requestHeaders={requestHeaders}
                  apiBaseUrl={apiBaseUrl}
                />
              ))}
            </tbody>
          </table>
        </div>
        <FormalPagination
          pathname="/app/master-data/counterparties"
          params={paginationParams}
          page={page}
          pageSize={pageSize}
          total={total}
        />
      </section>
    </>
  );
}
