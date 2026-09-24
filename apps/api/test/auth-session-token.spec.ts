import { issueAuthSessionToken, readAuthSessionToken } from '../src/auth/auth-session-token';

describe('登录会话票据', () => {
  const previousSecret = process.env.ERP_FORMAL_SESSION_SECRET;

  beforeEach(() => {
    process.env.ERP_FORMAL_SESSION_SECRET = 'stage02-test-secret';
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.ERP_FORMAL_SESSION_SECRET;
    else process.env.ERP_FORMAL_SESSION_SECRET = previousSecret;
  });

  it('只接受签名正确且未过期的账号票据', () => {
    const token = issueAuthSessionToken('zoe', 1_000);
    expect(readAuthSessionToken(token, 1_001)).toBe('zoe');
    expect(readAuthSessionToken(token, 1_000 + 8 * 60 * 60 * 1_000)).toBeNull();
    expect(readAuthSessionToken(`${token}x`, 1_001)).toBeNull();
    expect(readAuthSessionToken('zoe', 1_001)).toBeNull();
  });
});
