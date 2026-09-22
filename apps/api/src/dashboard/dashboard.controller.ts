import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { FormalModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { BossDashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(FormalRoleGuard)
@FormalModules('boss_dashboard')
export class DashboardController {
  constructor(
    @Inject(BossDashboardService)
    private readonly bossDashboardService: BossDashboardService,
  ) {}

  @FormalRoles('admin', 'boss', 'sales_manager', 'purchase_manager')
  @Get('boss')
  getBossDashboard() {
    return this.bossDashboardService.getSummary();
  }
}
