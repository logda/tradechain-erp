'use client';

import { type FormEvent, useState } from 'react';
import {
  buildFormalRequestHeaders,
  buildFormalRequestHeadersFromSearch,
} from '../../_lib/formal-request-headers';
import { submitFormalJsonMutationAction } from '../../_actions/formal-mutation-action';
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

type CreateCounterpartyFormProps = {
  endpoint: string;
  createdBy: string;
  allowedTypes: CounterpartyType[];
  ownerOptions: CounterpartyAssignableUser[];
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  onSuccess?: (item: {
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
  }) => void;
};

type FormState = {
  error: string | null;
  success: string | null;
};

const initialState: FormState = {
  error: null,
  success: null,
};

const typeLabels: Record<CounterpartyType, string> = {
  customer: 'customer / 客户',
  supplier: 'supplier / 供应商',
  both: 'both / 客户兼供应商',
};

const formStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px 16px',
  alignItems: 'start',
} satisfies React.CSSProperties;

const fieldStyle = {
  display: 'grid',
  gap: '8px',
  alignContent: 'start',
} satisfies React.CSSProperties;

const labelRowStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '4px',
  minHeight: '24px',
  color: '#475569',
  fontSize: '13px',
  fontWeight: 600,
  lineHeight: '20px',
  flexWrap: 'wrap',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cfd8e3',
  borderRadius: '4px',
  padding: '10px 12px',
  background: '#ffffff',
  color: '#0f172a',
  minHeight: '46px',
  width: '100%',
  boxSizing: 'border-box',
  fontSize: '15px',
  lineHeight: '22px',
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '4px',
  padding: '10px 16px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  width: 'fit-content',
  marginTop: '2px',
} satisfies React.CSSProperties;

const requiredMarkStyle = {
  color: '#b91c1c',
  fontWeight: 700,
} satisfies React.CSSProperties;

function resolveRequestHeaders(
  createdBy: string,
  actorAccessScopes?: CreateCounterpartyFormProps['actorAccessScopes'],
) {
  if (actorAccessScopes) {
    return buildFormalRequestHeaders({
      role: 'admin',
      user: createdBy,
      accessScopes: actorAccessScopes,
    });
  }

  if (typeof window === 'undefined') {
    return buildFormalRequestHeadersFromSearch(new URLSearchParams(), {
      role: 'admin',
      user: createdBy,
    });
  }

  return buildFormalRequestHeadersFromSearch(
    new URLSearchParams(window.location.search),
    { role: 'admin', user: createdBy },
  );
}

