import type { FormalSession } from './formal-session';

export async function loadAuthenticatedSession(token: string | undefined | null): Promise<FormalSession | null> {
  if (!token) return null;
  const baseUrl = process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
  try {
    const response = await fetch(`${baseUrl}/auth/session`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const value = (await response.json()) as Partial<FormalSession>;
    if (
      !value ||
      !['admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase'].includes(value.role ?? '') ||
      typeof value.user !== 'string' || !value.user ||
      typeof value.username !== 'string' || !value.username ||
      !value.accessScopes || !Array.isArray(value.accessScopes.modules) ||
      !Array.isArray(value.accessScopes.actions) ||
      typeof value.accessScopes.dataScope !== 'string'
    ) return null;
    return value as FormalSession;
  } catch {
    return null;
  }
}
