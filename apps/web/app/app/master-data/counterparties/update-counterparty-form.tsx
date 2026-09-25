'use client';

import { type FormEvent, useState } from 'react';
import {
  buildFormalRequestHeaders,
  buildFormalRequestHeadersFromSearch,
} from '../../_lib/formal-request-headers';
import { submitFormalJsonMutationAction } from '../../_actions/formal-mutation-action';
import { useMutationAttempt } from '../../_lib/use-mutation-attempt';
import {
  buildCounterpartyOwnerOptions,
  filterCounterpartyOwnerOptions,
  type CounterpartyAssignableUser,
  type CounterpartyType,
} from './owner-options';
import {
  buildCounterpartyRequiredFieldMessage,
  counterpartyFieldPlaceholders,
} from './counterparty-form-schema';
import { CounterpartyExtraFields, readCounterpartyExtraFields, type CounterpartyCustomField, type CounterpartyExtraValues } from './counterparty-extra-fields';

type CounterpartyEditableItem = CounterpartyExtraValues & {
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
  cooperationStatus?: 'uncooperated' | 'cooperated';
};

type UpdateCounterpartyFormProps = {
  endpoint: string;
  item: CounterpartyEditableItem;
  updatedBy: string;
  actorRole?: string;
  allowedTypes: CounterpartyType[];
  ownerOptions: CounterpartyAssignableUser[];
  customFields?: CounterpartyCustomField[];
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  onSuccess?: (item: CounterpartyEditableItem) => void;
};

const typeLabels: Record<CounterpartyType, string> = {
  customer: 'customer / 客户',
  supplier: 'supplier / 供应商',
  both: 'both / 客户兼供应商',
};

const formStyle = {
  display: 'grid',
  gap: '10px',
  minWidth: '280px',
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(170px, 1fr))',
  gap: '12px 14px',
  alignItems: 'start',
} satisfies React.CSSProperties;

const fieldStyle = {
  display: 'grid',
  gap: '6px',
  alignContent: 'start',
} satisfies React.CSSProperties;

const labelRowStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '4px',
  minHeight: '20px',
  color: '#475569',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: '18px',
  flexWrap: 'wrap',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cfd8e3',
  borderRadius: '4px',
  padding: '8px 10px',
  background: '#ffffff',
  fontSize: '12px',
  lineHeight: '18px',
  minHeight: '42px',
  width: '100%',
  boxSizing: 'border-box',
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #334155',
  borderRadius: '4px',
  padding: '8px 10px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
  width: 'fit-content',
} satisfies React.CSSProperties;

const requiredMarkStyle = {
  color: '#b91c1c',
  fontWeight: 700,
} satisfies React.CSSProperties;

function resolveRequestHeaders(
  updatedBy: string,
  role: string,
  actorAccessScopes?: UpdateCounterpartyFormProps['actorAccessScopes'],
) {
  if (actorAccessScopes) {
    return buildFormalRequestHeaders({
      role,
      user: updatedBy,
      accessScopes: actorAccessScopes,
    });
  }

  if (typeof window === 'undefined') {
    return buildFormalRequestHeadersFromSearch(new URLSearchParams(), {
      role,
      user: updatedBy,
    });
  }

  return buildFormalRequestHeadersFromSearch(
    new URLSearchParams(window.location.search),
    { role, user: updatedBy },
  );
}

