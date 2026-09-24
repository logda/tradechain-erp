import { FORMAL_ACTIONS_KEY } from '../src/auth/formal-role.decorator';
import { AuditController } from '../src/audit/audit.controller';
import { QuoteController } from '../src/quote/quote.controller';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import { InquiryController } from '../src/inquiry/inquiry.controller';
import { SampleOrderController } from '../src/sample-order/sample-order.controller';
import { PurchaseOrderController } from '../src/purchase-order/purchase-order.controller';
import { ShipmentBatchController } from '../src/shipment-batch/shipment-batch.controller';
import { AfterSalesController } from '../src/after-sales/after-sales.controller';
import { CounterpartyController } from '../src/counterparty/counterparty.controller';
import { ProductController } from '../src/product/product.controller';
import { UserManagementController } from '../src/user-management/user-management.controller';

const auditRoutes = [
    [AuditController, 'list'],
    [QuoteController, 'listAuditLogs'],
    [SalesOrderController, 'listAuditLogs'],
    [InquiryController, 'listAuditLogs'],
    [SampleOrderController, 'listAuditLogs'],
    [PurchaseOrderController, 'listAuditLogs'],
    [ShipmentBatchController, 'listAuditLogs'],
    [AfterSalesController, 'listAuditLogs'],
    [CounterpartyController, 'listAuditLogs'],
    [ProductController, 'listAuditLogs'],
    [UserManagementController, 'listAuditLogs'],
] as const;

describe('审计接口权限', () => {
  it.each(auditRoutes.map(([controller, method]) => ({ controller, method, name: controller.name })))('$name.$method requires audit.view', ({ controller, method }) => {
    const handler = (controller.prototype as unknown as Record<string, object>)[method];
    expect(Reflect.getMetadata(FORMAL_ACTIONS_KEY, handler)).toContain('audit.view');
  });
});
