'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitFormalJsonMutationAction } from '../../../_actions/formal-mutation-action';
import type { CounterpartyOption } from '../../../_lib/counterparty-options';
import { useMutationAttempt } from '../../../_lib/use-mutation-attempt';
import {
  CounterpartyPicker,
  formatCounterpartyOptionLabel,
} from '../../../_components/counterparty-picker';
import { formalActionButtonStyle } from '../../../_components/formal-action-button-style';

type SamplePurchaseExecutionFormProps = {
  endpoint: string;
  label: string;
  submitEndpoint?: string;
  submitLabel?: string;
  requestHeaders?: Record<string, string>;
  currentStatus: string;
  supplierOptions: CounterpartyOption[];
  variant?: 'draft' | 'execution';
  initialPurchaseUnit?: string;
  initialEstimatedCompletionDate?: string;
  initialSampleRequirements?: string;
  initialSamplingCost?: number;
  initialSampleQuantity?: number;
};

type PurchaseUnitMode = 'counterparty' | 'manual';
type SubmitIntent = 'save' | 'submit';

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
  border: '1px solid #dbe5ef',
  borderRadius: '22px',
  padding: '20px',
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,251,255,0.94) 100%)',
  boxShadow: '0 16px 42px rgba(15, 23, 42, 0.07)',
} satisfies React.CSSProperties;

const formStyle = {
  display: 'grid',
  gap: '14px',
  width: '100%',
  alignSelf: 'stretch',
  justifySelf: 'stretch',
} satisfies React.CSSProperties;

const cardHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'flex-start',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const titleStyle = {
  margin: 0,
  fontSize: '18px',
  color: '#0f172a',
  fontWeight: 800,
} satisfies React.CSSProperties;

const hintStyle = {
  margin: 0,
  fontSize: '13px',
  color: '#64748b',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const fieldGridStyle = {
  display: 'grid',
  gap: '14px 16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
} satisfies React.CSSProperties;

const fieldStyle = {
  display: 'grid',
  gap: '8px',
  color: '#334155',
  fontSize: '13px',
  fontWeight: 700,
} satisfies React.CSSProperties;

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  border: '1px solid #d4deea',
  borderRadius: '14px',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.96)',
  color: '#0f172a',
  fontSize: '14px',
  outline: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
} satisfies React.CSSProperties;

const segmentedControlStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '8px',
} satisfies React.CSSProperties;

function buildModeButtonStyle(isActive: boolean) {
  return {
    border: isActive ? '1px solid #0f172a' : '1px solid #d4deea',
    borderRadius: '14px',
    padding: '12px 14px',
    background: isActive ? '#0f172a' : 'rgba(255,255,255,0.96)',
    color: isActive ? '#ffffff' : '#0f172a',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
  } satisfies React.CSSProperties;
}

const formFooterStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const primaryButtonStyle = {
  ...formalActionButtonStyle,
  minWidth: '180px',
  borderRadius: '999px',
  padding: '13px 22px',
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  border: '1px solid #cbd5e1',
  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
  color: '#0f172a',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
} satisfies React.CSSProperties;

