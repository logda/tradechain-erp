'use client';

import { useState } from 'react';
import {
  filterCounterpartyOwnerOptions,
  type CounterpartyOwnerOption,
  type CounterpartyType,
} from './owner-options';

type CounterpartyFilterFormProps = {
  pathname: string;
  role: string;
  user: string;
  access?: string;
  allowedTypes: CounterpartyType[];
  defaultType: CounterpartyType | null;
  initialType: CounterpartyType | null;
  initialStatus?: string;
  initialKeyword?: string;
  initialOwnerName?: string;
  pageSize: number;
  ownerOptions: CounterpartyOwnerOption[];
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  filterStyle: React.CSSProperties;
  filterButtonStyle: React.CSSProperties;
};

export function CounterpartyFilterForm({
  pathname,
  role,
  user,
  access,
  allowedTypes,
  defaultType,
  initialType,
  initialStatus,
  initialKeyword,
  initialOwnerName,
  pageSize,
  ownerOptions,
  labelStyle,
  inputStyle,
  filterStyle,
  filterButtonStyle,
}: CounterpartyFilterFormProps) {
  const [selectedType, setSelectedType] = useState<CounterpartyType | ''>(
    initialType ?? '',
  );
  const [selectedOwner, setSelectedOwner] = useState(initialOwnerName ?? '');
  const filteredOwnerOptions = filterCounterpartyOwnerOptions(
    ownerOptions,
    selectedType || null,
  );

  function handleTypeChange(nextType: CounterpartyType | '') {
    setSelectedType(nextType);
    const nextOwners = filterCounterpartyOwnerOptions(ownerOptions, nextType || null);
    if (!nextOwners.some((item) => item.value === selectedOwner)) {
      setSelectedOwner('');
    }
  }

  return (
    <form action={pathname} className="erp-filter-form erp-form-grid">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="user" value={user} />
      <input type="hidden" name="page" value="1" />
      <input type="hidden" name="pageSize" value={String(pageSize)} />
      {access ? <input type="hidden" name="access" value={access} /> : null}
      <label className="erp-form-field">
        类型 Type
        <select
          aria-label="筛选类型 Type"
          name="type"
          value={selectedType}
          onChange={(event) =>
            handleTypeChange(event.target.value as CounterpartyType | '')
          }
          className="erp-control"
        >
          {!defaultType ? <option value="">全部 All</option> : null}
          {allowedTypes.map((type) => (
            <option key={type} value={type}>
              {type === 'customer'
                ? '客户 Customer'
                : type === 'supplier'
                  ? '供应商 Supplier'
                  : '客户兼供应商 Both'}
            </option>
          ))}
        </select>
      </label>
      <label className="erp-form-field">
        状态 Status
        <select
          aria-label="筛选状态 Status"
          name="status"
          defaultValue={initialStatus ?? ''}
          className="erp-control"
        >
          <option value="">全部 All</option>
          <option value="active">active / 启用</option>
          <option value="inactive">inactive / 停用</option>
        </select>
      </label>
      <label className="erp-form-field">
        关键词 Keyword
        <input
          aria-label="筛选关键词 Keyword"
          name="keyword"
          defaultValue={initialKeyword ?? ''}
          placeholder="编码/名称/中文名称/区域/联系人/电话/地址/银行/备注"
          className="erp-control"
        />
      </label>
      <label className="erp-form-field">
        归属人 Owner
        <select
          aria-label="筛选归属人 Owner"
          name="ownerName"
          value={selectedOwner}
          onChange={(event) => setSelectedOwner(event.target.value)}
          className="erp-control"
        >
          <option value="">全部 All</option>
          {filteredOwnerOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div className="erp-filter-actions">
      <button className="erp-button erp-button--primary" type="submit">
        查询
      </button>
      </div>
    </form>
  );
}
