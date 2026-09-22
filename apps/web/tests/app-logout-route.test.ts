import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { FORMAL_SESSION_COOKIE } from '../app/app/_lib/formal-session';
import { GET } from '../app/app/logout/route';

describe('app logout route', () => {
  it('redirects to the public login page and clears the session cookie', () => {
    const request = new NextRequest('https://erp.example.com/app/logout', {
      headers: {
        cookie: `${FORMAL_SESSION_COOKIE}=session-value`,
        host: '127.0.0.1:3002',
        'x-forwarded-host': 'erp.example.com',
        'x-forwarded-proto': 'https',
        'x-erp-public-origin': 'https://erp.example.com',
      },
    });

    const response = GET(request);

    expect(response.headers.get('location')).toBe(
      'https://erp.example.com/app/login',
    );
    expect(response.headers.get('set-cookie')).toContain(FORMAL_SESSION_COOKIE);
  });
});
