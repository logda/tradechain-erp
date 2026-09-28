import { matchesFormalUser, type FormalSession, type FormalOwnedItem } from '../auth/formal-session';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { AfterSalesService } from '../after-sales/after-sales.service';
import { InquiryService } from '../inquiry/inquiry.service';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import { QuoteService } from '../quote/quote.service';
import { SampleOrderService } from '../sample-order/sample-order.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { ShipmentBatchService } from '../shipment-batch/shipment-batch.service';
import { resolveFormalUserName } from '../auth/formal-user-name';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';

export type FormalTodoDomain = 'sales' | 'purchase' | 'operations' | 'after_sales';

export type FormalTodoRole =
  | 'admin'
  | 'boss'
  | 'sales_manager'
  | 'sales'
  | 'purchase_manager'
  | 'purchase';

export type FormalTodoListQuery = FormalSession;

export type FormalTodoItem = {
  id: string;
  docNo: string;
  title: string;
  domain: FormalTodoDomain;
  moduleLabel: string;
  statusLabel: string;
  ownerName: string;
  ownerId?: number;
  createdById?: number;
  href: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  relation: 'action' | 'following';
  nextAction: string;
  handlerLabel: string;
  dueDate?: string;
  dueInDays?: number;
  createdAt?: string;
  productNames?: string[];
  customerName?: string;
  supplierName?: string;
  imageUrls?: string[];
  lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
  closeReason?: string;
  visibility?: 'owner_only' | 'purchase_team' | 'purchase_manager_only' | 'finance_only';
};

export type FormalTodoResponse = {
  items: FormalTodoItem[];
  total: number;
  closedTotal: number;
  actionTotal: number;
  followingTotal: number;
  generatedAt: string;
};

type FormalTodoDraft = Omit<FormalTodoItem, 'relation' | 'nextAction' | 'handlerLabel'>;

type ListResponse<T> = {
  items: T[];
  total?: number;
};

type LifecycleTrackedItem = FormalOwnedItem & {
  ownerName?: string;
  lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
  closeReason?: string;
  docNo?: string;
  inquiryNo?: string;
  detailHref?: string;
};

type TodoSourceContext = FormalOwnedItem & {
  docNo?: string;
  inquiryNo?: string;
  createdAt?: string;
  customerName?: string;
  counterpartyName?: string;
  supplierName?: string;
  goodsName?: string;
  items?: Array<{ productName?: string; imageUrls?: string[] }>;
};

function detailContext(value: unknown) {
  const detail = value as { imageUrls?: string[]; items?: Array<{
    productName?: string;
    imageUrls?: string[];
    factoryPicUrls?: string[];
  }> } | null;
  const items = detail?.items ?? [];
  return {
    productNames: items.map((item) => item.productName ?? '').filter(Boolean),
    imageUrls: [
      ...(detail?.imageUrls ?? []),
      ...items.flatMap((item) => item.imageUrls ?? item.factoryPicUrls ?? []),
    ].filter(Boolean),
  };
}

function formalDetailHref(detailHref: string, formalPrefix: string) {
  const id = detailHref.split('/').filter(Boolean).at(-1);
  return id ? `${formalPrefix}/${id}` : formalPrefix;
}

function canSeeFormalTodo(query: FormalTodoListQuery | undefined, item: FormalTodoDraft) {
  const role = query?.role;
  const ownsItem = query?.dataScope === 'all' || query?.dataScope === (item.domain === 'sales' ? 'sales_team' : 'purchase_team') || matchesFormalUser(query ?? {}, item);
  if (query?.modules) {
    const moduleCode = item.domain === 'sales' ? 'sales' : item.domain === 'purchase' ? 'purchase' : 'operations';
    if (!query.modules.includes(moduleCode)) return false;
  }
  if (query?.dataScope?.startsWith('own_') && !ownsItem && item.visibility !== 'purchase_team') return false;

  if (!role || role === 'admin' || role === 'boss') {
    return true;
  }

  if (item.visibility === 'finance_only') return false;
  if (item.visibility === 'purchase_manager_only') return role === 'purchase_manager';

  if (role === 'sales_manager') {
    return item.domain === 'sales';
  }

  if (role === 'sales') {
    return item.domain === 'sales' && ownsItem;
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
    (ownsItem || item.visibility === 'purchase_team')
  );
}

