import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import {
  FORMAL_ACTIONS_KEY,
  FORMAL_ANY_MODULES_KEY,
  FORMAL_MODULES_KEY,
  FORMAL_ROLES_KEY,
  type FormalRole,
} from '../src/auth/formal-role.decorator';
import { AdminOnlyGuard } from '../src/auth/admin-only.guard';
import { FormalRoleGuard } from '../src/auth/formal-role.guard';
import { CounterpartyController } from '../src/counterparty/counterparty.controller';
import { AfterSalesController } from '../src/after-sales/after-sales.controller';
import { AuditController } from '../src/audit/audit.controller';
import { DashboardController } from '../src/dashboard/dashboard.controller';
import { InquiryController } from '../src/inquiry/inquiry.controller';
import { ProductController } from '../src/product/product.controller';
import { PurchaseOrderController } from '../src/purchase-order/purchase-order.controller';
import { QuoteController } from '../src/quote/quote.controller';
import { ReportController } from '../src/report/report.controller';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import { SampleOrderController } from '../src/sample-order/sample-order.controller';
import { ShipmentBatchController } from '../src/shipment-batch/shipment-batch.controller';
import { FormalTodoController } from '../src/todo/formal-todo.controller';
import { UserManagementController } from '../src/user-management/user-management.controller';

function getClassGuards(controller: Function) {
  return Reflect.getMetadata(GUARDS_METADATA, controller) as unknown[] | undefined;
}

function getMethodRoles(controller: Function, methodName: string) {
  return Reflect.getMetadata(
    FORMAL_ROLES_KEY,
    controller.prototype[methodName],
  ) as FormalRole[] | undefined;
}

function getMethodActions(controller: Function, methodName: string) {
  return Reflect.getMetadata(
    FORMAL_ACTIONS_KEY,
    controller.prototype[methodName],
  ) as string[] | undefined;
}

function getClassModules(controller: Function) {
  return Reflect.getMetadata(FORMAL_MODULES_KEY, controller) as string[] | undefined;
}

function getClassAnyModules(controller: Function) {
  return Reflect.getMetadata(FORMAL_ANY_MODULES_KEY, controller) as string[] | undefined;
}

function getMethodModules(controller: Function, methodName: string) {
  return Reflect.getMetadata(
    FORMAL_MODULES_KEY,
    controller.prototype[methodName],
  ) as string[] | undefined;
}

function getMethodAnyModules(controller: Function, methodName: string) {
  return Reflect.getMetadata(
    FORMAL_ANY_MODULES_KEY,
    controller.prototype[methodName],
  ) as string[] | undefined;
}

function getRouteMethodNames(controller: Function) {
  return Object.getOwnPropertyNames(controller.prototype).filter(
    (name) => name !== 'constructor' && typeof controller.prototype[name] === 'function',
  );
}

function isMutatingRoute(controller: Function, methodName: string) {
  const method = Reflect.getMetadata(
    METHOD_METADATA,
    controller.prototype[methodName],
  ) as RequestMethod | undefined;

  return (
    method === RequestMethod.POST ||
    method === RequestMethod.PATCH ||
    method === RequestMethod.PUT ||
    method === RequestMethod.DELETE
  );
}

function isControllerRoute(controller: Function, methodName: string) {
  return (
    Reflect.getMetadata(METHOD_METADATA, controller.prototype[methodName]) !==
    undefined
  );
}

