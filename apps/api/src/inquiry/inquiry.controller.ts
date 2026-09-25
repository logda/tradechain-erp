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
import {
  FormalActions,
  FormalAnyModules,
  FormalModules,
  FormalRoles,
} from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { readOptionalFormalSession } from '../auth/formal-session';
import { InquiryService } from './inquiry.service';
import { ListInquiryQueriesDto } from './dto/list-inquiry-queries.dto';

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeInquiryStatus(value: string | undefined) {
  if (
    value === 'pending_inquiry' ||
    value === 'pending_boss_review' ||
    value === 'boss_confirmed'
  ) {
    return value;
  }

  return 'all';
}

@Controller('quote-inquiries')
@UseGuards(FormalRoleGuard)
export class InquiryController {
  constructor(
    @Inject(InquiryService)
    private readonly inquiryService: InquiryService,
  ) {}

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalModules('purchase')
  @Get()
  list(
    @Query() query: ListInquiryQueriesDto,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.inquiryService.list(
      {
        keyword: query.keyword,
        docNo: query.docNo,
        quoteNo: query.quoteNo,
        status: normalizeInquiryStatus(query.status),
        customerName: query.customerName,
        createdBy: query.createdBy,
        page: normalizePositiveInteger(query.page, 1),
        pageSize: normalizePositiveInteger(query.pageSize, 20),
      },
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
  @FormalAnyModules('purchase', 'sales')
  @FormalActions('audit.view')
  @Get('audit-logs')
  listAuditLogs(
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.inquiryService.listAuditLogs(
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalModules('purchase')
  @Get(':id')
  getById(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.inquiryService.getById(
      id,
      readOptionalFormalSession({
        'x-erp-role': role,
        'x-erp-user': user,
      }),
    );
  }

  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  @FormalModules('purchase')
  @FormalActions('sales.inquiry.submit')
  @Post(':id/submit-for-comparison')
  submitForComparison(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      items: Array<{
        itemId: number;
        supplierQuotes: Array<{
          supplierSourceMode?: 'counterparty' | 'manual';
          supplierId?: number;
          supplierCode?: string;
          supplierName?: string;
          purchasePrice?: number;
          productId?: number;
          productSku?: string;
          productStatus?: 'active' | 'inactive' | 'deleted';
          productSizeCm?: string;
          productMaterial?: string;
          productPackaging?: string;
          productWeightG?: number;
          bulkLeadTimeDays?: string;
          cartonQuantity?: number;
          outerCartonSizeCm?: string;
          outerCartonGrossWeightKg?: number;
          samplingInfo?: string;
          remark?: string;
        }>;
      }>;
    },
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.inquiryService.submitForComparison({
      inquiryId: id,
      items: body.items,
    }, readOptionalFormalSession({
      'x-erp-role': role,
      'x-erp-user': user,
    }));
  }

  @FormalRoles('admin', 'boss')
  @FormalModules('purchase')
  @FormalActions('boss.confirm')
  @Post(':id/boss-reject')
  bossReject(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.inquiryService.rejectByBoss(id, readOptionalFormalSession({
      'x-erp-role': role,
      'x-erp-user': user,
    }));
  }

  @FormalRoles('admin', 'boss')
  @FormalModules('purchase')
  @FormalActions('boss.confirm')
  @Post(':id/boss-confirm')
  bossConfirm(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      items: Array<{
        itemId: number;
        supplierQuoteCount: number;
        confirmedSalePrice: number;
        selectedSupplierQuoteIndex?: number;
      }>;
    },
    @Headers('x-erp-role') role?: string,
    @Headers('x-erp-user') user?: string,
  ) {
    return this.inquiryService.confirmByBoss({
      inquiryId: id,
      items: body.items,
    }, readOptionalFormalSession({
      'x-erp-role': role,
      'x-erp-user': user,
    }));
  }
}