function isClosedLifecycleStatus(value?: string) {
  return value === 'auto_closed' || value === 'voided';
}

async function readAllPages<T>(load: (page: number) => Promise<ListResponse<T>>) {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await load(page);
    items.push(...result.items);
    if (!result.items.length || (result.total !== undefined
      ? items.length >= result.total : result.items.length < 100)) return { items };
  }
}

function calendarDay(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date.getTime() / 86_400_000 : undefined;
}

function actionForTodo(item: FormalTodoDraft) {
  const salesRoles: FormalTodoRole[] = ['admin', 'boss', 'sales_manager', 'sales'];
  const purchaseRoles: FormalTodoRole[] = ['admin', 'boss', 'purchase_manager', 'purchase'];
  const salesApprovalRoles: FormalTodoRole[] = ['admin', 'boss', 'sales_manager'];
  const purchaseApprovalRoles: FormalTodoRole[] = ['admin', 'boss', 'purchase_manager'];
  const bossRoles: FormalTodoRole[] = ['admin', 'boss'];
  if (item.id.startsWith('quote-feedback-')) return { roles: salesRoles, actions: ['sales.quote.write', 'boss.confirm'], nextAction: '跟进客户反馈', handlerLabel: item.ownerName || '销售负责人' };
  if (item.id.startsWith('quote-')) return { roles: bossRoles, actions: ['boss.confirm'], nextAction: '确认报价价格', handlerLabel: '老板' };
  if (item.id.startsWith('inquiry-work-')) return { roles: purchaseRoles, actions: ['sales.inquiry.submit'], nextAction: '录入供应商报价并提交比价', handlerLabel: '采购团队', module: 'purchase' };
  if (item.id.startsWith('inquiry-')) return { roles: bossRoles, actions: ['boss.confirm'], nextAction: '确认询价最终售价', handlerLabel: '老板', module: 'purchase' };
  if (item.id.startsWith('sample-')) {
    if (item.statusLabel === '待样品审批') return { roles: salesApprovalRoles, actions: ['sales.sample.approve'], nextAction: '审批样品申请', handlerLabel: '销售主管' };
    if (item.domain === 'purchase') return { roles: ['admin', 'purchase_manager', 'purchase'] as FormalTodoRole[], actions: ['purchase.sample.execute'], nextAction: item.statusLabel === '待打样' ? '安排打样' : '完成打样并寄样', handlerLabel: '采购团队' };
    return { roles: salesRoles, actions: ['sales.sample.execute'], nextAction: '跟进客户确认样品', handlerLabel: item.ownerName || '销售负责人' };
  }
  if (item.id.startsWith('sales-rejected-')) return { roles: salesRoles, actions: ['sales.order.write'], nextAction: '修改销售单并重新提交', handlerLabel: item.ownerName || '销售负责人' };
  if (item.id.startsWith('sales-')) return { roles: salesApprovalRoles, actions: ['sales.order.write'], nextAction: '审批销售单', handlerLabel: '销售主管' };
  if (item.id.startsWith('purchase-assignment-') || item.statusLabel === '待分配') return { roles: purchaseApprovalRoles, actions: ['purchase.order.approve'], nextAction: '指定采购负责人', handlerLabel: '采购主管' };
  if (item.id.startsWith('purchase-claim-')) return { roles: purchaseRoles, actions: ['purchase.order.submit'], nextAction: '补齐采购信息并提交审批', handlerLabel: item.ownerName || '采购负责人' };
  if (item.id.startsWith('purchase-eta-')) return { roles: purchaseRoles, actions: ['purchase.order.submit'], nextAction: '跟进供应商交付', handlerLabel: item.ownerName || '采购负责人' };
  if (item.id.startsWith('purchase-')) return { roles: purchaseApprovalRoles, actions: ['purchase.order.approve'], nextAction: '审批采购单', handlerLabel: '采购主管' };
  if (item.id.startsWith('shipment-')) return { roles: purchaseRoles, actions: ['shipment.update'], nextAction: item.statusLabel === '异常待处理' ? '处理发货异常' : '发送发货回单', handlerLabel: item.ownerName || '发货负责人' };
  if (item.id.startsWith('after-sales-approval-')) return { roles: purchaseApprovalRoles, actions: ['purchase.order.approve'], nextAction: '审批售后处理方案', handlerLabel: '采购主管' };
  return { roles: bossRoles, actions: ['finance.confirm'], nextAction: '复核售后财务并确认', handlerLabel: '老板 / 财务' };
}

