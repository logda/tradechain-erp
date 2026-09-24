import React from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';
import {
  FORMAL_SESSION_COOKIE,
} from '../_lib/formal-session';
import { loadAuthenticatedSession } from '../_lib/formal-auth-session';

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    username?: string | string[];
    password?: string | string[];
  }>;
};

const pageStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '32px',
  background:
    'radial-gradient(circle at top left, rgba(14,165,233,0.18), transparent 28%), linear-gradient(180deg, #eef3f8 0%, #f8fafc 38%, #edf2f7 100%)',
  fontFamily:
    '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
} satisfies React.CSSProperties;

const panelStyle = {
  width: 'min(520px, 100%)',
  display: 'grid',
  gap: '18px',
  border: '1px solid #d8e1ea',
  borderRadius: '24px',
  padding: '28px',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 24px 80px rgba(15, 23, 42, 0.10)',
} satisfies React.CSSProperties;

const titleStyle = {
  margin: 0,
  fontSize: '32px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const subStyle = {
  margin: 0,
  fontSize: '14px',
  lineHeight: 1.8,
  color: '#475569',
} satisfies React.CSSProperties;

const linkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

function readLoginError(
  searchParams: {
    error?: string | string[];
  } | undefined,
) {
  const error = searchParams?.error;

  if (Array.isArray(error)) {
    return error[0] ?? null;
  }

  return error ?? null;
}

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export default async function AppLoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const formalSession = await loadAuthenticatedSession(
    cookieStore.get(FORMAL_SESSION_COOKIE)?.value,
  );

  if (formalSession) {
    redirect('/app');
  }

  const errorMessage = readLoginError(resolvedSearchParams);
  const defaultUsername = readSearchParamValue(resolvedSearchParams?.username);
  const defaultPassword = readSearchParamValue(resolvedSearchParams?.password);

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <div style={{ display: 'grid', gap: '8px' }}>
          <h1 style={titleStyle}>ERP 登录</h1>
          <p style={subStyle}>
            提供最小可用登录入口，登录后跳转到正式工作台，并沿用现有角色权限模型。
          </p>
        </div>

        <LoginForm
          errorMessage={errorMessage}
          defaultUsername={defaultUsername}
          defaultPassword={defaultPassword}
        />

        <Link href="/app" style={linkStyle}>
          登录后进入正式工作台
        </Link>
      </section>
    </main>
  );
}
