'use client';

import { type FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  buildFormalRequestHeaders,
  buildFormalRequestHeadersFromSearch,
  parseFormalAccessScopes,
} from '../_lib/formal-request-headers';
import { submitFormalMutationAction } from '../_actions/formal-mutation-action';
import type { MutationField } from '../_lib/mutation-action';
import { createMutationRequestKey } from '../_lib/mutation-request-key';
import {
  formalActionButtonDisabledStyle,
  formalActionButtonStyle,
  formalActionFormStyle,
} from './formal-action-button-style';

type MutationActionFormProps = {
  endpoint: string;
  label: string;
  successLabel?: string;
  successRedirectBasePath?: string;
  confirmMessage?: string;
  requiredAction?: string;
  requiredActionLabel?: string;
  fields: MutationField[];
  requestHeaders?: Record<string, string>;
  onSuccess?: (result: unknown) => void;
};

type MutationActionState = {
  error: string | null;
  success: string | null;
};

const initialState: MutationActionState = {
  error: null,
  success: null,
};

function describeSuccess(result: unknown, successLabel?: string) {
  if (typeof successLabel === 'string' && successLabel.trim()) {
    return successLabel;
  }

  if (typeof result === 'object' && result !== null) {
    const maybeStatus = (result as { status?: unknown }).status;
    if (typeof maybeStatus === 'string') {
      return `操作成功，当前状态：${maybeStatus}`;
    }

    const maybeFinanceStatus = (result as { financeStatus?: unknown }).financeStatus;
    if (typeof maybeFinanceStatus === 'string') {
      return `操作成功，财务状态：${maybeFinanceStatus}`;
    }

    const maybeReceiptStatus = (result as { receiptSendStatus?: unknown }).receiptSendStatus;
    if (typeof maybeReceiptStatus === 'string') {
      return `操作成功，回单状态：${maybeReceiptStatus}`;
    }

    const maybePurchaseOrders = (result as { purchaseOrders?: unknown }).purchaseOrders;
    if (Array.isArray(maybePurchaseOrders)) {
      return `操作成功，已生成 ${maybePurchaseOrders.length} 张采购单`;
    }
  }

  return '操作成功';
}

function extractGeneratedPurchaseNos(result: unknown) {
  if (typeof result !== 'object' || result === null) {
    return [];
  }

  const maybePurchaseOrders = (result as { purchaseOrders?: unknown }).purchaseOrders;
  if (!Array.isArray(maybePurchaseOrders)) {
    return [];
  }

  return maybePurchaseOrders
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }

      const maybePurchaseNo = (item as { purchaseNo?: unknown }).purchaseNo;
      return typeof maybePurchaseNo === 'string' && maybePurchaseNo.trim()
        ? maybePurchaseNo.trim()
        : null;
    })
    .filter((item): item is string => item !== null);
}

function buildPurchaseOrderAlertMessage(result: unknown) {
  const purchaseNos = extractGeneratedPurchaseNos(result);
  if (purchaseNos.length === 0) {
    return null;
  }

  return [
    `已生成 ${purchaseNos.length} 张采购单：`,
    ...purchaseNos.map((purchaseNo) => `- ${purchaseNo}`),
    '',
    '请提醒销售和采购及时跟进。',
  ].join('\n');
}

function resolveSuccessRedirectId(result: unknown) {
  if (typeof result !== 'object' || result === null) {
    return null;
  }

  const maybeId = (result as { id?: unknown }).id;
  if (typeof maybeId === 'number' || typeof maybeId === 'string') {
    return maybeId;
  }

  return null;
}

function formatUnexpectedActionError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return `操作失败：${error.message}`;
  }

  if (typeof error === 'string' && error.trim()) {
    return `操作失败：${error}`;
  }

  return '操作失败';
}

function resolveFormalRequestHeaders(
  requestHeaders?: Record<string, string>,
): Record<string, string> {
  const params =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search);
  const accessScopes = parseFormalAccessScopes(params?.get('access') ?? null);

  if (requestHeaders) {
    if (
      requestHeaders['x-erp-actions'] ||
      !requestHeaders['x-erp-role'] ||
      !requestHeaders['x-erp-user']
    ) {
      return requestHeaders;
    }

    return {
      ...buildFormalRequestHeaders({
        role: requestHeaders['x-erp-role'],
        user: requestHeaders['x-erp-user'],
        accessScopes,
      }),
      ...requestHeaders,
    };
  }

  if (!params) {
    return {};
  }

  return buildFormalRequestHeadersFromSearch(params);
}

function hasRequiredAction(
  requiredAction: string | undefined,
  requestHeaders?: Record<string, string>,
) {
  if (!requiredAction) {
    return true;
  }

  const headers = resolveFormalRequestHeaders(requestHeaders);
  if (!headers['x-erp-role'] || !headers['x-erp-user']) {
    return true;
  }

  const actions = headers['x-erp-actions']
    ?.split(',')
    .map((action) => action.trim())
    .filter(Boolean) ?? [];

  return actions.includes(requiredAction);
}

