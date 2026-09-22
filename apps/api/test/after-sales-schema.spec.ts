import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('After sales Prisma schema', () => {
  it('contains after-sales fields for closure and finance traceability', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const getModelBlock = (modelName: string) => {
      const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm'));

      expect(match).not.toBeNull();

      return match?.[0] ?? '';
    };

    const salesOrder = getModelBlock('SalesOrder');
    const afterSalesOrder = getModelBlock('AfterSalesOrder');

    expect(salesOrder).toMatch(/afterSalesEndStatus\s+String\s+@db.VarChar\(64\)/);
    expect(salesOrder).toMatch(/financeStatus\s+String\s+@db.VarChar\(64\)/);
    expect(afterSalesOrder).toMatch(/afterSalesNo\s+String\s+@unique\s+@db.VarChar\(64\)/);
    expect(afterSalesOrder).toMatch(/salesOrderId\s+BigInt/);
    expect(afterSalesOrder).toMatch(/purchaseOrderId\s+BigInt\?/);
    expect(afterSalesOrder).toMatch(/shipmentBatchId\s+BigInt\?/);
    expect(afterSalesOrder).toMatch(/type\s+String\s+@db.VarChar\(32\)/);
    expect(afterSalesOrder).toMatch(/status\s+String\s+@db.VarChar\(64\)/);
    expect(afterSalesOrder).toMatch(/financeReviewStatus\s+String\s+@db.VarChar\(64\)/);
  });
});
