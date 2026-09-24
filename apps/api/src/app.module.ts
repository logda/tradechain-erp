import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AfterSalesController } from './after-sales/after-sales.controller';
import { AfterSalesService } from './after-sales/after-sales.service';
import { AuditController } from './audit/audit.controller';
import { AuditService } from './audit/audit.service';
import { HealthController } from './health/health.controller';
import { InquiryController } from './inquiry/inquiry.controller';
import { InquiryService } from './inquiry/inquiry.service';
import { PurchaseOrderController } from './purchase-order/purchase-order.controller';
import { PurchaseOrderService } from './purchase-order/purchase-order.service';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { FormalLookupController } from './formal-lookup/formal-lookup.controller';
import { QuoteController } from './quote/quote.controller';
import { QuoteMetadataController } from './quote/quote-metadata.controller';
import { QuoteService } from './quote/quote.service';
import { QuoteSourceController } from './quote-source/quote-source.controller';
import { QuoteSourceService } from './quote-source/quote-source.service';
import { ReportController } from './report/report.controller';
import { ReportService } from './report/report.service';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { SampleOrderController } from './sample-order/sample-order.controller';
import { SampleOrderService } from './sample-order/sample-order.service';
import { SalesOrderController } from './sales-order/sales-order.controller';
import { SalesOrderService } from './sales-order/sales-order.service';
import { ShipmentBatchController } from './shipment-batch/shipment-batch.controller';
import { ShipmentBatchService } from './shipment-batch/shipment-batch.service';
import { StockInController } from './stock-in/stock-in.controller';
import { StockInService } from './stock-in/stock-in.service';
import { StockOutController } from './stock-out/stock-out.controller';
import { StockOutService } from './stock-out/stock-out.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { BossDashboardService } from './dashboard/dashboard.service';
import { AuthController } from './auth/auth.controller';
import { AdminOnlyGuard } from './auth/admin-only.guard';
import { FormalRoleGuard } from './auth/formal-role.guard';
import { FileStorageController } from './file-storage/file-storage.controller';
import { FileStorageService } from './file-storage/file-storage.service';
import { DocumentCodeRuleController } from './document-code-rule/document-code-rule.controller';
import { DocumentCodeRuleService } from './document-code-rule/document-code-rule.service';
import { CounterpartyController } from './counterparty/counterparty.controller';
import { CounterpartyService } from './counterparty/counterparty.service';
import { UserManagementController } from './user-management/user-management.controller';
import { UserManagementService } from './user-management/user-management.service';
import { FormalTodoController } from './todo/formal-todo.controller';
import { FormalTodoService } from './todo/formal-todo.service';
import { WarehouseController } from './warehouse/warehouse.controller';
import { WarehouseService } from './warehouse/warehouse.service';
import { PrismaModule } from './storage/prisma.module';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';
import { IdempotencyService } from './idempotency/idempotency.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    AfterSalesController,
    AuditController,
    AuthController,
    CounterpartyController,
    DashboardController,
    FileStorageController,
    HealthController,
    DocumentCodeRuleController,
    InventoryController,
    FormalLookupController,
    QuoteController,
    QuoteMetadataController,
    QuoteSourceController,
    InquiryController,
    ReportController,
    SalesOrderController,
    PurchaseOrderController,
    ProductController,
    SampleOrderController,
    ShipmentBatchController,
    StockInController,
    StockOutController,
    FormalTodoController,
    UserManagementController,
    WarehouseController,
  ],
  providers: [
    IdempotencyService,
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    AfterSalesService,
    AuditService,
    BossDashboardService,
    CounterpartyService,
    FileStorageService,
    DocumentCodeRuleService,
    QuoteService,
    InquiryService,
    ReportService,
    InventoryService,
    SalesOrderService,
    PurchaseOrderService,
    ProductService,
    QuoteSourceService,
    SampleOrderService,
    ShipmentBatchService,
    StockInService,
    StockOutService,
    {
      provide: 'STOCK_OUT_INVENTORY_PORT',
      useExisting: InventoryService,
    },
    FormalTodoService,
    AdminOnlyGuard,
    FormalRoleGuard,
    UserManagementService,
    WarehouseService,
  ],
})
export class AppModule {}
