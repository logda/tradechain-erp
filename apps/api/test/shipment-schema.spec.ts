import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Shipment Prisma schema', () => {
  it('contains shipment batch fields for quantity tracking and receipt sending', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const match = schema.match(/model ShipmentBatch \{[\s\S]*?\n\}/m);

    expect(match).not.toBeNull();

    const shipmentBatch = match?.[0] ?? '';

    expect(schema).toContain('model ShipmentBatch');
    expect(shipmentBatch).toMatch(/batchNo\s+String\s+@unique\s+@db.VarChar\(64\)/);
    expect(shipmentBatch).toMatch(/salesOrderId\s+BigInt/);
    expect(shipmentBatch).toMatch(/purchaseOrderId\s+BigInt/);
    expect(shipmentBatch).toMatch(/status\s+String\s+@db.VarChar\(64\)/);
    expect(shipmentBatch).toMatch(/shippedQty\s+Int/);
    expect(shipmentBatch).toMatch(/accumulatedQty\s+Int/);
    expect(shipmentBatch).toMatch(/remainingQty\s+Int/);
    expect(shipmentBatch).toMatch(/receiptSendStatus\s+String\s+@db.VarChar\(16\)/);
    expect(shipmentBatch).toMatch(/receiptDocUrl\s+String\?\s+@db.VarChar\(255\)/);
    expect(shipmentBatch).toMatch(/receiptSentAt\s+DateTime\?/);
  });
});
