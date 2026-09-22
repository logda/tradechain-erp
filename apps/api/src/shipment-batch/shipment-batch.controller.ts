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
import { shipmentBatchListSortFields } from '@erp/shared';
import {
  FormalActions,
  FormalAnyModules,
  FormalRoles,
} from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { readOptionalFormalSession } from '../auth/formal-session';
import { CreateShipmentBatchDto } from './dto/create-shipment-batch.dto';
import { ListShipmentBatchesQueryDto } from './dto/list-shipment-batches-query.dto';
import { ShipmentBatchService } from './shipment-batch.service';

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

function resolveFormalUserId(user: string | undefined) {
  if (user === 'Admin') {
    return 9000;
  }

  if (user === 'Zoe') {
    return 2001;
  }

  if (user === 'Leo') {
    return 2002;
  }

  return 2000;
}

@Controller('shipment-batches')
@UseGuards(FormalRoleGuard)
@FormalAnyModules('sales', 'operations')
export class ShipmentBatchController {
  constructor(
    @Inject(ShipmentBatchService)
    private readonly shipmentBatchService: ShipmentBatchService,
  ) {}

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
  @Get()
  list(
    @Query() query: ListShipmentBatchesQueryDto,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    const sortBy: (typeof shipmentBatchListSortFields)[number] = shipmentBatchListSortFields.includes(
      query.sortBy as (typeof shipmentBatchListSortFields)[number],
    )
      ? (query.sortBy as (typeof shipmentBatchListSortFields)[number])
      : 'createdAt';

    return this.shipmentBatchService.list(
      {
        ...query,
        page: normalizePositiveInteger(query.page, 1),
        pageSize: normalizePositiveInteger(query.pageSize, 20),
        sortBy,
        sortOrder: query.sortOrder ?? 'desc',
        hasException: normalizeTriStateFilter(query.hasException),
      },
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @Get('audit-logs')
  listAuditLogs() {
    return this.shipmentBatchService.listAuditLogs();
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('shipment.update')
  @Post()
  create(@Body() body: CreateShipmentBatchDto) {
    return this.shipmentBatchService.create(body);
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
  @Get(':id')
  getDetail(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.shipmentBatchService.getDetail(
      id,
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('shipment.update')
  @Post(':id/mark-to-forwarder')
  markToForwarder(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
    @Headers('x-erp-user') user?: string,
  ) {
    return this.shipmentBatchService.markToForwarder({
      shipmentBatchId: id,
      currentStatus: body.currentStatus,
      operatorId: resolveFormalUserId(user),
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('shipment.update')
  @Post(':id/mark-forwarder-shipped')
  markForwarderShipped(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
    @Headers('x-erp-user') user?: string,
  ) {
    return this.shipmentBatchService.markForwarderShipped({
      shipmentBatchId: id,
      currentStatus: body.currentStatus,
      operatorId: resolveFormalUserId(user),
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('shipment.update')
  @Post(':id/mark-arrived')
  markArrived(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
    @Headers('x-erp-user') user?: string,
  ) {
    return this.shipmentBatchService.markArrived({
      shipmentBatchId: id,
      currentStatus: body.currentStatus,
      operatorId: resolveFormalUserId(user),
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('shipment.update')
  @Post(':id/mark-exception')
  markException(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string; reason: string },
    @Headers('x-erp-user') user?: string,
  ) {
    return this.shipmentBatchService.markException({
      shipmentBatchId: id,
      currentStatus: body.currentStatus,
      reason: body.reason,
      operatorId: resolveFormalUserId(user),
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('shipment.update')
  @Post(':id/upload-receipt')
  uploadReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { receiptDocUrl: string },
    @Headers('x-erp-user') user?: string,
  ) {
    return this.shipmentBatchService.uploadReceipt({
      shipmentBatchId: id,
      receiptDocUrl: body.receiptDocUrl,
      operatorId: resolveFormalUserId(user),
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('shipment.update')
  @Post(':id/send-receipt')
  sendReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { receiptDocUrl: string | null; sentBy: number },
    @Headers('x-erp-user') user?: string,
  ) {
    return this.shipmentBatchService.sendReceipt({
      shipmentBatchId: id,
      receiptDocUrl: body.receiptDocUrl,
      sentBy: body.sentBy,
      operatorId: resolveFormalUserId(user),
    });
  }
}
