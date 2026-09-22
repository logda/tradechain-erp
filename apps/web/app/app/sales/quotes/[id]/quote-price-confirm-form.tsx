'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitFormalJsonMutationAction } from '../../../_actions/formal-mutation-action';

type QuotePriceConfirmFormProps = {
  endpoint: string;
  currentVersionNo: number;
  requestHeaders?: Record<string, string>;
  items: Array<{
    lineNo: number;
    productName: string;
    salePrice: number;
    confirmedSalePrice?: number;
  }>;
};

const formStyle = {
  display: 'grid',
  gap: '12px',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '6px',
  color: '#334155',
  fontSize: '13px',
  fontWeight: 700,
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '10px 12px',
  fontSize: '14px',
} satisfies React.CSSProperties;

const buttonStyle = {
  border: 0,
  borderRadius: '12px',
  padding: '11px 14px',
  background: '#0f172a',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties;

export function QuotePriceConfirmForm({
  endpoint,
  currentVersionNo,
  requestHeaders,
  items,
}: QuotePriceConfirmFormProps) {
  let router: { refresh?: () => void } = {};
  try {
    router = useRouter();
  } catch {
    router = {};
  }
  const [prices, setPrices] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.lineNo,
        String(item.confirmedSalePrice ?? item.salePrice ?? ''),
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const payloadItems = items.map((item) => ({
      lineNo: item.lineNo,
      confirmedSalePrice: Number(prices[item.lineNo]),
    }));
    const invalidItem = payloadItems.find(
      (item) => !Number.isFinite(item.confirmedSalePrice) || item.confirmedSalePrice <= 0,
    );
    if (invalidItem) {
      setError(`第 ${invalidItem.lineNo} 行最终售价必须大于 0。`);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const result = await submitFormalJsonMutationAction(
        endpoint,
        'POST',
        { currentVersionNo, items: payloadItems },
        requestHeaders,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh?.();
    } catch {
      setError('老板确认售价失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="erp-card erp-workflow-card" onSubmit={handleSubmit} style={formStyle}>
      <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: 1.6 }}>
        确认后报价单进入待客户反馈，销售再记录客户结果。
      </p>
      {items.map((item) => (
        <label key={item.lineNo} style={labelStyle}>
          {`行 ${item.lineNo} 最终售价（${item.productName}）`}
          <input
            className="erp-control"
            aria-label={`行 ${item.lineNo} 最终售价`}
            type="number"
            min="0"
            step="0.01"
            value={prices[item.lineNo] ?? ''}
            onChange={(event) =>
              setPrices((current) => ({
                ...current,
                [item.lineNo]: event.target.value,
              }))
            }
            style={inputStyle}
          />
        </label>
      ))}
      {error ? <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{error}</p> : null}
      <button className="erp-button erp-button--primary" type="submit" disabled={isSubmitting || items.length === 0}>
        {isSubmitting ? '确认中...' : '确认最终售价'}
      </button>
    </form>
  );
}
