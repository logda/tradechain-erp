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
import { sampleListSortFields } from '@erp/shared';
import { FormalActions, FormalAnyModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { CreateSampleOrderDto } from './dto/create-sample-order.dto';
import { CreateSampleOrderVersionDto } from './dto/create-sample-order-version.dto';
import { ListSampleOrdersQueryDto } from './dto/list-sample-orders-query.dto';
import {
  SampleOrderService,
  type SampleOrderTransitionPayload,
  type SaveSampleOrderDraftPayload,
  type SubmitSampleOrderPayload,
} from './sample-order.service';
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

@Controller('samples')
@UseGuards(FormalRoleGuard)
@FormalAnyModules('sales', 'purchase')
export class SampleOrderController {
  constructor(
    @Inject(SampleOrderService)
    private readonly sampleOrderService: SampleOrderService,
  ) {}

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
  @Get()
  list(
    @Query() query: ListSampleOrdersQueryDto,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    const sortBy: (typeof sampleListSortFields)[number] = sampleListSortFields.includes(
      query.sortBy as (typeof sampleListSortFields)[number],
    )
      ? (query.sortBy as (typeof sampleListSortFields)[number])
      : 'createdAt';

    return this.sampleOrderService.list(
      {
        ...query,
        isReplacement: normalizeTriStateFilter(query.isReplacement),
        isCancelled: normalizeTriStateFilter(query.isCancelled),
        page: normalizePositiveInteger(query.page, 1),
        pageSize: normalizePositiveInteger(query.pageSize, 20),
        sortBy,
        sortOrder: query.sortOrder ?? 'desc',
      },
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
  @FormalActions('audit.view')
  @Get('audit-logs')
  listAuditLogs() {
    return this.sampleOrderService.listAuditLogs();
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
  @Get('source-quotes/:quoteOrderId/summary')
  getSourceQuoteSampleSummary(
    @Param('quoteOrderId', ParseIntPipe) quoteOrderId: number,
  ) {
    return this.sampleOrderService.getSourceQuoteSampleSummary(quoteOrderId);
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.sample.submit')
  @Post()
  create(@Body() body: CreateSampleOrderDto) {
    return this.sampleOrderService.create(body);
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
  @Get(':id')
  getDetail(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.sampleOrderService.getDetail(
      id,
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
  @Get(':id/versions')
  getVersions(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.sampleOrderService.getVersions(
      id,
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.sample.submit')
  @Post(':id/versions')
  createVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateSampleOrderVersionDto,
  ) {
    return this.sampleOrderService.createVersion({
      sampleOrderId: id,
      ...body,
    });
  }

  @FormalRoles('admin', 'purchase_manager', 'purchase')
  @FormalActions('purchase.sample.execute')
  @Post(':id/submit')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Pick<
      SubmitSampleOrderPayload,
      | 'currentStatus'
      | 'sampleRequirements'
      | 'samplingCost'
      | 'sampleQuantity'
      | 'purchaseUnit'
      | 'estimatedCompletionDate'
    >,
  ) {
    return this.sampleOrderService.submit({
      sampleOrderId: id,
      currentStatus: body.currentStatus,
      sampleRequirements: body.sampleRequirements,
      samplingCost: body.samplingCost,
      sampleQuantity: body.sampleQuantity,
      purchaseUnit: body.purchaseUnit,
      estimatedCompletionDate: body.estimatedCompletionDate,
    });
  }

  @FormalRoles('admin', 'purchase_manager', 'purchase')
  @FormalActions('purchase.sample.execute')
  @Post(':id/save-draft')
  saveDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Pick<
      SaveSampleOrderDraftPayload,
      | 'currentStatus'
      | 'sampleRequirements'
      | 'samplingCost'
      | 'sampleQuantity'
      | 'purchaseUnit'
      | 'estimatedCompletionDate'
    >,
  ) {
    return this.sampleOrderService.saveDraft({
      sampleOrderId: id,
      currentStatus: body.currentStatus,
      sampleRequirements: body.sampleRequirements,
      samplingCost: body.samplingCost,
      sampleQuantity: body.sampleQuantity,
      purchaseUnit: body.purchaseUnit,
      estimatedCompletionDate: body.estimatedCompletionDate,
    });
  }

  @FormalRoles('admin', 'boss', 'sales_manager')
  @FormalActions('sales.sample.approve')
  @Post(':id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
  ) {
    return this.sampleOrderService.approve({
      sampleOrderId: id,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'sales_manager')
  @FormalActions('sales.sample.approve')
  @Post(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
  ) {
    return this.sampleOrderService.reject({
      sampleOrderId: id,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'purchase_manager', 'purchase')
  @FormalActions('purchase.sample.execute')
  @Post(':id/start-sampling')
  startSampling(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Pick<
      SampleOrderTransitionPayload,
      | 'currentStatus'
      | 'purchaseUnit'
      | 'estimatedCompletionDate'
    >,
  ) {
    return this.sampleOrderService.startSampling({
      sampleOrderId: id,
      currentStatus: body.currentStatus,
      purchaseUnit: body.purchaseUnit,
      estimatedCompletionDate: body.estimatedCompletionDate,
    });
  }

  @FormalRoles('admin', 'purchase_manager', 'purchase')
  @FormalActions('purchase.sample.execute')
  @Post(':id/mark-sent')
  markSent(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Pick<
      SampleOrderTransitionPayload,
      | 'currentStatus'
      | 'freightForwarder'
      | 'domesticTrackingNo'
      | 'domesticCourierFee'
      | 'internationalCourierFee'
      | 'estimatedArrivalDate'
    >,
  ) {
    return this.sampleOrderService.markSent({
      sampleOrderId: id,
      currentStatus: body.currentStatus,
      freightForwarder: body.freightForwarder,
      domesticTrackingNo: body.domesticTrackingNo,
      domesticCourierFee: body.domesticCourierFee,
      internationalCourierFee: body.internationalCourierFee,
      estimatedArrivalDate: body.estimatedArrivalDate,
    });
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.sample.execute')
  @Post(':id/mark-customer-confirmed')
  markCustomerConfirmed(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string },
  ) {
    return this.sampleOrderService.markCustomerConfirmed({
      sampleOrderId: id,
      currentStatus: body.currentStatus,
    });
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.sample.execute')
  @Post(':id/close-no-followup')
  closeNoFollowup(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { currentStatus: string; closeReason: string },
  ) {
    return this.sampleOrderService.closeNoFollowup({
      sampleOrderId: id,
      currentStatus: body.currentStatus,
      closeReason: body.closeReason,
    });
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.sample.execute')
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      currentStatus: string;
      hasProductionStarted: boolean;
      cancelReason: string;
    },
  ) {
    return this.sampleOrderService.cancel({
      sampleOrderId: id,
      currentStatus: body.currentStatus,
      hasProductionStarted: body.hasProductionStarted,
      cancelReason: body.cancelReason,
    });
  }
}
