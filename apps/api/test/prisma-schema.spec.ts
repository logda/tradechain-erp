import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';

describe('Prisma schema', () => {
  it('contains quote and inquiry models', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

    expect(schema).not.toContain('url      = env("DATABASE_URL")');
    expect(schema).toContain('model User');
    expect(schema).toContain('model RolePermission');
    expect(schema).toContain('passwordHash');
    expect(schema).toContain('fullAccess');
    expect(schema).toContain('deactivatedAt');
    expect(schema).toContain('deactivatedBy');
    expect(schema).toContain('deactivatedReason');
    expect(schema).toContain('model Counterparty');
    expect(schema).toContain('code');
    expect(schema).toContain('name');
    expect(schema).toContain('shortName');
    expect(schema).toContain('contactName');
    expect(schema).toContain('address');
    expect(schema).toContain('bankName');
    expect(schema).toContain('bankAccount');
    expect(schema).toContain('remark');
    expect(schema).toContain('ownerName');
    expect(schema).toContain('status');
    expect(schema).toContain('model Product');
    expect(schema).toContain('sku');
    expect(schema).toContain('salesCode');
    expect(schema).toContain('purchaseCode');
    expect(schema).toContain('purchaseCodeMode');
    expect(schema).toContain('productStage');
    expect(schema).toContain('pricingMode');
    expect(schema).toContain('brand');
    expect(schema).toContain('factoryName');
    expect(schema).toContain('spec');
    expect(schema).toContain('singleWeight');
    expect(schema).toContain('cartonSpec');
    expect(schema).toContain('cartonQuantity');
    expect(schema).toContain('cartonWeight');
    expect(schema).toContain('defaultSupplierCode');
    expect(schema).toContain('nameCn');
    expect(schema).toContain('nameEn');
    expect(schema).toContain('defaultSalePrice');
    expect(schema).toContain('defaultPurchasePrice');
    expect(schema).toContain('model ProductSalePriceTier');
    expect(schema).toContain('minQuantity');
    expect(schema).toContain('salePriceTiers');
    expect(schema).toContain('model AttachmentMeta');
    expect(schema).toContain('model BusinessDocument');
    expect(schema).toContain('payload');
    expect(schema).toContain('@@index([bizType, status])');
    expect(schema).toContain('model QuoteOrder');
    expect(schema).toContain('model QuoteOrderVersion');
    expect(schema).toContain('model QuoteInquirySheet');
    expect(schema).toContain('model QuoteInquiryItem');
    expect(schema).toContain('model QuoteInquirySupplierQuote');
    expect(schema).toContain('model ApprovalRecord');
    expect(schema).toContain('model OperationLog');
    expect(schema).toContain('inquiries          QuoteInquirySheet[]');
    expect(schema).toContain(
      'quoteOrder        QuoteOrder @relation(fields: [quoteOrderId], references: [id])',
    );
  });

  it('keeps the generated Prisma client in sync with Product schema fields', () => {
    const productModel = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === 'Product',
    );
    const fieldNames = productModel?.fields.map((field) => field.name) ?? [];

    expect(fieldNames).toEqual(
      expect.arrayContaining([
        'salesCode',
        'purchaseCode',
        'purchaseCodeMode',
        'productStage',
        'pricingMode',
        'brand',
        'factoryName',
        'model',
        'spec',
        'singleWeight',
        'cartonSpec',
        'cartonQuantity',
        'cartonWeight',
        'defaultSupplierCode',
      ]),
    );
  });
});
