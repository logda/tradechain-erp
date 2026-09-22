'use client';

import { type FormEvent, useState } from 'react';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';
import { submitFormalJsonMutationAction } from '../../_actions/formal-mutation-action';

type CreateAdminUserFormProps = {
  endpoint: string;
  createdBy: string;
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

const initialState: State = {
  error: null,
  success: null,
};

const formStyle = {
  display: 'grid',
  gap: '14px',
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
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

export function CreateAdminUserForm({
  endpoint,
  createdBy,
  actorRole,
  actorUser,
  actorAccessScopes,
  onSuccess,
}: CreateAdminUserFormProps) {
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    setIsSubmitting(true);
    setState(initialState);

    const formData = new FormData(form);
    const payload = {
      username: String(formData.get('username') ?? ''),
      realName: String(formData.get('realName') ?? ''),
      password: String(formData.get('password') ?? ''),
      roleCode: String(formData.get('roleCode') ?? ''),
      createdBy,
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
      );

      if (!result.ok) {
        setState({
          error: result.error,
          success: null,
        });
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
      const createdItem = {
        id: responseItem?.id ?? Date.now(),
        username: responseItem?.username ?? payload.username.trim().toLowerCase(),
        realName: responseItem?.realName ?? payload.realName.trim(),
        roleCode: responseItem?.roleCode ?? payload.roleCode,
        status: responseItem?.status ?? 'active',
        fullAccess: responseItem?.fullAccess ?? false,
        accessScopes: responseItem?.accessScopes,
        createdAt: responseItem?.createdAt ?? new Date().toISOString(),
        createdBy: responseItem?.createdBy ?? createdBy,
        deactivatedReason: responseItem?.deactivatedReason,
      };

      form.reset();
      onSuccess?.(createdItem);
      setState({
        error: null,
        success: onSuccess ? '新增成功，已同步到当前列表。' : '新增成功，请刷新或继续在当前页查看最新用户。',
      });
    } catch {
      setState({
        error: '新增用户失败',
        success: null,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <div style={gridStyle}>
        <label style={labelStyle}>
          用户名 Username
          <input name="username" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          姓名 Real Name
          <input name="realName" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          初始密码 Password
          <input name="password" type="password" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          角色 Role
          <select name="roleCode" defaultValue="sales" style={inputStyle}>
            <option value="sales">sales / 销售</option>
            <option value="sales_manager">sales_manager / 销售主管</option>
            <option value="purchase">purchase / 采购</option>
            <option value="purchase_manager">purchase_manager / 采购主管</option>
            <option value="boss">boss / 老板</option>
            <option value="admin">admin / 管理员</option>
          </select>
        </label>
      </div>
      {state.error ? (
        <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: '13px' }}>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p style={{ margin: 0, color: '#166534', fontSize: '13px' }}>
          {state.success}
        </p>
      ) : null}
      <button type="submit" style={buttonStyle} disabled={isSubmitting}>
        {isSubmitting ? '提交中...' : '新增用户'}
      </button>
    </form>
  );
}
