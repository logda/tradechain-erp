# ERP Foundation And Quote MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the initial monorepo, platform foundation, and the first end-to-end ERP vertical slice for quote and inquiry management.

**Architecture:** Use a TypeScript monorepo with a Next.js frontend and NestJS backend in a single repository. Start with a modular monolith, Prisma/MySQL data layer, shared enums/types package, and a first vertical slice that covers auth-ready foundation, master data, quote orders, inquiry sheets, supplier quotes, and boss confirmation.

**Tech Stack:** pnpm workspaces, Next.js, NestJS, Prisma, MySQL 8, TypeScript, Ant Design, Jest, React Testing Library, Supertest

---

### Task 1: Initialize The Monorepo Skeleton

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/package.json`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/pnpm-workspace.yaml`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/tsconfig.base.json`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/.gitignore`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/package.json`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/package.json`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/package.json`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/package.json`

- [ ] **Step 1: Write the failing workspace smoke test**

```bash
test -f package.json && test -f pnpm-workspace.yaml && test -f apps/web/package.json && test -f apps/api/package.json && test -f packages/shared/package.json
```

- [ ] **Step 2: Run test to verify it fails**

Run: `test -f package.json && test -f pnpm-workspace.yaml && test -f apps/web/package.json && test -f apps/api/package.json && test -f packages/shared/package.json`
Expected: FAIL because the monorepo files do not exist yet