const messageStyle = {
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const visibleFieldGridStyle = {
  display: 'grid',
  gap: '10px',
  minWidth: 'min(100%, 260px)',
} satisfies React.CSSProperties;

const visibleFieldLabelStyle = {
  display: 'grid',
  gap: '6px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#334155',
} satisfies React.CSSProperties;

const visibleFieldInputStyle = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '10px 12px',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '14px',
  outline: 'none',
} satisfies React.CSSProperties;

const helpTextStyle = {
  margin: 0,
  fontSize: '12px',
  lineHeight: 1.5,
  color: '#64748b',
} satisfies React.CSSProperties;

function getVisibleFieldLabel(field: MutationField) {
  return field.label ?? field.name;
}

export function MutationActionForm({
  endpoint,
  label,
  successLabel,
  successRedirectBasePath,
  confirmMessage,
  requiredAction,
  requiredActionLabel,
  fields,
  requestHeaders,
  onSuccess,
}: MutationActionFormProps) {
  let router: { push: (href: string) => void; refresh?: () => void } = {
    push: () => undefined,
  };

  try {
    router = useRouter();
  } catch {
    router = {
      push: () => undefined,
    };
  }

  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const submissionLocked = useRef(false);
  const requestKey = useRef<string | null>(null);
  const canSubmit = hasRequiredAction(requiredAction, requestHeaders);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLocked.current || isComplete || !canSubmit) {
      return;
    }

    if (confirmMessage && typeof window !== 'undefined') {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return;
      }
    }

    setState(initialState);
    submissionLocked.current = true;
    setIsSubmitting(true);
    requestKey.current ??= createMutationRequestKey();

    const formData = new FormData(event.currentTarget);
    const formalHeaders = resolveFormalRequestHeaders(requestHeaders);

    try {
      const result = await submitFormalMutationAction(
        endpoint,
        fields,
        formData,
        formalHeaders,
        requestKey.current,
      );

      if (!result.ok) {
        submissionLocked.current = false;
        setState({
          error: result.error,
          success: null,
        });
        return;
      }

      setState({
        error: null,
        success: describeSuccess(result.result, successLabel),
      });
      setIsComplete(true);
      onSuccess?.(result.result);

      const purchaseOrderAlertMessage = buildPurchaseOrderAlertMessage(result.result);
      if (purchaseOrderAlertMessage && typeof window !== 'undefined') {
        window.alert(purchaseOrderAlertMessage);
      }

      const redirectId = successRedirectBasePath
        ? resolveSuccessRedirectId(result.result)
        : null;
      if (successRedirectBasePath && redirectId !== null) {
        router.push(
          `${successRedirectBasePath.replace(/\/$/, '')}/${redirectId}`,
        );
      } else if (!onSuccess) {
        router.refresh?.();
      }
    } catch (error) {
      submissionLocked.current = false;
      setState({
        error: formatUnexpectedActionError(error),
        success: null,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChangeCapture={() => {
      if (state.error && !submissionLocked.current) {
        requestKey.current = null;
        setState(initialState);
      }
    }} style={formalActionFormStyle}>
      {fields.filter((field) => field.display !== 'input' && field.display !== 'select').map((field) => (
        <input
          key={field.name}
          name={field.name}
          type="hidden"
          value={String(field.value)}
        />
      ))}
      {fields.some((field) => field.display === 'input' || field.display === 'select') ? (
        <div style={visibleFieldGridStyle}>
          {fields.filter((field) => field.display === 'input' || field.display === 'select').map((field) => (
            <label key={field.name} style={visibleFieldLabelStyle}>
              <span>
                {getVisibleFieldLabel(field)}
                {field.required ? ' *' : ''}
              </span>
              {field.display === 'select' ? (
                <select
                  name={field.name}
                  defaultValue={String(field.value)}
                  required={field.required}
                  style={visibleFieldInputStyle}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={String(option.value)} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.inputType ?? 'text'}
                  defaultValue={String(field.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  step={field.inputType === 'number' ? 'any' : undefined}
                  min={field.min}
                  max={field.max}
                  style={visibleFieldInputStyle}
                />
              )}
              {field.helpText ? (
                <p style={helpTextStyle}>{field.helpText}</p>
              ) : null}
            </label>
          ))}
        </div>
      ) : null}
      {state.error ? (
        <p role="alert" style={{ ...messageStyle, color: '#b91c1c' }}>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p style={{ ...messageStyle, color: '#166534' }}>{state.success}</p>
      ) : null}
      {!canSubmit ? (
        <p role="note" style={{ ...messageStyle, color: '#b45309' }}>
          {`无权限执行：${requiredActionLabel ?? requiredAction}`}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting || isComplete || !canSubmit}
        style={{
          ...formalActionButtonStyle,
          ...(isSubmitting || isComplete || !canSubmit ? formalActionButtonDisabledStyle : {}),
        }}
      >
        {isSubmitting ? '提交中...' : label}
      </button>
    </form>
  );
}
