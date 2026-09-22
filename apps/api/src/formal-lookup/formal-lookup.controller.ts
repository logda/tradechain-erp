import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { FormalAnyModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { CounterpartyService } from '../counterparty/counterparty.service';
import { ProductService } from '../product/product.service';

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
  listCounterparties(
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.counterpartyService.list({
      type: normalizeCounterpartyType(type),
      status: normalizeActiveStatus(status),
      page: 1,
      pageSize: 1000,
    });
  }
}