@Injectable()
export class FormalTodoService {
  constructor(
    @Inject(QuoteService)
    private readonly quoteService: Pick<QuoteService, 'list'> & Partial<Pick<QuoteService, 'getDetail'>>,
    @Inject(SalesOrderService)
    private readonly salesOrderService: Pick<SalesOrderService, 'list' | 'listPendingPurchaseAssignments'> & Partial<Pick<SalesOrderService, 'getDetail'>>,
    @Inject(PurchaseOrderService)
    private readonly purchaseOrderService: Pick<PurchaseOrderService, 'list'> & Partial<Pick<PurchaseOrderService, 'getDetail'>>,
    @Inject(ShipmentBatchService)
    private readonly shipmentBatchService: Pick<ShipmentBatchService, 'list'> & Partial<Pick<ShipmentBatchService, 'getDetail'>>,
    @Inject(AfterSalesService)
    private readonly afterSalesService: Pick<AfterSalesService, 'list'> & Partial<Pick<AfterSalesService, 'getDetail'>>,
    @Optional()
    @Inject(InquiryService)
    private readonly inquiryService?: Pick<InquiryService, 'list'>,
    @Optional()
    @Inject(SampleOrderService)
    private readonly sampleOrderService?: Pick<SampleOrderService, 'list'> & Partial<Pick<SampleOrderService, 'getDetail'>>,
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  async listFormalTodos(
    query?: FormalTodoListQuery,
    includeContext = true,
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
        readAllPages(page => this.quoteService.list(
          { page, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
          query,
        )),
        readAllPages(page => this.salesOrderService.list(
          { page, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
          query,
        )),
        readAllPages(page => this.purchaseOrderService.list(
          { page, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
          query,
        )),
        readAllPages(page => this.shipmentBatchService.list(
          { page, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
          query,
        )),
        readAllPages(page => this.afterSalesService.list(
          { page, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
          query,
        )),
        this.inquiryService
          ? readAllPages(page => this.inquiryService!.list({ page, pageSize: 100 }, query))
          : Promise.resolve({ items: [] }),
        this.sampleOrderService
          ? readAllPages(page => this.sampleOrderService!.list(
              { page, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' },
              query,
            ))
          : Promise.resolve({ items: [] }),
      ]) as [
        ListResponse<{
          docNo: string;
          title: string;
          bossConfirmed: boolean;
          status?: string;
          secondaryStatus?: string;
          createdAt?: string;
          customerName?: string;
          items?: Array<{ productName: string; imageUrls?: string[] }>;
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
          createdAt?: string;
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
          factoryEstimatedDeliveryDate?: string;
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
          createdAt?: string;
          items?: Array<{ productName: string; imageUrls?: string[] }>;
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

    const items: FormalTodoDraft[] = [];
    const closedSources = new Set<string>();

    const countClosed = (item: LifecycleTrackedItem, domain: FormalTodoDomain) => {
      if (!isClosedLifecycleStatus(item.lifecycleStatus)) {
        return false;
      }

      const syntheticTodo = {
        domain,
        ownerName: item.ownerName ?? '',
        ownerId: item.ownerId ?? item.salesUserId ?? item.ownerUserId,
        createdById: item.createdById,
        visibility: undefined,
      } as FormalTodoItem;

      if (canSeeFormalTodo(query, syntheticTodo)) {
        closedSources.add(`${domain}:${item.detailHref ?? item.docNo ?? item.inquiryNo}`);
      }

      return true;
    };

    quotes.items
      .filter((item) => !countClosed(item, 'sales'))
      .filter((item) => !item.bossConfirmed && (
        !item.status ||
        ['pending_boss_approval', 'pending_boss_price_confirmation',
          'pending_boss_confirm', 'pending_boss_confirmation', 'pending_boss_review'].includes(item.status) ||
        (item.status === 'quoted' && item.secondaryStatus === 'pending_boss_confirmation')
      ))
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
          createdAt: item.createdAt,
        });
      });

    quotes.items
      .filter((item) => !isClosedLifecycleStatus(item.lifecycleStatus))
      .filter((item) => item.status === 'pending_customer_feedback')
      .forEach((item) => items.push({
        id: `quote-feedback-${item.docNo}`,
        docNo: item.docNo,
        title: '报价待客户反馈',
        domain: 'sales',
        moduleLabel: '报价',
        statusLabel: '待客户反馈',
        ownerName: item.createdBy,
        href: formalDetailHref(item.detailHref, '/app/sales/quotes'),
        priority: 'medium',
        description: `${item.title} 等待销售跟进客户反馈。`,
        createdAt: item.createdAt,
      }));

    inquiries.items
      .filter((item) => !isClosedLifecycleStatus(item.lifecycleStatus))
      .filter((item) => item.status === 'pending_inquiry')
      .forEach((item) => items.push({
        id: `inquiry-work-${item.inquiryNo}`,
        docNo: item.inquiryNo,
        title: '询价待录入比价',
        domain: 'purchase',
        moduleLabel: '询价',
        statusLabel: '待询价',
        ownerName: '',
        visibility: 'purchase_team',
        href: formalDetailHref(item.detailHref, '/app/sales/inquiries'),
        priority: 'high',
        description: `${item.customerName} / ${item.quoteOrderNo} 需要采购录入供应商报价。`,
        createdAt: item.createdAt,
        customerName: item.customerName,
        productNames: item.items?.map((entry) => entry.productName).filter(Boolean),
        imageUrls: item.items?.flatMap((entry) => entry.imageUrls ?? []).filter(Boolean),
      }));

    inquiries.items
      .filter((item) =>
        !countClosed(
          { ...item, ownerName: item.createdBy },
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
          createdAt: item.createdAt,
          customerName: item.customerName,
          productNames: item.items?.map((entry) => entry.productName).filter(Boolean),
          imageUrls: item.items?.flatMap((entry) => entry.imageUrls ?? []).filter(Boolean),
        });
      });

    sampleOrders.items
      .filter((item) => !countClosed(item, ['pending_sampling', 'sampling'].includes(item.status) ? 'purchase' : 'sales'))
      .filter((item) =>
        ['pending_approval', 'pending_sampling', 'sampling', 'sample_sent'].includes(
          item.status,
        ),
      )
      .forEach((item) => {
        const purchaseStep = item.status === 'pending_sampling' || item.status === 'sampling';
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
          domain: purchaseStep ? 'purchase' : 'sales',
          moduleLabel: '样品单',
          statusLabel: statusMeta.statusLabel,
          ownerName: purchaseStep ? '' : item.ownerName ?? '',
          visibility: purchaseStep ? 'purchase_team' : undefined,
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

    salesOrders.items
      .filter((item) => !isClosedLifecycleStatus(item.lifecycleStatus))
      .filter((item) => item.status === 'rejected')
      .forEach((item) => items.push({
        id: `sales-rejected-${item.docNo}`,
        docNo: item.docNo,
        title: '销售单驳回待修改',
        domain: 'sales',
        moduleLabel: '销售单',
        statusLabel: '待修改重提',
        ownerName: item.ownerName ?? item.createdBy,
        href: formalDetailHref(item.detailHref, '/app/sales/orders'),
        priority: 'high',
        description: `${item.title} 已驳回，请修改后重新提交。`,
        createdAt: item.createdAt,
      }));

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

    const today = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const todayDay = calendarDay(today.toISOString().slice(0, 10))!;
    const reminderEnd = new Date(today);
    reminderEnd.setUTCDate(reminderEnd.getUTCDate() + 3);
    const reminderEndDate = reminderEnd.toISOString().slice(0, 10);
    purchaseOrders.items
      .filter((item) => !isClosedLifecycleStatus(item.lifecycleStatus))
      .filter((item) => item.status === 'purchasing' || item.status.startsWith('partial_'))
      .filter((item) => calendarDay(item.factoryEstimatedDeliveryDate) !== undefined)
      .filter((item) => item.factoryEstimatedDeliveryDate! <= reminderEndDate)
      .forEach((item) => {
        const dueInDays = calendarDay(item.factoryEstimatedDeliveryDate)! - todayDay;
        items.push({
          id: `purchase-eta-${item.docNo}`,
          docNo: item.docNo,
          title: '工厂交期提醒',
          domain: 'purchase',
          moduleLabel: '采购单',
          statusLabel: dueInDays < 0 ? `已逾期 ${-dueInDays} 天`
            : dueInDays === 0 ? '今天到期' : `还有 ${dueInDays} 天`,
          dueDate: item.factoryEstimatedDeliveryDate,
          dueInDays,
          ownerName: item.ownerName ?? '',
          href: formalDetailHref(item.detailHref, '/app/purchase-orders'),
          priority: 'medium',
          description: `${item.title} 工厂预计交期为 ${item.factoryEstimatedDeliveryDate}，请跟进供应商交付。`,
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
      .filter((item) => item.status === 'pending_approval')
      .forEach((item) => {
        items.push({
          id: `after-sales-approval-${item.docNo}`,
          docNo: item.docNo,
          title: '售后单待审批',
          domain: 'after_sales',
          moduleLabel: '售后',
          statusLabel: '待审批',
          ownerName: '',
          visibility: 'purchase_manager_only',
          href: formalDetailHref(item.detailHref, '/app/after-sales'),
          priority: 'medium',
          description: `${item.title} 需要审批售后处理方案。`,
        });
      });

    afterSalesOrders.items
      .filter((item) => !countClosed(item, 'after_sales'))
      .filter((item) => item.status === 'finance_reviewing' && item.financeReviewStatus === 'pending')
      .forEach((item) => {
        items.push({
          id: `after-sales-${item.docNo}`,
          docNo: item.docNo,
          title: '售后单待财务复核',
          domain: 'after_sales',
          moduleLabel: '售后',
          statusLabel: '财务复核中',
          ownerName: '',
          visibility: 'finance_only',
          href: formalDetailHref(item.detailHref, '/app/after-sales'),
          priority: 'medium',
          description: `${item.title} 需要复核退款、抵扣和收款状态后闭环。`,
        });
      });

    const sources = [
      ...quotes.items, ...salesOrders.items, ...purchaseOrders.items,
      ...shipmentBatches.items, ...afterSalesOrders.items,
      ...inquiries.items, ...sampleOrders.items,
    ] as unknown as TodoSourceContext[];
    const sourcesByNo = new Map<string | undefined, TodoSourceContext>();
    for (const source of sources) {
      const docNo = source.docNo ?? source.inquiryNo;
      if (!sourcesByNo.has(docNo)) sourcesByNo.set(docNo, source);
    }
    const uniqueItems = [...new Map(items.map(item => [item.id, item])).values()];
    const visibleItems = await Promise.all(uniqueItems
      .map(item => {
        const source = sourcesByNo.get(item.docNo);
        return { ...item, ownerId: source?.ownerId ?? source?.salesUserId ?? (source?.ownerUserId == null ? undefined : Number(source.ownerUserId)), createdById: source?.createdById ?? undefined };
      })
      .filter((item) => canSeeFormalTodo(query, item))
      .map(async (item) => {
        const action = actionForTodo(item);
        const canAct = (!query?.role || action.roles.includes(query.role))
          && (query?.actions === undefined || action.actions.some(value => query.actions!.includes(value)))
          && (!action.module || query?.modules === undefined || query.modules.includes(action.module));
        if (!includeContext) return {
          ...item, relation: canAct ? 'action' as const : 'following' as const,
          nextAction: action.nextAction, handlerLabel: action.handlerLabel,
        };
        const source = sourcesByNo.get(item.docNo);
        const sourceItems = source?.items ?? [];
        const sourceContext = {
          productNames: sourceItems.map((entry) => entry.productName ?? '').filter(Boolean),
          imageUrls: sourceItems.flatMap((entry) => entry.imageUrls ?? []).filter(Boolean),
        };
        const id = Number(item.href.split('/').filter(Boolean).at(-1));
        let detail: unknown;
        if (Number.isSafeInteger(id) && id > 0) {
          try {
            if (item.id.startsWith('quote-')) detail = await this.quoteService.getDetail?.(id, query);
            else if (item.id.startsWith('inquiry-')) detail = null;
            else if (item.id.startsWith('sample-')) detail = await this.sampleOrderService?.getDetail?.(id, query);
            else if (item.id.startsWith('sales-') || item.id.startsWith('purchase-assignment-') && item.href.includes('/sales/')) detail = await this.salesOrderService.getDetail?.(id, query);
            else if (item.id.startsWith('purchase-')) detail = await this.purchaseOrderService.getDetail?.(id, query);
            else if (item.id.startsWith('shipment-')) detail = await this.shipmentBatchService.getDetail?.(id, query);
            else if (item.id.startsWith('after-sales-')) detail = await this.afterSalesService.getDetail?.(id, query);
          } catch {
            // A readable summary still remains available if a detail was removed meanwhile.
          }
        }
        const detailData = detailContext(detail);
        let handlerLabel = action.handlerLabel;
        if (item.ownerName && action.handlerLabel === item.ownerName && item.ownerId !== undefined
          && (resolveStorageMode() !== 'prisma' || this.prisma)) {
          handlerLabel = await resolveFormalUserName(item.ownerId, this.prisma);
        }
        return {
          relation: canAct ? 'action' as const : 'following' as const,
          nextAction: action.nextAction,
          handlerLabel,
          handlerUserId: item.ownerName && action.handlerLabel === item.ownerName ? item.ownerId : undefined,
          ...item,
          createdAt: item.createdAt ?? source?.createdAt,
          customerName: item.customerName ?? source?.customerName ?? source?.counterpartyName,
          supplierName: item.supplierName ?? source?.supplierName,
          productNames: item.productNames?.length ? item.productNames
            : detailData.productNames.length ? detailData.productNames
              : sourceContext.productNames.length ? sourceContext.productNames
                : source?.goodsName ? [source.goodsName] : [],
          imageUrls: item.imageUrls?.length ? item.imageUrls
            : detailData.imageUrls.length ? detailData.imageUrls : sourceContext.imageUrls,
        };
      }));
    visibleItems.sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''));

    return {
      items: visibleItems,
      total: visibleItems.length,
      closedTotal: closedSources.size,
      actionTotal: visibleItems.filter(item => item.relation === 'action').length,
      followingTotal: visibleItems.filter(item => item.relation === 'following').length,
      generatedAt: new Date().toISOString(),
    };
  }

  async countFormalTodos(query?: FormalTodoListQuery): Promise<{ count: number }> {
    const result = await this.listFormalTodos(query, false);
    return { count: result.total };
  }
}
