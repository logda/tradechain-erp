# Product Library Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing product master into a formal product library with candidate/formal stages, separate sales and purchase codes, supplier-code linkage, and quantity-based sale price tiers while preserving the current `productId` business chain.

**Architecture:** Extend the existing `Product` model instead of introducing a second durable product identity. Keep `productId` stable, reinterpret current `sku` as the internal product code in UI and payload mapping, and add a dedicated `ProductSalePriceTier` child structure so quotes and downstream operations can resolve fixed or tiered pricing without breaking existing flows.

**Tech Stack:** NestJS, Prisma + MySQL, Next.js App Router, React, inline TypeScript styles, Vitest, Testing Library

---

### Task 1: Expand persistence for formal product library fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/prisma/seed.ts`
- Modify: `apps/api/test/prisma-schema.spec.ts`
- Modify: `apps/api/test/product.prisma.spec.ts`
- Modify: `apps/api/test/product.persistence.spec.ts`

- [ ] **Step 1: Write the failing schema and persistence tests**

Add assertions that the Prisma schema includes the new product fields and the dedicated sale price tier model.

```ts
expect(schema).toContain('salesCode');
expect(schema).toContain('purchaseCode');
expect(schema).toContain('productStage');
expect(schema).toContain('pricingMode');
expect(schema).toContain('defaultSupplierCode');
expect(schema).toContain('model ProductSalePriceTier');
```

Add persistence expectations for returning a saved formal product with richer fields and sale tiers.

```ts
expect(created).toMatchObject({
  sku: 'SKU-CAM-900',
  salesCode: 'SALE-CAM-900',
  purchaseCode: 'PUR-CAM-900',
  productStage: 'formal',
  pricingMode: 'tiered',
  defaultSupplierCode: 'SUP-LIGHT',
});
expect(created.salePriceTiers).toEqual([
  expect.objectContaining({ minQuantity: 1, salePrice: 128 }),
  expect.objectContaining({ minQuantity: 100, salePrice: 118 }),
]);
```

- [ ] **Step 2: Run the focused API tests to verify they fail**

Run: `CI=true pnpm --filter api test -- prisma-schema.spec.ts product.prisma.spec.ts product.persistence.spec.ts`

Expected: FAIL because the schema, seed data, and product persistence layer do not yet expose the new fields and child tier records.

- [ ] **Step 3: Write the minimal schema implementation**

Extend `Product` with the new columns and add `ProductSalePriceTier`.

```prisma
model Product {
  id                   BigInt    @id @default(autoincrement())
  sku                  String    @unique @db.VarChar(64)
  salesCode            String?   @unique @db.VarChar(64)
  purchaseCode         String?   @unique @db.VarChar(64)
  purchaseCodeMode     String?   @db.VarChar(16)
  productStage         String    @db.VarChar(32)
  pricingMode          String    @db.VarChar(16)
  brand                String?   @db.VarChar(64)
  factoryName          String?   @db.VarChar(128)
  spec                 String?   @db.VarChar(255)
  singleWeight         Decimal?  @db.Decimal(18, 3)
  cartonSpec           String?   @db.VarChar(255)
  cartonQuantity       Int?
  cartonWeight         Decimal?  @db.Decimal(18, 3)
  defaultSupplierCode  String?   @db.VarChar(64)
  salePriceTiers       ProductSalePriceTier[]
}

model ProductSalePriceTier {
  id         BigInt   @id @default(autoincrement())
  productId   BigInt
  minQuantity Int
  salePrice   Decimal @db.Decimal(18, 2)
  currency    String  @db.VarChar(16)
  status      String  @db.VarChar(16)
  createdBy   String  @db.VarChar(64)
  createdAt   DateTime @default(now())
  updatedBy   String? @db.VarChar(64)
  updatedAt   DateTime @updatedAt

  @@unique([productId, minQuantity])
  @@index([productId, status])
}
```

Seed at least one formal product and one candidate product so UI and quote flows have realistic data.

- [ ] **Step 4: Run the focused API tests to verify they pass**