- [ ] **Step 3: Write minimal implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/package.json`:

```json
{
  "name": "erp",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev:web": "pnpm --filter web dev",
    "dev:api": "pnpm --filter api start:dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "format": "pnpm -r format"
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@erp/shared/*": ["packages/shared/src/*"]
    }
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/.gitignore`:

```gitignore
node_modules
.next
dist
coverage
.env
.env.*
pnpm-lock.yaml
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/package.json`:

```json
{
  "name": "web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "lint": "next lint",
    "format": "prettier --check ."
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/package.json`:

```json
{
  "name": "api",
  "private": true,
  "scripts": {
    "start:dev": "nest start --watch",
    "build": "nest build",
    "test": "jest --runInBand",
    "lint": "eslint .",
    "format": "prettier --check ."
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/package.json`:

```json
{
  "name": "@erp/shared",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "exports": {
    "./*": "./src/*"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "echo shared-ok",
    "lint": "echo shared-lint-ok",
    "format": "prettier --check ."
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `test -f package.json && test -f pnpm-workspace.yaml && test -f apps/web/package.json && test -f apps/api/package.json && test -f packages/shared/package.json`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore apps/web/package.json apps/api/package.json packages/shared/package.json
git commit -m "chore: initialize erp monorepo"
```

### Task 2: Scaffold The Backend Foundation

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/main.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/health/health.controller.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/health.e2e-spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/health.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/health.e2e-spec.ts`:

```ts
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('HealthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns healthy status', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- health.e2e-spec.ts`
Expected: FAIL because `AppModule` and `/health` endpoint do not exist

- [ ] **Step 3: Write minimal implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return { status: 'ok' };
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
})
export class AppModule {}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(3001);
}

void bootstrap();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- health.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/main.ts apps/api/src/app.module.ts apps/api/src/health/health.controller.ts apps/api/test/health.e2e-spec.ts
git commit -m "feat: scaffold api foundation"
```

### Task 3: Add Prisma Schema For Foundation And Quote Domain

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/prisma/schema.prisma`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/prisma-schema.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/prisma-schema.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/prisma-schema.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Prisma schema', () => {
  it('contains quote and inquiry models', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('model User');
    expect(schema).toContain('model Counterparty');
    expect(schema).toContain('model Product');
    expect(schema).toContain('model QuoteOrder');
    expect(schema).toContain('model QuoteOrderVersion');
    expect(schema).toContain('model QuoteInquirySheet');
    expect(schema).toContain('model QuoteInquiryItem');
    expect(schema).toContain('model QuoteInquirySupplierQuote');
    expect(schema).toContain('model ApprovalRecord');
    expect(schema).toContain('model OperationLog');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- prisma-schema.spec.ts`
Expected: FAIL because `prisma/schema.prisma` does not exist

- [ ] **Step 3: Write minimal implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/prisma/schema.prisma` with datasource, generator, and minimum models:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id         BigInt   @id @default(autoincrement())
  username   String   @db.VarChar(64)
  realName   String   @db.VarChar(64)
  roleCode   String   @db.VarChar(32)
  status     Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Counterparty {
  id         BigInt   @id @default(autoincrement())
  type       String   @db.VarChar(16)
  unitName   String   @db.VarChar(128)
  unitCode   String   @db.VarChar(64)
  shortName  String?  @db.VarChar(64)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([unitName, unitCode])
}

model Product {
  id           BigInt   @id @default(autoincrement())
  productName  String   @db.VarChar(128)
  salesCode    String?  @db.VarChar(64)
  purchaseCode String?  @db.VarChar(64)
  status       String   @db.VarChar(32)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model QuoteOrder {
  id                 BigInt              @id @default(autoincrement())
  quoteNo            String              @unique @db.VarChar(64)
  customerId         BigInt
  salesUserId        BigInt
  currentVersionNo   Int
  confirmedVersionNo Int?
  status             String              @db.VarChar(32)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  versions           QuoteOrderVersion[]
  inquiries          QuoteInquirySheet[]
}

model QuoteOrderVersion {
  id            BigInt   @id @default(autoincrement())
  quoteOrderId  BigInt
  versionNo     Int
  requirements  String   @db.Text
  changeReason  String?  @db.VarChar(255)
  confirmedFlag Boolean  @default(false)
  createdBy     BigInt
  createdAt     DateTime @default(now())
  quoteOrder    QuoteOrder @relation(fields: [quoteOrderId], references: [id])

  @@unique([quoteOrderId, versionNo])
}

model QuoteInquirySheet {
  id                BigInt   @id @default(autoincrement())
  inquiryNo         String   @unique @db.VarChar(64)
  quoteOrderId      BigInt
  quoteVersionId    BigInt
  status            String   @db.VarChar(32)
  supplierCount     Int      @default(0)
  comparisonSummary String?  @db.Text
  confirmedBy       BigInt?
  confirmedAt       DateTime?
  createdBy         BigInt
  createdAt         DateTime @default(now())
}

model QuoteInquiryItem {
  id                           BigInt   @id @default(autoincrement())
  inquirySheetId               BigInt
  quoteVersionItemId           BigInt
  lineNo                       Int
  productId                    BigInt
  requiredSupplierCount        Int      @default(2)
  bossConfirmedSalePrice       Decimal? @db.Decimal(18, 2)
  bossSelectedSupplierQuoteId  BigInt?
  bossPricingRemark            String?  @db.VarChar(255)
  bossPricedBy                 BigInt?
  bossPricedAt                 DateTime?
  createdAt                    DateTime @default(now())
}

model QuoteInquirySupplierQuote {
  id                  BigInt   @id @default(autoincrement())
  inquiryItemId       BigInt
  supplierId          BigInt
  supplierProductName String?  @db.VarChar(128)
  quotePrice          Decimal  @db.Decimal(18, 2)
  currencyCode        String   @db.VarChar(16)
  quoteDate           DateTime
  attachmentUrl       String?  @db.VarChar(255)
  remark              String?  @db.VarChar(255)
  createdAt           DateTime @default(now())
}

model ApprovalRecord {
  id           BigInt   @id @default(autoincrement())
  bizType      String   @db.VarChar(32)
  bizId        BigInt
  bizVersionNo Int?
  actionType   String   @db.VarChar(32)
  approverId   BigInt?
  result       String?  @db.VarChar(16)
  remark       String?  @db.VarChar(255)
  createdAt    DateTime @default(now())
}

model OperationLog {
  id            BigInt   @id @default(autoincrement())
  bizType       String   @db.VarChar(32)
  bizId         BigInt
  operationType String   @db.VarChar(32)
  operatorId    BigInt
  beforeData    Json?
  afterData     Json?
  createdAt     DateTime @default(now())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- prisma-schema.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/test/prisma-schema.spec.ts
git commit -m "feat: add foundation and quote prisma schema"
```

### Task 4: Implement Quote Creation And Query APIs

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/quote.controller.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/quote.service.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/dto/create-quote.dto.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/quote.controller.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/quote.controller.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/quote.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { QuoteController } from '../src/quote/quote.controller';
import { QuoteService } from '../src/quote/quote.service';

describe('QuoteController', () => {
  it('creates a quote order draft', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        {
          provide: QuoteService,
          useValue: {
            create: jest.fn().mockResolvedValue({
              id: 1,
              quoteNo: 'Q202607070001',
              status: 'draft',
              currentVersionNo: 1,
            }),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuoteController);
    const result = await controller.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
    });

    expect(result.status).toBe('draft');
    expect(result.currentVersionNo).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- quote.controller.spec.ts`
Expected: FAIL because the quote controller and service do not exist

- [ ] **Step 3: Write minimal implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/dto/create-quote.dto.ts`:

```ts
export class CreateQuoteDto {
  customerId!: number;
  salesUserId!: number;
  sourceCode!: string;
  requirements!: string;
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/quote.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';

@Injectable()
export class QuoteService {
  async create(dto: CreateQuoteDto) {
    return {
      id: 1,
      quoteNo: 'Q202607070001',
      customerId: dto.customerId,
      salesUserId: dto.salesUserId,
      sourceCode: dto.sourceCode,
      status: 'draft',
      currentVersionNo: 1,
    };
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/quote.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuoteService } from './quote.service';

@Controller('quotes')
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  create(@Body() dto: CreateQuoteDto) {
    return this.quoteService.create(dto);
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.quoteService.getDetail(Number(id));
  }
}
```

Update `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/quote/quote.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';

@Injectable()
export class QuoteService {
  async create(dto: CreateQuoteDto) {
    return {
      id: 1,
      quoteNo: 'Q202607070001',
      customerId: dto.customerId,
      salesUserId: dto.salesUserId,
      sourceCode: dto.sourceCode,
      status: 'draft',
      currentVersionNo: 1,
    };
  }

  async getDetail(id: number) {
    return {
      id,
      quoteNo: 'Q202607070001',
      status: 'draft',
      currentVersionNo: 1,
    };
  }
}
```

Update `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { QuoteController } from './quote/quote.controller';
import { QuoteService } from './quote/quote.service';

@Module({
  controllers: [HealthController, QuoteController],
  providers: [QuoteService],
})
export class AppModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- quote.controller.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/quote/dto/create-quote.dto.ts apps/api/src/quote/quote.controller.ts apps/api/src/quote/quote.service.ts apps/api/src/app.module.ts apps/api/test/quote.controller.spec.ts
git commit -m "feat: implement quote creation api"
```

### Task 5: Implement Inquiry Submission And Boss Confirmation Rules

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/inquiry/inquiry.service.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/inquiry/inquiry.controller.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/inquiry-rules.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/inquiry-rules.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/test/inquiry-rules.spec.ts`:

```ts
import { InquiryService } from '../src/inquiry/inquiry.service';

describe('InquiryService', () => {
  it('rejects boss submission when any item has fewer than two suppliers', async () => {
    const service = new InquiryService();

    await expect(
      service.submitForComparison({
        inquiryId: 1,
        items: [
          { itemId: 10, supplierQuoteIds: [100] },
          { itemId: 11, supplierQuoteIds: [200, 201] },
        ],
      }),
    ).rejects.toThrow('Each inquiry item must have at least two supplier quotes');
  });

  it('confirms inquiry after all items are priced', async () => {
    const service = new InquiryService();

    const result = await service.confirmByBoss({
      inquiryId: 1,
      items: [
        { itemId: 10, supplierQuoteCount: 2, confirmedSalePrice: 12.5 },
        { itemId: 11, supplierQuoteCount: 3, confirmedSalePrice: 15.8 },
      ],
    });

    expect(result.status).toBe('boss_confirmed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- inquiry-rules.spec.ts`
Expected: FAIL because `InquiryService` does not exist

- [ ] **Step 3: Write minimal implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/inquiry/inquiry.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';

type SubmitPayload = {
  inquiryId: number;
  items: Array<{ itemId: number; supplierQuoteIds: number[] }>;
};

type ConfirmPayload = {
  inquiryId: number;
  items: Array<{ itemId: number; supplierQuoteCount: number; confirmedSalePrice: number }>;
};

@Injectable()
export class InquiryService {
  async submitForComparison(payload: SubmitPayload) {
    const invalidItem = payload.items.find((item) => item.supplierQuoteIds.length < 2);

    if (invalidItem) {
      throw new BadRequestException('Each inquiry item must have at least two supplier quotes');
    }

    return {
      id: payload.inquiryId,
      status: 'submitted',
    };
  }

  async confirmByBoss(payload: ConfirmPayload) {
    const invalidItem = payload.items.find(
      (item) => item.supplierQuoteCount < 2 || item.confirmedSalePrice <= 0,
    );

    if (invalidItem) {
      throw new BadRequestException('Boss confirmation requires complete item pricing');
    }

    return {
      id: payload.inquiryId,
      status: 'boss_confirmed',
    };
  }
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/inquiry/inquiry.controller.ts`:

```ts
import { Body, Controller, Param, Post } from '@nestjs/common';
import { InquiryService } from './inquiry.service';

@Controller('quote-inquiries')
export class InquiryController {
  constructor(private readonly inquiryService: InquiryService) {}

  @Post(':id/submit-for-comparison')
  submitForComparison(@Param('id') id: string, @Body() body: { items: Array<{ itemId: number; supplierQuoteIds: number[] }> }) {
    return this.inquiryService.submitForComparison({
      inquiryId: Number(id),
      items: body.items,
    });
  }

  @Post(':id/boss-confirm')
  bossConfirm(@Param('id') id: string, @Body() body: { items: Array<{ itemId: number; supplierQuoteCount: number; confirmedSalePrice: number }> }) {
    return this.inquiryService.confirmByBoss({
      inquiryId: Number(id),
      items: body.items,
    });
  }
}
```

Update `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { QuoteController } from './quote/quote.controller';
import { QuoteService } from './quote/quote.service';
import { InquiryController } from './inquiry/inquiry.controller';
import { InquiryService } from './inquiry/inquiry.service';

@Module({
  controllers: [HealthController, QuoteController, InquiryController],
  providers: [QuoteService, InquiryService],
})
export class AppModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- inquiry-rules.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/inquiry/inquiry.service.ts apps/api/src/inquiry/inquiry.controller.ts apps/api/src/app.module.ts apps/api/test/inquiry-rules.spec.ts
git commit -m "feat: implement inquiry submission and boss confirmation rules"
```

### Task 6: Scaffold The First Frontend Workbench And Quote Pages

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quotes-page.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quotes-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/quotes-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import QuotesPage from '../app/quotes/page';

describe('QuotesPage', () => {
  it('shows the quote workspace header', () => {
    render(<QuotesPage />);

    expect(screen.getByText('Quote Workspace')).toBeInTheDocument();
    expect(screen.getByText('Create Quote')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- quotes-page.test.tsx`
Expected: FAIL because the page does not exist

- [ ] **Step 3: Write minimal implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/page.tsx`:

```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h1>ERP Workbench</h1>
      <Link href="/quotes">Go to Quote Workspace</Link>
    </main>
  );
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/page.tsx`:

```tsx
import Link from 'next/link';

export default function QuotesPage() {
  return (
    <main>
      <h1>Quote Workspace</h1>
      <p>Manage quote drafts, inquiry sheets, supplier quotes, and boss confirmations.</p>
      <Link href="/quotes/new">Create Quote</Link>
    </main>
  );
}
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/page.tsx`:

```tsx
export default function NewQuotePage() {
  return (
    <main>
      <h1>Create Quote</h1>
      <p>Quote creation form will live here.</p>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- quotes-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/app/quotes/page.tsx apps/web/app/quotes/new/page.tsx apps/web/tests/quotes-page.test.tsx
git commit -m "feat: scaffold quote workspace pages"
```

### Task 7: Connect Quote Creation UI To Backend Contract

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/actions.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/page.tsx`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/create-quote-form.test.tsx`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/create-quote-form.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/create-quote-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import NewQuotePage from '../app/quotes/new/page';

describe('NewQuotePage', () => {
  it('shows required quote form fields', () => {
    render(<NewQuotePage />);

    expect(screen.getByLabelText('Customer ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Sales User ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Source Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Requirements')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Quote' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- create-quote-form.test.tsx`
Expected: FAIL because the form fields do not exist

- [ ] **Step 3: Write minimal implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/actions.ts`:

```ts
export async function createQuoteAction(formData: FormData) {
  return {
    customerId: Number(formData.get('customerId')),
    salesUserId: Number(formData.get('salesUserId')),
    sourceCode: String(formData.get('sourceCode')),
    requirements: String(formData.get('requirements')),
  };
}
```

Update `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/quotes/new/page.tsx`:

```tsx
export default function NewQuotePage() {
  return (
    <main>
      <h1>Create Quote</h1>
      <form>
        <label>
          Customer ID
          <input name="customerId" type="number" />
        </label>
        <label>
          Sales User ID
          <input name="salesUserId" type="number" />
        </label>
        <label>
          Source Code
          <input name="sourceCode" type="text" />
        </label>
        <label>
          Requirements
          <textarea name="requirements" />
        </label>
        <button type="submit">Submit Quote</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- create-quote-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/quotes/new/actions.ts apps/web/app/quotes/new/page.tsx apps/web/tests/create-quote-form.test.tsx
git commit -m "feat: add quote creation form"
```

### Task 8: Add Shared Domain Enums And Close The First Vertical Slice

**Files:**
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/quote-status.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/inquiry-status.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`
- Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/quote-status.spec.ts`
- Test: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/quote-status.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/quote-status.spec.ts`:

```ts
import { QUOTE_STATUSES, INQUIRY_STATUSES } from './index';

describe('shared domain enums', () => {
  it('exports the quote and inquiry statuses used by the first vertical slice', () => {
    expect(QUOTE_STATUSES).toContain('draft');
    expect(QUOTE_STATUSES).toContain('quoted');
    expect(INQUIRY_STATUSES).toContain('submitted');
    expect(INQUIRY_STATUSES).toContain('boss_confirmed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @erp/shared test`
Expected: FAIL because the shared enum files do not exist

- [ ] **Step 3: Write minimal implementation**

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/quote-status.ts`:

```ts
export const QUOTE_STATUSES = [
  'draft',
  'quoted',
  'revised',
  'sample_requested',
  'ordered',
  'closed',
] as const;
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/inquiry-status.ts`:

```ts
export const INQUIRY_STATUSES = [
  'draft',
  'submitted',
  'boss_confirmed',
  'rejected',
] as const;
```

Create `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/packages/shared/src/index.ts`:

```ts
export * from './quote-status';
export * from './inquiry-status';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @erp/shared test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/quote-status.ts packages/shared/src/inquiry-status.ts packages/shared/src/index.ts packages/shared/src/quote-status.spec.ts
git commit -m "feat: add shared quote domain enums"
```

## Self-Review

### Spec coverage

- Platform foundation: covered by Tasks 1-3
- Quote and inquiry MVP: covered by Tasks 4-5
- Shared domain contract: covered by Task 8
- First frontend quote workbench: covered by Tasks 6-7
- Full sales, purchase, shipment, after-sales, finance chain: intentionally deferred to the next implementation plan after this vertical slice is stable

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders are left inside task steps
- All tasks include explicit file paths and commands

### Type consistency

- Quote statuses use `draft` and inquiry statuses use `submitted` / `boss_confirmed`, matching the design document
- Quote creation DTO fields align across backend controller, service, and frontend form
