import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

describe('next config', () => {
  it('allows larger server action payloads for quote image uploads', () => {
    const nextConfigSource = readFileSync(
      resolve(__dirname, '../next.config.mjs'),
      'utf8',
    );

    expect(nextConfigSource).toContain('experimental');
    expect(nextConfigSource).toContain('serverActions');
    expect(nextConfigSource).toContain("bodySizeLimit: '500mb'");
  });

  it('isolates the live development cache from the production build output', () => {
    const webRoot = resolve(__dirname, '..');
    const packageJson = JSON.parse(readFileSync(resolve(webRoot, 'package.json'), 'utf8'));
    const configDistDir = (override?: string) => {
      const env = { ...process.env };
      if (override) env.ERP_NEXT_DIST_DIR = override;
      else delete env.ERP_NEXT_DIST_DIR;
      return execFileSync(
        process.execPath,
        ['--input-type=module', '-e', "import config from './next.config.mjs'; process.stdout.write(config.distDir)"],
        { cwd: webRoot, env, encoding: 'utf8' },
      );
    };

    expect(packageJson.scripts.dev).toContain('ERP_NEXT_DIST_DIR=.next-dev');
    expect(configDistDir('.next-dev')).toBe('.next-dev');
    expect(configDistDir()).toBe('.next');
  });
});
