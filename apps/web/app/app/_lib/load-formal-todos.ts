import type { DemoSession } from './demo-session';
import { buildFormalApiRequestHeaders } from './formal-api-request-headers';
import type { FormalTodoItem } from './formal-todos';

export type FormalTodoApiResponse = {
  items: FormalTodoItem[];
  total: number;
  closedTotal: number;
  actionTotal?: number;
  followingTotal?: number;
  generatedAt: string;
};

export async function loadFormalTodos(session: DemoSession): Promise<FormalTodoApiResponse | null> {
  const params = new URLSearchParams({ role: session.role, user: session.user });
  const baseUrl = process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
  try {
    const response = await fetch(`${baseUrl}/todos/formal?${params}`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });
    if (!response.ok) return null;
    const result = await response.json() as FormalTodoApiResponse;
    if (!Array.isArray(result?.items) || result.items.some((item) => !item || typeof item !== 'object') ||
      !Number.isInteger(result.total) || result.total < 0 || !Number.isInteger(result.closedTotal) || result.closedTotal < 0) return null;
    return { ...result, generatedAt: result.generatedAt && !Number.isNaN(Date.parse(result.generatedAt)) ? result.generatedAt : new Date().toISOString() };
  } catch {
    return null;
  }
}
