import { NextRequest } from 'next/server';
import { loadAuthenticatedSession } from '../../../app/_lib/formal-auth-session';
import { FORMAL_SESSION_COOKIE } from '../../../app/_lib/formal-session';
import { getFormalTodos } from '../../../app/_lib/formal-todos';
import { loadFormalTodos } from '../../../app/_lib/load-formal-todos';

export async function GET(request: NextRequest) {
  const session = await loadAuthenticatedSession(request.cookies.get(FORMAL_SESSION_COOKIE)?.value);
  if (!session) return new Response('请先登录', { status: 401 });
  const result = await loadFormalTodos(session);
  if (!result) return new Response('待办暂时无法加载', { status: 503 });
  return Response.json({ count: getFormalTodos(session, result.items).length }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
