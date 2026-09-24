import {
  Body,
  Controller,
  Headers,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { purchaseOrderListSortFields } from '@erp/shared';
import { FormalActions, FormalModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { CreatePurchaseOrdersFromSalesDto } from './dto/create-purchase-orders-from-sales.dto';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders-query.dto';
import { ResubmitPurchaseOrderDto } from './dto/resubmit-purchase-order.dto';
import { PurchaseOrderService } from './purchase-order.service';
import { readOptionalFormalSession } from '../auth/formal-session';

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeTriStateFilter(value: 'all' | 'yes' | 'no' | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

function parseItemPricePatches(body: Record<string, unknown>) {
  return Object.entries(body)
    .filter(([key]) => key.startsWith('unitPrice:'))
    .map(([key, value]) => ({
      lineNo: Number(key.replace('unitPrice:', '')),
      unitPrice: Number(value),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.lineNo) &&
        item.lineNo > 0 &&
        Number.isFinite(item.unitPrice) &&
        item.unitPrice >= 0,
    );
}

@Controller('purchase-orders')
@UseGuards(FormalRoleGuard)
@FormalModules('purchase')
export class PurchaseOrderController {
  constructor(
    @Inject(PurchaseOrderService)
    private readonly purchaseOrderService: PurchaseOrderService,
  ) {}

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @Get()
  list(
    @Query() query: ListPurchaseOrdersQueryDto,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    const sortBy: (typeof purchaseOrderListSortFields)[number] = purchaseOrderListSortFields.includes(
      query.sortBy as (typeof purchaseOrderListSortFields)[number],
    )
      ? (query.sortBy as (typeof purchaseOrderListSortFields)[number])
      : 'createdAt';

    return this.purchaseOrderService.list(
      {
        ...query,
        page: normalizePositiveInteger(query.page, 1),
        pageSize: normalizePositiveInteger(query.pageSize, 20),
        sortBy,
        sortOrder: query.sortOrder ?? 'desc',
        isResubmitted: normalizeTriStateFilter(query.isResubmitted),
      },
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('audit.view')
  @Get('audit-logs')
  listAuditLogs() {
    return this.purchaseOrderService.listAuditLogs();
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('purchase.order.create')
  @Post('from-sales-order/:salesOrderId')
  createFromSalesOrder(
    @Param('salesOrderId', ParseIntPipe) salesOrderId: number,
    @Body() body: CreatePurchaseOrdersFromSalesDto,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.purchaseOrderService.createFromSalesOrder({
      salesOrderId,
      items: body.items,
      createdBy: body.createdBy,
      salesOrderNo: body.salesOrderNo,
      customerOrderNo: body.customerOrderNo,
      storeName: body.storeName,
      orderDate: body.orderDate,
      factoryEstimatedDeliveryDate: body.factoryEstimatedDeliveryDate,
      shipTo: body.shipTo,
      purchaseOrderAttachments: body.purchaseOrderAttachments,
      ownerName: body.ownerName,
      session: readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @Get('owner-options')
  listOwnerOptions(
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.purchaseOrderService.listAssignablePurchaseOwners(
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @Get(':id')
  getDetail(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.purchaseOrderService.getDetail(
      id,
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('purchase.order.submit')
  @Post(':id/draft')
  saveDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      currentStatus: string;
      ownerName?: string;
      supplierId?: number;
      supplierName?: string;
    } & Record<string, unknown>,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.purchaseOrderService.saveDraft({
      purchaseOrderId: id,
      currentStatus: body.currentStatus,
      ownerName: body.ownerName,
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      itemPricePatches: parseItemPricePatches(body),
      session: readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('purchase.order.submit')
  @Post(':id/submit')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
  ) {
    return this.purchaseOrderService.submit({
      purchaseOrderId: id,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager')
  @FormalActions('purchase.order.approve')
  @Post(':id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
  ) {
    return this.purchaseOrderService.approve({
      purchaseOrderId: id,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager')
  @FormalActions('purchase.order.approve')
  @Post(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
  ) {
    return this.purchaseOrderService.reject({
      purchaseOrderId: id,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('purchase.order.submit')
  @Post(':id/resubmit')
  resubmit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ResubmitPurchaseOrderDto & { currentStatus: string },
  ) {
    return this.purchaseOrderService.resubmit({
      purchaseOrderId: id,
      currentStatus: body.currentStatus,
      hasShipmentBatches: body.hasShipmentBatches,
      sourceSalesOrderId: body.sourceSalesOrderId,
      supplierId: body.supplierId,
      changeReason: body.changeReason,
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('purchase.order.submit')
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { currentStatus: string; hasShipmentBatches: boolean; cancelReason: string },
  ) {
    return this.purchaseOrderService.cancel({
      purchaseOrderId: id,
      currentStatus: body.currentStatus,
      hasShipmentBatches: body.hasShipmentBatches,
      cancelReason: body.cancelReason,
    });
  }
}
