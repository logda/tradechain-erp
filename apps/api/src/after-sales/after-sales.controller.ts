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
import { afterSalesListSortFields } from '@erp/shared';
import { FormalActions, FormalModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { parseAuditBizId } from '../audit/audit-log-query';
import { readOptionalFormalSession } from '../auth/formal-session';
import { CreateAfterSalesOrderDto } from './dto/create-after-sales-order.dto';
import { ListAfterSalesQueryDto } from './dto/list-after-sales-query.dto';
import { AfterSalesService } from './after-sales.service';

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeAfterSalesType(value: string | undefined) {
  if (
    value === 'customer_complaint' ||
    value === 'return' ||
    value === 'refund' ||
    value === 'rework'
  ) {
    return value;
  }

  return undefined;
}

@Controller('after-sales')
@UseGuards(FormalRoleGuard)
@FormalModules('operations')
export class AfterSalesController {
  constructor(
    @Inject(AfterSalesService)
    private readonly afterSalesService: AfterSalesService,
  ) {}

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @Get()
  list(
    @Query() query: ListAfterSalesQueryDto,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
    @Headers('x-erp-user-id') userId?: string,
    @Headers('x-erp-legacy-user-ids') legacyUserIds?: string,
    @Headers('x-erp-data-scope') dataScope?: string,
    @Headers('x-erp-modules') modules?: string,
  ) {
    const sortBy: (typeof afterSalesListSortFields)[number] = afterSalesListSortFields.includes(
      query.sortBy as (typeof afterSalesListSortFields)[number],
    )
      ? (query.sortBy as (typeof afterSalesListSortFields)[number])
      : 'createdAt';

    return this.afterSalesService.list(
      {
        ...query,
        type: normalizeAfterSalesType(query.type),
        page: normalizePositiveInteger(query.page, 1),
        pageSize: normalizePositiveInteger(query.pageSize, 20),
        sortBy,
        sortOrder: query.sortOrder ?? 'desc',
      },
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
        'x-erp-user-id': userId,
        'x-erp-legacy-user-ids': legacyUserIds,
        'x-erp-data-scope': dataScope,
        'x-erp-modules': modules,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('audit.view')
  @Get('audit-logs')
  listAuditLogs(@Query('bizId') bizId?: string) {
    return this.afterSalesService.listAuditLogs(parseAuditBizId(bizId));
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('after_sales.process')
  @Post()
  create(@Body() body: CreateAfterSalesOrderDto, @Headers('x-erp-user-id') userId?: string) {
    return this.afterSalesService.create({ ...body, createdBy: userId ? Number(userId) : body.createdBy });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @Get(':id')
  getDetail(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
    @Headers('x-erp-user-id') userId?: string,
    @Headers('x-erp-legacy-user-ids') legacyUserIds?: string,
    @Headers('x-erp-data-scope') dataScope?: string,
    @Headers('x-erp-modules') modules?: string,
  ) {
    return this.afterSalesService.getDetail(
      id,
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
        'x-erp-user-id': userId,
        'x-erp-legacy-user-ids': legacyUserIds,
        'x-erp-data-scope': dataScope,
        'x-erp-modules': modules,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('after_sales.process')
  @Post(':id/submit')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
    @Headers('x-erp-user-id') userId?: string,
  ) {
    return this.afterSalesService.submit({
      afterSalesOrderId: id,
      operatorId: userId ? Number(userId) : undefined,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager')
  @FormalActions('purchase.order.approve')
  @Post(':id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
    @Headers('x-erp-user-id') userId?: string,
  ) {
    return this.afterSalesService.approve({
      afterSalesOrderId: id,
      operatorId: userId ? Number(userId) : undefined,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager')
  @FormalActions('purchase.order.approve')
  @Post(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string; rejectionReason: string },
    @Headers('x-erp-user-id') userId?: string,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
    @Headers('x-erp-legacy-user-ids') legacyUserIds?: string,
    @Headers('x-erp-data-scope') dataScope?: string,
    @Headers('x-erp-modules') modules?: string,
  ) {
    return this.afterSalesService.reject({
      afterSalesOrderId: id,
      operatorId: userId ? Number(userId) : undefined,
      currentStatus: body.currentStatus,
      rejectionReason: body.rejectionReason,
      session: readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
        'x-erp-user-id': userId,
        'x-erp-legacy-user-ids': legacyUserIds,
        'x-erp-data-scope': dataScope,
        'x-erp-modules': modules,
      }),
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('after_sales.process')
  @Post(':id/start-processing')
  startProcessing(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
    @Headers('x-erp-user-id') userId?: string,
  ) {
    return this.afterSalesService.startProcessing({
      afterSalesOrderId: id,
      operatorId: userId ? Number(userId) : undefined,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('after_sales.process')
  @Post(':id/finish')
  finish(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
    @Headers('x-erp-user-id') userId?: string,
  ) {
    return this.afterSalesService.finish({
      afterSalesOrderId: id,
      operatorId: userId ? Number(userId) : undefined,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'boss')
  @FormalActions('finance.confirm')
  @Post(':id/confirm-finance')
  confirmFinance(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string; financeReviewStatus: string },
    @Headers('x-erp-user-id') userId?: string,
  ) {
    return this.afterSalesService.confirmFinance({
      afterSalesOrderId: id,
      operatorId: userId ? Number(userId) : undefined,
      currentStatus: body.currentStatus,
      financeReviewStatus: body.financeReviewStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalActions('after_sales.process')
  @Post(':id/close')
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string; financeReviewStatus: string },
    @Headers('x-erp-user-id') userId?: string,
  ) {
    return this.afterSalesService.close({
      afterSalesOrderId: id,
      operatorId: userId ? Number(userId) : undefined,
      currentStatus: body.currentStatus,
      financeReviewStatus: body.financeReviewStatus,
    });
  }
}
