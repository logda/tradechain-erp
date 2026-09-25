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
import { quoteListSortFields } from '@erp/shared';
import { FormalActions, FormalAnyActions, FormalModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ListQuotesQueryDto } from './dto/list-quotes-query.dto';
import { UpdateQuoteDraftDto } from './dto/update-quote-draft.dto';
import { QuoteService } from './quote.service';
import { ConvertQuoteToSalesDto } from '../sales-order/dto/convert-quote-to-sales.dto';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { readOptionalFormalSession } from '../auth/formal-session';
import type { CustomerFeedbackResult } from './quote-workflow';

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeQuoteSourceType(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTriStateFilter(value: 'all' | 'yes' | 'no' | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

@Controller('quotes')
@UseGuards(FormalRoleGuard)
@FormalModules('sales')
export class QuoteController {
  constructor(
    @Inject(QuoteService)
    private readonly quoteService: QuoteService,
    @Inject(SalesOrderService)
    private readonly salesOrderService: SalesOrderService,
  ) {}

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @Get()
  list(
    @Query() query: ListQuotesQueryDto,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    const sortBy: (typeof quoteListSortFields)[number] = quoteListSortFields.includes(
      query.sortBy as (typeof quoteListSortFields)[number],
    )
      ? (query.sortBy as (typeof quoteListSortFields)[number])
      : 'createdAt';

    return this.quoteService.list(
      {
      ...query,
      sourceType: normalizeQuoteSourceType(query.sourceType),
      bossConfirmed: normalizeTriStateFilter(query.bossConfirmed),
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

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('audit.view')
  @Get('audit-logs')
  listAuditLogs(
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.quoteService.listAuditLogs(
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.quote.write')
  @Post()
  create(@Body() dto: CreateQuoteDto) {
    return this.quoteService.create(dto);
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @Get(':id')
  getDetail(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.quoteService.getDetail(
      id,
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalAnyActions('sales.order.write', 'boss.confirm')
  @Post(':id/convert-to-sales')
  async convertToSales(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConvertQuoteToSalesDto,
  ) {
    const quote = await this.quoteService.getDetail(id);

    return this.salesOrderService.convertConfirmedQuote({
      quoteOrderId: id,
      quoteVersionNo: dto.quoteVersionNo ?? quote.currentVersionNo,
      customerId: dto.customerId ?? quote.customerId,
      customerName: dto.customerName ?? quote.customerName,
      customerFullName: dto.customerFullName ?? quote.customerFullName ?? undefined,
      customerCode: dto.customerCode ?? quote.customerCode,
      customerEntryMode: dto.customerEntryMode ?? quote.customerEntryMode,
      sourceQuoteNo: dto.sourceQuoteNo ?? quote.quoteNo,
      sourceDocumentType:
        quote.documentType ?? (quote.quoteNo?.startsWith('XQ') ? 'demand' : 'quote'),
      sourceCode: dto.sourceCode ?? quote.sourceCode,
      inquiryDate: dto.inquiryDate ?? quote.inquiryDate,
      destination: dto.destination ?? quote.destination,
      requirements: dto.requirements ?? quote.requirements,
      createdBy: dto.createdBy ?? quote.salesUserId,
      existingSalesOrderId: dto.existingSalesOrderId,
      quoteConfirmed: dto.quoteConfirmed,
      items:
        dto.items ??
        quote.items.map((item) => ({
          ...item,
          productId: item.productId ?? 0,
        })),
      quoteAttachments: dto.quoteAttachments ?? quote.quoteAttachments,
    });
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.quote.write')
  @Post(':id/submit')
  submitDraftQuote(
    @Param('id', ParseIntPipe) id: number,
    @Body() _body: { currentStatus: string },
  ) {
    return this.quoteService.submitDraftQuote(id);
  }

  @FormalRoles('admin', 'boss')
  @FormalActions('boss.confirm')
  @Post(':id/approve-demand')
  approveDemand(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.quoteService.approveDemand(
      id,
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss')
  @FormalActions('boss.confirm')
  @Post(':id/confirm-price')
  confirmPrice(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      currentVersionNo: number;
      items: Array<{ lineNo: number; confirmedSalePrice: number }>;
    },
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.quoteService.confirmQuotePrice(
      id,
      body,
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalAnyActions('sales.quote.write', 'boss.confirm')
  @Post(':id/customer-feedback')
  recordCustomerFeedback(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      currentVersionNo: number;
      result: CustomerFeedbackResult;
      remark?: string;
    },
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.quoteService.recordCustomerFeedback(
      id,
      body,
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @FormalActions('sales.quote.write')
  @Post(':id/draft')
  updateDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuoteDraftDto,
  ) {
    return this.quoteService.updateDraft(id, dto);
  }
}
