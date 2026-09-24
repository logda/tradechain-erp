import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CanActivate,
  Controller,
  ExecutionContext,
  INestApplication,
  Injectable,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IdempotencyInterceptor } from '../src/idempotency/idempotency.interceptor';
import { IdempotencyService } from '../src/idempotency/idempotency.service';
import { setupApp } from '../src/app.setup';

let writes = 0;

@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    if (req.headers['x-test-auth'] !== 'allowed') return false;
    req.headers['x-erp-role'] = 'sales';
    req.headers['x-erp-user'] = 'Leo';
    return true;
  }
}

@Controller('test-orders')
@UseGuards(TestAuthGuard)
class TestOrdersController {
  @Post()
  async create() {
    writes += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return { id: writes, status: 'draft' };
  }
}

describe('idempotent mutation HTTP boundary', () => {
  let app: INestApplication;
  let dataDir: string;

  beforeEach(async () => {
    writes = 0;
    dataDir = mkdtempSync(join(tmpdir(), 'erp-idempotency-http-'));
    process.env.ERP_DATA_DIR = dataDir;
    process.env.ERP_STORAGE_MODE = 'runtime';
    const moduleRef = await Test.createTestingModule({
      controllers: [TestOrdersController],
      providers: [TestAuthGuard, IdempotencyService, IdempotencyInterceptor],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    app.useGlobalInterceptors(app.get(IdempotencyInterceptor));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
    delete process.env.ERP_DATA_DIR;
    delete process.env.ERP_STORAGE_MODE;
  });

  it('authorizes first, then returns one created document for repeated POSTs', async () => {
    const key = 'ec9f7fee-4312-4c96-b95b-330a53278843';
    const send = () => request(app.getHttpServer())
      .post('/api/test-orders')
      .set('x-test-auth', 'allowed')
      .set('Idempotency-Key', key)
      .send({ customerId: 42 });

    await request(app.getHttpServer())
      .post('/api/test-orders')
      .set('Idempotency-Key', key)
      .send({ customerId: 42 })
      .expect(403);
    const [first, second] = await Promise.all([send(), send()]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body).toEqual({ id: 1, status: 'draft' });
    expect(second.body).toEqual(first.body);
    expect(writes).toBe(1);

    const replay = await send().expect(201);
    expect(replay.body).toEqual(first.body);
    expect(writes).toBe(1);
  });
});
