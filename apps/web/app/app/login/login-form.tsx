import { loginAndRedirectAction } from './actions';

type LoginFormProps = {
  errorMessage?: string | null;
  defaultUsername?: string;
  defaultPassword?: string;
};

const formStyle = {
  display: 'grid',
  gap: '16px',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#0f172a',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '14px',
  color: '#0f172a',
  background: '#ffffff',
} satisfies React.CSSProperties;

const helperStyle = {
  margin: 0,
  fontSize: '13px',
  color: '#64748b',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '12px 16px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties;

export function LoginForm({
  errorMessage,
  defaultUsername = '',
  defaultPassword = '',
}: LoginFormProps) {
  return (
    <form action={loginAndRedirectAction} style={formStyle}>
      <label style={labelStyle}>
        用户名 Username
        <input name="username" defaultValue={defaultUsername} style={inputStyle} />
      </label>
      <label style={labelStyle}>
        密码 Password
        <input
          name="password"
          type="password"
          defaultValue={defaultPassword}
          style={inputStyle}
        />
      </label>

      <p style={helperStyle}>
        可使用已配置账号登录系统，账号权限由用户管理中的角色配置决定。
      </p>

      {errorMessage ? <p role="alert">{errorMessage}</p> : null}

      <button type="submit" style={buttonStyle}>
        登录系统
      </button>
    </form>
  );
}
