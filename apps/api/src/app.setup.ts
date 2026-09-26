import type { INestApplication } from '@nestjs/common';
import { resolveUploadRoot } from './file-storage/file-storage.config';
import { logHttpRequest } from './common/console-diagnostics';

const { json, urlencoded, static: serveStatic } = require('express') as {
  json: (options: { limit: string }) => unknown;
  urlencoded: (options: { extended: boolean; limit: string }) => unknown;
  static: (root: string) => unknown;
};

const LOCAL_CORS_ORIGINS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3002',
  'http://localhost:3002',
  'http://127.0.0.1:3003',
  'http://localhost:3003',
];

function resolveCorsOrigins() {
  const configured = (process.env.ERP_CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...LOCAL_CORS_ORIGINS, ...configured])];
}

// 健康检查不走签名校验，缺密钥时容器仍会被判为"健康"，所以必须在启动期就拦住
function assertFormalSessionSecret() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (!process.env.ERP_FORMAL_SESSION_SECRET?.trim()) {
    throw new Error(
      '生产环境必须配置 ERP_FORMAL_SESSION_SECRET（生成：openssl rand -base64 48），api 与 web 两侧须同值',
    );
  }
}

export function setupApp(app: INestApplication) {
  assertFormalSessionSecret();
  app.use(logHttpRequest);
  app.use(json({ limit: '500mb' }));
  app.use(urlencoded({ extended: true, limit: '500mb' }));
  app.use('/uploads', serveStatic(resolveUploadRoot()));
  app.enableCors({ origin: resolveCorsOrigins() });
  app.setGlobalPrefix('api');
}
