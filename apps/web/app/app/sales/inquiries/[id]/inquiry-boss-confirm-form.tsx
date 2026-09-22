'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitFormalJsonMutationAction } from '../../../_actions/formal-mutation-action';
import {
  formatCounterpartyBilingualDisplay,
  formatCounterpartyChineseDisplay,
} from '../../../_lib/counterparty-display';

type InquiryBossConfirmFormProps = {
  endpoint: string;
  label: string;
  requestHeaders?: Record<string, string>;
  quoteNo: string;
  quoteVersionNo: number;
  customerName: string;
  customerFullName?: string | null;
  items: Array<{
    itemId: number;
    lineNo: number;
    sku: string;
    productName: string;
    requiredSupplierCount: number;
    supplierQuotes: Array<{
      supplierSourceMode: 'counterparty' | 'manual';
      supplierId?: number;
      supplierCode?: string;
      supplierName: string;
      purchasePrice: number;
      productId?: number;
      productSku?: string;
      productStatus?: 'active' | 'inactive' | 'deleted';
      productSizeCm?: string;
      productMaterial?: string;
      productPackaging?: string;
      productWeightG?: number;
      bulkLeadTimeDays?: string;
      cartonQuantity?: number;
      outerCartonSizeCm?: string;
      outerCartonGrossWeightKg?: number;
      remark?: string;
    }>;
    confirmedSalePrice: number;
    confirmedSupplierQuoteIndex?: number;
  }>;
};

type FormState = {
  error: string | null;
  success: string | null;
};

const initialState: FormState = {
  error: null,
  success: null,
};

const cardStyle = {
  display: 'grid',
  gap: '18px',
  alignSelf: 'start',
  border: '1px solid #d4dde7',
  borderRadius: '24px',
  padding: '22px',
  background:
    'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, #f8fbff 58%, #eef5fb 100%)',
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
} satisfies React.CSSProperties;

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  paddingBottom: '4px',
} satisfies React.CSSProperties;

const eyebrowStyle = {
  margin: 0,
  fontSize: '12px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
} satisfies React.CSSProperties;

const titleStyle = {
  margin: '6px 0 0',
  fontSize: '22px',
  color: '#0f172a',
} satisfies React.CSSProperties;

const badgeStyle = {
  border: '1px solid #c7d2e0',
  borderRadius: '999px',
  padding: '7px 12px',
  background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
  color: '#0f172a',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.03em',
} satisfies React.CSSProperties;

const summaryStyle = {
  margin: 0,
  color: '#475569',
  fontSize: '13px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const itemListStyle = {
  display: 'grid',
  gap: '14px',
} satisfies React.CSSProperties;

const itemCardStyle = {
  display: 'grid',
  gap: '10px',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '16px',
  background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
} satisfies React.CSSProperties;

const itemTitleStyle = {
  margin: 0,
  color: '#0f172a',
  fontWeight: 800,
} satisfies React.CSSProperties;

const metaStyle = {
  margin: 0,
  color: '#64748b',
  fontSize: '12px',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  color: '#334155',
  fontSize: '13px',
  fontWeight: 700,
} satisfies React.CSSProperties;

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '11px 12px',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '15px',
  boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '999px',
  padding: '13px 20px',
  background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 14px 30px rgba(15, 23, 42, 0.18)',
} satisfies React.CSSProperties;

