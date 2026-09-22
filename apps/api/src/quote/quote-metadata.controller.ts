import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { FormalModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { UserManagementService } from '../user-management/user-management.service';
import { QuoteSourceService } from '../quote-source/quote-source.service';

@Controller('quotes')
@UseGuards(FormalRoleGuard)
@FormalModules('sales')
export class QuoteMetadataController {
  constructor(
    @Inject(UserManagementService)
    private readonly userManagementService: UserManagementService,
    @Inject(QuoteSourceService)
    private readonly quoteSourceService: QuoteSourceService,
  ) {}

  @Get('create-metadata')
  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  async getCreateMetadata() {
    return {
      salesUsers: await this.userManagementService.listAssignableSalesUsers(),
      sourceOptions: this.quoteSourceService.list().items.filter((item) => item.enabled),
    };
  }
}
