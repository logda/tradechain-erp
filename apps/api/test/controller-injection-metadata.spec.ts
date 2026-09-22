import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { AfterSalesController } from '../src/after-sales/after-sales.controller';
import { AfterSalesService } from '../src/after-sales/after-sales.service';
import { AuditController } from '../src/audit/audit.controller';
import { AuditService } from '../src/audit/audit.service';
import { AuthController } from '../src/auth/auth.controller';
import { BossDashboardService } from '../src/dashboard/dashboard.service';
import { DashboardController } from '../src/dashboard/dashboard.controller';
import { InquiryController } from '../src/inquiry/inquiry.controller';
import { InquiryService } from '../src/inquiry/inquiry.service';
import { ProductService } from '../src/product/product.service';
import { PurchaseOrderController } from '../src/purchase-order/purchase-order.controller';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import { QuoteController } from '../src/quote/quote.controller';
import { QuoteService } from '../src/quote/quote.service';
import { ReportController } from '../src/report/report.controller';
import { ReportService } from '../src/report/report.service';
import { SampleOrderController } from '../src/sample-order/sample-order.controller';
import { SampleOrderService } from '../src/sample-order/sample-order.service';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { ShipmentBatchController } from '../src/shipment-batch/shipment-batch.controller';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';
import { UserManagementController } from '../src/user-management/user-management.controller';
import { UserManagementService } from '../src/user-management/user-management.service';

type ControllerClass = new (...args: never[]) => unknown;

function getExplicitDependencyTokens(controller: ControllerClass) {
  return (
    Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, controller) as
      | Array<{ index: number; param: unknown }>
      | undefined
  )?.sort((left, right) => left.index - right.index);
}

describe('controller dependency injection metadata', () => {
  it.each([
    [AfterSalesController, [AfterSalesService]],
    [AuditController, [AuditService]],
    [AuthController, [UserManagementService]],
    [DashboardController, [BossDashboardService]],
    [InquiryController, [InquiryService]],
    [PurchaseOrderController, [PurchaseOrderService]],
    [QuoteController, [QuoteService, SalesOrderService]],
    [ReportController, [ReportService]],
    [SampleOrderController, [SampleOrderService]],
    [SalesOrderController, [SalesOrderService, PurchaseOrderService, ProductService]],
    [ShipmentBatchController, [ShipmentBatchService]],
    [UserManagementController, [UserManagementService]],
  ])('declares explicit providers for %p', (controller, providers) => {
    expect(getExplicitDependencyTokens(controller as ControllerClass)).toEqual(
      providers.map((provider, index) => ({ index, param: provider })),
    );
  });
});
