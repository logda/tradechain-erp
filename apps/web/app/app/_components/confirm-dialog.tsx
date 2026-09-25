'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const overlayStyle = {
  position: 'fixed' as const,
  inset: 0,
  zIndex: 100,
  display: 'grid',
  placeItems: 'center',
  padding: '16px',
  background: 'rgba(15, 23, 42, 0.48)',
} satisfies React.CSSProperties;

const buttonStyle = {
  minHeight: '40px',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '0 16px',
  background: '#fff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties;

export function ConfirmDialog({ message, confirmLabel = '确认', busy = false, onConfirm, onCancel }: {
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div style={overlayStyle}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={`${dialogId}-message`}
        className="erp-dialog"
        style={{ width: 'min(440px, 100%)', padding: '24px' }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) {
            event.preventDefault();
            onCancel();
          }
          if (event.key === 'Tab') {
            if (event.shiftKey && document.activeElement === cancelRef.current) {
              event.preventDefault();
              confirmRef.current?.focus();
            } else if (!event.shiftKey && document.activeElement === confirmRef.current) {
              event.preventDefault();
              cancelRef.current?.focus();
            }
          }
        }}
      >
        <h2 id={`${dialogId}-title`} style={{ margin: '0 0 12px', fontSize: '18px', color: '#0f172a' }}>请确认操作</h2>
        <p id={`${dialogId}-message`} style={{ margin: '0 0 24px', color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel} style={buttonStyle}>取消</button>
          <button ref={confirmRef} type="button" disabled={busy} onClick={onConfirm} style={{ ...buttonStyle, borderColor: '#0f172a', background: '#0f172a', color: '#fff' }}>{busy ? '处理中...' : confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
