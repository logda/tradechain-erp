import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { resolveStorageMode } from './storage-mode';

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    'mysql://root:password@127.0.0.1:3306/erp'
  );
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaMariaDb(resolveDatabaseUrl()),
    });
  }

  async onModuleInit() {
    if (resolveStorageMode() !== 'prisma') {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
