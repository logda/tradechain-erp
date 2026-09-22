import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Sample Prisma schema', () => {
  it('contains versioned sample order models with quote traceability fields', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const getModelBlock = (modelName: string) => {
      const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm'));

      expect(match).not.toBeNull();

      return match?.[0] ?? '';
    };

    const sampleOrder = getModelBlock('SampleOrder');
    const sampleOrderVersion = getModelBlock('SampleOrderVersion');

    expect(schema).toContain('model SampleOrder');
    expect(schema).toContain('model SampleOrderVersion');
    expect(sampleOrder).toMatch(/sourceQuoteOrderId\s+BigInt/);
    expect(sampleOrder).toMatch(/sourceQuoteVersionId\s+BigInt\s+@unique/);
    expect(sampleOrder).toMatch(/currentVersionNo\s+Int/);
    expect(sampleOrder).toMatch(/versions\s+SampleOrderVersion\[\]/);
    expect(sampleOrderVersion).toMatch(/sampleOrderId\s+BigInt/);
    expect(sampleOrderVersion).toMatch(/status\s+String\s+@db.VarChar\(64\)/);
    expect(sampleOrderVersion).toMatch(/cancelReason\s+String\?\s+@db.VarChar\(255\)/);
    expect(sampleOrderVersion).toMatch(/replacedVersionNo\s+Int\?/);
    expect(sampleOrderVersion).toMatch(/@@unique\(\[sampleOrderId,\s*versionNo\]\)/);
  });
});
