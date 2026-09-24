import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { FormalActions, FormalAnyModules, FormalRoles, type FormalRole } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { normalizePaginationQuery } from '../common/pagination';
import { UserManagementService } from '../user-management/user-management.service';
import { accessibleCounterpartyOwners, assertCounterpartyCreateAccess, assertCounterpartyUpdateAccess, canViewCounterparty } from './counterparty.access';
import {
  CounterpartyService,
  type CreateCounterpartyPayload,
  type ListCounterpartiesQuery,
  type UpdateCounterpartyPayload,
} from './counterparty.service';

@Controller('counterparties')
@FormalAnyModules('sales', 'purchase')
@FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
@UseGuards(FormalRoleGuard)
export class CounterpartyController {
  constructor(
    @Inject(CounterpartyService)
    private readonly counterpartyService: CounterpartyService,
    @Inject(UserManagementService)
    private readonly userManagementService: UserManagementService,
  ) {}

  private actor(request: { headers: Record<string, string | string[] | undefined> }) {
    const role = request.headers['x-erp-role'] as FormalRole;
    const user = request.headers['x-erp-user'];
    return { role, user: typeof user === 'string' ? user : '' };
  }

  @Get('owners')
  async listOwners(@Req() request: { headers: Record<string, string | string[] | undefined> }) {
    const users = await this.userManagementService.listActiveCounterpartyOwners();
    return { items: accessibleCounterpartyOwners(this.actor(request), users) };
  }

  @Get('custom-fields')
  listCustomFields() {
    return this.counterpartyService.listCustomFields();
  }

  @Post('custom-fields')
  @FormalRoles('admin', 'boss')
  @FormalActions('counterparty.write')
  createCustomField(@Body() body: { name: string; type: string }, @Req() request: { headers: Record<string, string | string[] | undefined> }) {
    return this.counterpartyService.createCustomField({ ...body, createdBy: this.actor(request).user });
  }

  @Delete('custom-fields/:id')
  @FormalRoles('admin', 'boss')
  @FormalActions('counterparty.write')
  deleteCustomField(@Param('id', ParseIntPipe) id: number) {
    return this.counterpartyService.deleteCustomField(id);
  }

  @Get()
  async list(@Query() query: ListCounterpartiesQuery, @Req() request: { headers: Record<string, string | string[] | undefined> }) {
    const users = await this.userManagementService.listActiveCounterpartyOwners();
    return this.counterpartyService.list(normalizePaginationQuery(query), (item) =>
      canViewCounterparty(this.actor(request), item, users));
  }

  @FormalRoles('admin')
  @FormalActions('audit.view')
  @Get('audit-logs')
  listAuditLogs() {
    return this.counterpartyService.listAuditLogs();
  }

  @Post()
  @FormalActions('counterparty.write')
  async create(@Body() body: CreateCounterpartyPayload, @Req() request: { headers: Record<string, string | string[] | undefined> }) {
    const actor = this.actor(request);
    const users = await this.userManagementService.listActiveCounterpartyOwners();
    assertCounterpartyCreateAccess(actor, body.type, body.ownerName, users);
    return this.counterpartyService.create({ ...body, createdBy: actor.user });
  }

  @Patch(':id')
  @FormalActions('counterparty.write')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCounterpartyPayload,
    @Req() request: { headers: Record<string, string | string[] | undefined> },
  ) {
    const existing = await this.counterpartyService.findById(id);
    if (!existing) throw new NotFoundException('往来单位不存在');
    const actor = this.actor(request);
    const users = await this.userManagementService.listActiveCounterpartyOwners();
    assertCounterpartyUpdateAccess(actor, existing, body.type ?? existing.type, body.ownerName ?? existing.ownerName, users);
    return this.counterpartyService.update(id, { ...body, updatedBy: actor.user });
  }

  @Post(':id/deactivate')
  @FormalRoles('admin')
  @FormalActions('master_data.write')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.counterpartyService.deactivate(id, body);
  }

  @Post(':id/activate')
  @FormalRoles('admin')
  @FormalActions('master_data.write')
  activate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.counterpartyService.activate(id, body);
  }
}
