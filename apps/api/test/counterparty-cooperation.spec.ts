import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CounterpartyService } from '../src/counterparty/counterparty.service';
import type { PrismaService } from '../src/storage/prisma.service';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';
import type { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';

describe('supplier cooperation after a new shipment', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-supplier-cooperation-'));
    process.env.ERP_DATA_DIR = dataDir;
    process.env.ERP_STORAGE_MODE = 'runtime';
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('defaults existing and newly created suppliers to uncooperated; partial shipment and later shipment mark them cooperated', async () => {
    const service = new CounterpartyService();
    expect((await service.findById(2))?.cooperationStatus).toBe('uncooperated');
    const created = await service.create({ type: 'supplier', code: 'SUP-NEW-11', name: 'New Supplier', shortName: '', region: '', ownerName: 'Leo', contactName: '', phone: '', address: '', bankName: '', bankAccount: '', remark: '', createdBy: 'Leo' });
    expect(created.cooperationStatus).toBe('uncooperated');
    await service.markSupplierCooperated({ supplierId: created.id, supplierName: 'New Supplier', ownerName: 'Leo', shipmentId: 9001 });
    expect((await service.findById(created.id))?.cooperationStatus).toBe('cooperated');
    await service.update(created.id, { cooperationStatus: 'uncooperated', updatedBy: 'Boss' });
    await service.markSupplierCooperated({ supplierId: created.id, supplierName: 'New Supplier', ownerName: 'Leo', shipmentId: 9002 });
    expect((await service.findById(created.id))?.cooperationStatus).toBe('cooperated');
  });

  it('matches manually named suppliers exactly and creates only one supplier record for repeated shipment', async () => {
    const service = new CounterpartyService();
    await service.markSupplierCooperated({ supplierId: 0, supplierName: 'Manual Supplier', ownerName: 'Leo', shipmentId: 9101 });
    await service.markSupplierCooperated({ supplierId: 0, supplierName: 'Manual Supplier', ownerName: 'Leo', shipmentId: 9102 });
    const items = (await service.list({ type: 'supplier', keyword: 'Manual Supplier' })).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Manual Supplier', ownerName: 'Leo', cooperationStatus: 'cooperated' });
  });

  it('updates the supplier from the purchase order when a partial shipment is created', async () => {
    const counterparties = new CounterpartyService();
    const purchaseOrders = {
      getDetail: jest.fn().mockResolvedValue({ id: 21, status: 'purchasing', supplierId: 2, supplierName: 'Bravo Industrial', ownerName: 'Leo', purchaseNo: 'P21', salesOrderNo: 'S88', items: [{ quantity: 100 }] }),
      syncShipmentFulfillmentStatus: jest.fn(),
    } as unknown as PurchaseOrderService;
    const service = new ShipmentBatchService(undefined, undefined, purchaseOrders, counterparties);
    await service.create({ salesOrderId: 88, purchaseOrderId: 21, shippedQty: 40, accumulatedQty: 40, remainingQty: 60, shippedAt: '2026-09-25T10:00:00.000Z', shippingCode: 'SHIP-11-A', createdBy: 2002, purchaseOrderCurrentStatus: 'purchasing', currentBatchCount: 0 });
    expect((await counterparties.findById(2))?.cooperationStatus).toBe('cooperated');
  });

  it('uses the purchase order manual supplier name rather than the editable shipment purchasing unit', async () => {
    const counterparties = new CounterpartyService();
    const purchaseOrders = {
      getDetail: jest.fn().mockResolvedValue({ id: 22, status: 'purchasing', supplierId: 0, supplierName: 'Manual Purchase Supplier', ownerName: 'Leo', purchaseNo: 'P22', salesOrderNo: 'S89', items: [{ quantity: 10 }] }),
      syncShipmentFulfillmentStatus: jest.fn(),
    } as unknown as PurchaseOrderService;
    const service = new ShipmentBatchService(undefined, undefined, purchaseOrders, counterparties);
    await service.create({ salesOrderId: 89, purchaseOrderId: 22, shippedQty: 4, accumulatedQty: 4, remainingQty: 6, shippedAt: '2026-09-25T10:00:00.000Z', shippingCode: 'SHIP-11-B', purchasingUnit: 'Editable Display Name', createdBy: 2002, purchaseOrderCurrentStatus: 'purchasing', currentBatchCount: 0 });
    const items = (await counterparties.list({ type: 'supplier', keyword: 'Manual Purchase Supplier' })).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Manual Purchase Supplier', ownerName: 'Leo', cooperationStatus: 'cooperated' });
  });

  it('updates a linked supplier through Prisma without creating another record', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const now = new Date('2026-09-25T10:00:00.000Z');
    const existing = { id: 2n, type: 'supplier', code: 'SUP-2', name: 'Exact Supplier', shortName: null, region: null, ownerName: 'Leo', contactName: null, phone: null, address: null, bankName: null, bankAccount: null, remark: null, email: null, paymentTerms: null, status: 'active', cooperationStatus: 'uncooperated', createdBy: 'Leo', createdAt: now, updatedBy: null, updatedAt: now, deactivatedAt: null, deactivatedBy: null, deactivatedReason: null };
    const prisma = { counterpartyCustomField: { findMany: jest.fn().mockResolvedValue([]) }, counterparty: { findUnique: jest.fn().mockResolvedValue(existing), findFirst: jest.fn(), update: jest.fn().mockResolvedValue({ ...existing, cooperationStatus: 'cooperated' }), create: jest.fn() }, operationLog: { create: jest.fn() } } as unknown as PrismaService;
    const service = new CounterpartyService(prisma);
    await service.markSupplierCooperated({ supplierId: 2, supplierName: 'Exact Supplier', ownerName: 'Leo', shipmentId: 9201 });
    expect(prisma.counterparty.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 2n }, data: expect.objectContaining({ cooperationStatus: 'cooperated' }) }));
    expect(prisma.counterparty.create).not.toHaveBeenCalled();
  });

  it('reuses an exact-name supplier in Prisma for a manually named purchase supplier', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const now = new Date('2026-09-25T10:00:00.000Z');
    const existing = { id: 7n, type: 'supplier', code: 'SUP-EXACT', name: 'Exact Manual', shortName: null, region: null, ownerName: 'Leo', contactName: null, phone: null, address: null, bankName: null, bankAccount: null, remark: null, email: null, paymentTerms: null, status: 'active', cooperationStatus: 'uncooperated', createdBy: 'Leo', createdAt: now, updatedBy: null, updatedAt: now, deactivatedAt: null, deactivatedBy: null, deactivatedReason: null };
    const prisma = { counterpartyCustomField: { findMany: jest.fn().mockResolvedValue([]) }, counterparty: { findFirst: jest.fn().mockResolvedValue(existing), findUnique: jest.fn().mockResolvedValue(existing), update: jest.fn().mockResolvedValue({ ...existing, cooperationStatus: 'cooperated' }), create: jest.fn() }, operationLog: { create: jest.fn() } } as unknown as PrismaService;
    await new CounterpartyService(prisma).markSupplierCooperated({ supplierId: 0, supplierName: 'Exact Manual', ownerName: 'Leo', shipmentId: 9301 });
    expect(prisma.counterparty.findFirst).toHaveBeenCalledWith({ where: { name: 'Exact Manual', type: { in: ['supplier', 'both'] } }, orderBy: { id: 'asc' } });
    expect(prisma.counterparty.create).not.toHaveBeenCalled();
    expect(prisma.counterparty.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7n } }));
  });

  it('creates a cooperated supplier in Prisma when a manual name has no exact match', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const now = new Date('2026-09-25T10:00:00.000Z');
    const created = { id: 8n, type: 'supplier', code: 'SUP-SH-9401', name: 'New Manual', shortName: '', region: '', ownerName: 'Leo', contactName: '', phone: '', address: '', bankName: '', bankAccount: '', remark: '', email: null, paymentTerms: null, status: 'active', cooperationStatus: 'uncooperated', createdBy: 'system', createdAt: now, updatedBy: null, updatedAt: now, deactivatedAt: null, deactivatedBy: null, deactivatedReason: null };
    const prisma = { counterpartyCustomField: { findMany: jest.fn().mockResolvedValue([]) }, counterparty: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id?: bigint } }) => where.id ? created : null), create: jest.fn().mockResolvedValue(created), update: jest.fn().mockResolvedValue({ ...created, cooperationStatus: 'cooperated' }) }, operationLog: { create: jest.fn() } } as unknown as PrismaService;
    const id = await new CounterpartyService(prisma).markSupplierCooperated({ supplierId: 0, supplierName: 'New Manual', ownerName: 'Leo', shipmentId: 9401 });
    expect(id).toBe(8);
    expect(prisma.counterparty.create).toHaveBeenCalledWith({ data: expect.objectContaining({ code: 'SUP-SH-9401', name: 'New Manual', ownerName: 'Leo', cooperationStatus: 'cooperated' }) });
    expect(prisma.counterparty.update).not.toHaveBeenCalled();
  });
});
