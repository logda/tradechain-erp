import { Controller, Get, Inject, Query } from '@nestjs/common';
import { normalizePaginationQuery } from '../common/pagination';
import { InventoryService, type InventoryListQuery } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService,
  ) {}

  @Get('balances')
  listBalances(@Query() query: InventoryListQuery) {
    return this.inventoryService.listBalances(normalizePaginationQuery(query));
  }

  @Get('ledger')
  listLedger(@Query() query: InventoryListQuery) {
    return this.inventoryService.listLedger(normalizePaginationQuery(query));
  }
}
