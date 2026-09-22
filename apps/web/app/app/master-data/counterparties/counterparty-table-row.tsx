'use client';

import { useState } from 'react';
import { MutationActionForm } from '../../_components/mutation-action-form';
import { normalizeCounterpartyDisplayItem } from './counterparty-display';
import { UpdateCounterpartyForm } from './update-counterparty-form';
import {
  type CounterpartyAssignableUser,
  type CounterpartyType,
} from './owner-options';

type CounterpartyTableRowItem = {
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

type CounterpartyTableRowProps = {
  item: CounterpartyTableRowItem;
  canManageMasterData: boolean;
  allowedTypes: CounterpartyType[];
  ownerOptions: CounterpartyAssignableUser[];
  updatedBy: string;
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  requestHeaders: Record<string, string>;
  apiBaseUrl: string;
};

const typeLabels: Record<CounterpartyType, string> = {
  customer: '客户 Customer',
  supplier: '供应商 Supplier',
  both: '客户兼供应商 Both',
};

const cellStyle = {
  padding: '14px 12px',
  borderBottom: '1px solid #e5ebf2',
  borderRight: '1px solid #e5ebf2',
  fontSize: '13px',
  color: '#0f172a',
  verticalAlign: 'top' as const,
  background: '#ffffff',
} satisfies React.CSSProperties;

const rowEditingCellStyle = {
  ...cellStyle,
  background: '#f8fbff',
} satisfies React.CSSProperties;

const badgeStyle = {
  display: 'inline-flex',
  border: '1px solid #cfd8e3',
  borderRadius: '999px',
  padding: '5px 10px',
  background: '#f8fafc',
  fontSize: '12px',
  fontWeight: 700,
  whiteSpace: 'nowrap' as const,
} satisfies React.CSSProperties;

const mutedValueStyle = {
  color: '#94a3b8',
} satisfies React.CSSProperties;

const subTextStyle = {
  color: '#64748b',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const editTriggerStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  padding: '8px 14px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
} satisfies React.CSSProperties;

const expandedCellStyle = {
  padding: '0 0 18px',
  borderBottom: '1px solid #e5ebf2',
  borderRight: '1px solid #e5ebf2',
  background: '#f8fbff',
} satisfies React.CSSProperties;

const expandedPanelStyle = {
  margin: '0 16px',
  padding: '18px',
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
  boxShadow: '0 10px 32px rgba(15, 23, 42, 0.04)',
  display: 'grid',
  gap: '16px',
} satisfies React.CSSProperties;

const expandedHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
} satisfies React.CSSProperties;

const expandedTitleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const expandedDescStyle = {
  margin: '6px 0 0',
  fontSize: '13px',
  lineHeight: 1.7,
  color: '#64748b',
} satisfies React.CSSProperties;

function renderMutedValue(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return <span style={mutedValueStyle}>未填写</span>;
  }

  return normalized;
}

