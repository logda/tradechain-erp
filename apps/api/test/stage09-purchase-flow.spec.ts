import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InquiryService } from '../src/inquiry/inquiry.service';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import { PurchaseOrderController } from '../src/purchase-order/purchase-order.controller';
import { resolvePurchaseOrderStore } from '../src/purchase-order/purchase-order.store';
import type { PrismaService } from '../src/storage/prisma.service';

describe('stage 09 purchase ownership', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-stage09-'));
    process.env.ERP_DATA_DIR = dataDir;
    delete process.env.ERP_STORAGE_MODE;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    delete process.env.ERP_STORAGE_MODE;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('records the comparison submitter rather than the inquiry creator', async () => {
    const inquiryService = new InquiryService();
    const inquiry = await inquiryService.getPurchaseSource(1);
    await inquiryService.submitForComparison({
      inquiryId: inquiry.id,
      items: inquiry.items.map((item) => ({
        itemId: item.itemId,
        supplierQuotes: item.supplierQuotes,
      })),
    }, { role: 'purchase', user: 'Leo' });

    const submitted = await new InquiryService().getPurchaseSource(1);
    expect(submitted.createdBy).not.toBe('Leo');
    expect(submitted.comparisonSubmittedBy).toBe('Leo');
  });

  it('keeps direct sales orders in an assignment node until a purchaser is selected', async () => {
    const service = new SalesOrderService();
    const sale = await service.create({
      customerName: 'Test Customer',
      title: 'Direct sale',
      salesUserId: 2001,
      createdBy: 2001,
    });
    await service.submit({ salesOrderId: sale.id, currentStatus: 'draft' });
    await expect(service.approve({
      salesOrderId: sale.id,
      currentStatus: 'pending_sales_manager_approval',
    })).resolves.toMatchObject({ status: 'pending_purchase_assignment' });
    expect(await service.listPendingPurchaseAssignments()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: sale.id })]),
    );
    await expect(service.completePurchaseAssignment(sale.id, 'Leo')).resolves.toMatchObject({
      status: 'purchasing',
      purchaseOwnerName: 'Leo',
    });
    await expect(service.completePurchaseAssignment(sale.id, 'Nina')).rejects.toThrow('已分配');
    expect(await service.listPendingPurchaseAssignments()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: sale.id })]),
    );
  });

  it('locks a new purchase order to its assigned purchaser and does not create duplicates', async () => {
    const source = {
      getDetail: jest.fn().mockResolvedValue({
        id: 901,
        salesNo: 'S2609250901',
        status: 'pending_purchase_assignment',
      }),
      syncOperationalAggregates: jest.fn().mockResolvedValue(undefined),
    };
    const directory = { listAssignablePurchaseUsers: jest.fn().mockResolvedValue([
      { id: 2002, realName: 'Leo', username: 'leo', roleCode: 'purchase', status: 'active' },
      { id: 2003, realName: 'Nina', username: 'nina', roleCode: 'purchase', status: 'active' },
    ]) };
    const service = new PurchaseOrderService(undefined, source as never, directory as never);
    const payload = {
      salesOrderId: 901,
      createdBy: 2001,
      initialStatus: 'pending_purchase_claim',
      allowPendingAssignment: true,
      ownerName: 'Leo',
      items: [{ salesItemId: 1, supplierId: 3001, productId: 501, quantity: 1, unitPrice: 10 }],
    };
    const [first, duplicate] = await Promise.all([
      service.createFromSalesOrder(payload),
      service.createFromSalesOrder(payload),
    ]);
    expect(duplicate.purchaseOrders[0].id).toBe(first.purchaseOrders[0].id);
    expect((await service.createFromSalesOrder(payload)).purchaseOrders[0].id).toBe(first.purchaseOrders[0].id);
    const resumed = await service.createFromSalesOrder({
      ...payload,
      items: [...payload.items, { salesItemId: 2, supplierId: 3001, productId: 502, quantity: 2, unitPrice: 5 }],
    });
    expect(resumed.purchaseOrders).toHaveLength(2);
    expect((await service.createFromSalesOrder({
      ...payload,
      items: [...payload.items, { salesItemId: 2, supplierId: 3001, productId: 502, quantity: 2, unitPrice: 5 }],
    })).purchaseOrders).toHaveLength(2);
    const purchaseOrderId = first.purchaseOrders[0].id;
    await expect(service.saveDraft({
      purchaseOrderId,
      currentStatus: 'pending_purchase_claim',
      ownerName: 'Nina',
      session: { role: 'purchase', user: 'Nina' },
    })).rejects.toThrow('采购负责人不可通过保存草稿修改');
    await expect(service.saveDraft({
      purchaseOrderId,
      currentStatus: 'pending_purchase_claim',
      ownerName: 'Nina',
      session: { role: 'purchase_manager', user: 'Leo' },
    })).rejects.toThrow('采购负责人不可通过保存草稿修改');
    await expect(service.submit({
      purchaseOrderId,
      currentStatus: 'pending_purchase_claim',
      session: { role: 'purchase', user: 'Nina' },
    })).rejects.toThrow('仅指定采购负责人');
  });

  it('requires explicit manager assignment for an existing direct-sale purchase claim', async () => {
    const source = {
      getDetail: jest.fn().mockResolvedValue({
        id: 903, salesNo: 'S2609250903', sourceMode: 'direct', status: 'purchasing',
      }),
      syncOperationalAggregates: jest.fn().mockResolvedValue(undefined),
    };
    const directory = { listAssignablePurchaseUsers: jest.fn().mockResolvedValue([
      { id: 2002, realName: 'Leo', username: 'leo', roleCode: 'purchase', status: 'active' },
      { id: 2003, realName: 'Nina', username: 'nina', roleCode: 'purchase', status: 'active' },
    ]) };
    const service = new PurchaseOrderService(undefined, source as never, directory as never);
    const created = await service.createFromSalesOrder({
      salesOrderId: 903, createdBy: 2001, ownerName: 'Leo',
      initialStatus: 'pending_purchase_claim',
      items: [{ salesItemId: 1, supplierId: 3001, productId: 501, quantity: 1, unitPrice: 10 }],
    });
    const legacy = created.purchaseOrders[0];
    resolvePurchaseOrderStore().upsertPurchaseOrder({ ...legacy, lockedPurchaseOwner: undefined });

    expect(await service.getDetail(legacy.id)).toMatchObject({ needsPurchaseAssignment: true });
    await expect(service.assignExistingDirectPurchaseOwner({
      purchaseOrderId: legacy.id, ownerName: '',
      session: { role: 'purchase_manager', user: 'Mia' },
    })).rejects.toThrow('请选择有效的采购负责人');
    await expect(service.submit({
      purchaseOrderId: legacy.id, currentStatus: 'pending_purchase_claim',
      session: { role: 'purchase', user: 'Leo' },
    })).rejects.toThrow('请先分配采购负责人');
    await expect(service.assignExistingDirectPurchaseOwner({
      purchaseOrderId: legacy.id, ownerName: 'Nina',
      session: { role: 'purchase_manager', user: 'Mia' },
    })).resolves.toMatchObject({ ownerName: 'Nina', lockedPurchaseOwner: true });
    expect(await service.getDetail(legacy.id)).toMatchObject({
      ownerName: 'Nina', lockedPurchaseOwner: true, needsPurchaseAssignment: false,
    });
    await expect(service.assignExistingDirectPurchaseOwner({
      purchaseOrderId: legacy.id, ownerName: 'Leo',
      session: { role: 'purchase_manager', user: 'Mia' },
    })).rejects.toThrow('已分配');
    await expect(service.saveDraft({
      purchaseOrderId: legacy.id, currentStatus: 'pending_purchase_claim', ownerName: 'Leo',
      session: { role: 'purchase', user: 'Leo' },
    })).rejects.toThrow('采购负责人不可通过保存草稿修改');
  });

  it('persists an existing direct purchase assignment in Prisma without changing the supplier', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const record = {
      id: 504n, bizType: 'purchase_order', docNo: 'C504', status: 'pending_purchase_claim',
      ownerUserId: 2002n, counterpartyId: 3001n, createdBy: 2001n,
      createdAt: new Date(), updatedAt: new Date(),
      payload: {
        id: 504, purchaseNo: 'C504', sourceSalesOrderId: 904, supplierId: 3001,
        supplierName: 'Factory A', ownerName: 'Leo', currentVersionNo: 1,
        status: 'pending_purchase_claim', itemCount: 0, createdBy: 2001,
        createdAt: new Date().toISOString(), salesOrderNo: 'S904', currentBatchCount: 0,
        versionHistory: [], items: [],
      },
    };
    const prisma = {
      businessDocument: {
        findUnique: jest.fn().mockImplementation(async () => record),
        update: jest.fn().mockImplementation(async ({ data }) => {
          record.ownerUserId = data.ownerUserId;
          record.payload = data.payload;
          return record;
        }),
      },
      operationLog: { create: jest.fn().mockResolvedValue({ id: 1n }) },
    } as unknown as PrismaService;
    const source = { getDetail: jest.fn().mockResolvedValue({ sourceMode: 'direct' }) };
    const directory = { listAssignablePurchaseUsers: jest.fn().mockResolvedValue([
      { id: 2002, realName: 'Leo', username: 'leo', roleCode: 'purchase', status: 'active' },
      { id: 2003, realName: 'Nina', username: 'nina', roleCode: 'purchase', status: 'active' },
    ]) };
    const service = new PurchaseOrderService(prisma, source as never, directory as never);
    expect(await service.getDetail(504)).toMatchObject({ needsPurchaseAssignment: true });
    await expect(service.assignExistingDirectPurchaseOwner({
      purchaseOrderId: 504, currentStatus: 'pending_purchase_claim', ownerName: 'Nina',
      session: { role: 'purchase_manager', user: 'Mia' },
    })).resolves.toMatchObject({ ownerName: 'Nina', lockedPurchaseOwner: true });
    expect(record.ownerUserId).toBe(2003n);
    expect(record.payload).toMatchObject({
      ownerName: 'Nina', supplierId: 3001, supplierName: 'Factory A', lockedPurchaseOwner: true,
    });
    expect(await service.getDetail(504)).toMatchObject({ needsPurchaseAssignment: false });
    expect(prisma.operationLog.create).toHaveBeenCalledTimes(1);
  });

  it('does not let draft saving silently reassign an already-owned purchase order', async () => {
    const directory = { listAssignablePurchaseUsers: jest.fn().mockResolvedValue([
      { id: 2002, realName: 'Leo', username: 'leo', roleCode: 'purchase', status: 'active' },
      { id: 2003, realName: 'Nina', username: 'nina', roleCode: 'purchase', status: 'active' },
    ]) };
    const service = new PurchaseOrderService(undefined, undefined, directory as never);
    const created = await service.createFromSalesOrder({
      salesOrderId: 905, createdBy: 2001, ownerName: 'Leo',
      initialStatus: 'pending_purchase_claim',
      items: [{ salesItemId: 1, supplierId: 3001, productId: 501, quantity: 1, unitPrice: 10 }],
    });
    const purchaseOrderId = created.purchaseOrders[0].id;
    await expect(service.saveDraft({
      purchaseOrderId, currentStatus: 'pending_purchase_claim', ownerName: 'Nina',
      session: { role: 'purchase_manager', user: 'Mia' },
    })).rejects.toThrow('采购负责人不可通过保存草稿修改');
    expect(await service.getDetail(purchaseOrderId)).toMatchObject({ ownerName: 'Leo' });
    await expect(service.saveDraft({
      purchaseOrderId, currentStatus: 'pending_purchase_claim', ownerName: 'Leo',
      session: { role: 'purchase', user: 'Leo' },
    })).resolves.toMatchObject({ ownerName: 'Leo' });
  });

  it('uses the actual inquiry comparison submitter for quote-sourced purchase conversion', async () => {
    const sales = {
      getDetail: jest.fn().mockResolvedValue({
        id: 901,
        sourceMode: 'from_quote',
        sourceQuoteOrderId: 701,
        sourceQuoteVersionNo: 1,
        status: 'pending_sales_manager_approval',
        salesNo: 'S2609250901',
        createdBy: 2001,
        items: [],
      }),
      approve: jest.fn().mockResolvedValue({ id: 901, status: 'pending_purchase_assignment' }),
      hydratePurchaseFieldsFromSourceQuote: jest.fn().mockResolvedValue([
        { lineNo: 1, productId: 501, productName: 'Product', quantity: 1, unit: 'pcs' },
      ]),
      completePurchaseAssignment: jest.fn(),
    };
    const purchase = {
      listAssignablePurchaseOwners: jest.fn().mockResolvedValue([
        { id: 2002, realName: 'Leo', status: 'active' },
      ]),
      createFromSalesOrder: jest.fn()
        .mockRejectedValueOnce(new Error('temporary purchase storage failure'))
        .mockResolvedValue({ purchaseOrders: [{ id: 1 }] }),
    };
    const quote = { getDetail: jest.fn().mockResolvedValue({ linkedInquiryId: 801 }) };
    const inquiry = { getPurchaseSource: jest.fn().mockResolvedValue({ comparisonSubmittedBy: 'Leo' }) };
    const controller = new SalesOrderController(
      sales as never,
      purchase as never,
      undefined,
      quote as never,
      inquiry as never,
    );
    await expect(controller.approve(901, { currentStatus: 'pending_sales_manager_approval' }))
      .rejects.toThrow('temporary purchase storage failure');
    expect(sales.completePurchaseAssignment).not.toHaveBeenCalled();
    sales.getDetail.mockResolvedValue({
      id: 901, sourceMode: 'from_quote', sourceInquiryId: 801,
      status: 'pending_purchase_assignment', purchaseOwnerName: 'Leo',
      salesNo: 'S2609250901', createdBy: 2001, items: [],
    });
    await controller.assignPurchaser(901, { ownerName: 'Leo' });
    expect(sales.approve).toHaveBeenCalledWith(expect.objectContaining({
      sourceInquiryId: 801,
      purchaseOwnerName: 'Leo',
      deferPurchaseTransfer: true,
    }));
    expect(purchase.createFromSalesOrder).toHaveBeenCalledWith(expect.objectContaining({
      ownerName: 'Leo', allowPendingAssignment: true,
    }));
    expect(sales.completePurchaseAssignment).toHaveBeenCalledWith(901, 'Leo');
  });

  it('persists the assignment node and selected purchaser in Prisma payload storage', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const record = {
      id: 902n,
      bizType: 'sales_order',
      docNo: 'S2609250902',
      status: 'pending_sales_manager_approval',
      ownerUserId: 2001n,
      counterpartyId: 1n,
      createdBy: 2001n,
      createdAt: new Date(),
      updatedAt: new Date(),
      payload: {
        id: 902,
        salesNo: 'S2609250902',
        status: 'pending_sales_manager_approval',
        sourceMode: 'direct',
        title: 'Test',
        customerName: 'Customer',
        createdBy: 2001,
        purchaseAggregateStatus: 'not_started',
        shipmentAggregateStatus: 'not_started',
      },
    };
    const prisma = {
      businessDocument: {
        findUnique: jest.fn().mockImplementation(async () => record),
        findMany: jest.fn().mockImplementation(async ({ where }: { where: { status?: string } }) =>
          !where.status || record.status === where.status ? [record] : []),
        update: jest.fn().mockImplementation(async ({ data }: { data: { status: string; payload: typeof record.payload } }) => {
          record.status = data.status;
          record.payload = data.payload;
          return record;
        }),
      },
      operationLog: { create: jest.fn().mockResolvedValue({ id: 1n }) },
    } as unknown as PrismaService;
    const service = new SalesOrderService(prisma);
    await expect(service.approve({
      salesOrderId: 902,
      currentStatus: 'pending_sales_manager_approval',
    })).resolves.toMatchObject({ status: 'pending_purchase_assignment' });
    expect(await service.listPendingPurchaseAssignments()).toEqual([
      expect.objectContaining({ id: 902 }),
    ]);
    await expect(service.completePurchaseAssignment(902, 'Leo')).resolves.toMatchObject({
      status: 'purchasing', purchaseOwnerName: 'Leo',
    });
    expect(record.payload).toMatchObject({
      status: 'purchasing', purchaseOwnerName: 'Leo', purchaseAggregateStatus: 'purchasing',
    });
    expect(await service.listPendingPurchaseAssignments()).toEqual([]);
  });

  it('exposes linked inquiry facts only while the purchase manager is approving', async () => {
    const purchase = { getDetail: jest.fn().mockResolvedValue({
      status: 'pending_purchase_manager_approval', sourceInquiryId: 801,
    }) };
    const inquiry = { getPurchaseSource: jest.fn().mockResolvedValue({
      inquiryNo: 'IQ801', quoteOrderNo: 'XQ701', comparisonSubmittedBy: 'Leo',
      items: [{
        lineNo: 1, productName: 'Product', confirmedSupplierName: 'Factory A',
        confirmedPurchasePrice: 9,
        supplierQuotes: [{ supplierName: 'Factory A', purchasePrice: 9, remark: 'Ready' }],
      }],
    }) };
    const controller = new PurchaseOrderController(purchase as never, inquiry as never);
    await expect(controller.getSourceInquiryForApproval(501, 'purchase_manager', 'Manager'))
      .resolves.toMatchObject({ inquiryNo: 'IQ801', comparisonSubmittedBy: 'Leo' });
    purchase.getDetail.mockResolvedValueOnce({ status: 'purchasing', sourceInquiryId: 801 });
    await expect(controller.getSourceInquiryForApproval(501, 'purchase_manager', 'Manager'))
      .rejects.toThrow('没有来源询价');
    purchase.getDetail.mockResolvedValueOnce({ status: 'pending_purchase_manager_approval' });
    await expect(controller.getSourceInquiryForApproval(501, 'purchase_manager', 'Manager'))
      .rejects.toThrow('没有来源询价');
  });
});