const messageStyle = {
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

function resolveInitialMode(
  purchaseUnit: string | undefined,
  supplierOptions: CounterpartyOption[],
): {
  mode: PurchaseUnitMode;
  supplierId: string;
  manualPurchaseUnit: string;
} {
  const normalizedPurchaseUnit = purchaseUnit?.trim() ?? '';
  if (!normalizedPurchaseUnit) {
    return {
      mode: 'counterparty',
      supplierId: '',
      manualPurchaseUnit: '',
    };
  }

  const matchedOption = supplierOptions.find(
    (option) =>
      option.name === normalizedPurchaseUnit ||
      option.code === normalizedPurchaseUnit ||
      `${option.code} / ${option.name}` === normalizedPurchaseUnit,
  );

  if (matchedOption) {
    return {
      mode: 'counterparty',
      supplierId: String(matchedOption.id),
      manualPurchaseUnit: '',
    };
  }

  return {
    mode: 'manual',
    supplierId: '',
    manualPurchaseUnit: normalizedPurchaseUnit,
  };
}

export function SamplePurchaseExecutionForm({
  endpoint,
  label,
  submitEndpoint,
  submitLabel = '提交样品审批',
  requestHeaders,
  currentStatus,
  supplierOptions,
  variant = 'execution',
  initialPurchaseUnit,
  initialEstimatedCompletionDate = '',
  initialSampleRequirements = '',
  initialSamplingCost = 0,
  initialSampleQuantity = 0,
}: SamplePurchaseExecutionFormProps) {
  let router: { refresh?: () => void } = {};
  try {
    router = useRouter();
  } catch {
    router = {};
  }

  const initialMode = resolveInitialMode(initialPurchaseUnit, supplierOptions);
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attempt = useMutationAttempt();
  const [submittingIntent, setSubmittingIntent] = useState<SubmitIntent | null>(null);
  const [purchaseUnitMode, setPurchaseUnitMode] = useState<PurchaseUnitMode>(initialMode.mode);
  const [supplierId, setSupplierId] = useState(initialMode.supplierId);
  const [manualPurchaseUnit, setManualPurchaseUnit] = useState(initialMode.manualPurchaseUnit);
  const [sampleRequirements, setSampleRequirements] = useState(initialSampleRequirements);
  const [samplingCost, setSamplingCost] = useState(String(initialSamplingCost));
  const [sampleQuantity, setSampleQuantity] = useState(String(initialSampleQuantity));
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState(
    initialEstimatedCompletionDate,
  );

  const selectedSupplier = supplierOptions.find((option) => String(option.id) === supplierId);
  const switchPurchaseUnitMode = (nextMode: PurchaseUnitMode) => {
    setPurchaseUnitMode(nextMode);
    if (nextMode === 'counterparty') {
      if (!supplierId && supplierOptions[0]) {
        setSupplierId(String(supplierOptions[0].id));
      }
    } else if (selectedSupplier) {
      setManualPurchaseUnit(selectedSupplier.name);
    }
  };
  const resolvedPurchaseUnit =
    purchaseUnitMode === 'counterparty'
      ? selectedSupplier?.name ?? ''
      : manualPurchaseUnit.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || attempt.isComplete) {
      return;
    }

    if (!resolvedPurchaseUnit) {
      setState({
        error:
          purchaseUnitMode === 'counterparty'
            ? '请选择采购单位'
            : '请填写采购单位',
        success: null,
      });
      return;
    }

    if (!estimatedCompletionDate.trim()) {
      setState({
        error: '请填写预计完成日期',
        success: null,
      });
      return;
    }

    if (purchaseUnitMode === 'counterparty' && !selectedSupplier) {
      setState({
        error: '请选择采购单位',
        success: null,
      });
      return;
    }

    const requestKey = attempt.begin();
    if (!requestKey) return;
    setIsSubmitting(true);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent: SubmitIntent =
      submitter instanceof HTMLButtonElement &&
      submitter.value === 'submit' &&
      submitEndpoint
        ? 'submit'
        : 'save';
    const targetEndpoint = intent === 'submit' && submitEndpoint ? submitEndpoint : endpoint;
    setSubmittingIntent(intent);
    setState(initialState);

    try {
      const result = await submitFormalJsonMutationAction(
        targetEndpoint,
        'POST',
        {
          currentStatus,
          sampleRequirements: variant === 'draft' ? sampleRequirements.trim() : undefined,
          samplingCost:
            variant === 'draft' && samplingCost.trim() !== ''
              ? Number(samplingCost)
              : undefined,
          sampleQuantity:
            variant === 'draft' && sampleQuantity.trim() !== ''
              ? Number(sampleQuantity)
              : undefined,
          purchaseUnit: resolvedPurchaseUnit,
          estimatedCompletionDate,
        },
        requestHeaders,
        requestKey,
      );

      if (!result.ok) {
        attempt.fail();
        setState({
          error: result.error,
          success: null,
        });
        return;
      }

      setState({
        error: null,
        success: intent === 'submit' ? '样品信息已提交' : '打样信息已保存',
      });
      attempt.succeed();
      router.refresh?.();
    } catch {
      attempt.fail();
      setState({
        error: '操作失败',
        success: null,
      });
    } finally {
      setIsSubmitting(false);
      setSubmittingIntent(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChangeCapture={attempt.resetFailedAfterEdit} style={formStyle}>
      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <h4 style={titleStyle}>{label}</h4>
            <p style={hintStyle}>
              {variant === 'draft'
                ? '采购先补齐打样信息，采购单位可从供应商类往来单位选择，也可切换为手工填写。'
                : '采购单位可从供应商类往来单位选择，也可切换为手工填写。'}
            </p>
          </div>
        </div>

        <div style={fieldGridStyle}>
          {variant === 'draft' ? (
            <label style={fieldStyle}>
              样品要求
              <input
                type="text"
                value={sampleRequirements}
                onChange={(event) => setSampleRequirements(event.target.value)}
                placeholder="请输入样品要求"
                style={inputStyle}
              />
            </label>
          ) : null}

          {variant === 'draft' ? (
            <label style={fieldStyle}>
              打样费
              <input
                type="number"
                min="0"
                step="0.01"
                value={samplingCost}
                onChange={(event) => setSamplingCost(event.target.value)}
                placeholder="请输入打样费"
                style={inputStyle}
              />
            </label>
          ) : null}

          <div style={fieldStyle}>
            <span>采购单位录入方式</span>
            <span role="group" aria-label="采购单位录入方式" style={segmentedControlStyle}>
              <button
                type="button"
                aria-pressed={purchaseUnitMode === 'counterparty'}
                style={buildModeButtonStyle(purchaseUnitMode === 'counterparty')}
                onClick={() => switchPurchaseUnitMode('counterparty')}
              >
                选择往来单位
              </button>
              <button
                type="button"
                aria-pressed={purchaseUnitMode === 'manual'}
                style={buildModeButtonStyle(purchaseUnitMode === 'manual')}
                onClick={() => switchPurchaseUnitMode('manual')}
              >
                手工填写
              </button>
            </span>
          </div>

          {variant === 'draft' ? (
            <label style={fieldStyle}>
              样品数量
              <input
                type="number"
                min="0"
                step="1"
                value={sampleQuantity}
                onChange={(event) => setSampleQuantity(event.target.value)}
                placeholder="请输入样品数量"
                style={inputStyle}
              />
            </label>
          ) : null}

          {purchaseUnitMode === 'counterparty' ? (
            <label style={fieldStyle}>
              采购单位
              <input
                readOnly
                value={formatCounterpartyOptionLabel(selectedSupplier, {
                  nameOrder: 'chinese-english',
                })}
                placeholder="请选择供应商"
                style={inputStyle}
              />
              <CounterpartyPicker
                buttonLabel="选择采购单位"
                nameOrder="chinese-english"
                options={supplierOptions}
                selectedId={supplierId}
                onSelect={(option) => setSupplierId(String(option.id))}
              />
            </label>
          ) : (
            <label style={fieldStyle}>
              采购单位
              <input
                type="text"
                value={manualPurchaseUnit}
                onChange={(event) => setManualPurchaseUnit(event.target.value)}
                placeholder="请输入实际工厂或供应商名称"
                style={inputStyle}
              />
            </label>
          )}

          <label style={fieldStyle}>
            预计完成日期
            <input
              type="date"
              value={estimatedCompletionDate}
              onChange={(event) => setEstimatedCompletionDate(event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
      </section>

      <div style={formFooterStyle}>
        {state.error ? (
          <p style={{ ...messageStyle, color: '#b91c1c' }}>{state.error}</p>
        ) : null}
        {state.success ? (
          <p style={{ ...messageStyle, color: '#166534' }}>{state.success}</p>
        ) : null}
        <button
          type="submit"
          value="save"
          disabled={isSubmitting || attempt.isComplete}
          style={{
            ...(submitEndpoint ? secondaryButtonStyle : primaryButtonStyle),
            ...(isSubmitting
              ? {
                  border: '1px solid #cbd5e1',
                  background: '#e2e8f0',
                  color: '#64748b',
                  boxShadow: 'none',
                }
              : {}),
          }}
        >
          {isSubmitting && submittingIntent === 'save' ? '提交中...' : label}
        </button>
        {submitEndpoint ? (
          <button
            type="submit"
            value="submit"
            disabled={isSubmitting || attempt.isComplete}
            style={{
              ...primaryButtonStyle,
              ...(isSubmitting
                ? {
                    border: '1px solid #cbd5e1',
                    background: '#e2e8f0',
                    color: '#64748b',
                    boxShadow: 'none',
                  }
                : {}),
            }}
          >
            {isSubmitting && submittingIntent === 'submit' ? '提交中...' : submitLabel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