export function CounterpartyTableRow({
  item,
  canManageMasterData,
  allowedTypes,
  ownerOptions,
  updatedBy,
  actorAccessScopes,
  requestHeaders,
  apiBaseUrl,
}: CounterpartyTableRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(() =>
    normalizeCounterpartyDisplayItem(item),
  );

  return (
    <>
      <tr>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          <span style={badgeStyle}>{typeLabels[currentItem.type]}</span>
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>{currentItem.code}</td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          <strong>{currentItem.name}</strong>
          <br />
          <span style={subTextStyle}>
            中文名称: {renderMutedValue(currentItem.shortName)}
          </span>
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          {renderMutedValue(currentItem.region)}
          <br />
          <span style={subTextStyle}>所属人员: {renderMutedValue(currentItem.ownerName)}</span>
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          {renderMutedValue(currentItem.contactName)}
          <br />
          <span style={subTextStyle}>{renderMutedValue(currentItem.phone)}</span>
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          {renderMutedValue(currentItem.address)}
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          {renderMutedValue(currentItem.bankName)}
          <br />
          <span style={subTextStyle}>{renderMutedValue(currentItem.bankAccount)}</span>
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          {renderMutedValue(currentItem.remark)}
          <br />
          <span style={subTextStyle}>创建人: {currentItem.createdBy}</span>
          <br />
          <strong>{currentItem.status}</strong>
          {currentItem.deactivatedReason ? (
            <>
              <br />
              <span style={subTextStyle}>{currentItem.deactivatedReason}</span>
            </>
          ) : null}
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          {canManageMasterData ? (
            <button
              type="button"
              onClick={() => setIsEditing((current) => !current)}
              aria-expanded={isEditing}
              style={editTriggerStyle}
            >
              {isEditing ? '收起编辑' : '编辑'}
            </button>
          ) : (
            <span style={mutedValueStyle}>无权限</span>
          )}
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          {canManageMasterData && currentItem.status === 'active' ? (
            <MutationActionForm
              endpoint={`${apiBaseUrl}/counterparties/${currentItem.id}/deactivate`}
              label="停用"
              successLabel="操作成功，往来单位已停用（假删除）"
              requiredAction="master_data.write"
              requiredActionLabel="主数据维护"
              requestHeaders={requestHeaders}
              onSuccess={(result) => {
                const responseItem =
                  typeof result === 'object' && result !== null
                    ? (result as Partial<CounterpartyTableRowItem>)
                    : null;

                setCurrentItem((previous) =>
                  normalizeCounterpartyDisplayItem({
                    ...previous,
                    ...responseItem,
                    status: responseItem?.status ?? 'inactive',
                    deactivatedReason:
                      typeof responseItem?.deactivatedReason === 'string'
                        ? responseItem.deactivatedReason
                        : '业务停用',
                  }),
                );
              }}
              fields={[
                {
                  name: 'operatedBy',
                  value: updatedBy,
                },
                {
                  name: 'reason',
                  value: '业务停用',
                },
              ]}
            />
          ) : currentItem.status === 'active' ? (
            <span style={mutedValueStyle}>无权限</span>
          ) : canManageMasterData ? (
            <MutationActionForm
              endpoint={`${apiBaseUrl}/counterparties/${currentItem.id}/activate`}
              label="启用"
              successLabel="操作成功，往来单位已重新启用"
              requiredAction="master_data.write"
              requiredActionLabel="主数据维护"
              requestHeaders={requestHeaders}
              onSuccess={(result) => {
                const responseItem =
                  typeof result === 'object' && result !== null
                    ? (result as Partial<CounterpartyTableRowItem>)
                    : null;

                setCurrentItem((previous) =>
                  normalizeCounterpartyDisplayItem({
                    ...previous,
                    ...responseItem,
                    status: responseItem?.status ?? 'active',
                    deactivatedReason: undefined,
                  }),
                );
              }}
              fields={[
                {
                  name: 'operatedBy',
                  value: updatedBy,
                },
                {
                  name: 'reason',
                  value: '恢复启用',
                },
              ]}
            />
          ) : (
            <span style={mutedValueStyle}>已停用</span>
          )}
        </td>
      </tr>
      {isEditing ? (
        <tr>
          <td style={expandedCellStyle} colSpan={10}>
            <div style={expandedPanelStyle}>
              <div style={expandedHeaderStyle}>
                <div>
                  <h4 style={expandedTitleStyle}>
                    {[
                      currentItem.name,
                      currentItem.shortName,
                      currentItem.code,
                    ].filter(Boolean).join(' · ')}
                  </h4>
                  <p style={expandedDescStyle}>
                    在展开面板中维护该往来单位的主数据字段，保存后列表会自动刷新当前页。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={editTriggerStyle}
                >
                  关闭面板
                </button>
              </div>
              <UpdateCounterpartyForm
                endpoint={`${apiBaseUrl}/counterparties/${currentItem.id}`}
                item={currentItem}
                updatedBy={updatedBy}
                allowedTypes={allowedTypes}
                ownerOptions={ownerOptions}
                actorAccessScopes={actorAccessScopes}
                  onSuccess={(nextItem) => {
                    setCurrentItem((previous) =>
                      normalizeCounterpartyDisplayItem({
                        ...previous,
                        ...nextItem,
                      }),
                    );
                  }}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
