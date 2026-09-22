import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

type FetchInit = RequestInit & { headers: Record<string, string> };

function createRouteContext(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe('uploads proxy route', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('proxies GET to the api uploads static directory', async () => {
    vi.stubEnv('ERP_API_BASE_URL', 'http://api:3001/api');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('pdf-bytes', {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-length': '9',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/uploads/[...path]/route');
    const response = await GET(
      new NextRequest(
        'http://erp.example.com:3000/uploads/formal-quote-attachments/2026-07-21/a.pdf?download=1',
        { headers: { range: 'bytes=0-1' } },
      ),
      createRouteContext(['formal-quote-attachments', '2026-07-21', 'a.pdf']),
    );

    const [target, init] = fetchMock.mock.calls[0] as [URL, FetchInit];
    expect(String(target)).toBe(
      'http://api:3001/uploads/formal-quote-attachments/2026-07-21/a.pdf?download=1',
    );
    expect(init.method).toBe('GET');
    expect(init.headers.range).toBe('bytes=0-1');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-length')).toBe('9');
    await expect(response.text()).resolves.toBe('pdf-bytes');
  });

  it('passes the upstream status through when the file is missing', async () => {
    vi.stubEnv('ERP_API_BASE_URL', 'http://api:3001/api');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const { GET } = await import('../app/uploads/[...path]/route');
    const response = await GET(
      new NextRequest('http://erp.example.com:3000/uploads/formal-quote-attachments/missing.pdf'),
      createRouteContext(['formal-quote-attachments', 'missing.pdf']),
    );

    expect(response.status).toBe(404);
  });

  it('falls back to the local api origin when ERP_API_BASE_URL is empty', async () => {
    vi.stubEnv('ERP_API_BASE_URL', '');
    const fetchMock = vi.fn().mockResolvedValue(new Response('png-bytes', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/uploads/[...path]/route');
    await GET(
      new NextRequest('http://127.0.0.1:3000/uploads/formal-quotes/2026-07-21/a.png'),
      createRouteContext(['formal-quotes', '2026-07-21', 'a.png']),
    );

    const [target] = fetchMock.mock.calls[0] as [URL, FetchInit];
    expect(String(target)).toBe('http://127.0.0.1:3001/uploads/formal-quotes/2026-07-21/a.png');
  });
});
