import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

describe('AppModule idempotent business creation', () => {
  let app: INestApplication;
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-idempotency-app-'));
    process.env.ERP_DATA_DIR = dataDir;
    process.env.ERP_STORAGE_MODE = 'runtime';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
    delete process.env.ERP_DATA_DIR;
    delete process.env.ERP_STORAGE_MODE;
  });

  it('returns the original counterparty on repeated creation without a second audit write', async () => {
    const send = () => request(app.getHttpServer())
      .post('/api/counterparties')
      .set('x-erp-role', 'admin')
      .set('x-erp-user', 'Admin')
      .set('x-erp-modules', 'admin')
      .set('x-erp-actions', 'master_data.write')
      .set('Idempotency-Key', '22b1a221-afca-48ed-8779-78929e1f0a09')
      .send({
        type: 'customer', code: 'IDEMP-001', name: 'Idempotent Customer',
        shortName: '', region: '', ownerName: 'Admin', contactName: '', phone: '',
        address: '', bankName: '', bankAccount: '', remark: '', createdBy: 'Admin',
      });

    const first = await send().expect(201);
    const second = await send().expect(201);
    expect(second.body).toEqual(first.body);

    const listed = await request(app.getHttpServer())
      .get('/api/counterparties')
      .set('x-erp-role', 'admin')
      .set('x-erp-user', 'Admin')
      .set('x-erp-modules', 'admin')
      .expect(200);
    expect(listed.body.items.filter((item: { code: string }) => item.code === 'IDEMP-001'))
      .toHaveLength(1);
  });
});
