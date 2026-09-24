import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import { FormalAnyModules, FormalRoles, type FormalRole } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { canViewCounterparty } from '../counterparty/counterparty.access';
import { CounterpartyService } from '../counterparty/counterparty.service';
import { ProductService } from '../product/product.service';
import { UserManagementService } from '../user-management/user-management.service';

function normalizeActiveStatus(value: string | undefined) {
  return value === 'inactive' ? 'inactive' : 'active';
}

function normalizeCounterpartyType(value: string | undefined) {
  return value === 'supplier' || value === 'both' ? value : 'customer';
}

@Controller('formal-lookup')
@UseGuards(FormalRoleGuard)
@FormalAnyModules('sales', 'purchase')
export class FormalLookupController {
  constructor(
    @Inject(ProductService)
    private readonly productService: ProductService,
    @Inject(CounterpartyService)
    private readonly counterpartyService: CounterpartyService,
    @Inject(UserManagementService)
    private readonly userManagementService: UserManagementService,
  ) {}

  @Get('products')
  @FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
  listProducts(@Query('status') status?: string) {
    return this.productService.list({
      status: normalizeActiveStatus(status),
      page: 1,
      pageSize: 1000,
    });
  }

  @Get('counterparties')
  @FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
  async listCounterparties(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Req() request?: { headers: Record<string, string | string[] | undefined> },
  ) {
    const users = await this.userManagementService.listActiveCounterpartyOwners();
    const actor = {
      role: request?.headers['x-erp-role'] as FormalRole,
      user: String(request?.headers['x-erp-user'] ?? ''),
    };
    return this.counterpartyService.list({
      type: normalizeCounterpartyType(type),
      status: normalizeActiveStatus(status),
      page: 1,
      pageSize: 1000,
    }, (item) => canViewCounterparty(actor, item, users));
  }
}
