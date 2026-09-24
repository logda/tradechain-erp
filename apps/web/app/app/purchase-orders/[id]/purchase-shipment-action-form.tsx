'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitFormalJsonMutationAction } from '../../_actions/formal-mutation-action';
import { useMutationAttempt } from '../../_lib/use-mutation-attempt';
import {
  formalActionButtonDisabledStyle,
  formalActionButtonStyle,
  formalActionFormStyle,
} from '../../_components/formal-action-button-style';

type ShippingCodeDraftItem = {
  id: number;
  code: string;
  quantity: number;
};

type ShipmentBatchDraftLineItem = {
  purchaseLineNo: number;
  sourceSalesItemId: number;
  productId: number;
  sku: string;
  productName: string;
  unit: string;
  shippedQty: number;
  purchaseQty: number;
};

type PurchaseShipmentActionFormProps = {
  endpoint: string;
  requestHeaders: Record<string, string>;
  draft: {
    salesOrderId: number;
    purchaseOrderId: number;
    purchaseTotalQty: number;
    previousShippedQty: number;
    totalQty: number;
    shippedAt: string;
    createdBy: number;
    purchaseOrderCurrentStatus: string;
    currentBatchCount: number;
    items: ShipmentBatchDraftLineItem[];
  };
};

const fieldGridStyle = {
  display: 'grid',
  gap: '12px',
  minWidth: 'min(100%, 620px)',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '6px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#334155',
} satisfies React.CSSProperties;

const inputStyle = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '10px 12px',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '14px',
  outline: 'none',
} satisfies React.CSSProperties;

const codeGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 1fr) minmax(100px, 140px) auto',
  gap: '8px',
  alignItems: 'end',
} satisfies React.CSSProperties;

const helpTextStyle = {
  margin: 0,
  fontSize: '12px',
  lineHeight: 1.5,
  color: '#64748b',
} satisfies React.CSSProperties;

const messageStyle = {
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '10px 12px',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '13px',
  fontWeight: 800,
  cursor: 'pointer',
} satisfies React.CSSProperties;

function formatUnexpectedActionError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return `操作失败：${error.message}`;
  }

  return '操作失败';
}

function normalizeShippingCodeItems(items: ShippingCodeDraftItem[]) {
  return items
    .map((item) => ({
      code: item.code.trim(),
      quantity: Number(item.quantity),
    }))
    .filter((item) => item.code);
}

function buildShipmentItemsForShippedQty(
  items: ShipmentBatchDraftLineItem[],
  shippedQty: number,
) {
  let qtyToAllocate = shippedQty;

  return items
    .map((item) => {
      const lineRemainingQty = Math.max(Number(item.shippedQty) || 0, 0);
      const lineShippedQty = Math.min(lineRemainingQty, qtyToAllocate);
      qtyToAllocate = Math.max(qtyToAllocate - lineShippedQty, 0);

      return {
        ...item,
        shippedQty: lineShippedQty,
      };
    })
    .filter((item) => item.shippedQty > 0);
}

