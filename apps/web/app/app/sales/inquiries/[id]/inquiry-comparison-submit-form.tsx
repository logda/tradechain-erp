'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitFormalJsonMutationAction } from '../../../_actions/formal-mutation-action';
import type { CounterpartyOption } from '../../../_lib/counterparty-options';
import {
  CounterpartyPicker,
  formatCounterpartyOptionLabel,
} from '../../../_components/counterparty-picker';

type InquiryComparisonSubmitFormProps = {
  endpoint: string;
  label: string;
  requestHeaders?: Record<string, string>;
  supplierOptions: CounterpartyOption[];
  items: Array<{
    itemId: number;
    lineNo: number;
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
    }>;
  }>;
};

type FormState = {
  error: string | null;
  success: string | null;
};

type DraftSupplierQuote = {
  key: string;
  supplierSourceMode: 'counterparty' | 'manual';
  supplierId: string;
  supplierName: string;
  purchasePrice: string;
  productId?: number;
  productSku?: string;
  productStatus?: 'active' | 'inactive' | 'deleted';
};

const initialState: FormState = {
  error: null,
  success: null,
};

const formStyle = {
  display: 'grid',
  gap: '14px',
} satisfies React.CSSProperties;

const hintStyle = {
  margin: 0,
  fontSize: '13px',
  color: '#475569',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const itemCardStyle = {
  display: 'grid',
  gap: '14px',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '16px',
  background: '#f8fafc',
} satisfies React.CSSProperties;

const itemTitleStyle = {
  margin: 0,
  fontSize: '14px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const entryCardStyle = {
  display: 'grid',
  gap: '12px',
  border: '1px solid #d7e0ea',
  borderRadius: '14px',
  padding: '14px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const entryGridStyle = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  fontSize: '13px',
  color: '#334155',
  fontWeight: 600,
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '12px',
  padding: '10px 12px',
  background: '#fff',
  fontSize: '14px',
  color: '#0f172a',
} satisfies React.CSSProperties;

const segmentedControlStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '8px',
} satisfies React.CSSProperties;

function buildModeButtonStyle(isActive: boolean) {
  return {
    border: isActive ? '1px solid #0f172a' : '1px solid #d7e0ea',
    borderRadius: '12px',
    padding: '10px 12px',
    background: isActive ? '#0f172a' : '#ffffff',
    color: isActive ? '#ffffff' : '#0f172a',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  } satisfies React.CSSProperties;
}

const entryMetaStyle = {
  margin: 0,
  fontSize: '12px',
  color: '#64748b',
} satisfies React.CSSProperties;

const actionRowStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '8px 12px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 600,
  cursor: 'pointer',
} satisfies React.CSSProperties;

