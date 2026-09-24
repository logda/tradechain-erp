'use client';

import { type FormEvent, useState } from 'react';
import {
  buildFormalRequestHeaders,
  buildFormalRequestHeadersFromSearch,
} from '../../_lib/formal-request-headers';
import { submitFormalJsonMutationAction } from '../../_actions/formal-mutation-action';
import { useMutationAttempt } from '../../_lib/use-mutation-attempt';
import {
  buildDocumentCodePreview,
  describeDocumentCodeRule,
  normalizeDocumentCodeRule,
  validateDocumentCodeRule,
  type DocumentCodeRule,
  type DocumentCodeRuleSegment,
} from './document-code-rule';

type UpdateDocumentCodeRuleFormProps = {
  endpoint: string;
  item: DocumentCodeRule;
  updatedBy: string;
  title: string;
  description: string;
  examplePrefix: string;
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
};

const formStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const cardStyle = {
  display: 'grid',
  gap: '12px',
  border: '1px solid #d7e0ea',
  borderRadius: '18px',
  padding: '16px',
  background: '#f8fafc',
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '12px',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  fontSize: '13px',
  color: '#334155',
} satisfies React.CSSProperties;

const inlineLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  color: '#334155',
  fontWeight: 600,
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cfd8e3',
  borderRadius: '12px',
  padding: '12px 14px',
  background: '#ffffff',
  color: '#0f172a',
} satisfies React.CSSProperties;

const helperStyle = {
  margin: 0,
  fontSize: '12px',
  lineHeight: 1.7,
  color: '#64748b',
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '10px 16px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  width: 'fit-content',
} satisfies React.CSSProperties;

