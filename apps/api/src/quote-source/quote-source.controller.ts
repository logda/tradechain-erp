import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import { FormalActions, FormalModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import {
  QuoteSourceService,
  type UpdateQuoteSourcesPayload,
} from './quote-source.service';

@Controller('quote-sources')
@UseGuards(FormalRoleGuard)
@FormalModules('sales')
export class QuoteSourceController {
  constructor(
    @Inject(QuoteSourceService)
    private readonly quoteSourceService: QuoteSourceService,
  ) {}

  @Get()
  @FormalRoles('admin', 'boss', 'sales_manager', 'sales')
  list() {
    return this.quoteSourceService.list();
  }

  @Patch()
  @FormalRoles('admin')
  @FormalActions('master_data.write')
  update(@Body() body: UpdateQuoteSourcesPayload) {
    return this.quoteSourceService.update(body);
  }
}
