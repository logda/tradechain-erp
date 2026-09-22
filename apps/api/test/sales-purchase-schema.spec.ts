import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Sales and purchase Prisma schema', () => {
  it('contains versioned sales and purchase order models with traceability fields', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const getModelBlock = (modelName: string) => {
      const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm'));

      expect(match).not.toBeNull();

      return match?.[0] ?? '';
    };

    const salesOrder = getModelBlock('SalesOrder');
    const salesOrderVersion = getModelBlock('SalesOrderVersion');
    const salesOrderItem = getModelBlock('SalesOrderItem');
    const purchaseOrder = getModelBlock('PurchaseOrder');
    const purchaseOrderVersion = getModelBlock('PurchaseOrderVersion');
    const purchaseOrderItem = getModelBlock('PurchaseOrderItem');

    expect(schema).toContain('model SalesOrder');
    expect(schema).toContain('model SalesOrderVersion');
    expect(schema).toContain('model SalesOrderItem');
    expect(schema).toContain('model PurchaseOrder');
    expect(schema).toContain('model PurchaseOrderVersion');
    expect(schema).toContain('model PurchaseOrderItem');
    expect(salesOrder).toMatch(/sourceQuoteOrderId\s+BigInt\?/);
    expect(salesOrder).toMatch(/sourceQuoteVersionId\s+BigInt\?\s+@unique/);
    expect(salesOrder).toMatch(/versions\s+SalesOrderVersion\[\]/);
    expect(salesOrderVersion).toMatch(/@@unique\(\[salesOrderId,\s*versionNo\]\)/);
    expect(salesOrderItem).toMatch(/quantity\s+Int/);
    expect(salesOrderItem).not.toMatch(/quantity\s+Decimal/);
    expect(salesOrderItem).toMatch(/@@unique\(\[salesOrderVersionId,\s*lineNo\]\)/);
    expect(purchaseOrder).toMatch(/sourceSalesOrderId\s+BigInt/);
    expect(purchaseOrder).toMatch(/confirmedVersionNo\s+Int\?/);
    expect(purchaseOrder).toMatch(/versions\s+PurchaseOrderVersion\[\]/);
    expect(purchaseOrderVersion).toMatch(/@@unique\(\[purchaseOrderId,\s*versionNo\]\)/);
    expect(purchaseOrderItem).toMatch(/sourceSalesItemId\s+BigInt/);
    expect(purchaseOrderItem).toMatch(/quantity\s+Int/);
    expect(purchaseOrderItem).not.toMatch(/quantity\s+Decimal/);
    expect(purchaseOrderItem).toMatch(/@@unique\(\[purchaseOrderVersionId,\s*lineNo\]\)/);
  });
});
