import { NextRequest } from 'next/server';

// 上传文件代理：浏览器访问 web origin 的 /uploads/...，运行时转发到 api 容器的静态目录。
// 目标地址必须在运行时从 env 推导（rewrites 会在 build 期烘焙地址，镜像内无法解析 compose 主机名）。
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const FORWARD_REQUEST_HEADERS = ['range', 'if-none-match', 'if-modified-since'];

const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'cache-control',
  'etag',
  'last-modified',
];

function resolveUploadsBaseUrl() {
  const apiBaseUrl = process.env.ERP_API_BASE_URL?.trim() || 'http://127.0.0.1:3001/api';
  return new URL(apiBaseUrl).origin;
}

function pickHeaders(source: Headers, names: string[]) {
  const picked: Record<string, string> = {};
  for (const headerName of names) {
    const value = source.get(headerName);
    if (value) {
      picked[headerName] = value;
    }
  }

  return picked;
}

async function proxyUploadRequest(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const targetUrl = new URL(
    `${resolveUploadsBaseUrl()}/uploads/${(params.path ?? [])
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/')}`,
  );
  targetUrl.search = new URL(request.url).search;

  const response = await fetch(targetUrl, {
    method: request.method.toUpperCase(),
    headers: pickHeaders(request.headers, FORWARD_REQUEST_HEADERS),
    cache: 'no-store',
  });

  return new Response(response.body, {
    status: response.status,
    headers: pickHeaders(response.headers, FORWARD_RESPONSE_HEADERS),
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyUploadRequest(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyUploadRequest(request, context);
}
