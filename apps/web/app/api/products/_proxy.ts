import { NextRequest } from 'next/server';

const backendApiBaseUrl = process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';

function pickForwardHeaders(request: NextRequest) {
  const headers = new Headers();
  const headerNames = [
    'x-erp-role',
    'x-erp-user',
    'x-erp-modules',
    'x-erp-actions',
    'content-type',
    'authorization',
    'cookie',
  ];

  for (const headerName of headerNames) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

export async function proxyProductRequest(
  request: NextRequest,
  pathSegments: string[] = [],
) {
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

  const response = await fetch(targetUrl, {
    method,
    headers: pickForwardHeaders(request),
    body,
    cache: 'no-store',
  });

  const responseBody = await response.arrayBuffer();
  const responseHeaders = new Headers();
  const contentType = response.headers.get('content-type');
  if (contentType) {
    responseHeaders.set('content-type', contentType);
  }

  return new Response(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}