Run: `CI=true pnpm --filter api test -- prisma-schema.spec.ts product.prisma.spec.ts product.persistence.spec.ts`

Expected: PASS

### Task 2: Add backend product domain rules for candidate/formal products and price tiers

**Files:**
- Modify: `apps/api/src/product/product.service.ts`
- Modify: `apps/api/src/product/product.controller.ts`
- Modify: `apps/api/test/product.service.spec.ts`
- Modify: `apps/api/test/product.controller.spec.ts`
- Modify: `apps/api/test/product.prisma.spec.ts`
- Modify: `apps/api/test/counterparty.service.spec.ts`

- [ ] **Step 1: Write the failing service tests**

Add tests for candidate creation, formal conversion, supplier-code validation, generated purchase code, and tier validation.

```ts
it('creates a quote candidate product with relaxed validation', async () => {
  await expect(
    service.create({
      sku: 'SKU-Q-001',
      nameCn: '报价灯带',
      nameEn: '',
      category: 'electronics',
      ownerName: 'Zoe',
      productStage: 'quote_candidate',
      pricingMode: 'fixed',
      createdBy: 'Zoe',
    }),
  ).resolves.toMatchObject({
    sku: 'SKU-Q-001',
    productStage: 'quote_candidate',
    salesCode: '',
  });
});

it('rejects formal products without sales code', async () => {
  await expect(
    service.create({
      sku: 'SKU-F-001',
      nameCn: '正式灯带',
      nameEn: '',
      category: 'electronics',
      ownerName: 'Zoe',
      productStage: 'formal',
      pricingMode: 'fixed',
      createdBy: 'Zoe',
    }),
  ).rejects.toThrow('销售编码不能为空');
});
```

Add a controller test for:

```ts
await expect(
  controller.convertToFormal(9, { operatedBy: 'Admin' }),
).resolves.toMatchObject({ id: 9, productStage: 'formal' });
```

- [ ] **Step 2: Run the focused API tests to verify they fail**

Run: `CI=true pnpm --filter api test -- product.service.spec.ts product.controller.spec.ts product.prisma.spec.ts`

Expected: FAIL because service payloads, validation, and conversion action do not exist yet.

- [ ] **Step 3: Write the minimal backend implementation**

Extend product types and validation branches.

```ts
type ProductStage = 'quote_candidate' | 'formal';
type PricingMode = 'fixed' | 'tiered';

type ProductSalePriceTierRecord = {
  id: number;
  minQuantity: number;
  salePrice: number;
  currency: string;
  status: 'active' | 'inactive';
};
```

Implement service rules:

- candidate create requires category, internal code (`sku`), product name, owner
- formal create requires candidate fields plus `salesCode` and `pricingMode`
- provided `defaultSupplierCode` must resolve to a supplier / both counterparty
- generated purchase code fills `purchaseCode` when mode is `generated`
- `convertToFormal` validates and flips stage without changing `productId`

Add a controller action:

```ts
@Post(':id/convert-to-formal')
@FormalActions('master_data.write')
convertToFormal(
  @Param('id', ParseIntPipe) id: number,
  @Body() body: { operatedBy: string },
) {
  return this.productService.convertToFormal(id, body);
}
```

- [ ] **Step 4: Run the focused API tests to verify they pass**

Run: `CI=true pnpm --filter api test -- product.service.spec.ts product.controller.spec.ts product.prisma.spec.ts`

Expected: PASS

### Task 3: Support quote candidate product creation in quote flows

**Files:**
- Modify: `apps/api/src/quote/dto/create-quote.dto.ts`
- Modify: `apps/api/src/quote/quote.service.ts`
- Modify: `apps/api/test/quote.service.spec.ts`
- Modify: `apps/api/test/quote.controller.spec.ts`
- Modify: `apps/web/app/app/sales/quotes/new/actions.ts`
- Modify: `apps/web/app/app/sales/quotes/new/create-formal-quote-form.tsx`
- Modify: `apps/web/tests/quote-create-actions.test.ts`
- Modify: `apps/web/tests/app-formal-quote-create.test.tsx`

