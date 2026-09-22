import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';

describe('ShipmentBatchService persistence', () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-shipment-batch-'));
    process.env.ERP_DATA_DIR = runtimeDir;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('persists shipment batch creation and status transitions across service instances', async () => {
    const firstService = new ShipmentBatchService();
    const created = await firstService.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-08T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-001',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    await firstService.markToForwarder({
      shipmentBatchId: created.id,
      currentStatus: 'shipped',
    });
    await firstService.uploadReceipt({
      shipmentBatchId: created.id,
      receiptDocUrl: 'https://files.example.com/receipt-001.pdf',
    });
    await firstService.sendReceipt({
      shipmentBatchId: created.id,
      receiptDocUrl: 'https://files.example.com/receipt-001.pdf',
      sentBy: 2002,
    });

    const secondService = new ShipmentBatchService();
    const detail = await secondService.getDetail(created.id);

    expect(detail).toMatchObject({
      id: created.id,
      batchNo: created.batchNo,
      status: 'to_forwarder',
      receiptSendStatus: 'sent',
      salesOrderId: 88,
      purchaseOrderId: 21,
      receiptDocUrl: 'https://files.example.com/receipt-001.pdf',
      receiptSentBy: 2002,
    });
  });
});
