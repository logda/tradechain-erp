import {
  Body,
  Controller,
  Headers,
  Get,
  Inject,
  Optional,
  Param,
  ParseIntPipe,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { salesOrderListSortFields } from '@erp/shared';
import { normalizeSalesDocumentSourceMode } from '@erp/shared';
import { FormalActions, FormalModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { CreateDirectSalesOrderDto } from './dto/create-direct-sales-order.dto';
import { ListSalesOrdersQueryDto } from './dto/list-sales-orders-query.dto';
import { ResubmitSalesOrderDto } from './dto/resubmit-sales-order.dto';
import { UpdateSalesOrderDraftDto } from './dto/update-sales-order-draft.dto';
import { SalesOrderService, type SalesOrderLineItem } from './sales-order.service';
import { readOptionalFormalSession } from '../auth/formal-session';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import { ProductService } from '../product/product.service';

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveSalesItemProductId(item: SalesOrderLineItem) {
  if (Number.isFinite(item.confirmedProductId) && item.confirmedProductId! > 0) {
    return item.confirmedProductId!;
  }

  if (Number.isFinite(item.productId) && item.productId > 0) {
    return item.productId;
  }

  return 0;
}

async function buildPurchaseItemsFromSalesOrderItems(
  items: SalesOrderLineItem[] = [],
  productService?: Pick<ProductService, 'resolvePurchaseSupplierForLine'>,
) {
  return Promise.all(items.map(async (item) => {
    const productId = resolveSalesItemProductId(item);
    const productSupplier = await productService?.resolvePurchaseSupplierForLine({
      productId,
      sku: item.sku,
    });
    const resolvedProductId = productSupplier?.productId ?? productId;
    const confirmedSupplierId =
      Number.isFinite(item.confirmedSupplierId) && item.confirmedSupplierId! > 0
        ? item.confirmedSupplierId!
        : undefined;
    const confirmedPurchasePrice =
      Number.isFinite(item.confirmedPurchasePrice) && item.confirmedPurchasePrice! > 0
        ? item.confirmedPurchasePrice!
        : undefined;
    const confirmedSupplierCode =
      typeof item.confirmedSupplierCode === 'string'
        ? item.confirmedSupplierCode.trim()
        : '';
    const confirmedSupplierName =
      typeof item.confirmedSupplierName === 'string'
        ? item.confirmedSupplierName.trim()
        : '';

    return {
      salesItemId: item.lineNo,
      supplierId: confirmedSupplierId ?? productSupplier?.supplierId ?? 0,
      supplierName: confirmedSupplierName || productSupplier?.supplierName,
      purchaseOwnerName: productSupplier?.purchaseOwnerName,
      productId: resolvedProductId,
      sku: item.sku,
      internalCode: confirmedSupplierCode || (productSupplier?.purchaseCode ?? ''),
      productName: item.productName || productSupplier?.productName,
      unit: item.unit || productSupplier?.unit,
      quantity: item.totalQuantity ?? item.quantity,
      packageQuantity: item.packageQuantity,
      unitsPerPackage: item.unitsPerPackage,
      unitPrice: confirmedPurchasePrice ?? productSupplier?.defaultPurchasePrice ?? 0,
      imageUrls: item.factoryPicUrls,
    };
  }));
}

@Controller('sales-orders')
@UseGuards(FormalRoleGuard)
@FormalModules('sales')
export class SalesOrderController {
  constructor(
    @Inject(SalesOrderService)
    private readonly salesOrderService: SalesOrderService,
    @Optional()
    @Inject(PurchaseOrderService)
    private readonly purchaseOrderService?: Pick<
      PurchaseOrderService,
      'createFromSalesOrder' | 'listActiveLinkedPurchaseOrders'
    >,
    @Optional()
    @Inject(ProductService)
    private readonly productService?: Pick<
      ProductService,
      'resolvePurchaseSupplierForLine' | 'getCurrentPurchasePriceForSalesLine'
    >,
  ) {}

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.order.write')
  @Post()
  create(@Body() dto: CreateDirectSalesOrderDto) {
    return this.salesOrderService.create(dto);
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.order.write')
  @Post(':id/draft')
  updateDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSalesOrderDraftDto,
  ) {
    return this.salesOrderService.updateDraft(id, dto);
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @Get()
  list(
    @Query() query: ListSalesOrdersQueryDto,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    const sortBy: (typeof salesOrderListSortFields)[number] = salesOrderListSortFields.includes(
      query.sortBy as (typeof salesOrderListSortFields)[number],
    )
      ? (query.sortBy as (typeof salesOrderListSortFields)[number])
      : 'createdAt';

    return this.salesOrderService.list(
      {
        ...query,
        page: normalizePositiveInteger(query.page, 1),
        pageSize: normalizePositiveInteger(query.pageSize, 20),
        sortBy,
        sortOrder: query.sortOrder ?? 'desc',
        hasAfterSales: query.hasAfterSales ?? 'all',
        sourceMode: normalizeSalesDocumentSourceMode(query.sourceMode),
      },
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('audit.view')
  @Get('audit-logs')
  listAuditLogs() {
    return this.salesOrderService.listAuditLogs();
  }

  @FormalRoles('admin', 'boss', 'sales_manager')
  @FormalActions('sales.order.write')
  @Get(':id/cost-warning')
  async getCostWarning(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    const detail = await this.salesOrderService.getDetail(id, readOptionalFormalSession({
      'x-erp-role': role,
      'x-erp-user': user,
    }));
    if (detail.status !== 'pending_sales_manager_approval') {
      return { productNames: [] };
    }
    if (!this.productService) {
      throw new ServiceUnavailableException('成本核对暂不可用');
    }

    const flagged = await Promise.all((detail.items ?? []).map(async (item) => {
      const purchasePrice = await this.productService!.getCurrentPurchasePriceForSalesLine({
        productId: resolveSalesItemProductId(item),
        sku: item.sku,
      });
      return purchasePrice !== null && Number.isFinite(item.salePrice) && item.salePrice < purchasePrice
        ? item.productName.trim() || item.sku
        : null;
    }));
    return { productNames: flagged.filter((name): name is string => name !== null) };
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @Get(':id')
  async getDetail(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    const detail = await this.salesOrderService.getDetail(
      id,
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
    const linkedPurchaseOrders =
      (await this.purchaseOrderService?.listActiveLinkedPurchaseOrders({
        salesOrderId: detail.id,
        salesOrderNo: detail.salesNo,
      })) ?? [];

    return {
      ...detail,
      linkedPurchaseOrders,
    };
  }

  @FormalRoles('admin', 'boss')
  @FormalActions('finance.confirm')
  @Get(':id/close-validation')
  getCloseValidation(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      shipmentAggregateStatus: string;
      receiptSendStatus: string;
      afterSalesEndStatus: string;
      financeStatus: string;
      receiptStatus: string;
    },
  ) {
    return this.salesOrderService.getCloseValidation({
      salesOrderId: id,
      shipmentAggregateStatus: body.shipmentAggregateStatus,
      receiptSendStatus: body.receiptSendStatus,
      afterSalesEndStatus: body.afterSalesEndStatus,
      financeStatus: body.financeStatus,
      receiptStatus: body.receiptStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.order.write')
  @Post(':id/submit')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
  ) {
    return this.salesOrderService.submit({
      salesOrderId: id,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'sales_manager')
  @FormalActions('sales.order.write')
  @Post(':id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string; createdBy?: number },
  ) {
    return this.approveAndCreatePurchaseOrders(id, body);
  }

  private async approveAndCreatePurchaseOrders(
    id: number,
    body: { currentStatus: string; createdBy?: number },
  ) {
    const result = await this.salesOrderService.approve({
      salesOrderId: id,
      currentStatus: body.currentStatus,
    });

    if (!this.purchaseOrderService || result.status !== 'purchasing') {
      return result;
    }

    const salesOrder = await this.salesOrderService.getDetail(id);
    const salesItems =
      await this.salesOrderService.hydratePurchaseFieldsFromSourceQuote(salesOrder);
    const items = await buildPurchaseItemsFromSalesOrderItems(
      salesItems,
      this.productService,
    );
    const purchaseResult =
      items.length > 0
        ? await this.purchaseOrderService.createFromSalesOrder({
            salesOrderId: id,
            items,
            createdBy: body.createdBy ?? salesOrder.createdBy,
            initialStatus: 'pending_purchase_claim',
            salesOrderNo: salesOrder.salesNo,
            customerOrderNo: salesOrder.customerOrderNo,
            storeName: salesOrder.storeName,
            orderDate: salesOrder.orderDate,
            factoryEstimatedDeliveryDate: salesOrder.estimatedDeliveryDate,
            shipTo: salesOrder.shipTo,
            purchaseOrderAttachments: salesOrder.salesOrderAttachments,
          })
        : { purchaseOrders: [] };

    return {
      ...result,
      purchaseOrders: purchaseResult.purchaseOrders,
    };
  }

  @FormalRoles('admin', 'boss', 'sales_manager')
  @FormalActions('sales.order.write')
  @Post(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
  ) {
    return this.salesOrderService.reject({
      salesOrderId: id,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.order.write')
  @Post(':id/resubmit')
  resubmit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ResubmitSalesOrderDto & { currentStatus: string },
  ) {
    return this.salesOrderService.resubmit({
      salesOrderId: id,
      currentStatus: body.currentStatus,
      changeReason: body.changeReason,
      hasShipmentBatches: body.hasShipmentBatches,
    });
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.order.write')
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      currentStatus: string;
      hasShipmentBatches: boolean;
      unshippedPurchaseOrderIds: number[];
      cancelReason: string;
    },
  ) {
    return this.salesOrderService.cancel({
      salesOrderId: id,
      currentStatus: body.currentStatus,
      hasShipmentBatches: body.hasShipmentBatches,
      unshippedPurchaseOrderIds: body.unshippedPurchaseOrderIds,
      cancelReason: body.cancelReason,
    });
  }

  @FormalRoles('admin', 'boss')
  @FormalActions('finance.confirm')
  @Post(':id/receipt-status')
  updateReceiptStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { receiptStatus: string },
  ) {
    return this.salesOrderService.updateReceiptStatus({
      salesOrderId: id,
      receiptStatus: body.receiptStatus,
    });
  }

  @FormalRoles('admin', 'boss')
  @FormalActions('finance.confirm')
  @Post(':id/finance-confirm')
  confirmFinance(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { receiptStatus: string; financeStatus: string },
  ) {
    return this.salesOrderService.confirmFinance({
      salesOrderId: id,
      receiptStatus: body.receiptStatus,
      financeStatus: body.financeStatus,
    });
  }

  @FormalRoles('admin', 'boss')
  @FormalActions('finance.confirm')
  @Post(':id/close')
  close(@Param('id', ParseIntPipe) id: number, @Body() body: { canClose: boolean }) {
    return this.salesOrderService.close({
      salesOrderId: id,
      canClose: body.canClose,
    });
  }
}
