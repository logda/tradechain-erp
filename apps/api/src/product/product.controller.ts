import {
  BadRequestException,
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
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { FormalActions, FormalAnyModules, FormalRoles, type FormalRole } from '../auth/formal-role.decorator';
import { normalizePaginationQuery } from '../common/pagination';
import {
  ProductService,
  type CreateProductPayload,
  type ListProductsQuery,
  type UpdateProductCodeRulePayload,
  type UpdateProductPayload,
} from './product.service';

@Controller('products')
@FormalAnyModules('admin', 'sales', 'purchase')
@FormalRoles('admin', 'boss', 'sales_manager', 'sales', 'purchase_manager', 'purchase')
@UseGuards(FormalRoleGuard)
export class ProductController {
  constructor(
    @Inject(ProductService)
    private readonly productService: ProductService,
  ) {}

  @Get()
  list(@Query() query: ListProductsQuery, @Req() request?: { headers: Record<string, string | string[] | undefined> }) {
    const role = request?.headers['x-erp-role'] as FormalRole | undefined;
    return this.productService.list(normalizePaginationQuery(query), role === 'sales' || role === 'sales_manager' ? 'sales' : 'full');
  }

  @FormalActions('audit.view')
  @FormalRoles('admin')
  @Get('audit-logs')
  listAuditLogs() {
    return this.productService.listAuditLogs();
  }

  @Get('code-rule')
  @FormalRoles('admin', 'boss')
  getCodeRule() {
    return this.productService.getCodeRule();
  }

  @Get('code-rules')
  @FormalRoles('admin', 'boss')
  getCodeRules() {
    return this.productService.getCodeRules();
  }

  @Get('custom-fields')
  @FormalRoles('admin', 'boss', 'purchase_manager', 'purchase')
  listCustomFields() {
    return this.productService.listCustomFields();
  }

  @Post('custom-fields')
  @FormalRoles('admin', 'boss')
  @FormalActions('product.custom_field.write')
  createCustomField(@Body() body: { name: string; type: string }, @Req() request: { headers: Record<string, string | string[] | undefined> }) {
    return this.productService.createCustomField({ ...body, createdBy: String(request.headers['x-erp-user'] ?? '') });
  }

  @Delete('custom-fields/:id')
  @FormalRoles('admin', 'boss')
  @FormalActions('product.custom_field.write')
  deleteCustomField(@Param('id', ParseIntPipe) id: number) {
    return this.productService.deleteCustomField(id);
  }

  @Post()
  @FormalRoles('admin')
  @FormalActions('master_data.write')
  create(@Body() body: CreateProductPayload) {
    if (body.productStage !== 'quote_candidate' && body.productStage !== 'formal') {
      throw new BadRequestException('请选择产品阶段');
    }
    return this.productService.create(body);
  }

  @Patch('code-rule')
  @FormalRoles('admin')
  @FormalActions('master_data.write')
  updateCodeRule(@Body() body: UpdateProductCodeRulePayload) {
    return this.productService.updateCodeRule(body);
  }

  @Patch('code-rules/:kind')
  @FormalRoles('admin')
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
  @FormalRoles('admin')
  @FormalActions('master_data.write')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateProductPayload) {
    return this.productService.update(id, body);
  }

  @Post(':id/deactivate')
  @FormalRoles('admin')
  @FormalActions('master_data.write')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.productService.deactivate(id, body);
  }

  @Post(':id/activate')
  @FormalRoles('admin')
  @FormalActions('master_data.write')
  activate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.productService.activate(id, body);
  }

  @Post(':id/delete')
  @FormalRoles('admin')
  @FormalActions('master_data.write')
  deleteProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.productService.deleteProduct(id, body);
  }

  @Post(':id/convert-to-formal')
  @FormalRoles('admin')
  @FormalActions('master_data.write')
  convertToFormal(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string },
  ) {
    return this.productService.convertToFormal(id, body);
  }
}
