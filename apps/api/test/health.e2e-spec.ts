import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HealthController } from '../src/health/health.controller';
import { setupApp } from '../src/app.setup';

describe('HealthController', () => {
  it('returns healthy status', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });

  it('configures the api prefix for the formal workspace', () => {
    const use = jest.fn();
    const enableCors = jest.fn();
    const setGlobalPrefix = jest.fn();

    setupApp({
      use,
      enableCors,
      setGlobalPrefix,
    } as unknown as Parameters<typeof setupApp>[0]);

    expect(use).toHaveBeenCalledTimes(3);
    expect(use).toHaveBeenNthCalledWith(1, expect.any(Function));
    expect(use).toHaveBeenNthCalledWith(2, expect.any(Function));
    expect(use).toHaveBeenNthCalledWith(3, '/uploads', expect.any(Function));
    expect(enableCors).toHaveBeenCalledWith({
      origin: [
        'http://127.0.0.1:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3002',
        'http://localhost:3002',
        'http://127.0.0.1:3003',
        'http://localhost:3003',
      ],
    });
    expect(setGlobalPrefix).toHaveBeenCalledWith('api');
  });

  it('extends the cors allowlist from ERP_CORS_ORIGINS without hardcoding deployments', () => {
    const originalOrigins = process.env.ERP_CORS_ORIGINS;
    process.env.ERP_CORS_ORIGINS = 'https://erp.example.com, http://10.0.0.5:3000 ,,';
    const enableCors = jest.fn();

    try {
      setupApp({
        use: jest.fn(),
        enableCors,
        setGlobalPrefix: jest.fn(),
      } as unknown as Parameters<typeof setupApp>[0]);
    } finally {
      if (originalOrigins === undefined) {
        delete process.env.ERP_CORS_ORIGINS;
      } else {
        process.env.ERP_CORS_ORIGINS = originalOrigins;
      }
    }

    expect(enableCors).toHaveBeenCalledWith({
      origin: expect.arrayContaining([
        'http://127.0.0.1:3000',
        'https://erp.example.com',
        'http://10.0.0.5:3000',
      ]),
    });
    const { origin } = enableCors.mock.calls[0][0] as { origin: string[] };
    expect(origin).toHaveLength(new Set(origin).size);
  });

  it('allows larger api request payloads for quote image uploads', () => {
    const appSetupSource = readFileSync(
      resolve(__dirname, '../src/app.setup.ts'),
      'utf8',
    );

    expect(appSetupSource).toContain("json({ limit: '500mb' })");
    expect(appSetupSource).toContain("urlencoded({ extended: true, limit: '500mb' })");
  });

  describe('production ERP_FORMAL_SESSION_SECRET guard', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSecret = process.env.ERP_FORMAL_SESSION_SECRET;

    function createAppStub() {
      return {
        use: jest.fn(),
        enableCors: jest.fn(),
        setGlobalPrefix: jest.fn(),
      } as unknown as Parameters<typeof setupApp>[0];
    }

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalSecret === undefined) {
        delete process.env.ERP_FORMAL_SESSION_SECRET;
      } else {
        process.env.ERP_FORMAL_SESSION_SECRET = originalSecret;
      }
    });

    it('refuses to boot when the secret is missing', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ERP_FORMAL_SESSION_SECRET;

      expect(() => setupApp(createAppStub())).toThrow(/ERP_FORMAL_SESSION_SECRET/);
    });

    it('boots once the secret is configured', () => {
      process.env.NODE_ENV = 'production';
      process.env.ERP_FORMAL_SESSION_SECRET = 'configured-secret';

      expect(() => setupApp(createAppStub())).not.toThrow();
    });
  });
});
