'use client';

import { type FormEvent, useState } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import {
  convertQuoteToSalesAction,
  type ConvertQuoteFormState,
} from './actions';
import {
  formalActionButtonDisabledStyle,
  formalActionButtonStyle,
  formalActionFormStyle,
} from '../../app/_components/formal-action-button-style';

type ConvertQuoteFormProps = {
  quoteId: number;
  quoteNo?: string;
  quoteVersionNo?: number;
  customerId?: number;
  customerName?: string;
  customerFullName?: string | null;
  customerCode?: string;
  customerEntryMode?: 'existing' | 'manual';
  sourceCode?: string;
  inquiryDate?: string;
  destination?: string;
  requirements?: string;
  createdBy?: number;
  quoteConfirmed?: boolean;
  items?: Array<{
    lineNo: number;
    productId?: number;
    sku: string;
    productName: string;
    unit: string;
    quantity: number;
    salePrice: number;
    amount: number;
    imageUrls?: string[];
    confirmedSupplierId?: number;
    confirmedSupplierCode?: string;
    confirmedSupplierName?: string;
    confirmedPurchasePrice?: number;
    confirmedProductId?: number;
  }>;
  quoteAttachments?: Array<{
    key?: string;
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
  access?: string;
  role?: string;
  user?: string;
  variant?: 'default' | 'compact';
};

const initialState: ConvertQuoteFormState = { error: null };
const fallbackError = '转销售订单失败';
const errorStyle = {
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.6,
  color: '#b91c1c',
} satisfies React.CSSProperties;

const compactFormStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifySelf: 'start',
} satisfies React.CSSProperties;

const compactButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 'auto',
  border: '1px solid #93c5fd',
  borderRadius: '10px',
  padding: '7px 12px',
  background: '#eff6ff',
  color: '#1d4ed8',
  fontSize: '13px',
  fontWeight: 700,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  boxShadow: '0 1px 3px rgba(29, 78, 216, 0.10)',
} satisfies React.CSSProperties;

export function ConvertQuoteForm({
  quoteId,
  quoteNo,
  quoteVersionNo,
  customerId,
  customerName,
  customerFullName,
  customerCode,
  customerEntryMode,
  sourceCode,
  inquiryDate,
  destination,
  requirements,
  createdBy,
  quoteConfirmed = true,
  items,
  quoteAttachments,
  access,
  role,
  user,
  variant = 'default',
}: ConvertQuoteFormProps) {
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setState(initialState);

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);
    const resolvedRole = role?.trim() || params.get('role');
    const resolvedUser = user?.trim() || params.get('user');
    if (resolvedRole && resolvedUser) {
      formData.set('role', resolvedRole);
      formData.set('user', resolvedUser);
      formData.set('formalRedirect', 'true');
    }

    try {
      const nextState = await convertQuoteToSalesAction(initialState, formData);
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

  const isCompact = variant === 'compact';
  const buttonStyle = isCompact ? compactButtonStyle : formalActionButtonStyle;
  const submittingButtonStyle = isCompact
    ? {
        ...compactButtonStyle,
        border: '1px solid #cbd5e1',
        background: '#f1f5f9',
        color: '#64748b',
        cursor: 'not-allowed',
        boxShadow: 'none',
      }
    : {
        ...formalActionButtonStyle,
        ...formalActionButtonDisabledStyle,
      };

  return (
    <form
      onSubmit={handleSubmit}
      style={isCompact ? compactFormStyle : formalActionFormStyle}
    >
      <input name="quoteId" type="hidden" value={quoteId} />
      {quoteNo ? <input name="sourceQuoteNo" type="hidden" value={quoteNo} /> : null}
      {quoteVersionNo && quoteVersionNo > 0 ? (
        <input name="quoteVersionNo" type="hidden" value={quoteVersionNo} />
      ) : null}
      {customerId && customerId > 0 ? (
        <input name="customerId" type="hidden" value={customerId} />
      ) : null}
      {customerName ? <input name="customerName" type="hidden" value={customerName} /> : null}
      {customerFullName ? (
        <input name="customerFullName" type="hidden" value={customerFullName} />
      ) : null}
      {customerCode ? <input name="customerCode" type="hidden" value={customerCode} /> : null}
      {customerEntryMode ? (
        <input name="customerEntryMode" type="hidden" value={customerEntryMode} />
      ) : null}
      {sourceCode ? <input name="sourceCode" type="hidden" value={sourceCode} /> : null}
      {inquiryDate ? <input name="inquiryDate" type="hidden" value={inquiryDate} /> : null}
      {destination ? <input name="destination" type="hidden" value={destination} /> : null}
      {requirements ? <input name="requirements" type="hidden" value={requirements} /> : null}
      {createdBy && createdBy > 0 ? (
        <input name="createdBy" type="hidden" value={createdBy} />
      ) : null}
      {access ? <input name="access" type="hidden" value={access} /> : null}
      {items ? (
        <input name="items" type="hidden" value={JSON.stringify(items)} />
      ) : null}
      {quoteAttachments ? (
        <input
          name="quoteAttachments"
          type="hidden"
          value={JSON.stringify(quoteAttachments)}
        />
      ) : null}
      <input
        name="quoteConfirmed"
        type="hidden"
        value={quoteConfirmed ? 'true' : 'false'}
      />
      {state.error ? (
        <p role="alert" style={errorStyle}>
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        style={isSubmitting ? submittingButtonStyle : buttonStyle}
      >
        {isSubmitting ? '提交中...' : isCompact ? '转销售单' : '转为销售订单'}
      </button>
    </form>
  );
}