describe('formal role controller metadata', () => {
  it('protects every non-public formal controller with a route guard', () => {
    [
      QuoteController,
      InquiryController,
      SalesOrderController,
      PurchaseOrderController,
      SampleOrderController,
      ShipmentBatchController,
      AfterSalesController,
      AuditController,
      DashboardController,
      ReportController,
      FormalTodoController,
    ].forEach((controller) => {
      expect(getClassGuards(controller)).toEqual(
        expect.arrayContaining([FormalRoleGuard]),
      );
    });

    [ProductController, CounterpartyController, UserManagementController].forEach(
      (controller) => {
        expect(getClassGuards(controller)).toEqual(
          expect.arrayContaining([AdminOnlyGuard]),
        );
      },
    );
  });

  it('declares dynamic module permissions on formal business controllers', () => {
    [
      QuoteController,
      SalesOrderController,
    ].forEach((controller) => {
      expect(getClassModules(controller)).toEqual(['sales']);
    });

    expect(getClassAnyModules(SampleOrderController)).toEqual([
      'sales',
      'purchase',
    ]);
    expect(getClassModules(InquiryController)).toBeUndefined();
    expect(getMethodModules(InquiryController, 'list')).toEqual(['purchase']);
    expect(getMethodModules(InquiryController, 'getById')).toEqual(['purchase']);
    expect(getMethodAnyModules(InquiryController, 'listAuditLogs')).toEqual([
      'purchase',
      'sales',
    ]);
    expect(getClassModules(PurchaseOrderController)).toEqual(['purchase']);
    expect(getClassModules(ShipmentBatchController)).toBeUndefined();
    expect(getClassAnyModules(ShipmentBatchController)).toEqual([
      'sales',
      'operations',
    ]);
    expect(getClassModules(AfterSalesController)).toEqual(['operations']);
    expect(getClassModules(AuditController)).toBeUndefined();
    expect(getClassModules(DashboardController)).toEqual(['boss_dashboard']);
    expect(getClassModules(ReportController)).toEqual(['boss_dashboard']);
  });

  it('declares dynamic module permissions on admin-only controllers', () => {
    [ProductController, CounterpartyController, UserManagementController].forEach(
      (controller) => {
        expect(getClassModules(controller)).toEqual(['admin']);
      },
    );
  });

  it('uses the formal role guard on core business controllers', () => {
    [
      QuoteController,
      InquiryController,
      SalesOrderController,
      PurchaseOrderController,
      SampleOrderController,
      ShipmentBatchController,
      AfterSalesController,
      AuditController,
    ].forEach((controller) => {
      expect(getClassGuards(controller)).toEqual(
        expect.arrayContaining([FormalRoleGuard]),
      );
    });
  });

  it('restricts sales-domain mutation actions to sales-domain roles', () => {
    expect(getMethodRoles(QuoteController, 'create')).toEqual([
      'admin',
      'boss',
      'sales_manager',
      'sales',
    ]);
    expect(getMethodActions(QuoteController, 'create')).toEqual([
      'sales.quote.write',
    ]);
    expect(getMethodRoles(QuoteController, 'getDetail')).toEqual([
      'admin',
      'boss',
      'sales_manager',
      'sales',
    ]);
    expect(getMethodRoles(QuoteController, 'approveDemand')).toEqual([
      'admin',
      'boss',
    ]);
    expect(getMethodActions(QuoteController, 'approveDemand')).toEqual([
      'boss.confirm',
    ]);
    expect(getMethodRoles(QuoteController, 'confirmPrice')).toEqual([
      'admin',
      'boss',
    ]);
    expect(getMethodActions(QuoteController, 'confirmPrice')).toEqual([
      'boss.confirm',
    ]);
    expect(getMethodRoles(SalesOrderController, 'approve')).toEqual([
      'admin',
      'boss',
      'sales_manager',
    ]);
    expect(getMethodActions(SalesOrderController, 'approve')).toEqual([
      'sales.order.write',
    ]);
    expect(getMethodRoles(SalesOrderController, 'getCloseValidation')).toEqual([
      'admin',
      'boss',
    ]);
    expect(getMethodActions(SalesOrderController, 'getCloseValidation')).toEqual([
      'finance.confirm',
    ]);
    expect(getMethodRoles(SampleOrderController, 'approve')).toEqual([
      'admin',
      'boss',
      'sales_manager',
    ]);
    expect(getMethodActions(SampleOrderController, 'approve')).toEqual([
      'sales.sample.approve',
    ]);
  });

  it('restricts purchase-domain mutation actions to purchase-domain roles', () => {
    expect(getMethodRoles(InquiryController, 'list')).toEqual([
      'admin',
      'boss',
      'purchase_manager',
      'purchase',
    ]);
    expect(getMethodRoles(InquiryController, 'submitForComparison')).toEqual([
      'admin',
      'boss',
      'purchase_manager',
      'purchase',
    ]);
    expect(getMethodActions(InquiryController, 'submitForComparison')).toEqual([
      'sales.inquiry.submit',
    ]);
    expect(getMethodRoles(InquiryController, 'bossConfirm')).toEqual([
      'admin',
      'boss',
    ]);
    expect(getMethodActions(InquiryController, 'bossConfirm')).toEqual([
      'boss.confirm',
    ]);
    expect(getMethodRoles(PurchaseOrderController, 'approve')).toEqual([
      'admin',
      'boss',
      'purchase_manager',
    ]);
    expect(getMethodActions(PurchaseOrderController, 'approve')).toEqual([
      'purchase.order.approve',
    ]);
    expect(getMethodRoles(ShipmentBatchController, 'create')).toEqual([
      'admin',
      'boss',
      'purchase_manager',
      'purchase',
    ]);
    expect(getMethodActions(ShipmentBatchController, 'create')).toEqual([
      'shipment.update',
    ]);
    expect(getMethodRoles(AfterSalesController, 'confirmFinance')).toEqual([
      'admin',
      'boss',
    ]);
    expect(getMethodActions(AfterSalesController, 'confirmFinance')).toEqual([
      'finance.confirm',
    ]);
    expect(getMethodRoles(SampleOrderController, 'getDetail')).toEqual([
      'admin',
      'boss',
      'sales_manager',
      'sales',
      'purchase_manager',
      'purchase',
    ]);
    expect(getMethodRoles(ShipmentBatchController, 'getDetail')).toEqual([
      'admin',
      'boss',
      'sales_manager',
      'sales',
      'purchase_manager',
      'purchase',
    ]);
    expect(getMethodRoles(AfterSalesController, 'getDetail')).toEqual([
      'admin',
      'boss',
      'purchase_manager',
      'purchase',
    ]);
  });

  it('requires explicit formal actions on every mutating controller route', () => {
    const controllers = [
      QuoteController,
      InquiryController,
      SalesOrderController,
      PurchaseOrderController,
      SampleOrderController,
      ShipmentBatchController,
      AfterSalesController,
      ProductController,
      CounterpartyController,
      UserManagementController,
    ];

    controllers.forEach((controller) => {
      getRouteMethodNames(controller)
        .filter((methodName) => isMutatingRoute(controller, methodName))
        .forEach((methodName) => {
          expect(getMethodActions(controller, methodName)).toEqual(
            expect.arrayContaining([expect.any(String)]),
          );
        });
    });
  });

  it('requires explicit formal roles on every formal controller route', () => {
    const controllers = [
      QuoteController,
      InquiryController,
      SalesOrderController,
      PurchaseOrderController,
      SampleOrderController,
      ShipmentBatchController,
      AfterSalesController,
      AuditController,
      DashboardController,
      ReportController,
      FormalTodoController,
    ];

    controllers.forEach((controller) => {
      getRouteMethodNames(controller)
        .filter((methodName) => isControllerRoute(controller, methodName))
        .forEach((methodName) => {
          expect(getMethodRoles(controller, methodName)).toEqual(
            expect.arrayContaining([expect.any(String)]),
          );
        });
    });
  });
});
