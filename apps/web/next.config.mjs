import { fileURLToPath } from 'node:url';

const sharedEntry = fileURLToPath(
  new URL('../../packages/shared/src/index.ts', import.meta.url),
);

// monorepo 根目录：锁定 Next standalone 的产物布局为 apps/web/server.js
const monorepoRoot = fileURLToPath(new URL('../../', import.meta.url));

const extraDevOrigins = (process.env.ERP_EXTRA_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  allowedDevOrigins: ['*.trycloudflare.com', ...extraDevOrigins],
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@erp/shared': sharedEntry,
    };

    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mjs', '.mts'],
      '.cjs': ['.cjs', '.cts'],
    };

    return config;
  },
};

export default nextConfig;