export function PurchaseShipmentActionForm({
  endpoint,
  requestHeaders,
  draft,
}: PurchaseShipmentActionFormProps) {
  let router: { refresh?: () => void } = {};
  try {
    router = useRouter();
  } catch {
    router = {};
  }

  const [shippingCodeItems, setShippingCodeItems] = useState<ShippingCodeDraftItem[]>([
    { id: 1, code: '', quantity: draft.totalQty },
  ]);
  const [message, setMessage] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attempt = useMutationAttempt();

  const normalizedShippingCodeItems = useMemo(
    () => normalizeShippingCodeItems(shippingCodeItems),
    [shippingCodeItems],
  );
  const shippedQty = normalizedShippingCodeItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
  const accumulatedQty = draft.previousShippedQty + shippedQty;
  const remainingQty = Math.max(draft.purchaseTotalQty - accumulatedQty, 0);
  const canSubmit =
    normalizedShippingCodeItems.length > 0 &&
    shippedQty > 0 &&
    shippedQty <= draft.totalQty &&
    normalizedShippingCodeItems.every((item) => item.quantity > 0);

  function updateShippingCodeItem(
    id: number,
    patch: Partial<Pick<ShippingCodeDraftItem, 'code' | 'quantity'>>,
  ) {
    setShippingCodeItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addShippingCodeItem() {
    setShippingCodeItems((current) => [
      ...current,
      { id: Math.max(...current.map((item) => item.id)) + 1, code: '', quantity: 0 },
    ]);
  }

  function removeShippingCodeItem(id: number) {
    setShippingCodeItems((current) =>
      current.length === 1 ? current : current.filter((item) => item.id !== id),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || attempt.isComplete) {
      return;
    }

    if (!canSubmit) {
      setMessage({
        error: '请填写发货编码，并确认编码数量合计不超过剩余可发数量',
        success: null,
      });
      return;
    }

    setMessage({ error: null, success: null });
    const requestKey = attempt.begin();
    if (!requestKey) return;
    setIsSubmitting(true);

    try {
      const result = await submitFormalJsonMutationAction(
        endpoint,
        'POST',
        {
          salesOrderId: draft.salesOrderId,
          purchaseOrderId: draft.purchaseOrderId,
          shippedQty,
          accumulatedQty,
          remainingQty,
          shippedAt: draft.shippedAt,
          shippingCode: normalizedShippingCodeItems
            .map((item) => item.code)
            .join('\n'),
          shippingCodeItems: normalizedShippingCodeItems,
          createdBy: draft.createdBy,
          purchaseOrderCurrentStatus: draft.purchaseOrderCurrentStatus,
          currentBatchCount: draft.currentBatchCount,
          items: buildShipmentItemsForShippedQty(draft.items, shippedQty),
        },
        requestHeaders,
        requestKey,
      );

      if (!result.ok) {
        attempt.fail();
        setMessage({ error: result.error, success: null });
        return;
      }

      setMessage({ error: null, success: '操作成功，已生成发货批次' });
      attempt.succeed();
      router.refresh?.();
    } catch (error) {
      attempt.fail();
      setMessage({ error: formatUnexpectedActionError(error), success: null });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChangeCapture={attempt.resetFailedAfterEdit} style={formalActionFormStyle}>
      <div style={fieldGridStyle}>
        <div style={labelStyle}>
          发货编码与数量 Shipping Codes *
          <div style={{ display: 'grid', gap: '8px' }}>
            {shippingCodeItems.map((item, index) => (
              <div key={item.id} style={codeGridStyle}>
                <label style={labelStyle}>
                  {`发货编码 ${index + 1}`}
                  <input
                    value={item.code}
                    onChange={(event) =>
                      updateShippingCodeItem(item.id, { code: event.target.value })
                    }
                    placeholder="例如：SHIP-001"
                    required
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  数量
                  <input
                    type="number"
                    min="1"
                    max={draft.totalQty}
                    step="1"
                    value={item.quantity || ''}
                    onChange={(event) =>
                      updateShippingCodeItem(item.id, {
                        quantity: Number(event.target.value),
                      })
                    }
                    required
                    style={inputStyle}
                  />
                </label>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => removeShippingCodeItem(item.id)}
                  disabled={shippingCodeItems.length === 1}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
          <button type="button" style={secondaryButtonStyle} onClick={addShippingCodeItem}>
            添加发货编码
          </button>
          <p style={helpTextStyle}>
            {`剩余可发数量 ${draft.totalQty}，本次编码数量合计 ${shippedQty}，采购总数量 ${draft.purchaseTotalQty}。`}
          </p>
        </div>

        <label style={labelStyle}>
          本次发货数量 Shipped Qty
          <input readOnly value={shippedQty || ''} style={{ ...inputStyle, background: '#f8fafc' }} />
        </label>
      </div>

      {message.error ? (
        <p role="alert" style={{ ...messageStyle, color: '#b91c1c' }}>
          {message.error}
        </p>
      ) : null}
      {message.success ? (
        <p style={{ ...messageStyle, color: '#166534' }}>{message.success}</p>
      ) : null}

      <button
        type="submit"
        style={isSubmitting || !canSubmit ? formalActionButtonDisabledStyle : formalActionButtonStyle}
        disabled={isSubmitting || attempt.isComplete || !canSubmit}
      >
        {isSubmitting ? '提交中...' : '生成发货批次'}
      </button>
    </form>
  );
}
