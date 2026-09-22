import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { FormalModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { ReportService } from './report.service';

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
  getSalesSummary() {
    return this.reportService.getSalesSummary();
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'purchase_manager')
  @Get('gross-profit')
  getGrossProfitSummary() {
    return this.reportService.getGrossProfitSummary();
  }

  @FormalRoles('admin', 'boss', 'sales_manager', 'purchase_manager')
  @Get('period-summary')
  getPeriodSummary() {
    return this.reportService.getPeriodSummary();
  }
}
