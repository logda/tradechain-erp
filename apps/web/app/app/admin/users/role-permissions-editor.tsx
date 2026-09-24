'use client';

import { useState } from 'react';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';
import { submitFormalJsonMutationAction } from '../../_actions/formal-mutation-action';
import { useMutationAttempt } from '../../_lib/use-mutation-attempt';

type RolePermissionEditorProps = {
  endpoint: string;
  roleCode: string;
  roleLabel: string;
  modules: string[];
  dataScope: string;
  actions?: string[];
  updatedBy: string;
  updatedAt: string;
  actorRole: string;
  actorUser: string;
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  onSuccess?: () => void;
};

type State = {
  error: string | null;
  success: string | null;
};

const moduleOptions = [
  { value: 'sales', label: '销售' },
  { value: 'purchase', label: '采购' },
  { value: 'operations', label: '运营' },
  { value: 'boss_dashboard', label: '老板看板' },
  { value: 'admin', label: '用户管理' },
] as const;

const dataScopeOptions = [
  { value: 'all', label: '全部业务数据' },
  { value: 'sales_team', label: '销售团队数据' },
  { value: 'own_sales', label: '仅本人销售单/报价' },
  { value: 'purchase_team', label: '采购团队数据' },
  { value: 'own_purchase', label: '仅本人采购/发货/售后' },
] as const;

const actionOptions = [
  { value: 'audit.view', label: '审计查看' },
  { value: 'admin.user.write', label: '账号管理' },
  { value: 'admin.role.write', label: '角色权限' },
  { value: 'master_data.write', label: '主数据维护' },
  { value: 'counterparty.write', label: '往来单位维护' },
  { value: 'sales.quote.write', label: '报价' },
  { value: 'sales.inquiry.submit', label: '询价提交' },
  { value: 'sales.order.write', label: '销售单' },
  { value: 'sales.sample.submit', label: '样品提交' },
  { value: 'sales.sample.approve', label: '样品审批' },
  { value: 'sales.sample.execute', label: '样品执行' },
  { value: 'purchase.order.create', label: '创建采购单' },
  { value: 'purchase.order.submit', label: '采购提交' },
  { value: 'purchase.order.approve', label: '采购审批' },
  { value: 'purchase.sample.execute', label: '采购样品执行' },
  { value: 'shipment.update', label: '发货更新' },
  { value: 'after_sales.process', label: '售后处理' },
  { value: 'boss.confirm', label: '老板确认' },
  { value: 'finance.confirm', label: '财务确认' },
] as const;

const cardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  background: '#fff',
  padding: '18px',
  display: 'grid',
  gap: '14px',
} satisfies React.CSSProperties;

const tagStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  borderRadius: '999px',
  background: '#eff6ff',
  color: '#1d4ed8',
  fontSize: '12px',
  width: 'fit-content',
} satisfies React.CSSProperties;

const groupStyle = {
  display: 'grid',
  gap: '10px',
} satisfies React.CSSProperties;

const checkboxGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '8px 12px',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  fontSize: '13px',
  color: '#334155',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '10px',
  padding: '10px 12px',
  background: '#fff',
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '10px 14px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  width: 'fit-content',
} satisfies React.CSSProperties;

