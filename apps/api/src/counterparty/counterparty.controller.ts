import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminOnlyGuard } from '../auth/admin-only.guard';
import { FormalActions, FormalModules } from '../auth/formal-role.decorator';
import { normalizePaginationQuery } from '../common/pagination';
import {
  CounterpartyService,
  type CreateCounterpartyPayload,
  type ListCounterpartiesQuery,
  type UpdateCounterpartyPayload,
} from './counterparty.service';

@Controller('counterparties')
@FormalModules('admin')
@UseGuards(AdminOnlyGuard)
export class CounterpartyController {
  constructor(
    @Inject(CounterpartyService)
    private readonly counterpartyService: CounterpartyService,
  ) {}

  @Get()
  list(@Query() query: ListCounterpartiesQuery) {
    return this.counterpartyService.list(normalizePaginationQuery(query));
  }

  @FormalActions('audit.view')
  @Get('audit-logs')
  listAuditLogs() {
    return this.counterpartyService.listAuditLogs();
  }

  @Post()
  @FormalActions('master_data.write')
  create(@Body() body: CreateCounterpartyPayload) {
    return this.counterpartyService.create(body);
  }

  @Patch(':id')
  @FormalActions('master_data.write')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCounterpartyPayload,
  ) {
    return this.counterpartyService.update(id, body);
  }

  @Post(':id/deactivate')
  @FormalActions('master_data.write')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.counterpartyService.deactivate(id, body);
  }

  @Post(':id/activate')
  @FormalActions('master_data.write')
  activate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.counterpartyService.activate(id, body);
  }
}
