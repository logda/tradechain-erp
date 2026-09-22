import { NextResponse, type NextRequest } from 'next/server';
import {
  buildFormalSessionRouteDecision,
  FORMAL_SESSION_COOKIE,
  resolveFormalRequestOrigin,
} from './app/app/_lib/formal-session';

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

export function middleware(request: NextRequest) {
  const formalRoute = resolveLegacyFormalRoute(request.nextUrl.pathname);
  if (formalRoute) {
    const url = request.nextUrl.clone();
    url.pathname = formalRoute;
    return NextResponse.redirect(url);
  }

  const decision = buildFormalSessionRouteDecision({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    origin: resolveFormalRequestOrigin({
      origin: request.nextUrl.origin,
      publicOrigin: request.headers.get('x-erp-public-origin'),
      forwardedHost: request.headers.get('x-forwarded-host'),
      host: request.headers.get('host'),
      forwardedProto: request.headers.get('x-forwarded-proto'),
    }),
    sessionCookie: request.cookies.get(FORMAL_SESSION_COOKIE)?.value,
    referer: request.headers.get('referer'),
  });

  if (!decision) {
    return NextResponse.next();
  }

  if (decision.type === 'rewrite') {
    return NextResponse.redirect(decision.url);
  }

  return NextResponse.redirect(decision.url);
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
