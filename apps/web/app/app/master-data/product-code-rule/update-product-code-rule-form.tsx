'use client';

import { type FormEvent, useState } from 'react';
import {
  buildFormalRequestHeaders,
  buildFormalRequestHeadersFromSearch,
} from '../../_lib/formal-request-headers';
import { submitFormalJsonMutationAction } from '../../_actions/formal-mutation-action';
import {
  buildProductCodePreview,
  describeProductCodeRule,
  validateProductCodeRule,
  type ProductCodeRule,
  type ProductCodeRuleSegment,
} from '../products/product-code-rule';

type UpdateProductCodeRuleFormProps = {
  endpoint: string;
  item: ProductCodeRule;
  updatedBy: string;
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  onSuccess?: (item: ProductCodeRule) => void;
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
  actorAccessScopes?: UpdateProductCodeRuleFormProps['actorAccessScopes'],
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

function hasEnabledSegment(item: ProductCodeRule, key: ProductCodeRuleSegment['key']) {
  return item.segments.some((segment) => segment.key === key && segment.enabled);
}

function getSegmentValue(item: ProductCodeRule, key: ProductCodeRuleSegment['key']) {
  return item.segments.find((segment) => segment.key === key)?.value ?? '';
}

function buildSegments(config: {
  prefixEnabled: boolean;
  prefixValue: string;
  supplierEnabled: boolean;
  categoryEnabled: boolean;
  yearEnabled: boolean;
  monthEnabled: boolean;
}): ProductCodeRuleSegment[] {
  const segments: ProductCodeRuleSegment[] = [];
  let order = 1;

  if (config.prefixEnabled) {
    segments.push({ key: 'prefix', enabled: true, order, value: config.prefixValue });
    order += 1;
  }

  if (config.supplierEnabled) {
    segments.push({ key: 'supplier_code', enabled: true, order });
    order += 1;
  }

  if (config.categoryEnabled) {
    segments.push({ key: 'category_code', enabled: true, order });
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

  segments.push({ key: 'serial', enabled: true, order });

  return segments;
}

export function UpdateProductCodeRuleForm({
  endpoint,
  item,
  updatedBy,
  actorAccessScopes,
  onSuccess,
}: UpdateProductCodeRuleFormProps) {
  const [serialLength, setSerialLength] = useState(String(item.serialLength));
  const [serialScope, setSerialScope] = useState<ProductCodeRule['serialScope']>(
    item.serialScope,
  );
  const [prefixEnabled, setPrefixEnabled] = useState(hasEnabledSegment(item, 'prefix'));
  const [prefixValue, setPrefixValue] = useState(getSegmentValue(item, 'prefix') || 'PD');
  const [supplierEnabled, setSupplierEnabled] = useState(hasEnabledSegment(item, 'supplier_code'));
  const [categoryEnabled, setCategoryEnabled] = useState(hasEnabledSegment(item, 'category_code'));
  const [yearEnabled, setYearEnabled] = useState(hasEnabledSegment(item, 'year'));
  const [monthEnabled, setMonthEnabled] = useState(hasEnabledSegment(item, 'month'));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewRule: ProductCodeRule = {
    strategy: 'composed_segments',
    serialLength: Number(serialLength) || item.serialLength,
    serialScope,
    segments: buildSegments({
      prefixEnabled,
      prefixValue,
      supplierEnabled,
      categoryEnabled,
      yearEnabled,
      monthEnabled,
    }),
    updatedAt: item.updatedAt,
    updatedBy,
  };
  const validation = validateProductCodeRule(previewRule);
  const previewCode = buildProductCodePreview(previewRule, {
    prefix: prefixValue,
    supplierCode: 'SUP-BRAVO',
    category: 'electronics',
    now: '2026-07-17T08:00:00.000Z',
    sequence: 1,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setError(null);
    setMessage(null);
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
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (typeof result.result === 'object' && result.result !== null) {
        onSuccess?.(normalizeSavedRule(result.result, previewRule, updatedBy));
      }

      setMessage('产品编码规则已保存');
    } catch {
      setError('保存产品编码规则失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <section style={cardStyle}>
        <div>
          <h3 style={{ margin: '0 0 6px' }}>规则段配置</h3>
          <p style={helperStyle}>
            可自由组合固定前缀、供应商编码、分类编码、年、月，流水号固定放在最后。
          </p>
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
              placeholder="例如 PD"
            />
          </label>
          <label style={inlineLabelStyle}>
            <input
              type="checkbox"
              checked={supplierEnabled}
              onChange={(event) => setSupplierEnabled(event.target.checked)}
            />
            供应商编码
          </label>
          <label style={inlineLabelStyle}>
            <input
              type="checkbox"
              checked={categoryEnabled}
              onChange={(event) => setCategoryEnabled(event.target.checked)}
            />
            分类编码
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
        </div>
      </section>

      <section style={cardStyle}>
        <div>
          <h3 style={{ margin: '0 0 6px' }}>流水规则</h3>
          <p style={helperStyle}>流水号必选，支持总流水、按年流水、按月流水，并可选择是否按供应商独立。</p>
        </div>
        <div style={gridStyle}>
          <label style={labelStyle}>
            流水位数
            <input
              name="serialLength"
              type="number"
              min={2}
              max={6}
              value={serialLength}
              onChange={(event) => setSerialLength(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            流水范围
            <select
              value={serialScope}
              onChange={(event) =>
                setSerialScope(event.target.value as ProductCodeRule['serialScope'])
              }
              style={inputStyle}
            >
              <option value="per_supplier_total">按供应商总流水</option>
              <option value="per_supplier_year">按供应商按年流水</option>
              <option value="per_supplier_month">按供应商按月流水</option>
              <option value="global_total">全局总流水</option>
              <option value="global_year">全局按年流水</option>
              <option value="global_month">全局按月流水</option>
            </select>
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <div>
          <h3 style={{ margin: '0 0 6px' }}>生成前提与提示</h3>
          <p style={helperStyle}>
            当前规则摘要：{describeProductCodeRule(previewRule)}
          </p>
          <p style={helperStyle}>
            示例预览：{previewCode}
          </p>
          <p style={helperStyle}>保存约束：流水号必选，且除流水号外至少启用一个业务段。</p>
          <p style={helperStyle}>按供应商独立流水时，必须启用供应商编码段。</p>
          <p style={helperStyle}>按年流水时，必须启用年份段；按月流水时，必须同时启用年份段和月份段。</p>
        </div>
      </section>

      {error ? (
        <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: '13px' }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p style={{ margin: 0, color: '#166534', fontSize: '13px' }}>{message}</p>
      ) : null}
      <button type="submit" style={buttonStyle} disabled={isSubmitting}>
        {isSubmitting ? '保存中...' : '保存规则'}
      </button>
    </form>
  );
}

function normalizeSavedRule(
  value: unknown,
  fallbackRule: ProductCodeRule,
  updatedBy: string,
) {
  const raw = value as Partial<ProductCodeRule>;

  return {
    strategy: raw.strategy === 'composed_segments' ? raw.strategy : fallbackRule.strategy,
    serialLength:
      typeof raw.serialLength === 'number' && Number.isFinite(raw.serialLength)
        ? raw.serialLength
        : fallbackRule.serialLength,
    serialScope:
      typeof raw.serialScope === 'string'
        ? raw.serialScope
        : fallbackRule.serialScope,
    segments: Array.isArray(raw.segments) ? raw.segments : fallbackRule.segments,
    updatedAt:
      typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    updatedBy:
      typeof raw.updatedBy === 'string' && raw.updatedBy.trim()
        ? raw.updatedBy
        : updatedBy,
  } satisfies ProductCodeRule;
}