- [ ] **Step 1: Write the failing quote tests**

Backend expectation:

```ts
it('creates a quote with a newly created candidate product', async () => {
  const result = await service.create({
    customerId: 1001,
    salesUserId: 2001,
    sourceCode: 'expo',
    requirements: 'new candidate',
    items: [{
      createCandidateProduct: {
        sku: 'SKU-Q-900',
        nameCn: '报价新品',
        category: 'electronics',
        ownerName: 'Zoe',
      },
      quantity: 50,
      salePrice: 120,
    }],
  });

  expect(result.items[0].productId).toBeGreaterThan(0);
  expect(result.items[0].productName).toBe('报价新品');
});
```

Frontend expectation:

```ts
expect(payload.items[0]).toMatchObject({
  quantity: 50,
  salePrice: 120,
  createCandidateProduct: {
    sku: 'SKU-Q-900',
    nameCn: '报价新品',
    category: 'electronics',
  },
});
```

- [ ] **Step 2: Run the focused quote tests to verify they fail**

Run: `CI=true pnpm --filter api test -- quote.service.spec.ts quote.controller.spec.ts`

Run: `CI=true pnpm --filter web test -- quote-create-actions.test.ts app-formal-quote-create.test.tsx`

Expected: FAIL because quote payloads currently require an existing `productId` only.

- [ ] **Step 3: Write the minimal quote implementation**

Allow quote item payloads to either reference an existing product or include a candidate product draft.

```ts
type CreateQuoteItemDraft =
  | {
      productId: number;
      sku: string;
      productName: string;
      unit: string;
      quantity: number;
      salePrice: number;
    }
  | {
      createCandidateProduct: {
        sku: string;
        nameCn: string;
        category: string;
        ownerName: string;
      };
      quantity: number;
      salePrice: number;
    };
```

In the quote service, when `createCandidateProduct` is present, call product service create with `productStage = 'quote_candidate'`, then continue quote item normalization using the returned `productId`.

- [ ] **Step 4: Run the focused quote tests to verify they pass**

Run: `CI=true pnpm --filter api test -- quote.service.spec.ts quote.controller.spec.ts`

Run: `CI=true pnpm --filter web test -- quote-create-actions.test.ts app-formal-quote-create.test.tsx`

Expected: PASS

### Task 4: Expand product master UI for formal fields and stage-aware validation

**Files:**
- Modify: `apps/web/app/app/master-data/products/page.tsx`
- Modify: `apps/web/app/app/master-data/products/create-product-form.tsx`
- Modify: `apps/web/app/app/master-data/products/update-product-form.tsx`
- Modify: `apps/web/tests/app-products-page.test.tsx`

- [ ] **Step 1: Write the failing web test**

Add assertions for the richer field set, stage filter, and conversion action.

```tsx
expect(screen.getByText('内部产品编码 Internal Code')).toBeInTheDocument();
expect(screen.getByText('销售编码 Sales Code')).toBeInTheDocument();
expect(screen.getByText('采购编码 Purchase Code')).toBeInTheDocument();
expect(screen.getByText('产品阶段 Product Stage')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '转正式产品' })).toBeInTheDocument();
```

Add create-form submission assertions:

```ts
expect(fetchMock).toHaveBeenCalledWith(
  expect.stringContaining('/api/products'),
  expect.objectContaining({
    body: expect.stringContaining('"productStage":"quote_candidate"'),
  }),
);
```

- [ ] **Step 2: Run the focused web test to verify it fails**

Run: `CI=true pnpm --filter web test -- app-products-page.test.tsx`

Expected: FAIL because the current product page exposes only the lightweight field set.

- [ ] **Step 3: Write the minimal UI implementation**

Update list, create form, and update form to include:

- internal code label mapped from current `sku`
- sales code
- purchase code
- purchase code mode
- product stage
- pricing mode
- brand / factory / model / spec
- packaging fields
- default supplier code

Add a row action for candidate products:

