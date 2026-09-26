import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AfterSalesService } from '../after-sales/after-sales.service';
import { CounterpartyService } from '../counterparty/counterparty.service';
import { InquiryService } from '../inquiry/inquiry.service';
import { ProductService } from '../product/product.service';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import { QuoteService } from '../quote/quote.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { SampleOrderService } from '../sample-order/sample-order.service';
import { ShipmentBatchService } from '../shipment-batch/shipment-batch.service';
import { UserManagementService } from '../user-management/user-management.service';

type AuditLogProvider = {
  listAuditLogs: () => Promise<{ items: AuditLogItem[] }>;
};

export type AuditLogItem = {
  id: number;
  bizType: string;
  bizId: number;
  operationType: string;
  operatorId: number;
  operatorName?: string;
  beforeData?: unknown;
  afterData?: unknown;
  createdAt: string;
};

export type AggregatedAuditLogItem = AuditLogItem & {
  moduleKey: string;
  moduleLabel: string;
};

export type AuditModuleSummary = {
  key: string;
  label: string;
  count: number;
  failed: boolean;
};

type AuditModuleConfig = {
  key: string;
  label: string;
  provider: AuditLogProvider;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(
    @Inject(QuoteService)
    private readonly quoteService: QuoteService,
    @Inject(InquiryService)
    private readonly inquiryService: InquiryService,
    @Inject(SampleOrderService)
    private readonly sampleOrderService: SampleOrderService,
    @Inject(SalesOrderService)
    private readonly salesOrderService: SalesOrderService,
    @Inject(PurchaseOrderService)
    private readonly purchaseOrderService: PurchaseOrderService,
    @Inject(ShipmentBatchService)
    private readonly shipmentBatchService: ShipmentBatchService,
    @Inject(AfterSalesService)
    private readonly afterSalesService: AfterSalesService,
    @Inject(CounterpartyService)
    private readonly counterpartyService: CounterpartyService,
    @Inject(ProductService)
    private readonly productService: ProductService,
    @Optional()
    @Inject(UserManagementService)
    private readonly userManagementService?: UserManagementService,
  ) {}

  async list() {
    const modules = this.buildModules();
    const operatorNameMap = await this.loadOperatorNameMap();
    const loadedModules = await Promise.all(
      modules.map(async (module) => {
        try {
          const result = await module.provider.listAuditLogs();
          const items = result.items.map((item) => ({
            ...item,
            operatorName: operatorNameMap.get(item.operatorId),
            moduleKey: module.key,
            moduleLabel: module.label,
          }));

          return {
            key: module.key,
            label: module.label,
            failed: false,
            items,
          };
        } catch (error) {
          this.logger.error(`审计模块 ${module.key} 加载失败`, error instanceof Error ? error.stack : String(error));
          return {
            key: module.key,
            label: module.label,
            failed: true,
            items: [],
          };
        }
      }),
    );

    return {
      modules: loadedModules.map((module) => ({
        key: module.key,
        label: module.label,
        count: module.items.length,
        failed: module.failed,
      })),
      items: loadedModules
        .flatMap((module) => module.items)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    };
  }

  private buildModules(): AuditModuleConfig[] {
    return [
      { key: 'quotes', label: '报价 Quote', provider: this.quoteService },
      { key: 'quote-inquiries', label: '询价 Inquiry', provider: this.inquiryService },
      { key: 'samples', label: '样品 Sample', provider: this.sampleOrderService },
      {
        key: 'sales-orders',
        label: '销售单 Sales Order',
        provider: this.salesOrderService,
      },
      {
        key: 'purchase-orders',
        label: '采购单 Purchase Order',
        provider: this.purchaseOrderService,
      },
      {
        key: 'shipment-batches',
        label: '发货批次 Shipment',
        provider: this.shipmentBatchService,
      },
      { key: 'after-sales', label: '售后 After-sales', provider: this.afterSalesService },
      {
        key: 'counterparties',
        label: '往来单位 Counterparty',
        provider: this.counterpartyService,
      },
      { key: 'products', label: '商品 Product', provider: this.productService },
    ];
  }

  private async loadOperatorNameMap() {
    if (!this.userManagementService) {
      return new Map<number, string>();
    }

    try {
      const users = await this.userManagementService.listOperatorDirectory();
      return new Map(
        users.map((user) => [
          user.id,
          user.realName?.trim() || user.username || `操作人 #${user.id}`,
        ]),
      );
    } catch (error) {
      this.logger.error("审计操作人目录加载失败", error instanceof Error ? error.stack : String(error));
      return new Map<number, string>();
    }
  }
}
