import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
});
