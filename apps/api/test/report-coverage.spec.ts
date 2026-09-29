import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { FormalSession } from '../src/auth/formal-session';
import { ReportController } from '../src/report/report.controller';
import { ReportService } from '../src/report/report.service';
import type { PrismaService } from '../src/storage/prisma.service';

type Document = {
  id: number; bizType: string; status: string; createdAt?: string; ownerUserId?: number;
  payload: Record<string, unknown>;
};
type Log = {
  bizType: string; bizId: number; operationType: string; createdAt: string;
  beforeData?: unknown; afterData?: unknown;
};
type Reports = {
  getSalesSummary(session?: FormalSession): Promise<any>;
  getGrossProfitSummary(session?: FormalSession): Promise<any>;
  getPeriodSummary(session?: FormalSession, period?: string): Promise<any>;
};

function document(id: number, bizType: string, status = 'closed', options: Partial<Document> = {}): Document {
  return {
    id, bizType, status, createdAt: '2026-09-10T01:00:00.000Z', ownerUserId: 57,
    ...options,
    payload: {
      id, status,
      ...(bizType === 'sales_order' ? { salesNo: `SO-${id}` }
        : bizType === 'purchase_order' ? { purchaseNo: `PO-${id}` }
          : bizType === 'shipment_batch' ? { batchNo: `SH-${id}` } : { afterSalesNo: `AS-${id}` }),
      salesUserId: 57, ownerId: 57, createdBy: 57,
      createdAt: '2026-07-11T10:00:00.000Z', versionHistory: [{}, {}, {}],
      items: [{ quantity: 2, salePrice: 50, unitPrice: 50, amount: 100 }],
      ...options.payload,
    },
  };
}

