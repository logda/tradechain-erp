import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { resolveAfterSalesStore } from '../after-sales/after-sales.store';
import { resolvePurchaseOrderStore } from '../purchase-order/purchase-order.store';
import { resolveSalesOrderStore } from '../sales-order/sales-order.store';
import { resolveShipmentBatchStore } from '../shipment-batch/shipment-batch.store';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';
import { filterVisibleFormalItems, type FormalSession } from '../auth/formal-session';

function sumBy<T>(items: T[], predicate: (item: T) => number) {
  return items.reduce((total, item) => total + predicate(item), 0);
}

function toFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

type DocumentItem = {
  lineNo?: number;
  sourceSalesItemId?: number;
  shippedQty?: number;
  amount?: unknown;
  quantity?: unknown;
  salePrice?: unknown;
  unitPrice?: unknown;
};

type PrismaBusinessDocumentRecord = {
  id?: bigint | number;
  bizType?: string;
  docNo?: string;
  status?: string;
  createdAt?: Date | string;
  ownerUserId?: bigint | number | null;
  payload: {
    id?: number;
    salesNo?: string;
    purchaseNo?: string;
    batchNo?: string;
    afterSalesNo?: string;
    ownerId?: number;
    ownerName?: string;
    salesUserName?: string;
    currency?: unknown;
    salesUserId?: number;
    createdBy?: number;
    salesOrderId?: number;
    purchaseOrderId?: number;
    status?: string;
    financeStatus?: string;
    receiptStatus?: string;
    versionHistory?: unknown[];
    shipmentAggregateStatus?: string;
    items?: DocumentItem[];
  };
};

type ReportAuditLog = {
  bizType: string;
  bizId: bigint | number;
  operationType: string;
  beforeData?: unknown;
  afterData?: unknown;
  createdAt: Date | string;
};

const reportSubmittedSalesStatuses = new Set([
  'pending_sales_manager_approval', 'pending_purchase_assignment', 'purchasing', 'closed',
  'partial_purchasing', 'partial_shipped', 'shipped', 'partial_to_forwarder', 'to_forwarder',
  'partial_forwarder_shipped', 'forwarder_shipped', 'partial_arrived', 'arrived',
]);
const reportSubmittedPurchaseStatuses = new Set([
  'pending_purchase_manager_approval', 'purchasing', 'closed', 'partial_shipped', 'shipped',
  'partial_to_forwarder', 'to_forwarder', 'partial_forwarder_shipped', 'forwarder_shipped',
  'partial_arrived', 'arrived', 'partial_exception', 'exception',
]);

function documentId(record: PrismaBusinessDocumentRecord) {
  return Number(record.id ?? record.payload.id);
}

function documentStatus(record: PrismaBusinessDocumentRecord) {
  return record.status ?? record.payload.status ?? '';
}

function documentSource(record: PrismaBusinessDocumentRecord, bizType: string) {
  const routes: Record<string, string> = {
    sales_order: 'sales/orders', purchase_order: 'purchase-orders',
    shipment_batch: 'shipment-batches', after_sales: 'after-sales',
  };
  const payload = record.payload;
  const id = documentId(record);
  const docNos: Record<string, string | undefined> = {
    sales_order: payload.salesNo, purchase_order: payload.purchaseNo,
    shipment_batch: payload.batchNo, after_sales: payload.afterSalesNo,
  };
  return {
    id, bizType,
    docNo: record.docNo ?? docNos[bizType] ?? String(id),
    status: documentStatus(record), href: `/app/${routes[bizType]}/${id}`,
  };
}

function knownDocumentAmount(items: DocumentItem[] | undefined): number | null {
  if (!items?.length) return null;
  let total = 0;
  for (const item of items) {
    if (typeof item.amount === 'number' && Number.isFinite(item.amount) && item.amount !== 0) {
      total += item.amount;
    } else {
      const price = item.salePrice ?? item.unitPrice;
      if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) ||
          typeof price !== 'number' || !Number.isFinite(price)) {
        if (item.amount === 0) continue;
        return null;
      }
      total += Number((item.quantity * price).toFixed(2));
    }
  }
  return total;
}

