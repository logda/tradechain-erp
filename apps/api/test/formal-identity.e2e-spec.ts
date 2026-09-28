import { createHmac } from 'node:crypto';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { QuoteService } from '../src/quote/quote.service';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserManagementService } from '../src/user-management/user-management.service';

describe('real employee metadata route', () => {
  let app: INestApplication;
  let dir: string;
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'erp-employee-http-'));
    process.env.ERP_DATA_DIR = dir;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    delete process.env.ERP_DATA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });
  it('rejects signed cross-owner edits before accepting a replacement owner', async () => {
    process.env.ERP_REQUIRE_SIGNED_FORMAL_SESSION = 'true';
    try {
      const users = app.get(UserManagementService);
      const employee = await users.create({ username: 'employeea', realName: '张三', password: 'secret', roleCode: 'sales', createdBy: 'admin' });
      const sales = app.get(SalesOrderService);
      const order = await sales.create({ customerName: 'Customer', title: 'Original title', salesUserId: 3, createdBy: 3 });
      const quotes = app.get(QuoteService);
      const quote = await quotes.create({ customerId: 1001, salesUserId: 3, sourceCode: 'expo', requirements: 'Original', items: [] });
      const payload = Buffer.from(JSON.stringify({ userId: employee.id, username: 'employeea', role: 'sales', user: '张三', dataScope: 'own_sales', modules: ['sales'], actions: ['sales.order.write', 'sales.quote.write'], exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
      const signature = createHmac('sha256', process.env.ERP_FORMAL_SESSION_SECRET?.trim() || 'dev-only-insecure-formal-session-secret').update(payload).digest('base64url');
      const signed = { 'x-erp-session': payload, 'x-erp-session-signature': signature };
      await request(app.getHttpServer()).post(`/sales-orders/${order.id}/draft`).set(signed).send({ title: 'Stolen title', salesUserId: employee.id }).expect(403);
      await request(app.getHttpServer()).post(`/quotes/${quote.id}/draft`).set(signed).send({ requirements: 'Stolen', salesUserId: employee.id }).expect(403);
      expect(await sales.getDetail(order.id)).toMatchObject({ salesUserId: 3, title: 'Original title' });
      expect(await quotes.getDetail(quote.id)).toMatchObject({ salesUserId: 3, requirements: 'Original' });
    } finally { delete process.env.ERP_REQUIRE_SIGNED_FORMAL_SESSION; }
  });

  it('decorates authorized own-sales HTTP rows with usernames while preserving scope and stored IDs', async () => {
    const users = app.get(UserManagementService);
    const employee = await users.create({ username: 'new-sales', realName: '员工姓名', password: 'secret', roleCode: 'sales', createdBy: 'admin' });
    const sales = app.get(SalesOrderService);
    const own = await sales.create({ customerName: 'Own customer', title: 'Own order', salesUserId: employee.id, createdBy: employee.id });
    const other = await sales.create({ customerName: 'Other customer', title: 'Other order', salesUserId: 3, createdBy: 3 });
    const response = await request(app.getHttpServer()).get('/sales-orders')
      .set('x-erp-role', 'sales').set('x-erp-user', encodeURIComponent('员工姓名'))
      .set('x-erp-user-id', String(employee.id)).set('x-erp-modules', 'sales').set('x-erp-data-scope', 'own_sales').expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({ ownerName: '员工姓名', userDisplayNames: { ownerName: 'new-sales' } });
    expect(response.body.items[0].detailHref).toContain(String(own.id));
    expect(JSON.stringify(response.body.items)).not.toContain('Other order');
    await request(app.getHttpServer()).get(`/sales-orders/${other.id}`)
      .set('x-erp-role', 'sales').set('x-erp-user', encodeURIComponent('员工姓名'))
      .set('x-erp-user-id', String(employee.id)).set('x-erp-modules', 'sales').set('x-erp-data-scope', 'own_sales').expect(404);
    expect(await sales.getDetail(own.id)).toMatchObject({ salesUserId: employee.id, createdBy: employee.id });
  });

  it('serves active real employee IDs before the generic quote detail route', async () => {
    const created = await app.get(UserManagementService).create({ username: 'newperson', realName: '张三', password: 'secret', roleCode: 'sales', createdBy: 'admin' });
    const response = await request(app.getHttpServer()).get('/quotes/create-metadata')
      .set('x-erp-role', 'sales').set('x-erp-user', encodeURIComponent('张三')).set('x-erp-user-id', String(created.id)).set('x-erp-modules', 'sales').expect(200);
    expect(response.body.salesUsers).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id, realName: '张三', status: 'active' })]));
  });
});
