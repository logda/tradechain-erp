import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'node -r ts-node/register prisma/seed.ts',
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'mysql://root:password@127.0.0.1:3306/erp',
  },
});