function reliableTime(value: Date | string | undefined) {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

type SalesStatusRecord = {
  payload: {
    status?: string;
    shipmentAggregateStatus?: string;
    receiptStatus?: string;
    versionHistory?: unknown[];
    items?: DocumentItem[];
  };
};

type AfterSalesStatusRecord = {
  payload: {
    status?: string;
  };
};

function sumDocumentItems(items: DocumentItem[] | undefined) {
  return sumBy(items ?? [], (item) => {
    const amount = toFiniteNumber(item.amount);
    if (amount) {
      return amount;
    }

    const quantity = toFiniteNumber(item.quantity);
    const salePrice = toFiniteNumber(item.salePrice ?? item.unitPrice);
    return Number((quantity * salePrice).toFixed(2));
  });
}

@Injectable()
export class ReportService {
  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  private shouldUsePrisma() {
    return resolveStorageMode() === 'prisma' && this.prisma;
  }

  private async getBusinessDocuments(bizType: string) {
    if (!this.shouldUsePrisma()) {
      return [];
    }

    return (await (this.prisma as PrismaService & {
      businessDocument: {
        findMany: (args: {
          where: { bizType: string };
          orderBy: { createdAt: 'desc' };
        }) => Promise<unknown>;
      };
    }).businessDocument.findMany({
      where: { bizType },
      orderBy: { createdAt: 'desc' },
    })) as PrismaBusinessDocumentRecord[];
  }

  async getSalesSummary(session?: FormalSession) {
    const salesSource: PrismaBusinessDocumentRecord[] = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('sales_order')
      : resolveSalesOrderStore().listSalesOrders().map((item) => ({ payload: item }));
    const afterSalesSource = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('after_sales')
      : resolveAfterSalesStore().listAfterSalesOrders().map((item) => ({ payload: item }));
    const shipmentSource = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('shipment_batch')
      : resolveShipmentBatchStore().listShipmentBatches().map((item) => ({ payload: item }));
    const salesOrders = filterVisibleFormalItems(
      salesSource.map((record) => ({
        payload: record.payload,
        id: record.payload.id ?? Number(record.id),
        salesUserId: record.payload.salesUserId ?? Number(record.ownerUserId),
        createdById: record.payload.createdBy,
      })),
      session ?? {},
      ['admin', 'boss', 'sales_manager'],
    );
    const isOwnScope = session?.dataScope === 'own_sales' || session?.dataScope === 'own_purchase' ||
      (!session?.dataScope && session?.role === 'sales');
    const visibleIds = new Set(salesOrders.map((record) =>
      record.id));
    const afterSalesOrders = isOwnScope
      ? afterSalesSource.filter((record) => visibleIds.has(record.payload.salesOrderId ?? -1))
      : afterSalesSource;
    const salesOrderCount = salesOrders.length;
    const submittedStatuses = new Set([
      'pending_sales_manager_approval', 'pending_purchase_assignment', 'purchasing', 'closed',
      'partial_purchasing', 'partial_shipped', 'shipped', 'partial_to_forwarder', 'to_forwarder',
      'partial_forwarder_shipped', 'forwarder_shipped', 'partial_arrived', 'arrived',
    ]);
    const submittedAmount = sumBy(salesOrders, (item) =>
      submittedStatuses.has(item.payload.status ?? '') ? sumDocumentItems(item.payload.items) : 0);
    const voidedAmount = sumBy(salesOrders, (item) =>
      item.payload.status === 'void' ? sumDocumentItems(item.payload.items) : 0);
    const salesById = new Map(salesOrders.map((record) => [record.id, record.payload]));
    const shippedStatuses = new Set(['shipped', 'to_forwarder', 'forwarder_shipped', 'arrived', 'exception', 'closed']);
    const shippedAmount = sumBy(shipmentSource, (record) => {
      const batch = record.payload;
      const sales = salesById.get(batch.salesOrderId ?? -1);
      if (!sales || !shippedStatuses.has(batch.status ?? '')) return 0;
      if (!batch.items?.length) {
        throw new BadRequestException('发货明细不完整，无法核对已发货金额');
      }
      return sumBy(batch.items, (line) => {
        const salesLine = sales.items?.find((item) => item.lineNo === line.sourceSalesItemId);
        if (!salesLine || typeof salesLine.salePrice !== 'number' || !Number.isFinite(salesLine.salePrice) ||
            typeof line.shippedQty !== 'number' || !Number.isFinite(line.shippedQty) || line.shippedQty <= 0) {
          throw new BadRequestException('发货明细与销售明细无法对应，请核对来源和售价');
        }
        return Number((line.shippedQty * salesLine.salePrice).toFixed(2));
      });
    });
    const afterSalesStatus = (item: AfterSalesStatusRecord) => item.payload.status ?? '';
    const receiptStatus = (item: SalesStatusRecord) => item.payload.receiptStatus ?? 'unpaid';
    const shipmentStatus = (item: SalesStatusRecord) =>
      item.payload.shipmentAggregateStatus ?? item.payload.status ?? 'not_started';

    return {
      generatedAt: new Date().toISOString(),
      currency: 'CNY',
      scope: {
        dataScope: session?.dataScope ?? (session?.role === 'sales' ? 'own_sales' : session?.role === 'sales_manager' ? 'sales_team' : 'all'),
        timeRange: 'all_time',
      },
      totals: {
        salesOrderCount,
        submittedAmount: Number(submittedAmount.toFixed(2)),
        shippedAmount: Number(shippedAmount.toFixed(2)),
        voidedAmount: Number(voidedAmount.toFixed(2)),
      },
      afterSalesOverview: {
        openCases: afterSalesOrders.filter((item) => afterSalesStatus(item) !== 'closed').length,
        pendingApproval:
          afterSalesOrders.filter((item) => afterSalesStatus(item) === 'pending_approval').length,
        processing:
          afterSalesOrders.filter((item) => afterSalesStatus(item) === 'processing').length,
        financeReviewing:
          afterSalesOrders.filter((item) => afterSalesStatus(item) === 'finance_reviewing').length,
        closedThisMonth:
          afterSalesOrders.filter((item) => afterSalesStatus(item) === 'closed').length,
      },
      shipmentBreakdown: [
        {
          status: 'not_shipped',
          count: salesOrders.filter((item) => {
            const status = shipmentStatus(item);
            return (
              status === 'not_started' ||
              status === 'draft' ||
              status === 'rejected' ||
              status === 'pending_sales_manager_approval' ||
              status === 'purchasing'
            );
          }).length,
        },
        {
          status: 'partially_shipped',
          count: salesOrders.filter((item) => {
            const status = shipmentStatus(item);
            return status === 'to_forwarder' || status === 'forwarder_shipped';
          }).length,
        },
        {
          status: 'fully_shipped',
          count: salesOrders.filter((item) => {
            const status = shipmentStatus(item);
            return status === 'arrived' || status === 'closed';
          }).length,
        },
      ],
      receiptBreakdown: ['unpaid', 'deposit_received', 'fully_paid', 'prepaid_deducted'].map(
        (status) => ({
          status,
          count: salesOrders.filter((item) => receiptStatus(item) === status).length,
        }),
      ),
    };
  }

  private async getReportDocuments(bizType: string): Promise<PrismaBusinessDocumentRecord[]> {
    if (resolveStorageMode() === 'prisma') {
      if (!this.prisma) throw new Error('Prisma report storage is unavailable');
      return this.getBusinessDocuments(bizType);
    }
    const sources = {
      sales_order: { store: resolveSalesOrderStore(), createTypes: ['create_sales_order', 'convert_quote_to_sales', 'convert_demand_quote_to_sales'] },
      purchase_order: { store: resolvePurchaseOrderStore(), createTypes: ['create_purchase_order'] },
      shipment_batch: { store: resolveShipmentBatchStore(), createTypes: ['create_shipment_batch'] },
      after_sales: { store: resolveAfterSalesStore(), createTypes: ['create_after_sales'] },
    };
    const source = sources[bizType as keyof typeof sources];
    const records = bizType === 'sales_order' ? resolveSalesOrderStore().listSalesOrders()
      : bizType === 'purchase_order' ? resolvePurchaseOrderStore().listPurchaseOrders()
      : bizType === 'shipment_batch' ? resolveShipmentBatchStore().listShipmentBatches()
      : resolveAfterSalesStore().listAfterSalesOrders();
    const creationTimes = new Map<number, number>();
    for (const log of source.store.listAuditLogs()) {
      const time = reliableTime(log.createdAt);
      if (source.createTypes.includes(log.operationType) && time !== null) {
        creationTimes.set(log.bizId, Math.min(creationTimes.get(log.bizId) ?? time, time));
      }
    }
    return records.map(payload => ({ payload,
      ...(creationTimes.has(payload.id) ? { createdAt: new Date(creationTimes.get(payload.id)!) } : {}),
    }));
  }

  private visibleReportDocuments(records: PrismaBusinessDocumentRecord[], bizType: string, session?: FormalSession) {
    if (bizType === 'purchase_order') {
      return records.filter(record => {
        if (!session?.role && !session?.user) return true;
        if (session.dataScope === 'all' || session.dataScope === 'purchase_team' ||
            (!session.dataScope?.startsWith('own_') && ['admin', 'boss', 'purchase_manager'].includes(session.role ?? ''))) return true;
        const ownerId = record.payload.ownerId ?? Number(record.ownerUserId);
        return session.userId !== undefined
          ? [session.userId, ...(session.legacyUserIds ?? [])].includes(ownerId)
          : !!session.user && record.payload.ownerName?.trim() === session.user.trim();
      });
    }
    return filterVisibleFormalItems(records.map(record => ({ record,
      ownerId: bizType === 'sales_order' ? record.payload.salesUserId
        : bizType === 'shipment_batch' ? record.payload.ownerId ?? record.payload.createdBy : record.payload.createdBy,
      ownerUserId: record.ownerUserId,
      ownerName: bizType === 'sales_order' ? record.payload.salesUserName : record.payload.ownerName,
      createdById: record.payload.createdBy,
    })), session ?? {}, bizType === 'sales_order' ? ['admin', 'boss', 'sales_manager'] : ['admin', 'boss', 'purchase_manager'])
      .map(item => item.record);
  }

  async getGrossProfitSummary(session?: FormalSession) {
    const [salesSource, purchaseSource] = await Promise.all([
      this.getReportDocuments('sales_order'), this.getReportDocuments('purchase_order'),
    ]);
    const salesOrders = this.visibleReportDocuments(salesSource, 'sales_order', session)
      .filter(record => reportSubmittedSalesStatuses.has(documentStatus(record)));
    const purchaseOrders = this.visibleReportDocuments(purchaseSource, 'purchase_order', session)
      .filter(record => reportSubmittedPurchaseStatuses.has(documentStatus(record)));
    const sourceDocuments = [
      ...salesOrders.map(record => ({ record, bizType: 'sales_order' })),
      ...purchaseOrders.map(record => ({ record, bizType: 'purchase_order' })),
    ].map(({ record, bizType }) => ({ ...documentSource(record, bizType),
      amount: knownDocumentAmount(record.payload.items),
      currency: typeof record.payload.currency === 'string' && record.payload.currency.trim()
        ? record.payload.currency.trim() : null,
    }));
    const unknownCurrencyCount = sourceDocuments.filter(record => record.currency === null).length;
    const currencies = new Set(sourceDocuments.map(record => record.currency).filter((value): value is string => value !== null));
    const currency = !unknownCurrencyCount && currencies.size === 1 ? [...currencies][0] : null;
    const totalFor = (bizType: string): number | null => {
      const records = sourceDocuments.filter(record => record.bizType === bizType);
      return currency === null || records.some(record => record.amount === null) ? null
        : Number(sumBy(records, record => record.amount!).toFixed(2));
    };
    const totalRevenue = totalFor('sales_order');
    const totalProcurementCost = totalFor('purchase_order');
    return {
      generatedAt: new Date().toISOString(), currency, totalRevenue, totalProcurementCost,
      totalAfterSalesCost: null, grossProfit: null, grossMargin: null,
      amountDifference: totalRevenue !== null && totalProcurementCost !== null
        ? Number((totalRevenue - totalProcurementCost).toFixed(2)) : null,
      calculationStatus: 'incomplete', missingCosts: ['after_sales', 'freight', 'other_expenses'],
      amountBasis: { sales: 'submitted_sales_documents', purchase: 'submitted_purchase_document_amounts',
        sourcePrecision: 'unrounded_document_sums', totalPrecision: 'round_after_aggregation_to_2_decimal_places' },
      unknownCurrencyCount, sourceDocuments,
    };
  }

  async getPeriodSummary(session?: FormalSession, requestedPeriod?: string) {
    const period = requestedPeriod ?? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
    if (typeof period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || period.startsWith('0000-')) {
      throw new BadRequestException('创建月份必须为 YYYY-MM');
    }
    const [year, month] = period.split('-').map(Number);
    const monthStart = (monthIndex: number) => {
      const date = new Date(0);
      date.setUTCFullYear(year, monthIndex, 1);
      date.setUTCHours(-8, 0, 0, 0);
      return date.getTime();
    };
    const start = monthStart(month - 1);
    const end = monthStart(month);
    const inPeriod = (time: number | null) => time !== null && time >= start && time < end;
    const types = ['sales_order', 'purchase_order', 'shipment_batch', 'after_sales'];
    const [salesSource, purchaseSource, shipmentSource, afterSalesSource] = await Promise.all(types.map(type => this.getReportDocuments(type)));
    const salesOrders = this.visibleReportDocuments(salesSource, 'sales_order', session);
    const purchaseOrders = this.visibleReportDocuments(purchaseSource, 'purchase_order', session);
    const salesIds = new Set(salesOrders.map(documentId));
    const purchaseIds = new Set(purchaseOrders.map(documentId));
    const restrictedShipmentScope = !!session?.role && session.dataScope !== 'all' && !session.dataScope?.endsWith('_team') &&
      (session.dataScope?.startsWith('own_') || !['admin', 'boss', 'sales_manager', 'purchase_manager'].includes(session.role));
    const shipmentBatches = restrictedShipmentScope && ['sales', 'sales_manager'].includes(session?.role ?? '')
      ? shipmentSource.filter(record => salesIds.has(record.payload.salesOrderId ?? -1))
      : restrictedShipmentScope && ['purchase', 'purchase_manager'].includes(session?.role ?? '')
        ? shipmentSource.filter(record => purchaseIds.has(record.payload.purchaseOrderId ?? -1))
        : this.visibleReportDocuments(shipmentSource, 'shipment_batch', session);
    const afterSalesOrders = this.visibleReportDocuments(afterSalesSource, 'after_sales', session);
    const visibleGroups = [salesOrders, purchaseOrders, shipmentBatches, afterSalesOrders];
    const monthGroups = visibleGroups.map(records => records.filter(record => inPeriod(reliableTime(record.createdAt))));
    const logs: ReportAuditLog[] = resolveStorageMode() === 'prisma'
      ? await this.prisma!.operationLog.findMany({ where: { bizType: 'sales_order',
        operationType: { in: ['submit_sales_order', 'resubmit_sales_order'] },
        createdAt: { gte: new Date(start), lt: new Date(end) },
      } })
      : resolveSalesOrderStore().listAuditLogs();
    const statusOf = (data: unknown) => data && typeof data === 'object' && 'status' in data ? data.status : undefined;
    const reopenedApprovalEvents = logs.filter(log => log.bizType === 'sales_order' && salesIds.has(Number(log.bizId)) &&
      inPeriod(reliableTime(log.createdAt)) && statusOf(log.afterData) === 'pending_sales_manager_approval' &&
      (log.operationType === 'resubmit_sales_order' ||
        (log.operationType === 'submit_sales_order' && statusOf(log.beforeData) === 'rejected')))
      .map(log => {
        const salesOrderId = Number(log.bizId);
        const source = documentSource(salesOrders.find(record => documentId(record) === salesOrderId)!, 'sales_order');
        return { salesOrderId, docNo: source.docNo, operationType: log.operationType,
          createdAt: new Date(log.createdAt).toISOString(), href: source.href };
      });
    return {
      generatedAt: new Date().toISOString(), period, timeZone: 'Asia/Shanghai',
      periodBasis: 'created_business_documents', calculationStatus: 'provisional',
      salesOrdersCreated: monthGroups[0].length, purchaseOrdersCreated: monthGroups[1].length,
      shipmentBatchesCreated: monthGroups[2].length, afterSalesCreated: monthGroups[3].length,
      closedOrders: monthGroups[0].filter(record => documentStatus(record) === 'closed').length,
      reopenedApprovals: reopenedApprovalEvents.length, reopenedApprovalEvents, reopenedApprovalsBasis: 'sales_audit_events',
      missingHistory: ['legacy_sales_resubmissions_without_audit_events'],
      undatedCounts: Object.fromEntries(types.map((type, index) => [type,
        visibleGroups[index].filter(record => reliableTime(record.createdAt) === null).length])),
      sourceDocuments: monthGroups.flatMap((records, index) => records.map(record => documentSource(record, types[index]))),
    };
  }
}