export function UpdateCounterpartyForm({
  endpoint,
  item,
  updatedBy,
  actorRole = 'admin',
  allowedTypes,
  ownerOptions,
  customFields = [],
  actorAccessScopes,
  onSuccess,
}: UpdateCounterpartyFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attempt = useMutationAttempt();
  const canEditType = (actorRole === 'admin' || actorRole === 'boss') && allowedTypes.includes(item.type);
  const allOwnerOptions = buildCounterpartyOwnerOptions(ownerOptions);
  const [selectedType, setSelectedType] = useState<CounterpartyType>(item.type);
  const [selectedOwner, setSelectedOwner] = useState(item.ownerName);
  const availableOwnerOptions = filterCounterpartyOwnerOptions(
    allOwnerOptions,
    selectedType,
    actorRole,
  );

  function handleTypeChange(nextType: CounterpartyType) {
    setSelectedType(nextType);
    const nextOwners = filterCounterpartyOwnerOptions(allOwnerOptions, nextType, actorRole);
    if (!nextOwners.some((option) => option.value === selectedOwner)) {
      setSelectedOwner(nextOwners[0]?.value ?? '');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || attempt.isComplete) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const validationError = buildCounterpartyRequiredFieldMessage({
      code: String(formData.get('code') ?? item.code),
      name: String(formData.get('name') ?? item.name),
      shortName: String(formData.get('shortName') ?? item.shortName),
      region: String(formData.get('region') ?? item.region),
      ownerName: selectedOwner || String(formData.get('ownerName') ?? item.ownerName),
      contactName: String(formData.get('contactName') ?? item.contactName),
      phone: String(formData.get('phone') ?? item.phone),
      address: String(formData.get('address') ?? item.address),
      bankName: String(formData.get('bankName') ?? item.bankName),
      bankAccount: String(formData.get('bankAccount') ?? item.bankAccount),
      remark: String(formData.get('remark') ?? item.remark),
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setMessage(null);
    setError(null);
    const requestKey = attempt.begin();
    if (!requestKey) return;
    setIsSubmitting(true);

    try {
      const result = await submitFormalJsonMutationAction(
        endpoint,
        'PATCH',
        {
          type: canEditType ? selectedType : item.type,
          code: String(formData.get('code') ?? ''),
          name: String(formData.get('name') ?? ''),
          shortName: String(formData.get('shortName') ?? ''),
          region: String(formData.get('region') ?? ''),
          ownerName: selectedOwner || String(formData.get('ownerName') ?? ''),
          contactName: String(formData.get('contactName') ?? ''),
          phone: String(formData.get('phone') ?? ''),
          address: String(formData.get('address') ?? ''),
          bankName: String(formData.get('bankName') ?? ''),
          bankAccount: String(formData.get('bankAccount') ?? ''),
          remark: String(formData.get('remark') ?? ''),
          ...((actorRole === 'boss' || actorRole === 'admin') && selectedType !== 'customer' ? { cooperationStatus: String(formData.get('cooperationStatus') ?? 'uncooperated') } : {}),
          ...readCounterpartyExtraFields(formData, customFields),
          updatedBy,
        },
        resolveRequestHeaders(updatedBy, actorRole, actorAccessScopes),
        requestKey,
      );

      if (!result.ok) {
        attempt.fail();
        setError(result.error);
        return;
      }

      const nextItem: CounterpartyEditableItem = {
        ...item,
        type: canEditType ? selectedType : item.type,
        code: String(formData.get('code') ?? '').trim(),
        name: String(formData.get('name') ?? '').trim(),
        shortName: String(formData.get('shortName') ?? '').trim(),
        region: String(formData.get('region') ?? '').trim(),
        ownerName: (selectedOwner || String(formData.get('ownerName') ?? '')).trim(),
        contactName: String(formData.get('contactName') ?? '').trim(),
        phone: String(formData.get('phone') ?? '').trim(),
        address: String(formData.get('address') ?? '').trim(),
        bankName: String(formData.get('bankName') ?? '').trim(),
        bankAccount: String(formData.get('bankAccount') ?? '').trim(),
        remark: String(formData.get('remark') ?? '').trim(),
        cooperationStatus: (formData.get('cooperationStatus') as CounterpartyEditableItem['cooperationStatus']) ?? item.cooperationStatus,
        ...readCounterpartyExtraFields(formData, customFields),
      };
      const responseItem =
        typeof result.result === 'object' && result.result !== null
          ? (result.result as Partial<CounterpartyEditableItem>)
          : null;

      onSuccess?.({
        ...nextItem,
        ...responseItem,
      });
      setMessage('保存成功');
      attempt.succeed();
    } catch {
      attempt.fail();
      setError('保存失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} onChangeCapture={attempt.resetAfterEdit} style={formStyle}>
      <div style={gridStyle}>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>类型 Type</span>
          <select
            aria-label={`类型 Type ${item.code}`}
            name="type"
            value={selectedType}
            disabled={!canEditType}
            onChange={(event) => handleTypeChange(event.target.value as CounterpartyType)}
            style={inputStyle}
          >
            {allowedTypes.map((type) => (
              <option key={type} value={type}>
                {typeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>
            <span>单位编码 Code</span>
            <span aria-hidden="true" style={requiredMarkStyle}>*</span>
          </span>
          <input
            aria-label={`编码 Code ${item.code}`}
            name="code"
            defaultValue={item.code}
            placeholder={counterpartyFieldPlaceholders.code}
            required
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>
            <span>单位简称 Name</span>
            <span aria-hidden="true" style={requiredMarkStyle}>*</span>
          </span>
          <input
            aria-label={`单位简称 Name ${item.code}`}
            name="name"
            defaultValue={item.name}
            placeholder={counterpartyFieldPlaceholders.name}
            required
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>单位全称 Full Name</span>
          <input
            aria-label={`单位全称 Full Name ${item.code}`}
            name="shortName"
            defaultValue={item.shortName}
            placeholder={counterpartyFieldPlaceholders.shortName}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>
            <span>所属人员 Owner</span>
            <span aria-hidden="true" style={requiredMarkStyle}>*</span>
          </span>
          <select
            aria-label={`所属人员 Owner ${item.code}`}
            name="ownerName"
            value={selectedOwner}
            onChange={(event) => setSelectedOwner(event.target.value)}
            disabled={actorRole === 'sales' || actorRole === 'purchase'}
            required
            style={inputStyle}
          >
            {!selectedOwner ? (
              <option value="">{counterpartyFieldPlaceholders.ownerName}</option>
            ) : null}
            {availableOwnerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(actorRole === 'boss' || actorRole === 'admin') && selectedType !== 'customer' ? (
        <label style={fieldStyle}>
          <span style={labelRowStyle}>供应商合作分类</span>
          <select name="cooperationStatus" defaultValue={item.cooperationStatus ?? 'uncooperated'} style={inputStyle}>
            <option value="uncooperated">未合作供应商</option>
            <option value="cooperated">已合作供应商</option>
          </select>
        </label>
      ) : null}
      <details>
        <summary style={{ cursor: 'pointer', color: '#334155', fontWeight: 700 }}>更多资料与自定义字段</summary>
        <div style={gridStyle}>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>所属地区 Region</span>
          <input aria-label={`所属地区 Region ${item.code}`} name="region" defaultValue={item.region} placeholder={counterpartyFieldPlaceholders.region} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>联系人 Contact</span>
          <input
            aria-label={`联系人 Contact ${item.code}`}
            name="contactName"
            defaultValue={item.contactName}
            placeholder={counterpartyFieldPlaceholders.contactName}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>联系号码 Phone</span>
          <input
            aria-label={`联系号码 Phone ${item.code}`}
            name="phone"
            defaultValue={item.phone}
            placeholder={counterpartyFieldPlaceholders.phone}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>地址 Address</span>
          <input
            aria-label={`地址 Address ${item.code}`}
            name="address"
            defaultValue={item.address}
            placeholder={counterpartyFieldPlaceholders.address}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>开户银行 Bank</span>
          <input
            aria-label={`开户银行 Bank ${item.code}`}
            name="bankName"
            defaultValue={item.bankName}
            placeholder={counterpartyFieldPlaceholders.bankName}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>银行账号 Bank Account</span>
          <input
            aria-label={`银行账号 Bank Account ${item.code}`}
            name="bankAccount"
            defaultValue={item.bankAccount}
            placeholder={counterpartyFieldPlaceholders.bankAccount}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>备注 Remark</span>
          <input
            aria-label={`备注 Remark ${item.code}`}
            name="remark"
            defaultValue={item.remark}
            placeholder={counterpartyFieldPlaceholders.remark}
            style={inputStyle}
          />
        </label>
        </div>
        <CounterpartyExtraFields type={selectedType} item={item} fields={customFields} />
      </details>
      {error ? (
        <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: '12px' }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p style={{ margin: 0, color: '#166534', fontSize: '12px' }}>{message}</p>
      ) : null}
      <button type="submit" disabled={isSubmitting || attempt.isComplete} style={buttonStyle}>
        {isSubmitting ? '保存中...' : '保存编辑'}
      </button>
    </form>
  );
}
