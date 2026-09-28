import { Controller, Get, Headers, Inject, Query, UseGuards } from '@nestjs/common';
import { FormalModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { ReportService } from './report.service';
import { readOptionalFormalSession } from '../auth/formal-session';

@Controller('reports')
@UseGuards(FormalRoleGuard)
@FormalModules('boss_dashboard')
export class ReportController {
  constructor(
    @Inject(ReportService)
    private readonly reportService: ReportService,
  ) {}

  @FormalModules('sales')
  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  @Get('sales-summary')
  getSalesSummary(@Headers() headers: Record<string, string | string[] | undefined> = {}) {
    return this.reportService.getSalesSummary(readOptionalFormalSession(headers));
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'purchase_manager')
  @Get('gross-profit')
  getGrossProfitSummary(@Headers() headers: Record<string, string | string[] | undefined> = {}) {
    return this.reportService.getGrossProfitSummary(readOptionalFormalSession(headers));
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'purchase_manager')
  @Get('period-summary')
  getPeriodSummary(@Headers() headers: Record<string, string | string[] | undefined> = {}, @Query('period') period?: string) {
    return this.reportService.getPeriodSummary(readOptionalFormalSession(headers), period);
  }
}
