import {
  BadRequestException,
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
  ProductService,
  type CreateProductPayload,
  type ListProductsQuery,
  type UpdateProductCodeRulePayload,
  type UpdateProductPayload,
} from './product.service';

@Controller('products')
@FormalModules('admin')
@UseGuards(AdminOnlyGuard)
export class ProductController {
  constructor(
    @Inject(ProductService)
    private readonly productService: ProductService,
  ) {}

  @Get()
  list(@Query() query: ListProductsQuery) {
    return this.productService.list(normalizePaginationQuery(query));
  }

  @FormalActions('audit.view')
  @Get('audit-logs')
  listAuditLogs() {
    return this.productService.listAuditLogs();
  }

  @Get('code-rule')
  getCodeRule() {
    return this.productService.getCodeRule();
  }

  @Get('code-rules')
  getCodeRules() {
    return this.productService.getCodeRules();
  }

  @Post()
  @FormalActions('master_data.write')
  create(@Body() body: CreateProductPayload) {
    return this.productService.create(body);
  }

  @Patch('code-rule')
  @FormalActions('master_data.write')
  updateCodeRule(@Body() body: UpdateProductCodeRulePayload) {
    return this.productService.updateCodeRule(body);
  }

  @Patch('code-rules/:kind')
  @FormalActions('master_data.write')
  updateCodeRuleByKind(
    @Param('kind') kind: string,
    @Body() body: UpdateProductCodeRulePayload,
  ) {
    if (kind !== 'purchase' && kind !== 'sales') {
      throw new BadRequestException('产品编码规则类型不合法');
    }
    return this.productService.updateCodeRuleByKind(kind, body);
  }

  @Patch(':id')
  @FormalActions('master_data.write')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateProductPayload) {
    return this.productService.update(id, body);
  }

  @Post(':id/deactivate')
  @FormalActions('master_data.write')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.productService.deactivate(id, body);
  }

  @Post(':id/activate')
  @FormalActions('master_data.write')
  activate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.productService.activate(id, body);
  }

  @Post(':id/delete')
  @FormalActions('master_data.write')
  deleteProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.productService.deleteProduct(id, body);
  }

  @Post(':id/convert-to-formal')
  @FormalActions('master_data.write')
  convertToFormal(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string },
  ) {
    return this.productService.convertToFormal(id, body);
  }
}
