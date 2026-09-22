import type { CSSProperties } from 'react';

export const formalActionFormStyle = {
  display: 'grid',
  gap: '12px',
  alignSelf: 'start',
  justifySelf: 'start',
} satisfies CSSProperties;

export const formalActionButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '168px',
  border: '1px solid rgba(15, 23, 42, 0.12)',
  borderRadius: '16px',
  padding: '12px 18px',
  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 14px 30px rgba(15, 23, 42, 0.16)',
  letterSpacing: '0.01em',
  transition: 'transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease',
} satisfies CSSProperties;

export const formalActionButtonDisabledStyle = {
  border: '1px solid #cbd5e1',
  background: '#e2e8f0',
  color: '#64748b',
  cursor: 'not-allowed',
  boxShadow: 'none',
} satisfies CSSProperties;
