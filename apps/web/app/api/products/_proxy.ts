import { NextRequest } from 'next/server';
import { loadAuthenticatedSession } from '../../app/_lib/formal-auth-session';
import { FORMAL_SESSION_COOKIE } from '../../app/_lib/formal-session';
import { buildFormalApiRequestHeaders } from '../../app/_lib/formal-api-request-headers';

const backendApiBaseUrl = process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';

export async function proxyProductRequest(
  request: NextRequest,
  pathSegments: string[] = [],
) {
  const session = await loadAuthenticatedSession(request.cookies.get(FORMAL_SESSION_COOKIE)?.value);
  if (!session) return new Response('请先登录', { status: 401 });
  if (session.role !== 'admin') return new Response('无权访问产品管理', { status: 403 });
  const targetUrl = new URL(backendApiBaseUrl.replace(/\/$/, ''));
  targetUrl.pathname = [
    targetUrl.pathname.replace(/\/$/, ''),
    'products',
    ...pathSegments.filter(Boolean),
  ]
    .join('/')
    .replace(/\/{2,}/g, '/');
  targetUrl.search = request.nextUrl.search;

  const method = request.method.toUpperCase();
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : Buffer.from(await request.arrayBuffer());
  const headers = new Headers(buildFormalApiRequestHeaders(session));
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);

  const response = await fetch(targetUrl, {
    method,
    headers,
    body,
    cache: 'no-store',
  });

  const responseBody = await response.arrayBuffer();
  const responseHeaders = new Headers();
  const responseContentType = response.headers.get('content-type');
  if (responseContentType) {
    responseHeaders.set('content-type', responseContentType);
  }

  return new Response(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}
