import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Inventory Prisma schema', () => {
  it('declares warehouse, inventory, stock-in, and stock-out models', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('model Warehouse');
    expect(schema).toContain('model WarehouseLocation');
    expect(schema).toContain('model InventoryBalance');
    expect(schema).toContain('model InventoryLedger');
    expect(schema).toContain('model StockInOrder');
    expect(schema).toContain('model StockOutOrder');
  });
});
