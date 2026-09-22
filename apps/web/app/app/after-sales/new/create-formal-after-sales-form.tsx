'use client';

import { useState, type FormEvent } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import {
  createFormalAfterSalesAction,
  type FormalAfterSalesFormState,
} from './actions';
import {
  CounterpartyPicker,
  formatCounterpartyOptionLabel,
} from '../../_components/counterparty-picker';
import type { CounterpartyOption } from '../../_lib/counterparty-options';

const initialState: FormalAfterSalesFormState = { error: null };
const fallbackError = '创建售后单失败';

const formStyle = {
  display: 'grid',
  gap: '16px',
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#0f172a',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '14px',
  color: '#0f172a',
  background: '#ffffff',
} satisfies React.CSSProperties;

const helperStyle = {
  margin: 0,
  fontSize: '13px',
  color: '#64748b',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '12px 16px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  justifySelf: 'start',
} satisfies React.CSSProperties;

export function CreateFormalAfterSalesForm({
  customerOptions,
  supplierOptions,
  createdBy,
  role,
  user,
  access,
  defaultSalesOrderId,
  defaultPurchaseOrderId,
  defaultShipmentBatchId,
}: {
  customerOptions: CounterpartyOption[];
  supplierOptions: CounterpartyOption[];
  createdBy: number;
  role: string;
  user: string;
  access?: string;
  defaultSalesOrderId?: string;
  defaultPurchaseOrderId?: string;
  defaultShipmentBatchId?: string;
}) {
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customerOptions[0]?.id ? String(customerOptions[0].id) : '',
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState(
    supplierOptions[0]?.id ? String(supplierOptions[0].id) : '',
  );
  const selectedCustomer = customerOptions.find(
    (option) => String(option.id) === selectedCustomerId,
  );
  const selectedSupplier = supplierOptions.find(
    (option) => String(option.id) === selectedSupplierId,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setState(initialState);

    const formData = new FormData(event.currentTarget);
    try {
      const nextState = await createFormalAfterSalesAction(initialState, formData);
      setState(nextState);
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      setState({ error: fallbackError });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <input type="hidden" name="createdBy" value={String(createdBy)} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="user" value={user} />
      {access ? <input type="hidden" name="access" value={access} /> : null}

      <div style={gridStyle}>
        <input type="hidden" name="customerName" value={selectedCustomer?.name ?? ''} />
        <input type="hidden" name="supplierName" value={selectedSupplier?.name ?? ''} />
        <label style={labelStyle}>
          客户 Customer
          <input
            readOnly
            value={formatCounterpartyOptionLabel(selectedCustomer)}
            placeholder="请选择客户"
            style={inputStyle}
          />
          <CounterpartyPicker
            options={customerOptions}
            selectedId={selectedCustomerId}
            onSelect={(option) => setSelectedCustomerId(String(option.id))}
          />
        </label>
        <label style={labelStyle}>
          供应商 Supplier
          <input
            readOnly
            value={formatCounterpartyOptionLabel(selectedSupplier, {
              nameOrder: 'chinese-english',
            })}
            placeholder="请选择供应商"
            style={inputStyle}
          />
          <CounterpartyPicker
            nameOrder="chinese-english"
            options={supplierOptions}
            selectedId={selectedSupplierId}
            onSelect={(option) => setSelectedSupplierId(String(option.id))}
          />
        </label>
        <label style={labelStyle}>
          销售单 ID Sales Order
          <input
            name="salesOrderId"
            type="number"
            defaultValue={defaultSalesOrderId}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          采购单 ID Purchase Order
          <input
            name="purchaseOrderId"
            type="number"
            defaultValue={defaultPurchaseOrderId}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          发货批次 ID Shipment Batch
          <input
            name="shipmentBatchId"
            type="number"
            defaultValue={defaultShipmentBatchId}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          售后类型 Type
          <select name="type" defaultValue="customer_complaint" style={inputStyle}>
            <option value="customer_complaint">customer_complaint / 客诉</option>
            <option value="return">return / 退货</option>
            <option value="refund">refund / 退款</option>
            <option value="rework">rework / 返工</option>
          </select>
        </label>
      </div>

      <label style={labelStyle}>
        问题描述 Issue
        <textarea name="issueDescription" rows={5} style={inputStyle} />
      </label>

      <p style={helperStyle}>
        按销售单维度创建售后，支持可选关联采购单与发货批次，便于链路追溯。
      </p>

      {state.error ? <p role="alert">{state.error}</p> : null}

      <button type="submit" disabled={isSubmitting} style={buttonStyle}>
        {isSubmitting ? '创建中...' : '创建售后单'}
      </button>
    </form>
  );
}
