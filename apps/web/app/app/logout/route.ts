import { NextResponse, type NextRequest } from 'next/server';
import {
  FORMAL_SESSION_COOKIE,
  resolveFormalRequestOrigin,
} from '../_lib/formal-session';

export function GET(request: NextRequest) {
  const origin = resolveFormalRequestOrigin({
    origin: request.nextUrl.origin,
    publicOrigin: request.headers.get('x-erp-public-origin'),
    forwardedHost: request.headers.get('x-forwarded-host'),
    host: request.headers.get('host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
  });
  const response = NextResponse.redirect(new URL('/app/login', origin));
  response.cookies.delete(FORMAL_SESSION_COOKIE);
  return response;
}