function readSearchParam(name: string) {
  if (typeof window === 'undefined') {
    return '';
  }

  return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

export function RolePermissionEditor({
  endpoint,
  roleCode,
  roleLabel,
  modules,
  dataScope,
  actions = [],
  updatedBy,
  updatedAt,
  actorRole,
  actorUser,
  actorAccessScopes,
  onSuccess,
}: RolePermissionEditorProps) {
  const [state, setState] = useState<State>({ error: null, success: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attempt = useMutationAttempt();
  const [selectedModules, setSelectedModules] = useState(modules);
  const [selectedDataScope, setSelectedDataScope] = useState(dataScope);
  const [selectedActions, setSelectedActions] = useState(actions);
  const [metaUpdatedBy, setMetaUpdatedBy] = useState(updatedBy);
  const [metaUpdatedAt, setMetaUpdatedAt] = useState(updatedAt);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || attempt.isComplete) {
      return;
    }

    const requestKey = attempt.begin();
    if (!requestKey) return;
    setIsSubmitting(true);
    setState({ error: null, success: null });
    const payload = {
      modules: selectedModules,
      dataScope: selectedDataScope,
      actions: selectedActions,
      updatedBy: actorUser,
    };
    const formalHeaders = buildFormalRequestHeaders({
      role: actorRole || readSearchParam('role'),
      user: actorUser || readSearchParam('user'),
      accessScopes: actorAccessScopes,
    });

    try {
      const result = await submitFormalJsonMutationAction(
        endpoint,
        'POST',
        payload,
        formalHeaders,
        requestKey,
      );

      if (!result.ok) {
        attempt.fail();
        setState({ error: result.error, success: null });
        return;
      }

      const normalized = normalizeRolePermissionResult(result.result);
      if (normalized) {
        setSelectedModules(normalized.modules);
        setSelectedDataScope(normalized.dataScope);
        setSelectedActions(normalized.actions);
        setMetaUpdatedBy(normalized.updatedBy);
        setMetaUpdatedAt(normalized.updatedAt);
      }

      setState({ error: null, success: `${roleLabel} 权限已更新` });
      attempt.succeed();
      onSuccess?.();
    } catch {
      attempt.fail();
      setState({ error: '保存角色权限失败', success: null });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChangeCapture={attempt.resetAfterEdit} style={cardStyle}>
      <div style={groupStyle}>
        <div style={tagStyle}>角色 Role: {roleCode}</div>
        <strong>{roleLabel}</strong>
        <span style={{ color: '#64748b', fontSize: '13px' }}>
          最近更新：{metaUpdatedBy} / {metaUpdatedAt}
        </span>
      </div>

      <label style={labelStyle}>
        模块权限 Modules
        <div style={checkboxGridStyle}>
          {moduleOptions.map((option) => (
            <label
              key={option.value}
              style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
            >
              <input
                type="checkbox"
                name="modules"
                value={option.value}
                checked={selectedModules.includes(option.value)}
                onChange={(event) =>
                  setSelectedModules((current) =>
                    event.target.checked
                      ? [...current, option.value].filter(
                          (value, index, list) => list.indexOf(value) === index,
                        )
                      : current.filter((value) => value !== option.value),
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </label>

      <label style={labelStyle}>
        数据范围 Data Scope
        <select
          name="dataScope"
          value={selectedDataScope}
          onChange={(event) => setSelectedDataScope(event.target.value)}
          style={inputStyle}
        >
          {dataScopeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label style={labelStyle}>
        动作权限 Actions
        <div style={checkboxGridStyle}>
          {actionOptions.map((option) => (
            <label
              key={option.value}
              style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
            >
              <input
                type="checkbox"
                name="actions"
                value={option.value}
                checked={selectedActions.includes(option.value)}
                onChange={(event) =>
                  setSelectedActions((current) =>
                    event.target.checked
                      ? [...current, option.value].filter(
                          (value, index, list) => list.indexOf(value) === index,
                        )
                      : current.filter((value) => value !== option.value),
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </label>

      {state.error ? (
        <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: '13px' }}>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p style={{ margin: 0, color: '#166534', fontSize: '13px' }}>{state.success}</p>
      ) : null}

      <button type="submit" style={buttonStyle} disabled={isSubmitting || attempt.isComplete}>
        {isSubmitting ? '保存中...' : '保存权限'}
      </button>
    </form>
  );
}

function normalizeRolePermissionResult(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const result = value as {
    accessScopes?: {
      modules?: unknown;
      dataScope?: unknown;
      actions?: unknown;
    };
    updatedBy?: unknown;
    updatedAt?: unknown;
  };

  const modules = Array.isArray(result.accessScopes?.modules)
    ? result.accessScopes.modules.filter((item): item is string => typeof item === 'string')
    : null;
  const actions = Array.isArray(result.accessScopes?.actions)
    ? result.accessScopes.actions.filter((item): item is string => typeof item === 'string')
    : [];
  const dataScope =
    typeof result.accessScopes?.dataScope === 'string' ? result.accessScopes.dataScope : null;
  const updatedBy = typeof result.updatedBy === 'string' ? result.updatedBy : null;
  const updatedAt = typeof result.updatedAt === 'string' ? result.updatedAt : null;

  if (!modules || !dataScope || !updatedBy || !updatedAt) {
    return null;
  }

  return {
    modules,
    dataScope,
    actions,
    updatedBy,
    updatedAt,
  };
}
