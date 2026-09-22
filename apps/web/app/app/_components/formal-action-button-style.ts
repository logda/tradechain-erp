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
  minHeight: '40px',
  border: '1px solid #0f172a',
  borderRadius: '8px',
  padding: '0 16px',
  background: '#0f172a',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 6px 16px rgba(15, 23, 42, 0.12)',
} satisfies CSSProperties;

export const formalActionButtonDisabledStyle = {
  border: '1px solid #cbd5e1',
  background: '#e2e8f0',
  color: '#64748b',
  cursor: 'not-allowed',
  boxShadow: 'none',
} satisfies CSSProperties;
