import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('formal Prisma persistence readiness', () => {
  it('ships migration, seed, and verification entry points for formal database rollout', () => {
    const apiRoot = process.cwd();
    const packageJson = JSON.parse(
      readFileSync(join(apiRoot, 'package.json'), 'utf8'),
    ) as {
      scripts: Record<string, string>;
      prisma?: { seed?: string };
    };
    const migrationPath = join(
      apiRoot,
      'prisma/migrations/20260713000000_formal_persistence_init/migration.sql',
    );
    const rolePermissionMigrationPath = join(
      apiRoot,
      'prisma/migrations/20260713002000_role_permissions/migration.sql',
    );
    const productFormalFieldsMigrationPath = join(
      apiRoot,
      'prisma/migrations/20260717133000_product_formal_fields/migration.sql',
    );
    const seedPath = join(apiRoot, 'prisma/seed.ts');
    const verifyPath = join(apiRoot, 'src/storage/verify-prisma-db.ts');
    const verifyScript = readFileSync(verifyPath, 'utf8');

    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(rolePermissionMigrationPath)).toBe(true);
    expect(existsSync(productFormalFieldsMigrationPath)).toBe(true);
    expect(existsSync(seedPath)).toBe(true);
    expect(existsSync(verifyPath)).toBe(true);
    expect(packageJson.scripts['prisma:validate']).toBe('prisma validate');
    expect(packageJson.scripts['prisma:generate']).toBe('prisma generate');
    expect(packageJson.scripts['prisma:migrate:deploy']).toBe(
      'prisma migrate deploy',
    );
    expect(packageJson.scripts['prisma:seed']).toBe(
      'node -r ts-node/register prisma/seed.ts',
    );
    expect(packageJson.scripts['db:verify']).toBe(
      'node -r ts-node/register src/storage/verify-prisma-db.ts',
    );
    expect(packageJson.prisma?.seed).toBe(
      'node -r ts-node/register prisma/seed.ts',
    );
    expect(verifyScript).toContain('salesCode');
    expect(verifyScript).toContain('purchaseCode');
    expect(verifyScript).toContain('productStage');
    expect(verifyScript).toContain('pricingMode');
  });
});
