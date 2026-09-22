import { Controller, Get, Inject, Query } from '@nestjs/common';
import { normalizePaginationQuery } from '../common/pagination';
import { WarehouseService, type WarehouseListQuery } from './warehouse.service';

@Controller('warehouses')
export class WarehouseController {
  constructor(
    @Inject(WarehouseService)
    private readonly warehouseService: WarehouseService,
  ) {}

  @Get()
  list(@Query() query: WarehouseListQuery) {
    return this.warehouseService.list(normalizePaginationQuery(query));
  }
}