const actionHintStyle = {
  margin: 0,
  color: '#475569',
  fontSize: '13px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const messageStyle = {
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

function getLowestPurchasePrice(
  item: InquiryBossConfirmFormProps['items'][number],
) {
  const prices = item.supplierQuotes
    .map((quote) => quote.purchasePrice)
    .filter((price) => Number.isFinite(price) && price > 0);

  return prices.length > 0 ? Math.min(...prices) : 0;
}

function buildInitialPriceMap(items: InquiryBossConfirmFormProps['items']) {
  return Object.fromEntries(
    items.map((item) => [
      item.itemId,
      item.confirmedSalePrice > 0 ? String(item.confirmedSalePrice) : '',
    ]),
  ) as Record<number, string>;
}

function buildInitialSupplierSelectionMap(items: InquiryBossConfirmFormProps['items']) {
  return Object.fromEntries(
    items.map((item) => {
      const existingIndex =
        Number.isInteger(item.confirmedSupplierQuoteIndex) &&
        item.confirmedSupplierQuoteIndex !== undefined
          ? item.confirmedSupplierQuoteIndex
          : -1;
      const fallbackIndex =
        existingIndex >= 0 && existingIndex < item.supplierQuotes.length
          ? existingIndex
          : item.supplierQuotes.length > 0
            ? 0
            : -1;

      return [item.itemId, String(fallbackIndex)];
    }),
  ) as Record<number, string>;
}

function formatSupplierChoice(
  supplierQuote: InquiryBossConfirmFormProps['items'][number]['supplierQuotes'][number],
) {
  const supplierLabel = supplierQuote.supplierCode
    ? `${supplierQuote.supplierCode} / ${formatCounterpartyChineseDisplay(supplierQuote.supplierName, {
        code: supplierQuote.supplierCode,
      })}`
    : formatCounterpartyChineseDisplay(supplierQuote.supplierName);

  return `${supplierLabel} / 采购价 ${supplierQuote.purchasePrice}`;
}

function SupplierQuoteDetails({
  supplierQuote,
}: {
  supplierQuote: InquiryBossConfirmFormProps['items'][number]['supplierQuotes'][number];
}) {
  return (
    <span style={{ display: 'grid', gap: '4px', color: '#475569', fontWeight: 500 }}>
      <span>
        尺寸 {supplierQuote.productSizeCm || '-'} cm · 材质 {supplierQuote.productMaterial || '-'} ·
        包装 {supplierQuote.productPackaging || '-'}
      </span>
      <span>
        产品重量 {supplierQuote.productWeightG ?? '-'} g · 大货交期{' '}
        {supplierQuote.bulkLeadTimeDays || '-'} 天 · 装箱数 {supplierQuote.cartonQuantity ?? '-'} 个
      </span>
      <span>
        外箱尺寸 {supplierQuote.outerCartonSizeCm || '-'} cm · 外箱毛重{' '}
        {supplierQuote.outerCartonGrossWeightKg ?? '-'} kg
      </span>
      <span>备注 {supplierQuote.remark || '-'}</span>
    </span>
  );
}

export function InquiryBossConfirmForm({
  endpoint,
  label,
  requestHeaders,
  quoteNo,
  quoteVersionNo,
  customerName,
  customerFullName,
  items,
}: InquiryBossConfirmFormProps) {
  let router: { refresh?: () => void } = {};
  try {
    router = useRouter();
  } catch {
    router = {};
  }

  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalPrices, setFinalPrices] = useState<Record<number, string>>(() =>
    buildInitialPriceMap(items),
  );
  const [selectedSupplierIndexes, setSelectedSupplierIndexes] = useState<
    Record<number, string>
  >(() => buildInitialSupplierSelectionMap(items));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (items.length === 0) {
      setState({
        error: '询价单没有可确认的明细，请先确认供应商比价明细。',
        success: null,
      });
      return;
    }

    const nextItems = items.map((item) => ({
      itemId: item.itemId,
      supplierQuoteCount: item.supplierQuotes.length,
      confirmedSalePrice: Number(finalPrices[item.itemId] ?? 0),
      selectedSupplierQuoteIndex: Number(selectedSupplierIndexes[item.itemId] ?? -1),
    }));

    const invalidItem = nextItems.find(
      (item) =>
        item.supplierQuoteCount < 2 ||
        !Number.isFinite(item.confirmedSalePrice) ||
        item.confirmedSalePrice <= 0 ||
        !Number.isInteger(item.selectedSupplierQuoteIndex) ||
        item.selectedSupplierQuoteIndex < 0 ||
        item.selectedSupplierQuoteIndex >= item.supplierQuoteCount,
    );

    if (invalidItem) {
      const lineNo =
        items.find((item) => item.itemId === invalidItem.itemId)?.lineNo ?? '';
      setState({
        error: `第 ${lineNo} 行需要至少 2 条供应商报价，选择最终供应商，并填写大于 0 的最终售价。`,
        success: null,
      });
      return;
    }

    setState(initialState);
    setIsSubmitting(true);

    try {
      const result = await submitFormalJsonMutationAction(
        endpoint,
        'POST',
        { items: nextItems },
        requestHeaders,
      );

      if (!result.ok) {
        setState({
          error: result.error,
          success: null,
        });
        return;
      }

      setState({
        error: null,
        success: '老板确认成功，最终售价已保存。',
      });
      router.refresh?.();
    } catch {
      setState({
        error: '老板确认失败，请稍后重试。',
        success: null,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Boss Approval</p>
          <h3 style={titleStyle}>老板确认</h3>
        </div>
        <span style={badgeStyle}>V{quoteVersionNo}</span>
      </div>

      <p style={summaryStyle}>报价单 {quoteNo}</p>
      <p style={summaryStyle}>
        客户：
        {formatCounterpartyBilingualDisplay(customerName, {
          fullName: customerFullName,
        })}
      </p>
      <p style={summaryStyle}>
        请根据销售报价、供应商采购价和利润空间填写最终售价，再点击老板确认。
      </p>

      <div style={itemListStyle}>
        {items.map((item) => (
          <section key={item.itemId} style={itemCardStyle}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <p style={itemTitleStyle}>
                行 {item.lineNo} / {item.productName}
              </p>
              <p style={metaStyle}>
                {item.sku} · 已录入 {item.supplierQuotes.length} 条供应商报价 · 最低采购价：
                {getLowestPurchasePrice(item)}
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label={`行 ${item.lineNo} 最终供应商`}
              style={{ display: 'grid', gap: '8px' }}
            >
              {item.supplierQuotes.map((supplierQuote, index) => (
                <label
                  key={`${item.itemId}-${index}`}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    border: '1px solid #d8e1ea',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    background:
                      selectedSupplierIndexes[item.itemId] === String(index)
                        ? '#eff6ff'
                        : '#ffffff',
                    color: '#0f172a',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  <input
                    type="radio"
                    name={`selectedSupplierQuoteIndex-${item.itemId}`}
                    checked={selectedSupplierIndexes[item.itemId] === String(index)}
                    onChange={() =>
                      setSelectedSupplierIndexes((current) => ({
                        ...current,
                        [item.itemId]: String(index),
                      }))
                    }
                  />
                  <span style={{ display: 'grid', gap: '6px' }}>
                    <span>{formatSupplierChoice(supplierQuote)}</span>
                    <SupplierQuoteDetails supplierQuote={supplierQuote} />
                  </span>
                  {supplierQuote.productSku ? (
                    <span style={{ color: '#64748b', fontWeight: 600 }}>
                      产品草稿 {supplierQuote.productSku}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
            <div
              style={{
                display: 'grid',
                gap: '12px',
                gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 0.8fr)',
                alignItems: 'end',
              }}
            >
              <p style={actionHintStyle}>
                先核对销售报价、供应商采购价和利润空间，再手动填写该行最终售价。
              </p>
              <label style={labelStyle}>
                行 {item.lineNo} 最终售价
                <input
                  className="erp-control"
                  aria-label={`行 ${item.lineNo} 最终售价`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalPrices[item.itemId] ?? ''}
                  onChange={(event) => {
                    setFinalPrices((current) => ({
                      ...current,
                      [item.itemId]: event.target.value,
                    }));
                  }}
                  style={inputStyle}
                />
              </label>
            </div>
          </section>
        ))}
      </div>

      {state.error ? (
        <p role="alert" style={{ ...messageStyle, color: '#b91c1c' }}>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p style={{ ...messageStyle, color: '#166534' }}>{state.success}</p>
      ) : null}
      {items.length === 0 ? (
        <p role="alert" style={{ ...messageStyle, color: '#b91c1c' }}>
          询价单没有可确认的明细，请先确认供应商比价明细。
        </p>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="erp-button erp-button--primary" type="submit" disabled={isSubmitting || items.length === 0}>
          {isSubmitting ? '确认中...' : label}
        </button>
      </div>
    </form>
  );
}
