import { Inject, Injectable, Optional } from '@nestjs/common';
import { resolveAfterSalesStore } from '../after-sales/after-sales.store';
import { resolvePurchaseOrderStore } from '../purchase-order/purchase-order.store';
import { resolveSalesOrderStore } from '../sales-order/sales-order.store';
import { resolveShipmentBatchStore } from '../shipment-batch/shipment-batch.store';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';

function sumBy<T>(items: T[], predicate: (item: T) => number) {
  return items.reduce((total, item) => total + predicate(item), 0);
}

function toFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

type DocumentItem = {
  amount?: unknown;
  quantity?: unknown;
  salePrice?: unknown;
  unitPrice?: unknown;
};

type PrismaBusinessDocumentRecord = {
  payload: {
    status?: string;
    financeStatus?: string;
    receiptStatus?: string;
    versionHistory?: unknown[];
    shipmentAggregateStatus?: string;
    items?: DocumentItem[];
  };
};

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

function isShippedSalesStatus(value?: string) {
  return (
    value === 'forwarder_shipped' ||
    value === 'arrived' ||
    value === 'closed'
  );
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

  async getSalesSummary() {
    const salesOrders = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('sales_order')
      : resolveSalesOrderStore().listSalesOrders().map((item) => ({ payload: item }));
    const afterSalesOrders = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('after_sales')
      : resolveAfterSalesStore().listAfterSalesOrders().map((item) => ({ payload: item }));
    const salesOrderCount = salesOrders.length;
    const submittedAmount = sumBy(salesOrders, (item) => sumDocumentItems(item.payload.items));
    const shippedAmount = sumBy(salesOrders, (item) =>
      isShippedSalesStatus(item.payload.shipmentAggregateStatus ?? item.payload.status)
        ? sumDocumentItems(item.payload.items)
        : 0,
    );
    const afterSalesStatus = (item: AfterSalesStatusRecord) => item.payload.status ?? '';
    const receiptStatus = (item: SalesStatusRecord) => item.payload.receiptStatus ?? 'unpaid';
    const shipmentStatus = (item: SalesStatusRecord) =>
      item.payload.shipmentAggregateStatus ?? item.payload.status ?? 'not_started';

    return {
      generatedAt: new Date().toISOString(),
      currency: 'CNY',
      totals: {
        salesOrderCount,
        submittedAmount,
        shippedAmount,
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

  async getGrossProfitSummary() {
    const salesOrders = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('sales_order')
      : resolveSalesOrderStore().listSalesOrders().map((item) => ({ payload: item }));
    const purchaseOrders = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('purchase_order')
      : resolvePurchaseOrderStore().listPurchaseOrders().map((item) => ({ payload: item }));
    const afterSalesOrders = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('after_sales')
      : resolveAfterSalesStore().listAfterSalesOrders().map((item) => ({ payload: item }));
    const totalRevenue = sumBy(salesOrders, (item) => sumDocumentItems(item.payload.items));
    const totalProcurementCost = sumBy(purchaseOrders, (item) =>
      sumDocumentItems(item.payload.items),
    );
    const totalAfterSalesCost = afterSalesOrders.length * 0;

    return {
      generatedAt: new Date().toISOString(),
      currency: 'CNY',
      totalRevenue,
      totalProcurementCost,
      totalAfterSalesCost,
      grossProfit: totalRevenue - totalProcurementCost - totalAfterSalesCost,
      grossMargin: totalRevenue > 0 ? (totalRevenue - totalProcurementCost - totalAfterSalesCost) / totalRevenue : 0,
    };
  }

  async getPeriodSummary() {
    const salesOrders = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('sales_order')
      : resolveSalesOrderStore().listSalesOrders().map((item) => ({ payload: item }));
    const purchaseOrders = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('purchase_order')
      : resolvePurchaseOrderStore().listPurchaseOrders().map((item) => ({ payload: item }));
    const shipmentBatches = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('shipment_batch')
      : resolveShipmentBatchStore().listShipmentBatches().map((item) => ({ payload: item }));
    const afterSalesOrders = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('after_sales')
      : resolveAfterSalesStore().listAfterSalesOrders().map((item) => ({ payload: item }));

    return {
      generatedAt: new Date().toISOString(),
      period: new Date().toISOString().slice(0, 7),
      salesOrdersCreated: salesOrders.length,
      purchaseOrdersCreated: purchaseOrders.length,
      shipmentBatchesCreated: shipmentBatches.length,
      afterSalesCreated: afterSalesOrders.length,
      closedOrders: salesOrders.filter((item) => item.payload.status === 'closed').length,
      reopenedApprovals:
        salesOrders.filter(
          (item) => Array.isArray(item.payload.versionHistory) && item.payload.versionHistory.length > 1,
        ).length,
    };
  }
}
