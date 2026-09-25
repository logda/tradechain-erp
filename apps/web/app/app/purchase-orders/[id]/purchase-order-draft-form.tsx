'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CounterpartyPicker,
  formatCounterpartyOptionLabel,
} from '../../_components/counterparty-picker';
import {
  formalActionButtonStyle,
  formalActionFormStyle,
} from '../../_components/formal-action-button-style';
import { submitFormalMutationAction } from '../../_actions/formal-mutation-action';
import { useMutationAttempt } from '../../_lib/use-mutation-attempt';
import type { CounterpartyOption } from '../../_lib/counterparty-options';
import type { MutationField } from '../../_lib/mutation-action';

type PurchaseDraftLineItem = {
  lineNo: number;
  sku: string;
  productName: string;
  unitPrice: number;
};

type SupplierMode = 'counterparty' | 'manual';

type PurchaseOrderDraftFormProps = {
  endpoint: string;
  currentStatus: string;
  currentOwnerName: string;
  supplierOptions: CounterpartyOption[];
  currentSupplierId: number;
  currentSupplierName: string;
  items: PurchaseDraftLineItem[];
  requestHeaders: Record<string, string>;
};

const fieldGridStyle = {
  display: 'grid',
  gap: '14px',
  minWidth: 'min(100%, 520px)',
} satisfies React.CSSProperties;

const fieldLabelStyle = {
  display: 'grid',
  gap: '8px',
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

const readonlyInputStyle = {
  ...inputStyle,
  background: '#f8fafc',
  color: '#334155',
} satisfies React.CSSProperties;

const helpTextStyle = {
  margin: 0,
  fontSize: '12px',
  lineHeight: 1.5,
  color: '#64748b',
} satisfies React.CSSProperties;

const modeGroupStyle = {
  display: 'inline-flex',
  gap: '8px',
  flexWrap: 'wrap',
} satisfies React.CSSProperties;

function buildModeButtonStyle(active: boolean) {
  return {
    border: active ? '1px solid #0f172a' : '1px solid #cbd5e1',
    borderRadius: '999px',
    padding: '8px 12px',
    background: active ? '#0f172a' : '#ffffff',
    color: active ? '#ffffff' : '#334155',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
  } satisfies React.CSSProperties;
}

function resolveInitialSupplierMode(supplierId: number, supplierName: string): SupplierMode {
  if (supplierId > 0) {
    return 'counterparty';
  }

  return supplierName.trim() && supplierName.trim() !== '待补供应商'
    ? 'manual'
    : 'counterparty';
}

function formatUnexpectedActionError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return `操作失败：${error.message}`;
  }

  return '操作失败';
}

