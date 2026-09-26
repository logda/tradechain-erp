import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookieValue = vi.hoisted(() => ({ value: null as string | null }));
const mockResolveFormalActionSession = vi.hoisted(() => vi.fn());
const mockResolveFormalActionSessionFromHeaders = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: () => (
      mockCookieValue.value
        ? { value: mockCookieValue.value }
        : undefined
    ),
  }),
}));

vi.mock('../app/app/_lib/formal-request-headers', () => ({
  buildFormalRequestHeaders: vi.fn((session) => ({
    'x-erp-role': session.role,
    'x-erp-user': session.user,
    ...(session.accessScopes?.actions?.length
      ? { 'x-erp-actions': session.accessScopes.actions.join(',') }
      : {}),
  })),
}));

vi.mock('../app/app/_lib/formal-request-signature', () => ({
  buildSignedFormalRequestHeaders: vi.fn(() => ({
    'x-erp-signature': 'signed',
  })),
}));

vi.mock('../app/app/_lib/formal-session', () => ({
  FORMAL_SESSION_COOKIE: 'erp_formal_session',
  resolveFormalActionSession: mockResolveFormalActionSession,
}));

vi.mock('../app/app/_lib/formal-action-session', () => ({
  resolveFormalActionSessionFromHeaders: mockResolveFormalActionSessionFromHeaders,
}));

vi.mock('../app/app/_lib/mutation-action', () => ({
  buildMutationPayload: vi.fn(() => ({
    operatedBy: 'Admin',
    reason: '网络异常回归测试',
  })),
}));

import {
  submitFormalJsonMutationAction,
  submitFormalMutationAction,
} from '../app/app/_actions/formal-mutation-action';

describe('formal mutation actions', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    mockCookieValue.value = null;
    mockResolveFormalActionSession.mockReturnValue({
      role: 'admin',
      user: 'Admin',
    });
    mockResolveFormalActionSessionFromHeaders.mockResolvedValue({
      role: 'admin',
      user: 'Admin',
    });
  });

  it('returns a structured error when json mutation fetch fails before a response is received', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(
      submitFormalJsonMutationAction(
        'http://127.0.0.1:3001/api/products',
        'POST',
        { sku: 'SKU-ERR-001' },
        {
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
        },
      ),
    ).resolves.toEqual({
      ok: false,
      error: '网络请求失败，请确认服务已启动',
    });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('POST /api/products'), expect.stringContaining('network down'));
    consoleError.mockRestore();
  });

  it('returns a structured error when form mutation fetch fails before a response is received', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const formData = new FormData();
    formData.set('reason', '网络异常回归测试');

    await expect(
      submitFormalMutationAction(
        'http://127.0.0.1:3001/api/products/1/deactivate',
        [
          {
            name: 'reason',
            value: '网络异常回归测试',
          },
        ],
        formData,
        {
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
        },
      ),
    ).resolves.toEqual({
      ok: false,
      error: '网络请求失败，请确认服务已启动',
    });
  });

  it('prefers explicit request headers over login cookie when submitting a signed form action', async () => {
    mockCookieValue.value = 'limited-cookie-session';
    mockResolveFormalActionSession.mockReturnValue({
      role: 'purchase',
      user: 'Leo',
      accessScopes: {
        actions: ['purchase.order.submit'],
      },
    });
    mockResolveFormalActionSessionFromHeaders.mockResolvedValue({
      role: 'admin',
      user: 'Admin',
      accessScopes: {
        actions: ['purchase.sample.execute'],
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.set('reason', '管理员开始打样');

    await submitFormalMutationAction(
      'http://127.0.0.1:3001/api/sample-orders/sample-1/start-sampling',
      [
        {
          name: 'reason',
          value: '管理员开始打样',
        },
      ],
      formData,
      {
        'x-erp-role': 'admin',
        'x-erp-user': 'Admin',
        'x-erp-actions': 'purchase.sample.execute',
      },
    );

    expect(mockResolveFormalActionSessionFromHeaders).toHaveBeenCalledWith({
      'x-erp-role': 'admin',
      'x-erp-user': 'Admin',
      'x-erp-actions': 'purchase.sample.execute',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/sample-orders/sample-1/start-sampling',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
          'x-erp-actions': 'purchase.sample.execute',
        }),
      }),
    );
  });

  it('resolves relative mutation endpoints against the local web origin before fetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await submitFormalJsonMutationAction(
      '/api/products',
      'POST',
      { sku: 'SKU-RELATIVE-001' },
      {
        'x-erp-role': 'admin',
        'x-erp-user': 'Admin',
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3002/api/products',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