```tsx
<MutationActionForm
  endpoint={`${apiBaseUrl}/products/${item.id}/convert-to-formal`}
  method="POST"
  fields={[{ name: 'operatedBy', value: actorName }]}
  buttonLabel="转正式产品"
/>
```

Keep the current pagination and activate / deactivate structure intact.

- [ ] **Step 4: Run the focused web test to verify it passes**

Run: `CI=true pnpm --filter web test -- app-products-page.test.tsx`

Expected: PASS

### Task 5: Add product sale price tier maintenance and tiered price display

**Files:**
- Modify: `apps/api/src/product/product.service.ts`
- Modify: `apps/api/test/product.service.spec.ts`
- Modify: `apps/web/app/app/master-data/products/page.tsx`
- Modify: `apps/web/app/app/master-data/products/update-product-form.tsx`
- Modify: `apps/web/tests/app-products-page.test.tsx`

- [ ] **Step 1: Write the failing tier tests**

Backend expectation:

```ts
expect(result.salePriceTiers).toEqual([
  expect.objectContaining({ minQuantity: 1, salePrice: 128 }),
  expect.objectContaining({ minQuantity: 100, salePrice: 118 }),
]);
```

UI expectation:

```tsx
expect(screen.getByText('阶梯 2 档')).toBeInTheDocument();
expect(screen.getByText('1+ : 128.00')).toBeInTheDocument();
expect(screen.getByText('100+ : 118.00')).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `CI=true pnpm --filter api test -- product.service.spec.ts`

Run: `CI=true pnpm --filter web test -- app-products-page.test.tsx`

Expected: FAIL because the product model and page do not yet expose child tiers.

- [ ] **Step 3: Write the minimal tier implementation**

Persist and return sale tiers through product list / create / update. For the UI, render a compact summary in the list and expose editable tier rows in the edit panel.

Recommended render shape:

```tsx
{item.pricingMode === 'tiered' ? (
  <div>
    <strong>{`阶梯 ${item.salePriceTiers.length} 档`}</strong>
    {item.salePriceTiers.map((tier) => (
      <div key={tier.id}>{`${tier.minQuantity}+ : ${tier.salePrice.toFixed(2)}`}</div>
    ))}
  </div>
) : (
  <span>{item.defaultSalePrice.toFixed(2)}</span>
)}
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `CI=true pnpm --filter api test -- product.service.spec.ts`

Run: `CI=true pnpm --filter web test -- app-products-page.test.tsx`

Expected: PASS

### Task 6: Final regression verification for product and quote chains

**Files:**
- Test: `apps/api/test/product.service.spec.ts`
- Test: `apps/api/test/product.controller.spec.ts`
- Test: `apps/api/test/product.prisma.spec.ts`
- Test: `apps/api/test/quote.service.spec.ts`
- Test: `apps/api/test/quote.controller.spec.ts`
- Test: `apps/web/tests/app-products-page.test.tsx`
- Test: `apps/web/tests/quote-create-actions.test.ts`
- Test: `apps/web/tests/app-formal-quote-create.test.tsx`

- [ ] **Step 1: Run the focused backend suite**

Run: `CI=true pnpm --filter api test -- product.service.spec.ts product.controller.spec.ts product.prisma.spec.ts quote.service.spec.ts quote.controller.spec.ts`

Expected: PASS

- [ ] **Step 2: Run the focused web suite**

Run: `CI=true pnpm --filter web test -- app-products-page.test.tsx quote-create-actions.test.ts app-formal-quote-create.test.tsx`

Expected: PASS

- [ ] **Step 3: Run the full web suite**

Run: `CI=true pnpm --filter web test`

Expected: PASS

- [ ] **Step 4: Run the full API suite**

Run: `CI=true pnpm --filter api test`

Expected: PASS

- [ ] **Step 5: Run database verification**

Run: `DATABASE_URL='mysql://erp_app:<db-password>@127.0.0.1:3306/erp' CI=true pnpm --filter api db:verify`

Expected: PASS with `ok: true`
