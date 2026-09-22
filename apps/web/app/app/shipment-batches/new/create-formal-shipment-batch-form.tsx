'use client';

import { useState, type FormEvent } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import {
  createFormalShipmentBatchAction,
  type FormalShipmentBatchFormState,
} from './actions';

const initialState: FormalShipmentBatchFormState = { error: null };
const fallbackError = '创建发货批次失败';

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

type ShipmentSourceDraft = {
  purchaseOrderCurrentStatus: string;
  currentBatchCount: number;
  salesOrderNo: string;
  purchaseOrderNo: string;
  purchasingUnit: string;
  destination: string;
  goodsName: string;
  totalPackages: number;
  estimatedArrivalDate: string;
  shippedQty: number;
  accumulatedQty: number;
  remainingQty: number;
  items: Array<{
    purchaseLineNo: number;
    sourceSalesItemId: number;
    productId: number;
    sku: string;
    productName: string;
    unit: string;
    shippedQty: number;
    purchaseQty: number;
  }>;
};

const sectionTitleStyle = {
  margin: '4px 0 0',
  fontSize: '17px',
  color: '#0f172a',
} satisfies React.CSSProperties;

export function CreateFormalShipmentBatchForm({
  createdBy,
  role,
  user,
  access,
  defaultSalesOrderId,
  defaultPurchaseOrderId,
  sourceDraft,
}: {
  createdBy: number;
  role: string;
  user: string;
  access?: string;
  defaultSalesOrderId?: string;
  defaultPurchaseOrderId?: string;
  sourceDraft?: ShipmentSourceDraft | null;
}) {
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const defaultShippedAt = `${today}T09:00:00.000Z`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setState(initialState);

    const formData = new FormData(event.currentTarget);
    try {
      const nextState = await createFormalShipmentBatchAction(initialState, formData);
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
      <input
        type="hidden"
        name="purchaseOrderCurrentStatus"
        value={sourceDraft?.purchaseOrderCurrentStatus ?? 'purchasing'}
      />
      <input
        type="hidden"
        name="currentBatchCount"
        value={String(sourceDraft?.currentBatchCount ?? 0)}
      />
      {sourceDraft?.items.length ? (
        <input type="hidden" name="items" value={JSON.stringify(sourceDraft.items)} />
      ) : null}

      <h3 style={sectionTitleStyle}>来源单据</h3>

      <div style={gridStyle}>
        <label style={labelStyle}>
          销售单 ID Sales Order
          <input
            name="salesOrderId"
            type="number"
            defaultValue={defaultSalesOrderId}
            required
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          采购单 ID Purchase Order
          <input
            name="purchaseOrderId"
            type="number"
            defaultValue={defaultPurchaseOrderId}
            required
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          订单号 Order No
          <input
            name="orderNo"
            defaultValue={sourceDraft?.salesOrderNo ?? ''}
            readOnly
            style={{ ...inputStyle, background: '#f8fafc' }}
          />
        </label>
        <label style={labelStyle}>
          采购单号 Purchase No
          <input
            name="purchaseOrderNo"
            defaultValue={sourceDraft?.purchaseOrderNo ?? ''}
            readOnly
            style={{ ...inputStyle, background: '#f8fafc' }}
          />
        </label>
      </div>

      <h3 style={sectionTitleStyle}>发货信息</h3>

      <div style={gridStyle}>
        <label style={labelStyle}>
          工厂发货日期 Factory Ship Date
          <input
            name="factoryShipDate"
            type="date"
            defaultValue={today}
            required
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          发货编码 Shipping Code
          <textarea
            name="shippingCode"
            placeholder="一行一个发货编码，支持多条"
            required
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>
        <label style={labelStyle}>
          到货目的地 Destination
          <input
            name="destination"
            defaultValue={sourceDraft?.destination ?? ''}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          唛头 Mark
          <input name="shippingMark" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          货物名称 Goods Name
          <input
            name="goodsName"
            defaultValue={sourceDraft?.goodsName ?? ''}
            required
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          总件数 Total Packages
          <input
            name="totalPackages"
            type="number"
            min="0"
            defaultValue={sourceDraft?.totalPackages || ''}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          采购单位 Purchasing Unit
          <input
            name="purchasingUnit"
            defaultValue={sourceDraft?.purchasingUnit ?? ''}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          客户 Customer
          <input name="customerName" placeholder="销售视角可见字段，可补填" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          货运站 Freight Station
          <input name="freightStation" required style={inputStyle} />
        </label>
        <label style={labelStyle}>
          入仓单 Warehouse Entry No
          <input name="warehouseEntryNo" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          到货情况 Arrival Status
          <select name="arrivalStatus" defaultValue="已发" required style={inputStyle}>
            <option value="已发">已发</option>
            <option value="已到货运站">已到货运站</option>
            <option value="已到客户">已到客户</option>
            <option value="异常">异常</option>
          </select>
        </label>
        <label style={labelStyle}>
          货代发货日期 Forwarder Ship Date
          <input name="forwarderShipDate" type="date" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          预计到货时间 Estimated Arrival
          <input
            name="estimatedArrivalDate"
            type="date"
            defaultValue={sourceDraft?.estimatedArrivalDate ?? ''}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          备注 Remark
          <input name="remark" style={inputStyle} />
        </label>
      </div>

      <h3 style={sectionTitleStyle}>数量信息</h3>

      <div style={gridStyle}>
        <label style={labelStyle}>
          发货数量 Shipped Qty
          <input
            name="shippedQty"
            type="number"
            min="1"
            defaultValue={sourceDraft?.shippedQty || ''}
            required
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          累计发货 Accumulated Qty
          <input
            name="accumulatedQty"
            type="number"
            min="1"
            defaultValue={sourceDraft?.accumulatedQty || ''}
            required
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          剩余数量 Remaining Qty
          <input
            name="remainingQty"
            type="number"
            min="0"
            defaultValue={sourceDraft?.remainingQty ?? ''}
            required
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          发货时间 Shipped At
          <input
            name="shippedAt"
            type="text"
            defaultValue={defaultShippedAt}
            required
            style={inputStyle}
          />
        </label>
      </div>

      <p style={helperStyle}>
        按采购执行中的单据创建首批发货，默认使用 `purchasing` 状态和首批批次口径。
      </p>

      {state.error ? <p role="alert">{state.error}</p> : null}

      <button type="submit" disabled={isSubmitting} style={buttonStyle}>
        {isSubmitting ? '创建中...' : '创建发货批次'}
      </button>
    </form>
  );
}