export function PurchaseOrderDraftForm({
  endpoint,
  currentStatus,
  currentOwnerName,
  supplierOptions,
  currentSupplierId,
  currentSupplierName,
  items,
  requestHeaders,
}: PurchaseOrderDraftFormProps) {
  let router: { refresh?: () => void } = {};
  try {
    router = useRouter();
  } catch {
    router = {};
  }
  const [supplierMode, setSupplierMode] = useState<SupplierMode>(
    resolveInitialSupplierMode(currentSupplierId, currentSupplierName),
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState(
    currentSupplierId > 0 ? String(currentSupplierId) : '',
  );
  const [manualSupplierName, setManualSupplierName] = useState(
    currentSupplierId > 0 || currentSupplierName === '待补供应商'
      ? ''
      : currentSupplierName,
  );
  const [message, setMessage] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attempt = useMutationAttempt();

  const selectedSupplier = useMemo(
    () =>
      supplierOptions.find((option) => String(option.id) === selectedSupplierId) ??
      null,
    [selectedSupplierId, supplierOptions],
  );
  const supplierIdValue =
    supplierMode === 'counterparty' && selectedSupplier ? selectedSupplier.id : 0;
  const supplierNameValue =
    supplierMode === 'counterparty'
      ? selectedSupplier?.name ?? ''
      : manualSupplierName;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || attempt.isComplete) {
      return;
    }

    setMessage({ error: null, success: null });
    const requestKey = attempt.begin();
    if (!requestKey) return;
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const fields: MutationField[] = [
      { name: 'currentStatus', value: currentStatus },
      { name: 'ownerName', value: currentOwnerName },
      { name: 'supplierId', value: supplierIdValue, dataType: 'number' },
      { name: 'supplierName', value: supplierNameValue },
      ...items.map((item) => ({
        name: `unitPrice:${item.lineNo}`,
        value: item.unitPrice > 0 ? item.unitPrice : '',
        dataType: 'number' as const,
      })),
    ];

    try {
      const result = await submitFormalMutationAction(
        endpoint,
        fields,
        formData,
        requestHeaders,
        requestKey,
      );
      if (!result.ok) {
        attempt.fail();
        setMessage({ error: result.error, success: null });
        return;
      }

      setMessage({ error: null, success: '采购单草稿已保存' });
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
    <form onSubmit={handleSubmit} onChangeCapture={attempt.resetAfterEdit} style={formalActionFormStyle}>
      <input name="currentStatus" type="hidden" value={currentStatus} />
      <input name="ownerName" type="hidden" value={currentOwnerName} />
      <input name="supplierId" type="hidden" value={supplierIdValue} />
      <input name="supplierName" type="hidden" value={supplierNameValue} />

      <div style={fieldGridStyle}>
        <label style={fieldLabelStyle}>
          采购负责人 Purchase Owner *
          <strong>{currentOwnerName}</strong>
          <span style={helpTextStyle}>
            采购负责人已确定；保存草稿与提交审批都不能更改。
          </span>
        </label>

        <div style={fieldLabelStyle}>
          <span>供应商录入方式 Supplier Mode</span>
          <span role="group" aria-label="供应商录入方式 Supplier Mode" style={modeGroupStyle}>
            <button
              type="button"
              aria-pressed={supplierMode === 'counterparty'}
              style={buildModeButtonStyle(supplierMode === 'counterparty')}
              onClick={() => setSupplierMode('counterparty')}
            >
              从往来单位选择
            </button>
            <button
              type="button"
              aria-pressed={supplierMode === 'manual'}
              style={buildModeButtonStyle(supplierMode === 'manual')}
              onClick={() => setSupplierMode('manual')}
            >
              手工填写
            </button>
          </span>
          <span style={helpTextStyle}>两种方式二选一，保存时只提交当前方式的供应商信息。</span>
        </div>

        {supplierMode === 'counterparty' ? (
          <label style={fieldLabelStyle}>
            供应商 Supplier
            <input
              aria-label="供应商 Supplier"
              readOnly
              value={
                selectedSupplier
                  ? formatCounterpartyOptionLabel(selectedSupplier, {
                      nameOrder: 'chinese-english',
                    })
                  : ''
              }
              placeholder="请选择供应商"
              style={readonlyInputStyle}
            />
            <CounterpartyPicker
              title="选择供应商"
              description="仅显示供应商类型往来单位，支持按编码、中文名称、英文名称筛选。"
              buttonLabel="选择供应商"
              selectedLabel="当前供应商"
              nameOrder="chinese-english"
              options={supplierOptions}
              selectedId={selectedSupplierId}
              onSelect={(option) => setSelectedSupplierId(String(option.id))}
            />
          </label>
        ) : (
          <label style={fieldLabelStyle}>
            手动供应商名称 Manual Supplier
            <input
              name="manualSupplierName"
              value={manualSupplierName}
              onChange={(event) => setManualSupplierName(event.target.value)}
              placeholder="例如：测试供应商-001"
              style={inputStyle}
            />
          </label>
        )}

        {items.map((item) => (
          <label key={item.lineNo} style={fieldLabelStyle}>
            {`第 ${item.lineNo} 行采购价 Unit Price *`}
            <input
              name={`unitPrice:${item.lineNo}`}
              type="number"
              required
              min="0.01"
              step="0.01"
              defaultValue={item.unitPrice > 0 ? item.unitPrice : ''}
              placeholder="请输入采购价"
              style={inputStyle}
            />
            <span style={helpTextStyle}>{`${item.sku} / ${item.productName}`}</span>
          </label>
        ))}
      </div>

      {message.error ? <p style={{ margin: 0, color: '#dc2626' }}>{message.error}</p> : null}
      {message.success ? <p style={{ margin: 0, color: '#15803d' }}>{message.success}</p> : null}

      <button type="submit" style={formalActionButtonStyle} disabled={isSubmitting || attempt.isComplete}>
        {isSubmitting ? '保存中...' : '保存草稿'}
      </button>
    </form>
  );
}