function resolveRequestHeaders(
  updatedBy: string,
  actorAccessScopes?: UpdateDocumentCodeRuleFormProps['actorAccessScopes'],
) {
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

function hasEnabledSegment(item: DocumentCodeRule, key: DocumentCodeRuleSegment['key']) {
  return item.segments.some((segment) => segment.key === key && segment.enabled);
}

function getSegmentValue(item: DocumentCodeRule, key: DocumentCodeRuleSegment['key']) {
  return item.segments.find((segment) => segment.key === key)?.value ?? '';
}

function buildSegments(config: {
  prefixEnabled: boolean;
  prefixValue: string;
  yearEnabled: boolean;
  monthEnabled: boolean;
  dayEnabled: boolean;
}): DocumentCodeRuleSegment[] {
  const segments: DocumentCodeRuleSegment[] = [];
  let order = 1;

  if (config.prefixEnabled) {
    segments.push({ key: 'prefix', enabled: true, order, value: config.prefixValue });
    order += 1;
  }

  if (config.yearEnabled) {
    segments.push({ key: 'year', enabled: true, order });
    order += 1;
  }

  if (config.monthEnabled) {
    segments.push({ key: 'month', enabled: true, order });
    order += 1;
  }

  if (config.dayEnabled) {
    segments.push({ key: 'day', enabled: true, order });
    order += 1;
  }

  segments.push({ key: 'serial', enabled: true, order });

  return segments;
}

const serialScopeLabels: Record<DocumentCodeRule['serialScope'], string> = {
  global_total: '按总量流水',
  global_year: '按年流水',
  global_month: '按月流水',
  global_day: '按日流水',
};

export function UpdateDocumentCodeRuleForm({
  endpoint,
  item,
  updatedBy,
  title,
  description,
  examplePrefix,
  actorAccessScopes,
}: UpdateDocumentCodeRuleFormProps) {
  const [serialLength, setSerialLength] = useState(String(item.serialLength));
  const [serialScope, setSerialScope] = useState<DocumentCodeRule['serialScope']>(
    item.serialScope,
  );
  const [prefixEnabled, setPrefixEnabled] = useState(hasEnabledSegment(item, 'prefix'));
  const [prefixValue, setPrefixValue] = useState(getSegmentValue(item, 'prefix') || examplePrefix);
  const [yearEnabled, setYearEnabled] = useState(hasEnabledSegment(item, 'year'));
  const [monthEnabled, setMonthEnabled] = useState(hasEnabledSegment(item, 'month'));
  const [dayEnabled, setDayEnabled] = useState(hasEnabledSegment(item, 'day'));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attempt = useMutationAttempt();

  const previewRule: DocumentCodeRule = {
    strategy: 'composed_segments',
    serialLength: Number(serialLength) || item.serialLength,
    serialScope,
    segments: buildSegments({
      prefixEnabled,
      prefixValue,
      yearEnabled,
      monthEnabled,
      dayEnabled,
    }),
    updatedAt: item.updatedAt,
    updatedBy,
  };
  const validation = validateDocumentCodeRule(previewRule);
  const previewCode = buildDocumentCodePreview(previewRule, {
    prefix: prefixValue,
    now: '2026-08-08T08:00:00.000Z',
    sequence: 1,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || attempt.isComplete) {
      return;
    }

    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setError(null);
    setMessage(null);
    const requestKey = attempt.begin();
    if (!requestKey) return;
    setIsSubmitting(true);

    try {
      const result = await submitFormalJsonMutationAction(
        endpoint,
        'PATCH',
        {
          strategy: 'composed_segments',
          serialLength: Number(serialLength),
          serialScope,
          segments: previewRule.segments,
          updatedBy,
        },
        resolveRequestHeaders(updatedBy, actorAccessScopes),
        requestKey,
      );

      if (!result.ok) {
        attempt.fail();
        setError(result.error);
        return;
      }

      setMessage('单据编号规则已保存');
      attempt.succeed();
    } catch {
      attempt.fail();
      setError('保存单据编号规则失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChangeCapture={attempt.resetAfterEdit} style={formStyle}>
      <section style={cardStyle}>
        <div>
          <h3 style={{ margin: '0 0 6px' }}>{title}</h3>
          <p style={helperStyle}>{description}</p>
          <p style={helperStyle}>{describeDocumentCodeRule(previewRule)}</p>
        </div>
        <div style={gridStyle}>
          <label style={labelStyle}>
            <span style={inlineLabelStyle}>
              <input
                type="checkbox"
                checked={prefixEnabled}
                onChange={(event) => setPrefixEnabled(event.target.checked)}
              />
              固定前缀
            </span>
            <input
              value={prefixValue}
              onChange={(event) => setPrefixValue(event.target.value.toUpperCase())}
              style={inputStyle}
              disabled={!prefixEnabled}
              placeholder={`例如 ${examplePrefix}`}
            />
          </label>

          <label style={inlineLabelStyle}>
            <input
              type="checkbox"
              checked={yearEnabled}
              onChange={(event) => setYearEnabled(event.target.checked)}
            />
            年
          </label>

          <label style={inlineLabelStyle}>
            <input
              type="checkbox"
              checked={monthEnabled}
              onChange={(event) => setMonthEnabled(event.target.checked)}
            />
            月
          </label>

          <label style={inlineLabelStyle}>
            <input
              type="checkbox"
              checked={dayEnabled}
              onChange={(event) => setDayEnabled(event.target.checked)}
            />
            日
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <div>
          <h3 style={{ margin: '0 0 6px' }}>流水规则</h3>
          <p style={helperStyle}>单据号最后一段固定为流水号，建议保留至少 4 位。</p>
        </div>
        <div style={gridStyle}>
          <label style={labelStyle}>
            流水位数
            <input
              type="number"
              min={2}
              max={6}
              value={serialLength}
              onChange={(event) => setSerialLength(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            流水重置方式
            <select
              value={serialScope}
              onChange={(event) =>
                setSerialScope(event.target.value as DocumentCodeRule['serialScope'])
              }
              style={inputStyle}
            >
              {Object.entries(serialScopeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            预览
            <input readOnly value={previewCode} style={inputStyle} />
          </label>
        </div>
      </section>

      {error ? <p style={{ margin: 0, color: '#b91c1c' }}>{error}</p> : null}
      {message ? <p style={{ margin: 0, color: '#0f766e' }}>{message}</p> : null}

      <button type="submit" style={buttonStyle} disabled={isSubmitting || attempt.isComplete}>
        {isSubmitting ? '保存中...' : '保存规则'}
      </button>
    </form>
  );
}
