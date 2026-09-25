import { Inject, Injectable, Optional } from '@nestjs/common';
import { AfterSalesService } from '../after-sales/after-sales.service';
import { InquiryService } from '../inquiry/inquiry.service';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import { QuoteService } from '../quote/quote.service';
import { SampleOrderService } from '../sample-order/sample-order.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { ShipmentBatchService } from '../shipment-batch/shipment-batch.service';

export type FormalTodoDomain = 'sales' | 'purchase' | 'operations' | 'after_sales';

export type FormalTodoRole =
  | 'admin'
  | 'boss'
  | 'sales_manager'
  | 'sales'
  | 'purchase_manager'
  | 'purchase';

export type FormalTodoListQuery = {
  role?: FormalTodoRole;
  user?: string;
};

export type FormalTodoItem = {
  id: string;
  docNo: string;
  title: string;
  domain: FormalTodoDomain;
  moduleLabel: string;
  statusLabel: string;
  ownerName: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
  closeReason?: string;
  visibility?: 'owner_only';
};

export type FormalTodoResponse = {
  items: FormalTodoItem[];
  total: number;
  closedTotal: number;
};

type ListResponse<T> = {
  items: T[];
};

type LifecycleTrackedItem = {
  ownerName?: string;
  lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
  closeReason?: string;
};

function formalDetailHref(detailHref: string, formalPrefix: string) {
  const id = detailHref.split('/').filter(Boolean).at(-1);
  return id ? `${formalPrefix}/${id}` : formalPrefix;
}

function canSeeFormalTodo(query: FormalTodoListQuery | undefined, item: FormalTodoItem) {
  const role = query?.role;
  const user = query?.user;

  if (!role || role === 'admin' || role === 'boss') {
    return true;
  }

  if (role === 'sales_manager') {
    return item.domain === 'sales';
  }

  if (role === 'sales') {
    return item.domain === 'sales' && item.ownerName === user;
  }

  if (role === 'purchase_manager') {
    return (
      item.domain === 'purchase' ||
      item.domain === 'operations' ||
      item.domain === 'after_sales'
    );
  }

  return (
    (item.domain === 'purchase' ||
      item.domain === 'operations' ||
      item.domain === 'after_sales') &&
    item.ownerName === user
  );
}

function isClosedLifecycleStatus(value?: string) {
  return value === 'auto_closed' || value === 'voided';
}

@Injectable()
export class FormalTodoService {
  constructor(
    @Inject(QuoteService)
    private readonly quoteService: Pick<QuoteService, 'list'>,
    @Inject(SalesOrderService)
    private readonly salesOrderService: Pick<SalesOrderService, 'list' | 'listPendingPurchaseAssignments'>,
    @Inject(PurchaseOrderService)
    private readonly purchaseOrderService: Pick<PurchaseOrderService, 'list'> & Partial<Pick<PurchaseOrderService, 'getDetail'>>,
    @Inject(ShipmentBatchService)
    private readonly shipmentBatchService: Pick<ShipmentBatchService, 'list'>,
    @Inject(AfterSalesService)
    private readonly afterSalesService: Pick<AfterSalesService, 'list'>,
    @Optional()
    @Inject(InquiryService)
    private readonly inquiryService?: Pick<InquiryService, 'list'>,
    @Optional()
    @Inject(SampleOrderService)
    private readonly sampleOrderService?: Pick<SampleOrderService, 'list'>,
  ) {}