describe.each(['runtime', 'prisma'] as const)('report coverage (%s)', (mode) => {
  let directory: string;
  const originalMode = process.env.ERP_STORAGE_MODE;
  const originalDirectory = process.env.ERP_DATA_DIR;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'erp-report-coverage-'));
    process.env.ERP_DATA_DIR = directory;
    process.env.ERP_STORAGE_MODE = mode;
  });
  afterEach(() => {
    jest.useRealTimers();
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    if (originalDirectory === undefined) delete process.env.ERP_DATA_DIR;
    else process.env.ERP_DATA_DIR = originalDirectory;
    rmSync(directory, { recursive: true, force: true });
  });

  function service(documents: Document[], logs: Log[] = []): Reports {
    const stores = [
      ['sales_order', 'sales-order', 'salesOrders', 'create_sales_order'],
      ['purchase_order', 'purchase-order', 'purchaseOrders', 'create_purchase_order'],
      ['shipment_batch', 'shipment-batch', 'shipmentBatches', 'create_shipment_batch'],
      ['after_sales', 'after-sales', 'afterSalesOrders', 'create_after_sales'],
    ];
    for (const [bizType, filename, key, operationType] of stores) {
      const creationLogs = documents.filter(doc => doc.bizType === bizType && doc.createdAt).map(doc => ({
        bizType, bizId: doc.id, operationType, createdAt: doc.createdAt,
      }));
      writeFileSync(join(directory, `${filename}-runtime.json`), JSON.stringify({
        [key]: documents.filter(doc => doc.bizType === bizType).map(doc => doc.payload),
        auditLogs: [...creationLogs, ...logs.filter(log => log.bizType === bizType)],
      }));
    }
    const prisma = {
      businessDocument: {
        findMany: async ({ where }: { where: { bizType: string } }) => documents
          .filter(doc => doc.bizType === where.bizType)
          .map(doc => ({ ...doc, id: BigInt(doc.id), ownerUserId: BigInt(doc.ownerUserId ?? 0),
            docNo: `${doc.bizType}-${doc.id}`, createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined })),
      },
      operationLog: { findMany: async () => logs.map(log => ({ ...log, bizId: BigInt(log.bizId), createdAt: new Date(log.createdAt) })) },
    } as unknown as PrismaService;
    return new ReportService(mode === 'prisma' ? prisma : undefined) as Reports;
  }

  it('filters the provisional creation cohort by Beijing month with an exclusive next-month boundary', async () => {
    const report = await service([
      document(1, 'sales_order', 'closed', { createdAt: '2026-08-31T16:00:00.000Z' }),
      document(2, 'sales_order', 'closed', { createdAt: '2026-09-30T15:59:59.999Z' }),
      document(3, 'sales_order', 'closed', { createdAt: '2026-09-30T16:00:00.000Z' }),
      document(4, 'purchase_order', 'purchasing'), document(5, 'shipment_batch', 'arrived'),
      document(6, 'after_sales', 'closed'),
      document(7, 'sales_order', 'closed', { createdAt: undefined }),
      document(8, 'purchase_order', 'draft', { createdAt: undefined }),
    ]).getPeriodSummary(undefined, '2026-09');
    expect(report).toMatchObject({
      period: '2026-09', timeZone: 'Asia/Shanghai', periodBasis: 'created_business_documents',
      calculationStatus: 'provisional', salesOrdersCreated: 2, purchaseOrdersCreated: 1,
      shipmentBatchesCreated: 1, afterSalesCreated: 1, closedOrders: 2, reopenedApprovals: 0,
      undatedCounts: { sales_order: 1, purchase_order: 1, shipment_batch: 0, after_sales: 0 },
    });
    expect(report.sourceDocuments.map((doc: { id: number }) => doc.id).sort()).toEqual([1, 2, 4, 5, 6]);
    expect(report.sourceDocuments).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 4, bizType: 'purchase_order', href: '/app/purchase-orders/4' }),
      expect.objectContaining({ id: 5, bizType: 'shipment_batch', docNo: mode === 'runtime' ? 'SH-5' : 'shipment_batch-5' }),
    ]));
  });

  it('defaults to the current Beijing month and handles a year rollover', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-12-31T16:00:00.000Z'));
    expect(await service([
      document(1, 'sales_order', 'draft', { createdAt: '2026-12-31T16:00:00.000Z' }),
    ]).getPeriodSummary()).toMatchObject({ period: '2027-01', salesOrdersCreated: 1 });
  });

  it.each(['2026-00', '2026-13', '2026-9', 'garbage', '2026-09-01', ''])('rejects invalid month %j', async (period) => {
    await expect(service([]).getPeriodSummary(undefined, period)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects repeated month query values as a bad request', async () => {
    await expect(service([]).getPeriodSummary(undefined, ['2026-09'] as unknown as string))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  if (mode === 'runtime') {
    it('dates a converted sale from its conversion event without trusting a fixed payload date', async () => {
      const report = await service([
        document(1, 'sales_order', 'draft', { createdAt: undefined }),
      ], [{ bizType: 'sales_order', bizId: 1, operationType: 'convert_quote_to_sales', createdAt: '2026-09-01T00:00:00Z' }])
        .getPeriodSummary(undefined, '2026-09');
      expect(report).toMatchObject({ salesOrdersCreated: 1, undatedCounts: { sales_order: 0 } });
    });
  } else {
    it('keeps legacy missing shipment lines unknown and links to the actual database sales ID', async () => {
      const report = await service([
        document(11, 'sales_order', 'purchasing', { payload: { id: 130101 } }),
        document(12, 'shipment_batch', 'shipped', { payload: { salesOrderId: 130101, items: undefined } }),
      ]).getSalesSummary({ role: 'admin', userId: 1, dataScope: 'all' });
      expect(report.totals).toEqual({ salesOrderCount: 1, submittedAmount: 100, voidedAmount: 0, shippedAmount: null });
      expect(report.shippedAmountIssues).toEqual([{
        batchNo: 'shipment_batch-12', salesOrderId: 11, salesOrderNo: 'SO-11',
        reason: '发货明细不完整，无法核对已发货金额',
      }]);
    });

    it('does not read runtime documents when Prisma is empty or unavailable', async () => {
      const reports = service([]);
      writeFileSync(join(directory, 'sales-order-runtime.json'), JSON.stringify({ salesOrders: [document(99, 'sales_order').payload] }));
      expect((await reports.getGrossProfitSummary()).sourceDocuments).toEqual([]);
      expect(await reports.getPeriodSummary(undefined, '2026-09')).toMatchObject({ salesOrdersCreated: 0, reopenedApprovals: 0 });
      await expect(new ReportService().getGrossProfitSummary()).rejects.toThrow('Prisma report storage is unavailable');
    });
  }

  it('counts only real sales resubmission events in their occurrence month', async () => {
    const logs: Log[] = [
      { bizType: 'sales_order', bizId: 1, operationType: 'submit_sales_order', createdAt: '2026-09-01T00:00:00Z', beforeData: { status: 'draft' }, afterData: { status: 'pending_sales_manager_approval' } },
      { bizType: 'sales_order', bizId: 1, operationType: 'submit_sales_order', createdAt: '2026-09-02T00:00:00Z', beforeData: { status: 'rejected' }, afterData: { status: 'pending_sales_manager_approval' } },
      { bizType: 'sales_order', bizId: 1, operationType: 'resubmit_sales_order', createdAt: '2026-09-30T15:59:59Z', beforeData: { status: 'purchasing' }, afterData: { status: 'pending_sales_manager_approval' } },
      { bizType: 'sales_order', bizId: 1, operationType: 'resubmit_sales_order', createdAt: '2026-09-30T16:00:00Z', afterData: { status: 'pending_sales_manager_approval' } },
      { bizType: 'sales_order', bizId: 999, operationType: 'resubmit_sales_order', createdAt: '2026-09-02T00:00:00Z', afterData: { status: 'pending_sales_manager_approval' } },
      { bizType: 'purchase_order', bizId: 3, operationType: 'resubmit_purchase_order', createdAt: '2026-09-02T00:00:00Z' },
    ];
    const report = await service([
      document(1, 'sales_order', 'closed', { createdAt: '2026-08-01T00:00:00Z' }),
      document(2, 'sales_order'), document(3, 'purchase_order'),
    ], logs).getPeriodSummary(undefined, '2026-09');
    expect(report).toMatchObject({ reopenedApprovals: 2, reopenedApprovalsBasis: 'sales_audit_events' });
    expect(report.missingHistory).toContain('legacy_sales_resubmissions_without_audit_events');
    expect(report.reopenedApprovalEvents).toEqual([
      { salesOrderId: 1, docNo: mode === 'runtime' ? 'SO-1' : 'sales_order-1', operationType: 'submit_sales_order', createdAt: '2026-09-02T00:00:00.000Z', href: '/app/sales/orders/1' },
      { salesOrderId: 1, docNo: mode === 'runtime' ? 'SO-1' : 'sales_order-1', operationType: 'resubmit_sales_order', createdAt: '2026-09-30T15:59:59.000Z', href: '/app/sales/orders/1' },
    ]);
  });

  it('retains only purchase ownership in own purchase scope and follows it for shipments', async () => {
    const own: FormalSession = { role: 'purchase_manager', userId: 57, dataScope: 'own_purchase' };
    const report = await service([
      document(1, 'purchase_order', 'purchasing'),
      document(2, 'purchase_order', 'purchasing', { ownerUserId: 99, payload: { ownerId: 99, createdBy: 57 } }),
      document(3, 'shipment_batch', 'arrived', { payload: { purchaseOrderId: 1, createdBy: 99 } }),
      document(4, 'shipment_batch', 'arrived', { payload: { purchaseOrderId: 2, createdBy: 57 } }),
    ]).getPeriodSummary(own, '2026-09');
    expect(report).toMatchObject({ purchaseOrdersCreated: 1, shipmentBatchesCreated: 1 });
    expect(report.sourceDocuments.map((doc: { id: number }) => doc.id)).toEqual([1, 3]);
  });

  it('preserves all records for the existing team scope', async () => {
    const report = await service([
      document(1, 'sales_order'),
      document(2, 'sales_order', 'closed', { ownerUserId: 99, payload: { salesUserId: 99, createdBy: 99 } }),
    ]).getPeriodSummary({ role: 'sales_manager', userId: 57, dataScope: 'sales_team' }, '2026-09');
    expect(report.salesOrdersCreated).toBe(2);
  });

  it('keeps unknown currency and absent after-sales costs incomplete instead of reporting fake profit', async () => {
    const report = await service([
      document(1, 'sales_order', 'closed'), document(2, 'sales_order', 'draft'),
      document(3, 'sales_order', 'rejected'), document(4, 'sales_order', 'void'),
      document(5, 'purchase_order', 'purchasing'), document(6, 'purchase_order', 'draft'),
      document(7, 'purchase_order', 'void'), document(8, 'purchase_order', 'pending_purchase_claim'),
      document(9, 'after_sales', 'processing'),
    ]).getGrossProfitSummary();
    expect(report).toMatchObject({ currency: null, totalRevenue: null, totalProcurementCost: null,
      totalAfterSalesCost: null, grossProfit: null, grossMargin: null, amountDifference: null,
      calculationStatus: 'incomplete', unknownCurrencyCount: 2 });
    expect(report.missingCosts).toEqual(expect.arrayContaining(['after_sales', 'freight']));
    expect(report.sourceDocuments.map((doc: { id: number }) => doc.id)).toEqual([1, 5]);
    expect(report.sourceDocuments[0]).toMatchObject({ amount: 100, currency: null });
  });

  it('shows only a document amount difference for explicit matching currencies, including a known zero', async () => {
    const report = await service([
      document(1, 'sales_order', 'closed', { payload: { currency: 'CNY' } }),
      document(2, 'purchase_order', 'purchasing', { payload: { currency: 'CNY', items: [{ quantity: 2, unitPrice: 0, amount: 0 }] } }),
    ]).getGrossProfitSummary();
    expect(report).toMatchObject({ currency: 'CNY', totalRevenue: 100, totalProcurementCost: 0,
      amountDifference: 100, totalAfterSalesCost: null, grossProfit: null, grossMargin: null,
      unknownCurrencyCount: 0 });
  });

  it('matches M03 zero fallback and per-line rounding without inventing missing monetary data', async () => {
    const report = await service([
      document(1, 'sales_order', 'closed', { payload: { currency: 'CNY', items: [
        { quantity: 1, salePrice: 0.005, amount: 0 }, { quantity: 1, salePrice: 0.005 },
      ] } }),
      document(2, 'purchase_order', 'purchasing', { payload: { currency: 'CNY', items: [{ quantity: 2, unitPrice: 30, amount: 0 }] } }),
    ]).getGrossProfitSummary();
    expect(report).toMatchObject({ totalRevenue: 0.02, totalProcurementCost: 60, amountDifference: -59.98 });
  });

  it('preserves source snapshot precision and rounds after aggregation like M03', async () => {
    const reports = service([1, 2].map(id => document(id, 'sales_order', 'closed', {
      payload: { currency: 'CNY', items: [{ quantity: 1, salePrice: 0.005, amount: 0.005 }] },
    })));
    expect((await reports.getSalesSummary()).totals.submittedAmount).toBe(0.01);
    const report = await reports.getGrossProfitSummary();
    expect(report.sourceDocuments.map((doc: { amount: number }) => doc.amount)).toEqual([0.005, 0.005]);
    expect(report.totalRevenue).toBe(0.01);
    expect(report.amountBasis).toMatchObject({
      sourcePrecision: 'unrounded_document_sums', totalPrecision: 'round_after_aggregation_to_2_decimal_places',
    });
  });

  it('matches the existing generic shipment ownership rule for a boss with explicit own scope', async () => {
    const report = await service([
      document(1, 'shipment_batch', 'arrived', { ownerUserId: 99, payload: { ownerId: 57, createdBy: 99 } }),
      document(2, 'shipment_batch', 'arrived', { ownerUserId: 99, payload: { ownerId: 99, createdBy: 99 } }),
    ]).getPeriodSummary({ role: 'boss', userId: 57, dataScope: 'own_sales' }, '2026-09');
    expect(report.shipmentBatchesCreated).toBe(1);
    expect(report.sourceDocuments.map((doc: { id: number }) => doc.id)).toEqual([1]);
  });

  it('does not combine mixed currencies or turn missing amounts into zero', async () => {
    const report = await service([
      document(1, 'sales_order', 'closed', { payload: { currency: 'USD' } }),
      document(2, 'purchase_order', 'purchasing', { payload: { currency: 'CNY', items: [{}] } }),
    ]).getGrossProfitSummary();
    expect(report).toMatchObject({ currency: null, totalRevenue: null, totalProcurementCost: null, amountDifference: null });
    expect(report.sourceDocuments[1]).toMatchObject({ amount: null, currency: 'CNY' });
  });

  it('limits own sales reports and resubmission events to the account and legacy IDs', async () => {
    const own: FormalSession = { role: 'sales_manager', userId: 57, legacyUserIds: [58], dataScope: 'own_sales' };
    const reportService = service([
      document(1, 'sales_order'),
      document(2, 'sales_order', 'closed', { ownerUserId: 58, payload: { salesUserId: 58, createdBy: 58 } }),
      document(3, 'sales_order', 'closed', { ownerUserId: 99, payload: { salesUserId: 99, createdBy: 99 } }),
      document(4, 'purchase_order', 'purchasing', { ownerUserId: 99, payload: { ownerId: 99, createdBy: 57 } }),
      document(5, 'shipment_batch', 'arrived', { payload: { salesOrderId: 3 } }),
    ], [{ bizType: 'sales_order', bizId: 3, operationType: 'resubmit_sales_order', createdAt: '2026-09-01T00:00:00Z', afterData: { status: 'pending_sales_manager_approval' } }]);
    expect(await reportService.getPeriodSummary(own, '2026-09')).toMatchObject({ salesOrdersCreated: 2,
      purchaseOrdersCreated: 0, shipmentBatchesCreated: 0, reopenedApprovals: 0 });
    expect((await reportService.getGrossProfitSummary(own)).sourceDocuments.map((doc: { id: number }) => doc.id)).toEqual([1, 2]);
  });

  it('preserves signed management module gates and applies signed scope to both report endpoints', async () => {
    const reportService = service([
      document(1, 'sales_order'),
      document(2, 'sales_order', 'closed', { ownerUserId: 99, payload: { salesUserId: 99, createdBy: 99 } }),
    ]);
    const module = await Test.createTestingModule({ controllers: [ReportController], providers: [
      { provide: ReportService, useValue: reportService },
    ] }).compile();
    const app = module.createNestApplication();
    await app.init();
    const secret = process.env.ERP_FORMAL_SESSION_SECRET ?? 'dev-only-insecure-formal-session-secret';
    const headers = (modules: string[]) => {
      const session = Buffer.from(JSON.stringify({ role: 'sales_manager', user: 'manager', userId: 57,
        username: 'manager', dataScope: 'own_sales', modules, exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url');
      return { 'x-erp-session': session, 'x-erp-session-signature': createHmac('sha256', secret).update(session).digest('base64url') };
    };
    try {
      const period = await request(app.getHttpServer()).get('/reports/period-summary?period=2026-09').set(headers(['boss_dashboard'])).expect(200);
      expect(period.body).toMatchObject({ period: '2026-09', salesOrdersCreated: 1 });
      const gross = await request(app.getHttpServer()).get('/reports/gross-profit').set(headers(['boss_dashboard'])).expect(200);
      expect(gross.body.sourceDocuments.map((doc: { id: number }) => doc.id)).toEqual([1]);
      await request(app.getHttpServer()).get('/reports/gross-profit').set(headers(['sales'])).expect(403);
      await request(app.getHttpServer()).get('/reports/period-summary?period=2026-09&period=2026-10')
        .set(headers(['boss_dashboard'])).expect(400);
    } finally { await app.close(); }
  });
});