const messageStyle = {
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '10px 14px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties;

function createDraftSupplierQuote(
  itemId: number,
  index: number,
  supplierQuote?: InquiryComparisonSubmitFormProps['items'][number]['supplierQuotes'][number],
): DraftSupplierQuote {
  return {
    key: `${itemId}-${index}`,
    supplierSourceMode: supplierQuote?.supplierSourceMode ?? 'counterparty',
    supplierId: supplierQuote?.supplierId ? String(supplierQuote.supplierId) : '',
    supplierName: supplierQuote?.supplierSourceMode === 'manual' ? supplierQuote.supplierName : '',
    purchasePrice:
      supplierQuote && supplierQuote.purchasePrice > 0
        ? String(supplierQuote.purchasePrice)
        : '',
    productId: supplierQuote?.productId,
    productSku: supplierQuote?.productSku,
    productStatus: supplierQuote?.productStatus,
  };
}

function buildInitialDraftValues(
  items: InquiryComparisonSubmitFormProps['items'],
) {
  return Object.fromEntries(
    items.map((item) => {
      const nextEntries =
        item.supplierQuotes.length > 0
          ? item.supplierQuotes.map((supplierQuote, index) =>
              createDraftSupplierQuote(item.itemId, index, supplierQuote),
            )
          : Array.from(
              { length: Math.max(item.requiredSupplierCount, 2) },
              (_, index) => createDraftSupplierQuote(item.itemId, index),
            );

      return [item.itemId, nextEntries];
    }),
  ) as Record<number, DraftSupplierQuote[]>;
}

export function InquiryComparisonSubmitForm({
  endpoint,
  label,
  requestHeaders,
  supplierOptions,
  items,
}: InquiryComparisonSubmitFormProps) {
  let router: { refresh?: () => void } = {};
  try {
    router = useRouter();
  } catch {
    router = {};
  }
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<number, DraftSupplierQuote[]>>(() =>
    buildInitialDraftValues(items),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (items.length === 0) {
      setState({
        error: '询价单没有可提交的明细，请先确认来源报价明细。',
        success: null,
      });
      return;
    }

    const nextItems = items.map((item) => {
      const entries = draftValues[item.itemId] ?? [];
      const supplierQuotes = entries
        .map((entry) => {
          const purchasePrice = Number(entry.purchasePrice);
          if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
            return null;
          }

          if (entry.supplierSourceMode === 'counterparty') {
            const matchedOption = supplierOptions.find(
              (option) => String(option.id) === entry.supplierId,
            );
            if (!matchedOption) {
              return null;
            }

            return {
              supplierSourceMode: 'counterparty' as const,
              supplierId: matchedOption.id,
              supplierCode: matchedOption.code,
              supplierName: matchedOption.name,
              purchasePrice,
              productId: entry.productId,
              productSku: entry.productSku,
              productStatus: entry.productStatus,
            };
          }

          const supplierName = entry.supplierName.trim();
          if (!supplierName) {
            return null;
          }

          return {
            supplierSourceMode: 'manual' as const,
            supplierName,
            purchasePrice,
            productId: entry.productId,
            productSku: entry.productSku,
            productStatus: entry.productStatus,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        itemId: item.itemId,
        supplierQuotes,
        requiredSupplierCount: item.requiredSupplierCount,
      };
    });

    const invalidItem = nextItems.find(
      (item) => item.supplierQuotes.length < Math.max(item.requiredSupplierCount, 2),
    );

    if (invalidItem) {
      setState({
        error: `第 ${items.find((item) => item.itemId === invalidItem.itemId)?.lineNo ?? ''} 行至少录入 2 条有效供应商报价。`,
        success: null,
      });
      return;
    }

    setIsSubmitting(true);
    setState(initialState);

    try {
      const result = await submitFormalJsonMutationAction(
        endpoint,
        'POST',
        {
          items: nextItems.map((item) => ({
            itemId: item.itemId,
            supplierQuotes: item.supplierQuotes,
          })),
        },
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
        success: '比价提交成功',
      });
      router.refresh?.();
    } catch {
      setState({
        error: '操作失败',
        success: null,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <p style={hintStyle}>每行至少录入 2 条供应商报价，供应商可从往来单位选择，也可手工填写。</p>
      <div style={{ display: 'grid', gap: '14px' }}>
        {items.map((item) => (
          <section key={item.itemId} style={itemCardStyle}>
            <p style={itemTitleStyle}>{`行 ${item.lineNo} / ${item.productName}`}</p>
            <div style={{ display: 'grid', gap: '12px' }}>
              {(draftValues[item.itemId] ?? []).map((entry, index) => {
                const supplierIndex = index + 1;
                const currentOption = supplierOptions.find(
                  (option) => String(option.id) === entry.supplierId,
                );

                return (
                  <div key={entry.key} style={entryCardStyle}>
                    <div style={entryGridStyle}>
                      <div style={labelStyle}>
                        <span>{`行 ${item.lineNo} 录入方式 ${supplierIndex}`}</span>
                        <span
                          role="group"
                          aria-label={`行 ${item.lineNo} 录入方式 ${supplierIndex}`}
                          style={segmentedControlStyle}
                        >
                          {(['counterparty', 'manual'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              aria-pressed={entry.supplierSourceMode === mode}
                              style={buildModeButtonStyle(entry.supplierSourceMode === mode)}
                              onClick={() =>
                                setDraftValues((current) => ({
                                  ...current,
                                  [item.itemId]: (current[item.itemId] ?? []).map((quoteEntry) =>
                                    quoteEntry.key === entry.key
                                      ? {
                                          ...quoteEntry,
                                          supplierSourceMode: mode,
                                          supplierId:
                                            mode === 'counterparty' ? quoteEntry.supplierId : '',
                                        }
                                      : quoteEntry,
                                  ),
                                }))
                              }
                            >
                              {mode === 'counterparty' ? '选择往来单位' : '手工填写'}
                            </button>
                          ))}
                        </span>
                      </div>

                      {entry.supplierSourceMode === 'counterparty' ? (
                        <label style={labelStyle}>
                          {`行 ${item.lineNo} 供应商 ${supplierIndex}`}
                          <input
                            readOnly
                            value={formatCounterpartyOptionLabel(currentOption, {
                              nameOrder: 'chinese-english',
                            })}
                            placeholder="请选择供应商"
                            style={inputStyle}
                          />
                          <CounterpartyPicker
                            buttonLabel="选择供应商"
                            nameOrder="chinese-english"
                            options={supplierOptions}
                            selectedId={entry.supplierId}
                            onSelect={(option) =>
                              setDraftValues((current) => ({
                                ...current,
                                [item.itemId]: (current[item.itemId] ?? []).map((quoteEntry) =>
                                  quoteEntry.key === entry.key
                                    ? {
                                        ...quoteEntry,
                                        supplierId: String(option.id),
                                      }
                                    : quoteEntry,
                                ),
                              }))
                            }
                          />
                        </label>
                      ) : (
                        <label style={labelStyle}>
                          {`行 ${item.lineNo} 手写供应商 ${supplierIndex}`}
                          <input
                            type="text"
                            value={entry.supplierName}
                            onChange={(event) =>
                              setDraftValues((current) => ({
                                ...current,
                                [item.itemId]: (current[item.itemId] ?? []).map((quoteEntry) =>
                                  quoteEntry.key === entry.key
                                    ? {
                                        ...quoteEntry,
                                        supplierName: event.target.value,
                                      }
                                    : quoteEntry,
                                ),
                              }))
                            }
                            placeholder="请输入供应商名称"
                            style={inputStyle}
                          />
                        </label>
                      )}

                      <label style={labelStyle}>
                        {`行 ${item.lineNo} 采购价 ${supplierIndex}`}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.purchasePrice}
                          onChange={(event) =>
                            setDraftValues((current) => ({
                              ...current,
                              [item.itemId]: (current[item.itemId] ?? []).map((quoteEntry) =>
                                quoteEntry.key === entry.key
                                  ? {
                                      ...quoteEntry,
                                      purchasePrice: event.target.value,
                                    }
                                  : quoteEntry,
                              ),
                            }))
                          }
                          placeholder="请输入采购价"
                          style={inputStyle}
                        />
                      </label>
                    </div>

                    {entry.supplierSourceMode === 'counterparty' && currentOption ? (
                      <p style={entryMetaStyle}>{`已选：${currentOption.code} / ${currentOption.name}`}</p>
                    ) : null}

                    {(draftValues[item.itemId] ?? []).length > Math.max(item.requiredSupplierCount, 2) ? (
                      <div style={actionRowStyle}>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftValues((current) => ({
                              ...current,
                              [item.itemId]: (current[item.itemId] ?? []).filter(
                                (quoteEntry) => quoteEntry.key !== entry.key,
                              ),
                            }))
                          }
                          style={secondaryButtonStyle}
                        >
                          {`移除报价 ${supplierIndex}`}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div style={actionRowStyle}>
              <button
                type="button"
                onClick={() =>
                  setDraftValues((current) => {
                    const currentEntries = current[item.itemId] ?? [];
                    return {
                      ...current,
                      [item.itemId]: [
                        ...currentEntries,
                        createDraftSupplierQuote(item.itemId, currentEntries.length),
                      ],
                    };
                  })
                }
                style={secondaryButtonStyle}
              >
                新增供应商报价
              </button>
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
          询价单没有可提交的明细，请先确认来源报价明细。
        </p>
      ) : null}
      <button type="submit" disabled={isSubmitting || items.length === 0} style={buttonStyle}>
        {isSubmitting ? '提交中...' : label}
      </button>
    </form>
  );
}