  async listFormalTodos(
    query?: FormalTodoListQuery,
  ): Promise<FormalTodoResponse> {
    const [
      quotes,
      salesOrders,
      purchaseOrders,
      shipmentBatches,
      afterSalesOrders,
      inquiries,
      sampleOrders,
    ] =
      await Promise.all([
        this.quoteService.list(
          { page: 1, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
          query,
        ),
        this.salesOrderService.list(
          { page: 1, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
          query,
        ),
        this.purchaseOrderService.list(
          { page: 1, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
          query,
        ),
        this.shipmentBatchService.list(
          { page: 1, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
          query,
        ),
        this.afterSalesService.list(
          { page: 1, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
          query,
        ),
        this.inquiryService
          ? this.inquiryService.list({ page: 1, pageSize: 100 }, query)
          : Promise.resolve({ items: [] }),
        this.sampleOrderService
          ? this.sampleOrderService.list(
              { page: 1, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
              query,
            )
          : Promise.resolve({ items: [] }),
      ]) as [
        ListResponse<{
          docNo: string;
          title: string;
          bossConfirmed: boolean;
          createdBy: string;
          detailHref: string;
          lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
          closeReason?: string;
        }>,
        ListResponse<{
          docNo: string;
          title: string;
          status: string;
          ownerName?: string;
          createdBy: string;
          detailHref: string;
          lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
          closeReason?: string;
        }>,
        ListResponse<{
          docNo: string;
          title: string;
          status: string;
          ownerName?: string;
          createdBy: string;
          detailHref: string;
          lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
          closeReason?: string;
        }>,
        ListResponse<{
          docNo: string;
          title: string;
          hasException: boolean;
          receiptSendStatus: string;
          ownerName?: string;
          detailHref: string;
          lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
          closeReason?: string;
        }>,
        ListResponse<{
          docNo: string;
          title: string;
          status: string;
          financeReviewStatus: string;
          ownerName: string;
          detailHref: string;
          lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
          closeReason?: string;
        }>,
        ListResponse<{
          inquiryNo: string;
          quoteOrderNo: string;
          status: string;
          customerName: string;
          createdBy: string;
          detailHref: string;
          lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
          closeReason?: string;
        }>,
        ListResponse<{
          docNo: string;
          title: string;
          status: string;
          ownerName: string;
          detailHref: string;
          lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
          closeReason?: string;
        }>,
      ];

    const items: FormalTodoItem[] = [];
    let closedTotal = 0;

    const countClosed = (item: LifecycleTrackedItem, domain: FormalTodoDomain) => {
      if (!isClosedLifecycleStatus(item.lifecycleStatus)) {
        return false;
      }

      const syntheticTodo = {
        domain,
        ownerName: item.ownerName ?? '',
        visibility: undefined,
      } as FormalTodoItem;

      if (canSeeFormalTodo(query, syntheticTodo)) {
        closedTotal += 1;
      }

      return true;
    };

    quotes.items
      .filter((item) => !countClosed(item, 'sales'))
      .filter((item) => !item.bossConfirmed)
      .forEach((item) => {
        items.push({
          id: `quote-${item.docNo}`,
          docNo: item.docNo,
          title: '报价待老板确认',
          domain: 'sales',
          moduleLabel: '报价',
          statusLabel: '待老板确认',
          ownerName: item.createdBy,
          href: formalDetailHref(item.detailHref, '/app/sales/quotes'),
          priority: 'high',
          description: `${item.title} 需要老板确认价格、利润与转单口径。`,
        });
      });

    inquiries.items
      .filter((item) =>
        !countClosed(
          {
            ownerName: item.createdBy,
            lifecycleStatus: item.lifecycleStatus,
            closeReason: item.closeReason,
          },
          'sales',
        ),
      )
      .filter((item) => item.status === 'pending_boss_review')
      .forEach((item) => {
        items.push({
          id: `inquiry-${item.inquiryNo}`,
          docNo: item.inquiryNo,
          title: '询价待老板确认',
          domain: 'sales',
          moduleLabel: '询价',
          statusLabel: '待老板确认',
          ownerName: item.createdBy,
          href: formalDetailHref(item.detailHref, '/app/sales/inquiries'),
          priority: 'high',
          description: `${item.customerName} / ${item.quoteOrderNo} 已提交比价，需要老板确认最终售价。`,
        });
      });

    sampleOrders.items
      .filter((item) => !countClosed(item, 'sales'))
      .filter((item) =>
        ['pending_approval', 'pending_sampling', 'sampling', 'sample_sent'].includes(
          item.status,
        ),
      )
      .forEach((item) => {
        const statusMeta =
          item.status === 'pending_approval'
            ? {
                title: '样品单待审批',
                statusLabel: '待样品审批',
                priority: 'high' as const,
                description: `${item.title} 已提交，需要销售主管或老板审批样品申请。`,
              }
            : item.status === 'pending_sampling'
              ? {
                  title: '样品单待打样',
                  statusLabel: '待打样',
                  priority: 'medium' as const,
                  description: `${item.title} 已审批，需要安排打样执行。`,
                }
              : item.status === 'sampling'
                ? {
                    title: '样品待寄样',
                    statusLabel: '打样中',
                    priority: 'medium' as const,
                    description: `${item.title} 打样中，需要完成后寄送客户。`,
                  }
                : {
                    title: '样品待客户确认',
                    statusLabel: '已寄样',
                    priority: 'medium' as const,
                    description: `${item.title} 已寄样，需要跟进客户确认结果。`,
                  };

        items.push({
          id: `sample-${item.docNo}`,
          docNo: item.docNo,
          title: statusMeta.title,
          domain: 'sales',
          moduleLabel: '样品单',
          statusLabel: statusMeta.statusLabel,
          ownerName: item.ownerName ?? '',
          href: formalDetailHref(item.detailHref, '/app/sales/samples'),
          priority: statusMeta.priority,
          description: statusMeta.description,
        });
      });

    salesOrders.items
      .filter((item) => !countClosed(item, 'sales'))
      .filter((item) => item.status === 'pending_sales_manager_approval')
      .forEach((item) => {
        items.push({
          id: `sales-${item.docNo}`,
          docNo: item.docNo,
          title: '销售单待主管审批',
          domain: 'sales',
          moduleLabel: '销售单',
          statusLabel: '待销售主管审批',
          ownerName: item.ownerName ?? item.createdBy,
          href: formalDetailHref(item.detailHref, '/app/sales/orders'),
          priority: 'high',
          description: `${item.title} 已提交，需要销售主管确认后进入采购履约。`,
        });
      });

    const pendingAssignments = await this.salesOrderService.listPendingPurchaseAssignments?.() ?? [];
    pendingAssignments.forEach((item) => {
      items.push({
        id: `purchase-assignment-${item.salesNo}`,
        docNo: item.salesNo,
        title: '销售单待分配采购负责人',
        domain: 'purchase',
        moduleLabel: '采购分配',
        statusLabel: '待分配',
        ownerName: '',
        href: '/app/purchase-orders/assignments',
        priority: 'high',
        description: `${item.title} 需要采购主管或老板指定采购负责人。`,
      });
    });

    const purchaseClaims = purchaseOrders.items
      .filter((item) => !countClosed(item, 'purchase'))
      .filter((item) => item.status === 'pending_purchase_claim');
    const purchaseClaimsWithAssignment = await Promise.all(purchaseClaims.map(async (item) => {
      const id = Number(item.detailHref.split('/').filter(Boolean).at(-1));
      const detail = Number.isSafeInteger(id) && id > 0
        ? await this.purchaseOrderService.getDetail?.(id)
        : null;
      return { item, needsAssignment: detail?.needsPurchaseAssignment === true };
    }));
    purchaseClaimsWithAssignment.forEach(({ item, needsAssignment }) => {
        items.push({
          id: `${needsAssignment ? 'purchase-assignment' : 'purchase-claim'}-${item.docNo}`,
          docNo: item.docNo,
          title: needsAssignment ? '采购单待分配采购负责人' : '采购单待负责人建单',
          domain: 'purchase',
          moduleLabel: '采购单',
          statusLabel: needsAssignment ? '待分配' : '待采购建单',
          ownerName: needsAssignment ? '' : item.ownerName ?? '',
          href: formalDetailHref(item.detailHref, '/app/purchase-orders'),
          priority: 'high',
          description: needsAssignment
            ? `${item.title} 需要采购主管或老板指定采购负责人。`
            : `${item.title} 已指定采购负责人，请补齐采购信息并提交审批。`,
        });
      });

    purchaseOrders.items
      .filter((item) => !countClosed(item, 'purchase'))
      .filter((item) => item.status === 'pending_purchase_manager_approval')
      .forEach((item) => {
        items.push({
          id: `purchase-${item.docNo}`,
          docNo: item.docNo,
          title: '采购单待主管审批',
          domain: 'purchase',
          moduleLabel: '采购单',
          statusLabel: '待采购主管审批',
          ownerName: '',
          href: formalDetailHref(item.detailHref, '/app/purchase-orders'),
          priority: 'high',
          description: `${item.title} 需要采购主管审批后进入采购执行。`,
        });
      });

    shipmentBatches.items
      .filter((item) => !countClosed(item, 'operations'))
      .filter((item) => item.hasException || item.receiptSendStatus === 'pending')
      .forEach((item) => {
        items.push({
          id: `shipment-${item.docNo}`,
          docNo: item.docNo,
          title: item.hasException ? '发货批次异常待处理' : '发货回单待发送',
          domain: 'operations',
          moduleLabel: '发货批次',
          statusLabel: item.hasException ? '异常待处理' : '回单待发送',
          ownerName: item.ownerName ?? '',
          href: formalDetailHref(item.detailHref, '/app/shipment-batches'),
          priority: item.hasException ? 'high' : 'medium',
          description: `${item.title} 需要运营跟进发货节点、回单或异常处理。`,
        });
      });

    afterSalesOrders.items
      .filter((item) => !countClosed(item, 'after_sales'))
      .filter((item) => item.status !== 'closed' && item.financeReviewStatus === 'pending')
      .forEach((item) => {
        items.push({
          id: `after-sales-${item.docNo}`,
          docNo: item.docNo,
          title: '售后单待财务复核',
          domain: 'after_sales',
          moduleLabel: '售后',
          statusLabel: '财务复核中',
          ownerName: item.ownerName,
          href: formalDetailHref(item.detailHref, '/app/after-sales'),
          priority: 'medium',
          description: `${item.title} 需要复核退款、抵扣和收款状态后闭环。`,
        });
      });

    const visibleItems = items.filter((item) => canSeeFormalTodo(query, item));

    return {
      items: visibleItems,
      total: visibleItems.length,
      closedTotal,
    };
  }
}
