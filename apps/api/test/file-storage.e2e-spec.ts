import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

describe('formal quote image upload api', () => {
  let app: INestApplication | null = null;
  let runtimeDir: string | undefined;

  beforeEach(async () => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-file-storage-'));
    process.env.ERP_DATA_DIR = runtimeDir;
    process.env.ERP_PUBLIC_BASE_URL = 'http://127.0.0.1:3001';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.ERP_DATA_DIR;
    delete process.env.ERP_PUBLIC_BASE_URL;

    if (app) {
      await app.close();
    }

    if (runtimeDir) {
      rmSync(runtimeDir, { recursive: true, force: true });
    }

    app = null;
    runtimeDir = undefined;
  });

  it('uploads formal quote images and serves them back as persisted urls', async () => {
    const uploadResponse = await request(app!.getHttpServer())
      .post('/api/files/formal-quote-images')
      .set('x-erp-role', 'sales')
      .set('x-erp-user', 'Leo')
      .set('x-erp-modules', 'sales')
      .set('x-erp-actions', 'sales.quote.write')
      .attach('files', Buffer.from('quote-image-a'), {
        filename: 'quote-a.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(uploadResponse.body.items).toHaveLength(1);
    expect(uploadResponse.body.items[0]).toMatchObject({
      fileName: 'quote-a.png',
      mimeType: 'image/png',
      size: 13,
      key: expect.stringMatching(/^formal-quotes\/\d{4}\/\d{2}\/\d{2}\/.+\.png$/),
      url: expect.stringMatching(
        /^http:\/\/127\.0\.0\.1:3001\/uploads\/formal-quotes\/\d{4}\/\d{2}\/\d{2}\/.+\.png$/,
      ),
    });

    const url = new URL(uploadResponse.body.items[0].url);
    const assetResponse = await request(app!.getHttpServer())
      .get(url.pathname)
      .expect(200);

    expect(assetResponse.headers['content-type']).toContain('image/png');
    expect(Buffer.compare(assetResponse.body, Buffer.from('quote-image-a'))).toBe(0);

    const relativeKey = uploadResponse.body.items[0].key as string;
    const savedFilePath = join(runtimeDir!, 'uploads', ...relativeKey.split('/'));
    expect(readFileSync(savedFilePath).toString('utf8')).toBe('quote-image-a');
  });

  it('uploads multiple sales order attachments including images and documents', async () => {
    const uploadResponse = await request(app!.getHttpServer())
      .post('/api/files/sales-order-attachments')
      .set('x-erp-role', 'sales')
      .set('x-erp-user', 'Leo')
      .set('x-erp-modules', 'sales')
      .set('x-erp-actions', 'sales.order.write')
      .attach('files', Buffer.from('sales-image'), {
        filename: 'sales-image.png',
        contentType: 'image/png',
      })
      .attach('files', Buffer.from('sales-spec'), {
        filename: 'sales-spec.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(uploadResponse.body.items).toHaveLength(2);
    expect(uploadResponse.body.items[0]).toMatchObject({
      fileName: 'sales-image.png',
      mimeType: 'image/png',
      size: 11,
      key: expect.stringMatching(
        /^sales-order-attachments\/\d{4}\/\d{2}\/\d{2}\/.+\.png$/,
      ),
      url: expect.stringMatching(
        /^http:\/\/127\.0\.0\.1:3001\/uploads\/sales-order-attachments\/\d{4}\/\d{2}\/\d{2}\/.+\.png$/,
      ),
    });
    expect(uploadResponse.body.items[1]).toMatchObject({
      fileName: 'sales-spec.pdf',
      mimeType: 'application/pdf',
      size: 10,
      key: expect.stringMatching(
        /^sales-order-attachments\/\d{4}\/\d{2}\/\d{2}\/.+\.pdf$/,
      ),
      url: expect.stringMatching(
        /^http:\/\/127\.0\.0\.1:3001\/uploads\/sales-order-attachments\/\d{4}\/\d{2}\/\d{2}\/.+\.pdf$/,
      ),
    });
  });
});
