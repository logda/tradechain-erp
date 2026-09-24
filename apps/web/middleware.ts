import { NextResponse, type NextRequest } from 'next/server';
import {
  FORMAL_SESSION_COOKIE,
  resolveFormalRequestOrigin,
} from './app/app/_lib/formal-session';
import { loadAuthenticatedSession } from './app/app/_lib/formal-auth-session';

const legacyRouteRedirects: Record<string, string> = {
  '/after-sales': '/app/after-sales',
  '/dashboard/boss': '/app/dashboard/boss',
  '/purchase-orders': '/app/purchase-orders',
  '/quotes': '/app/sales/quotes',
  '/quotes/new': '/app/sales/quotes/new',
  '/sales-orders': '/app/sales/orders',
  '/samples': '/app/sales/samples',
  '/shipment-batches': '/app/shipment-batches',
};

function resolveLegacyFormalRoute(pathname: string) {
  const exact = legacyRouteRedirects[pathname];
  if (exact) {
    return exact;
  }

  if (pathname.startsWith('/quotes/')) {
    return pathname.replace(/^\/quotes/, '/app/sales/quotes');
  }

  if (pathname.startsWith('/sales-orders/')) {
    return pathname.replace(/^\/sales-orders/, '/app/sales/orders');
  }

  if (pathname.startsWith('/purchase-orders/')) {
    return pathname.replace(/^\/purchase-orders/, '/app/purchase-orders');
  }

  if (pathname.startsWith('/shipment-batches/')) {
    return pathname.replace(/^\/shipment-batches/, '/app/shipment-batches');
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const formalRoute = resolveLegacyFormalRoute(request.nextUrl.pathname);
  if (formalRoute) {
    const url = request.nextUrl.clone();
    url.pathname = formalRoute;
    return NextResponse.redirect(url);
  }

  if (!request.nextUrl.pathname.startsWith('/app') ||
    request.nextUrl.pathname === '/app/login' ||
    request.nextUrl.pathname.startsWith('/app/login/') ||
    request.nextUrl.pathname === '/app/logout') {
    return NextResponse.next();
  }

  const origin = resolveFormalRequestOrigin({
      origin: request.nextUrl.origin,
      publicOrigin: request.headers.get('x-erp-public-origin'),
      forwardedHost: request.headers.get('x-forwarded-host'),
      host: request.headers.get('host'),
      forwardedProto: request.headers.get('x-forwarded-proto'),
  });
  const session = await loadAuthenticatedSession(request.cookies.get(FORMAL_SESSION_COOKIE)?.value);
  if (!session) {
    const response = NextResponse.redirect(new URL('/app/login', origin));
    response.cookies.delete(FORMAL_SESSION_COOKIE);
    return response;
  }
  const url = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, origin);
  if (url.searchParams.has('role') || url.searchParams.has('user') ||
    url.searchParams.has('username') || url.searchParams.has('access')) {
    const access = url.searchParams.get('access');
    const currentAccess = JSON.stringify(session.accessScopes);
    if (url.searchParams.get('role') === session.role &&
      url.searchParams.get('user') === session.user &&
      url.searchParams.get('username') === session.username &&
      (access === currentAccess || access === encodeURIComponent(currentAccess))) {
      return NextResponse.next();
    }
    url.searchParams.delete('role');
    url.searchParams.delete('user');
    url.searchParams.delete('username');
    url.searchParams.delete('access');
    return NextResponse.redirect(url);
  }
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.searchParams.set('role', session.role);
  rewriteUrl.searchParams.set('user', session.user);
  rewriteUrl.searchParams.set('username', session.username);
  rewriteUrl.searchParams.set('access', encodeURIComponent(JSON.stringify(session.accessScopes)));
  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: [
    '/app/:path*',
    '/after-sales/:path*',
    '/dashboard/boss/:path*',
    '/purchase-orders/:path*',
    '/quotes/:path*',
    '/sales-orders/:path*',
    '/samples/:path*',
    '/shipment-batches/:path*',
  ],
};
