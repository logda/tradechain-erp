'use client';

import { useState, type FormEvent } from 'react';
import { useMutationAttempt } from '../../_lib/use-mutation-attempt';
import {
  buildFormalRequestHeaders,
  buildFormalRequestHeadersFromSearch,
} from '../../_lib/formal-request-headers';

type QuoteSourceOption = {
  code: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
};

type EditableQuoteSource = QuoteSourceOption;

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '14px',
  background: '#ffffff',
  color: '#0f172a',
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '10px',
  padding: '10px 14px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties;

export function UpdateQuoteSourceForm({
  endpoint,
  item,
  updatedBy,
  actorAccessScopes,
  onSuccess,
}: {
  endpoint: string;
  item: QuoteSourceOption[];
  updatedBy: string;
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  onSuccess?: (items: QuoteSourceOption[]) => void;
}) {
  const [rows, setRows] = useState<EditableQuoteSource[]>(item);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attempt = useMutationAttempt();

  function resolveRequestHeaders() {
    if (actorAccessScopes) {
      return buildFormalRequestHeaders({
        role: 'admin',
        user: updatedBy,
        accessScopes: actorAccessScopes,
      });
    }

    if (typeof window === 'undefined') {
      return buildFormalRequestHeadersFromSearch(new URLSearchParams(), {
        role: 'admin',
        user: updatedBy,
      });
    }

    return buildFormalRequestHeadersFromSearch(
      new URLSearchParams(window.location.search),
      { role: 'admin', user: updatedBy },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || attempt.isComplete) {
      return;
    }

    const requestKey = attempt.begin();
    if (!requestKey) return;
    setIsSubmitting(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...resolveRequestHeaders(),
          'Idempotency-Key': requestKey,
        },
        body: JSON.stringify({
          items: rows.map((row, index) => ({
            code: row.code,
            label: row.label,
            enabled: row.enabled,
            sortOrder: index + 1,
          })),
          updatedBy,
        }),
      });

      if (!response.ok) {
        attempt.fail();
        setError('保存报价来源字典失败');
        return;
      }

      const result = (await response.json().catch(() => null)) as
        | { items?: QuoteSourceOption[] }
        | null;
      if (Array.isArray(result?.items)) {
        setRows(result.items);
        onSuccess?.(result.items);
      }

      setMessage('报价来源字典已保存');
      attempt.succeed();
    } catch {
      attempt.fail();
      setError('保存报价来源字典失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChangeCapture={attempt.resetAfterEdit} style={{ display: 'grid', gap: '16px' }}>
      {rows.map((row, index) => (
        <div
          key={`${row.code}-${index}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1.2fr auto auto',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <input
            aria-label={`source-code-${index}`}
            value={row.code}
            onChange={(event) =>
              setRows((items) =>
                items.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, code: event.target.value } : item,
                ),
              )
            }
            style={inputStyle}
          />
          <input
            aria-label={`source-label-${index}`}
            value={row.label}
            onChange={(event) =>
              setRows((items) =>
                items.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, label: event.target.value } : item,
                ),
              )
            }
            style={inputStyle}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(event) =>
                setRows((items) =>
                  items.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, enabled: event.target.checked } : item,
                  ),
                )
              }
            />
            启用
          </label>
          <button
            type="button"
            style={{ ...buttonStyle, background: '#ffffff', color: '#0f172a' }}
            onClick={() => {
              attempt.resetAfterEdit();
              setRows((items) => items.filter((_, itemIndex) => itemIndex !== index));
            }}
          >
            删除
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={{ ...buttonStyle, background: '#ffffff', color: '#0f172a' }}
          onClick={() => {
            attempt.resetAfterEdit();
            setRows((items) => [
              ...items,
              {
                code: '',
                label: '',
                enabled: true,
                sortOrder: items.length + 1,
              },
            ]);
          }}
        >
          新增来源
        </button>
        <button type="submit" style={buttonStyle} disabled={isSubmitting || attempt.isComplete}>
          {isSubmitting ? '保存中...' : '保存来源字典'}
        </button>
      </div>

      {message ? <p style={{ margin: 0, color: '#166534' }}>{message}</p> : null}
      {error ? <p style={{ margin: 0, color: '#b91c1c' }}>{error}</p> : null}
    </form>
  );
}
