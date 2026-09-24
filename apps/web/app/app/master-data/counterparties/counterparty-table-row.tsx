'use client';

import { useEffect, useState } from 'react';
import { MutationActionForm } from '../../_components/mutation-action-form';
import { normalizeCounterpartyDisplayItem } from './counterparty-display';
import { UpdateCounterpartyForm } from './update-counterparty-form';
import type { CounterpartyAssignableUser, CounterpartyType } from './owner-options';
import type { CounterpartyCustomField, CounterpartyExtraValues } from './counterparty-extra-fields';

type CounterpartyTableRowItem = CounterpartyExtraValues & {
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
  canChangeStatus?: boolean;
  actorRole?: string;
  allowedTypes: CounterpartyType[];
  ownerOptions: CounterpartyAssignableUser[];
  customFields?: CounterpartyCustomField[];
  updatedBy: string;
  actorAccessScopes?: { modules: string[]; dataScope: string; actions?: string[] };
  requestHeaders: Record<string, string>;
  apiBaseUrl: string;
};

const typeLabels: Record<CounterpartyType, string> = {
  customer: '客户', supplier: '供应商', both: '客户兼供应商',
};
const cellStyle = { padding: '12px', borderBottom: '1px solid #e5ebf2', color: '#0f172a', fontSize: '13px', verticalAlign: 'top' as const } satisfies React.CSSProperties;
const buttonStyle = { border: '1px solid #cbd5e1', borderRadius: '8px', padding: '7px 10px', background: '#fff', color: '#0f172a', fontWeight: 700, cursor: 'pointer' } satisfies React.CSSProperties;
const detailsStyle = { padding: '14px', background: '#f8fbff', borderBottom: '1px solid #e5ebf2' } satisfies React.CSSProperties;

function value(text?: string | null) { return text?.trim() || '—'; }

export function CounterpartyTableRow({ item, canManageMasterData, canChangeStatus = true, actorRole = 'admin', allowedTypes, ownerOptions, customFields = [], updatedBy, actorAccessScopes, requestHeaders, apiBaseUrl }: CounterpartyTableRowProps) {
  const [currentItem, setCurrentItem] = useState(() => normalizeCounterpartyDisplayItem(item));
  const [isEditing, setIsEditing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  return (
    <>
      <tr>
        <td style={cellStyle}>{typeLabels[currentItem.type]}</td>
        <td style={cellStyle}>{currentItem.code}</td>
        <td style={cellStyle}><strong>{currentItem.name}</strong><br /><span style={{ color: '#64748b' }}>{value(currentItem.shortName)}</span></td>
        <td style={cellStyle}>{value(currentItem.ownerName)}</td>
        <td style={cellStyle}>{currentItem.status === 'active' ? '启用' : '停用'}</td>
        <td style={cellStyle}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} aria-expanded={showDetails} onClick={() => setShowDetails((open) => !open)}>{showDetails ? '收起详情' : '查看详情'}</button>
            {canManageMasterData ? <button type="button" style={buttonStyle} aria-expanded={isEditing} onClick={() => setIsEditing((open) => !open)}>{isEditing ? '收起编辑' : '编辑'}</button> : null}
            {canChangeStatus ? (
              <MutationActionForm
                endpoint={`${apiBaseUrl}/counterparties/${currentItem.id}/${currentItem.status === 'active' ? 'deactivate' : 'activate'}`}
                label={currentItem.status === 'active' ? '停用' : '启用'}
                successLabel={currentItem.status === 'active' ? '已停用' : '已启用'}
                requiredAction="master_data.write"
                requiredActionLabel="主数据维护"
                requestHeaders={requestHeaders}
                fields={[{ name: 'operatedBy', value: updatedBy }, { name: 'reason', value: currentItem.status === 'active' ? '业务停用' : '恢复启用' }]}
                onSuccess={(result) => {
                  if (result && typeof result === 'object') setCurrentItem((previous) => normalizeCounterpartyDisplayItem({ ...previous, ...(result as Partial<CounterpartyTableRowItem>) }));
                }}
              />
            ) : null}
          </div>
          {toast ? <span role="status" style={{ color: '#166534' }}>{toast}</span> : null}
        </td>
      </tr>
      {showDetails ? (
        <tr><td colSpan={6} style={detailsStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px 16px' }}>
            <span>所属地区：{value(currentItem.region)}</span>
            <span>联系人：{value(currentItem.contactName)}</span>
            <span>联系号码：{value(currentItem.phone)}</span>
            <span>地址：{value(currentItem.address)}</span>
            <span>开户银行：{value(currentItem.bankName)}</span>
            <span>银行账号：{value(currentItem.bankAccount)}</span>
            <span>付款方式：{value(currentItem.paymentMethod)}</span>
            <span>结算方式：{value(currentItem.settlementMethod)}</span>
            <span>单位标签：{currentItem.unitTags?.join('、') || '—'}</span>
            {(currentItem.type === 'customer' || currentItem.type === 'both') ? <span>期初应收款：{value(currentItem.openingReceivable)}</span> : null}
            {(currentItem.type === 'supplier' || currentItem.type === 'both') ? <span>应付应收款：{value(currentItem.payableReceivable)}</span> : null}
            <span>模具费用：{value(currentItem.moldFee)}</span>
            <span>入库时间：{new Date(currentItem.createdAt).toLocaleString('zh-CN')}</span>
            <span>备注：{value(currentItem.remark)}</span>
            {currentItem.deactivatedReason ? <span>停用原因：{currentItem.deactivatedReason}</span> : null}
            {customFields.map((field) => <span key={field.id}>{field.name}：{value(currentItem.customValues?.[String(field.id)])}</span>)}
          </div>
        </td></tr>
      ) : null}
      {isEditing ? (
        <tr><td colSpan={6} style={detailsStyle}>
          <UpdateCounterpartyForm
            endpoint={`${apiBaseUrl}/counterparties/${currentItem.id}`}
            item={currentItem}
            updatedBy={updatedBy}
            actorRole={actorRole}
            allowedTypes={allowedTypes}
            ownerOptions={ownerOptions}
            customFields={customFields}
            actorAccessScopes={actorAccessScopes}
            onSuccess={(next) => {
              setCurrentItem((previous) => normalizeCounterpartyDisplayItem({ ...previous, ...next }));
              setIsEditing(false);
              setToast('保存成功');
            }}
          />
        </td></tr>
      ) : null}
    </>
  );
}