export function CreateCounterpartyForm({
  endpoint,
  createdBy,
  allowedTypes,
  ownerOptions,
  actorAccessScopes,
  onSuccess,
}: CreateCounterpartyFormProps) {
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<CounterpartyType>(
    allowedTypes[0] ?? 'customer',
  );
  const availableOwnerOptions = filterCounterpartyOwnerOptions(
    buildCounterpartyOwnerOptions(ownerOptions),
    selectedType,
  );
  const [selectedOwner, setSelectedOwner] = useState(
    availableOwnerOptions[0]?.value ?? '',
  );

  function handleTypeChange(nextType: CounterpartyType) {
    setSelectedType(nextType);
    const nextOwners = filterCounterpartyOwnerOptions(
      buildCounterpartyOwnerOptions(ownerOptions),
      nextType,
    );
    if (!nextOwners.some((item) => item.value === selectedOwner)) {
      setSelectedOwner(nextOwners[0]?.value ?? '');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const validationError = buildCounterpartyRequiredFieldMessage({
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
    });
    if (validationError) {
      setState({
        error: validationError,
        success: null,
      });
      return;
    }

    setIsSubmitting(true);
    setState(initialState);

    const payload = {
      type: String(formData.get('type') ?? ''),
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
      createdBy,
    };

    try {
      const result = await submitFormalJsonMutationAction(
        endpoint,
        'POST',
        payload,
        resolveRequestHeaders(createdBy, actorAccessScopes),
      );

      if (!result.ok) {
        setState({
          error: result.error,
          success: null,
        });
        return;
      }

      const responseItem =
        typeof result.result === 'object' && result.result !== null
          ? (result.result as Partial<{
              id: number;
              status: 'active' | 'inactive';
              createdAt: string;
            }>)
          : null;
      const createdItem = {
        id: responseItem?.id ?? Date.now(),
        type: selectedType,
        code: payload.code.trim(),
        name: payload.name.trim(),
        shortName: payload.shortName.trim(),
        region: payload.region.trim(),
        ownerName: payload.ownerName.trim(),
        contactName: payload.contactName.trim(),
        phone: payload.phone.trim(),
        address: payload.address.trim(),
        bankName: payload.bankName.trim(),
        bankAccount: payload.bankAccount.trim(),
        remark: payload.remark.trim(),
        status: responseItem?.status ?? 'active',
        createdAt: responseItem?.createdAt ?? new Date().toISOString(),
        createdBy,
      };

      form.reset();
      const resetType = allowedTypes[0] ?? 'customer';
      const resetOwners = filterCounterpartyOwnerOptions(
        buildCounterpartyOwnerOptions(ownerOptions),
        resetType,
      );
      setSelectedType(resetType);
      setSelectedOwner(resetOwners[0]?.value ?? '');
      onSuccess?.(createdItem);
      setState({
        error: null,
        success: onSuccess ? '新增成功，已同步到当前列表。' : '新增成功，请刷新查看最新往来单位。',
      });
    } catch {
      setState({
        error: '新增往来单位失败',
        success: null,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} style={formStyle}>
      <div style={gridStyle}>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>类型 Type</span>
          <select
            aria-label="类型 Type"
            name="type"
            value={selectedType}
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
            <span>编码 Code</span>
            <span aria-hidden="true" style={requiredMarkStyle}>*</span>
          </span>
          <input
            aria-label="编码 Code"
            name="code"
            required
            placeholder={counterpartyFieldPlaceholders.code}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>
            <span>单位名称 Name</span>
            <span aria-hidden="true" style={requiredMarkStyle}>*</span>
          </span>
          <input
            aria-label="单位名称 Name"
            name="name"
            required
            placeholder={counterpartyFieldPlaceholders.name}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>中文名称 Chinese Name</span>
          <input
            aria-label="中文名称 Chinese Name"
            name="shortName"
            placeholder={counterpartyFieldPlaceholders.shortName}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>所属区域 Region</span>
          <input
            aria-label="所属区域 Region"
            name="region"
            placeholder={counterpartyFieldPlaceholders.region}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>
            <span>所属人员 Owner</span>
            <span aria-hidden="true" style={requiredMarkStyle}>*</span>
          </span>
          <select
            aria-label="所属人员 Owner"
            name="ownerName"
            value={selectedOwner}
            onChange={(event) => setSelectedOwner(event.target.value)}
            required
            style={inputStyle}
          >
            {availableOwnerOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>联系人 Contact</span>
          <input
            aria-label="联系人 Contact"
            name="contactName"
            placeholder={counterpartyFieldPlaceholders.contactName}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>联系号码 Phone</span>
          <input
            aria-label="联系号码 Phone"
            name="phone"
            placeholder={counterpartyFieldPlaceholders.phone}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>地址 Address</span>
          <input
            aria-label="地址 Address"
            name="address"
            placeholder={counterpartyFieldPlaceholders.address}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>开户银行 Bank</span>
          <input
            aria-label="开户银行 Bank"
            name="bankName"
            placeholder={counterpartyFieldPlaceholders.bankName}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>银行账号 Bank Account</span>
          <input
            aria-label="银行账号 Bank Account"
            name="bankAccount"
            placeholder={counterpartyFieldPlaceholders.bankAccount}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelRowStyle}>备注 Remark</span>
          <input
            aria-label="备注 Remark"
            name="remark"
            placeholder={counterpartyFieldPlaceholders.remark}
            style={inputStyle}
          />
        </label>
      </div>
      {state.error ? (
        <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: '13px' }}>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p style={{ margin: 0, color: '#166534', fontSize: '13px' }}>
          {state.success}
        </p>
      ) : null}
      <button type="submit" disabled={isSubmitting} style={buttonStyle}>
        {isSubmitting ? '提交中...' : '新增往来单位'}
      </button>
    </form>
  );
}
