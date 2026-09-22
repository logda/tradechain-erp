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
  StockOutService,
  type CreateStockOutPayload,
  type StockOutListQuery,
} from './stock-out.service';

@Controller('stock-out')
export class StockOutController {
  constructor(
    @Inject(StockOutService)
    private readonly stockOutService: StockOutService,
  ) {}

  @Post()
  create(@Body() body: CreateStockOutPayload) {
    return this.stockOutService.create(body);
  }

  @Get()
  list(@Query() query: StockOutListQuery) {
    return this.stockOutService.list(normalizePaginationQuery(query));
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.stockOutService.detail(id);
  }

  @Post(':id/confirm')
  confirm(@Param('id', ParseIntPipe) id: number) {
    return this.stockOutService.confirm(id);
  }
}
