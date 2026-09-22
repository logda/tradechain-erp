import { Inject, Injectable, Optional } from '@nestjs/common';
import { resolveAfterSalesStore } from '../after-sales/after-sales.store';
import { resolveQuoteStore } from '../quote/quote.store';
import { resolveSalesOrderStore } from '../sales-order/sales-order.store';
import { resolveShipmentBatchStore } from '../shipment-batch/shipment-batch.store';
import { resolvePurchaseOrderStore } from '../purchase-order/purchase-order.store';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';

type PrismaBusinessDocumentRecord = {
  payload: {
    status?: string;
    financeStatus?: string;
    receiptStatus?: string;
    hasException?: boolean;
    stockInStatus?: string;
  };
};

@Injectable()
export class BossDashboardService {
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

  async getSummary() {
    const quotes = this.shouldUsePrisma()
      ? await this.getBusinessDocuments('quote')
      : resolveQuoteStore().listQuotes().map((item) => ({ payload: item }));
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

    const salesStatus = (item: PrismaBusinessDocumentRecord) => item.payload.status ?? '';
    const salesFinance = (item: PrismaBusinessDocumentRecord) => item.payload.financeStatus ?? '';
    const shipmentStatus = (item: PrismaBusinessDocumentRecord) => item.payload.status ?? '';
    const afterSalesStatus = (item: PrismaBusinessDocumentRecord) => item.payload.status ?? '';
    const purchaseStockInStatus = (item: PrismaBusinessDocumentRecord) =>
      item.payload.stockInStatus ?? '';

    return {
      generatedAt: new Date().toISOString(),
      workflowAlerts: [
        {
          key: 'quotes_pending_boss_confirm',
          label: '待老板确认报价',
          count: quotes.filter((item) => item.payload.status === 'draft').length,
          severity: 'warning',
        },
        {
          key: 'shipment_exceptions',
          label: '发货异常批次',
          count: shipmentBatches.filter(
            (item) => item.payload.hasException || item.payload.status === 'exception',
          ).length,
          severity: 'critical',
        },
        {
          key: 'after_sales_pending_close',
          label: '售后待闭环',
          count: afterSalesOrders.filter((item) => afterSalesStatus(item) !== 'closed').length,
          severity: 'warning',
        },
      ],
      salesOverview: {
        totalOrders: salesOrders.length,
        pendingApproval:
          salesOrders.filter(
            (item) => salesStatus(item) === 'pending_sales_manager_approval',
          ).length,
        inProduction:
          salesOrders.filter((item) => salesStatus(item) === 'purchasing').length,
        partiallyShipped:
          shipmentBatches.filter(
            (item) =>
              shipmentStatus(item) === 'to_forwarder' ||
              shipmentStatus(item) === 'forwarder_shipped',
          ).length,
        fullyShipped:
          shipmentBatches.filter((item) => shipmentStatus(item) === 'arrived').length,
      },
      purchaseOverview: {
        totalOrders: purchaseOrders.length,
        pendingApproval:
          purchaseOrders.filter(
            (item) => item.payload.status === 'pending_purchase_manager_approval',
          ).length,
        purchasing:
          purchaseOrders.filter((item) => item.payload.status === 'purchasing').length,
        partiallyReceived: purchaseOrders.filter((item) => {
          const status = purchaseStockInStatus(item);
          return status === 'partial_received' || status === 'partially_received';
        }).length,
        completed: purchaseOrders.filter((item) => {
          const status = purchaseStockInStatus(item);
          return status === 'completed' || status === 'received';
        }).length,
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
      financeOverview: {
        pendingConfirmation:
          salesOrders.filter((item) => salesFinance(item) === 'pending').length,
        confirmedThisMonth:
          salesOrders.filter((item) => salesFinance(item) === 'confirmed').length,
        prepaidDeducted:
          salesOrders.filter((item) => item.payload?.receiptStatus === 'prepaid_deducted').length,
      },
    };
  }
}
