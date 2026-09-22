# Formal Quote Image Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace formal quote image base64-in-payload handling with persisted file storage so the database stores only resolvable image URLs and the upload path remains deployable on a server.

**Architecture:** Add a small upload service on the API side that stores formal quote images under a storage-backed key and returns public URLs. Update the web formal quote creation action to upload files first, then submit the quote with stored image URLs instead of embedding base64 data in the quote payload. Reuse the existing `ERP_DATA_DIR` runtime convention so local development works immediately, while keeping the storage contract isolated for a future S3/MinIO adapter.

**Tech Stack:** Next.js server actions, NestJS, Prisma/runtime dual storage, filesystem-backed upload storage, Vitest, Jest

---

### Task 1: Add an API-side formal quote image upload service

**Files:**
- Create: `apps/api/src/file-storage/file-storage.service.ts`
- Create: `apps/api/src/file-storage/file-storage.controller.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/app.setup.ts`
- Test: `apps/api/test/file-storage.e2e-spec.ts`

- [ ] **Step 1: Write the failing API upload test**

```ts
it('uploads formal quote images and returns public urls', async () => {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  setupApp(app);
  await app.init();

  await request(app.getHttpServer())
    .post('/api/files/formal-quote-images')
    .attach('files', Buffer.from('quote-image-a'), {
      filename: 'quote-a.png',
      contentType: 'image/png',
    })
    .expect(201)
    .expect(({ body }) => {
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        fileName: 'quote-a.png',
      });
      expect(body.items[0].url).toMatch(/^http:\/\/127\.0\.0\.1:3001\/uploads\/formal-quotes\//);
    });
});
```

- [ ] **Step 2: Run the API upload test to verify it fails**

Run: `CI=true pnpm --filter api test -- file-storage.e2e-spec.ts`
Expected: FAIL because `/api/files/formal-quote-images` does not exist yet

- [ ] **Step 3: Implement the minimal file storage service and upload controller**

