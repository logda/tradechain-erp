'use client';

import { type FormEvent, useState } from 'react';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';
import { submitFormalJsonMutationAction } from '../../_actions/formal-mutation-action';
import { useMutationAttempt } from '../../_lib/use-mutation-attempt';

type UpdateUserRoleFormProps = {
  endpoint: string;
  currentRoleCode: string;
  actorRole: string;
  actorUser: string;
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  onSuccess?: (item: {
    id: number;
    username: string;
    realName: string;
    roleCode: string;
    status: string;
    fullAccess: boolean;
    accessScopes?: {
      modules: string[];
      dataScope: string;
      actions?: string[];
    };
    createdAt: string;
    createdBy: string;
    deactivatedReason?: string;
  }) => void;
};

type State = {
  error: string | null;
  success: string | null;
};

const roleOptions = [
  { value: 'sales', label: 'sales / 销售' },
  { value: 'sales_manager', label: 'sales_manager / 销售主管' },
  { value: 'purchase', label: 'purchase / 采购' },
  { value: 'purchase_manager', label: 'purchase_manager / 采购主管' },
  { value: 'boss', label: 'boss / 老板' },
  { value: 'admin', label: 'admin / 管理员' },
] as const;

const formStyle = {
  display: 'grid',
  gap: '8px',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '6px',
  fontSize: '12px',
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
  padding: '8px 12px',
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

export function UpdateUserRoleForm({
  endpoint,
  currentRoleCode,
  actorRole,
  actorUser,
  actorAccessScopes,
  onSuccess,
}: UpdateUserRoleFormProps) {
  const [state, setState] = useState<State>({ error: null, success: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attempt = useMutationAttempt();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || attempt.isComplete) {
      return;
    }

    const requestKey = attempt.begin();
    if (!requestKey) return;
    setIsSubmitting(true);
    setState({ error: null, success: null });

    const formData = new FormData(event.currentTarget);
    const payload = {
      roleCode: String(formData.get('roleCode') ?? currentRoleCode),
      operatedBy: actorUser,
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

      const responseItem =
        typeof result.result === 'object' && result.result !== null
          ? (result.result as Partial<{
              id: number;
              username: string;
              realName: string;
              roleCode: string;
              status: string;
              fullAccess: boolean;
              accessScopes: {
                modules: string[];
                dataScope: string;
                actions?: string[];
              };
              createdAt: string;
              createdBy: string;
              deactivatedReason?: string;
            }>)
          : null;

      if (
        typeof responseItem?.id === 'number' &&
        typeof responseItem.username === 'string' &&
        typeof responseItem.realName === 'string' &&
        typeof responseItem.roleCode === 'string' &&
        typeof responseItem.status === 'string' &&
        typeof responseItem.fullAccess === 'boolean' &&
        typeof responseItem.createdAt === 'string' &&
        typeof responseItem.createdBy === 'string'
      ) {
        onSuccess?.({
          id: responseItem.id,
          username: responseItem.username,
          realName: responseItem.realName,
          roleCode: responseItem.roleCode,
          status: responseItem.status,
          fullAccess: responseItem.fullAccess,
          accessScopes: responseItem.accessScopes,
          createdAt: responseItem.createdAt,
          createdBy: responseItem.createdBy,
          deactivatedReason: responseItem.deactivatedReason,
        });
      }

      setState({
        error: null,
        success: onSuccess ? '角色已更新，当前列表已同步。' : '角色已更新',
      });
      attempt.succeed();
    } catch {
      attempt.fail();
      setState({ error: '保存角色失败', success: null });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChangeCapture={attempt.resetAfterEdit} style={formStyle}>
      <label style={labelStyle}>
        变更角色 Role Change
        <select name="roleCode" defaultValue={currentRoleCode} style={inputStyle}>
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {state.error ? (
        <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: '12px' }}>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p style={{ margin: 0, color: '#166534', fontSize: '12px' }}>{state.success}</p>
      ) : null}
      <button type="submit" style={buttonStyle} disabled={isSubmitting || attempt.isComplete}>
        {isSubmitting ? '保存中...' : '保存角色'}
      </button>
    </form>
  );
}
