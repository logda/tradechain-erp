import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { normalizePaginationQuery } from '../common/pagination';
import {
  StockInService,
  type CreateStockInPayload,
  type StockInListQuery,
} from './stock-in.service';

@Controller('stock-in')
export class StockInController {
  constructor(
    @Inject(StockInService)
    private readonly stockInService: StockInService,
  ) {}

  @Post()
  create(@Body() body: CreateStockInPayload) {
    return this.stockInService.create(body);
  }

  @Get()
  list(@Query() query: StockInListQuery) {
    return this.stockInService.list(normalizePaginationQuery(query));
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.stockInService.detail(id);
  }

  @Post(':id/confirm')
  confirm(@Param('id', ParseIntPipe) id: number) {
    return this.stockInService.confirm(id);
  }
}