```ts
@Injectable()
export class FileStorageService {
  private readonly uploadRoot = resolve(process.env.ERP_DATA_DIR ?? '', 'uploads', 'formal-quotes');

  async saveFormalQuoteImages(files: Express.Multer.File[]) {
    await mkdir(this.uploadRoot, { recursive: true });

    return Promise.all(files.map(async (file) => {
      const ext = extname(file.originalname) || '.bin';
      const key = `${format(new Date(), 'yyyy/MM/dd')}/${randomUUID()}${ext}`;
      const absolutePath = resolve(this.uploadRoot, key);

      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.buffer);

      return {
        key,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/formal-quotes/${key}`.replaceAll('\\', '/'),
      };
    }));
  }
}
```

- [ ] **Step 4: Serve the upload directory from the API app**

```ts
const uploadRoot = resolve(process.env.ERP_DATA_DIR ?? '', 'uploads');
app.use('/uploads', express.static(uploadRoot));
```

- [ ] **Step 5: Re-run the API upload test**

Run: `CI=true pnpm --filter api test -- file-storage.e2e-spec.ts`
Expected: PASS

### Task 2: Change formal quote creation to upload files before creating the quote

**Files:**
- Modify: `apps/web/app/app/sales/quotes/new/actions.ts`
- Modify: `apps/web/tests/app-formal-quote-create.test.tsx`
- Test: `apps/web/tests/app-formal-quote-create.test.tsx`

- [ ] **Step 1: Write the failing web-side payload test**

```ts
it('uploads quote images first and uses returned urls in the quote payload', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({
        items: [
          { url: 'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/quote-a.png' },
          { url: 'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/quote-b.png' },
        ],
      }), { status: 201 }),
    );

  vi.stubGlobal('fetch', fetchMock);

  const formData = new FormData();
  formData.set('customerEntryMode', 'existing');
  formData.set('customerId', '1');
  formData.set('customerName', 'Acme Trading');
  formData.set('customerCode', 'CUST-ACME');
  formData.set('salesUserId', '2002');
  formData.set('sourceCode', 'tiktok');
  formData.set('requirements', 'Need 500 units');
  formData.set('productOption', '1|SKU-LED-001|智能 LED 灯带|set|15.9');
  formData.set('quantity', '500');
  formData.set('salePrice', '15.9');
  formData.append('imageFiles', createImageFile('a.png', 'image-a'));
  formData.append('imageFiles', createImageFile('b.png', 'image-b'));

  await expect(buildCreateFormalQuotePayload(formData)).resolves.toMatchObject({
    items: [
      {
        imageUrls: [
          'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/quote-a.png',
          'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/quote-b.png',
        ],
      },
    ],
  });
});
```

- [ ] **Step 2: Run the focused web test and verify it fails**

Run: `CI=true pnpm --filter web test -- app-formal-quote-create.test.tsx`
Expected: FAIL because the action still produces `data:image/...;base64,...`

- [ ] **Step 3: Implement upload-first behavior in the web action**

```ts
async function uploadFormalQuoteImages(formData: FormData) {
  const files = formData.getAll('imageFiles').filter(isFileLike).filter((file) => (file.size ?? 0) > 0);
  if (files.length === 0) {
    return [];
  }

  const uploadFormData = new FormData();
  for (const file of files) {
    uploadFormData.append('files', file as File);
  }

  const response = await fetch(`${getQuoteApiBaseUrl()}/files/formal-quote-images`, {
    method: 'POST',
    body: uploadFormData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const body = await response.json() as { items?: Array<{ url?: string }> };
  return (body.items ?? []).map((item) => item.url?.trim()).filter((value): value is string => Boolean(value));
}
```

- [ ] **Step 4: Remove base64 conversion from formal quote payload building**

```ts
const imageUrls = await uploadFormalQuoteImages(formData);
```

- [ ] **Step 5: Re-run the focused web test**

Run: `CI=true pnpm --filter web test -- app-formal-quote-create.test.tsx`
Expected: PASS

### Task 3: Verify formal quote persistence still stores only resolvable URLs

**Files:**
- Modify: `apps/api/test/quote.service.spec.ts`
- Test: `apps/api/test/quote.service.spec.ts`

- [ ] **Step 1: Add a regression test for stored quote image urls**

```ts
it('persists quote image urls as normal urls instead of embedded data urls', async () => {
  const service = new QuoteService();

  const result = await service.create({
    customerId: 1001,
    salesUserId: 2001,
    sourceCode: 'expo',
    requirements: 'Need 300 units',
    items: [
      {
        productId: 1,
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        unit: 'set',
        quantity: 300,
        salePrice: 18.5,
        imageUrls: ['http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/quote-a.png'],
      },
    ],
  } as any);

  expect(result.items[0].imageUrls).toEqual([
    'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/quote-a.png',
  ]);
  expect(result.items[0].imageUrls?.[0]).not.toContain('data:image');
});
```

- [ ] **Step 2: Run the focused quote service test**

Run: `CI=true pnpm --filter api test -- quote.service.spec.ts`
Expected: PASS after the web-side change because the service already accepts URL strings

- [ ] **Step 3: Run the final validation set**

Run: `CI=true pnpm --filter web test -- app-formal-quote-create.test.tsx next-config.test.ts`
Expected: PASS

Run: `CI=true pnpm --filter api test -- file-storage.e2e-spec.ts health.e2e-spec.ts quote.service.spec.ts`
Expected: PASS

- [ ] **Step 4: Restart local services and smoke-check the live page**

Run: `CI=true ERP_STORAGE_MODE=prisma DATABASE_URL='mysql://erp_app:<db-password>@127.0.0.1:3306/erp' pnpm --filter api start:dev`
Expected: API starts and serves `/uploads/*`

Run: `PORT=3002 CI=true ERP_API_BASE_URL='http://127.0.0.1:3001/api' pnpm dev`
Expected: Web starts on `http://127.0.0.1:3002`
