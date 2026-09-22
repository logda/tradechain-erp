import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import {
  FORMAL_MODULES_KEY,
  FORMAL_ROLES_KEY,
  type FormalRole,
} from '../src/auth/formal-role.decorator';
import { FormalRoleGuard } from '../src/auth/formal-role.guard';
import { DashboardController } from '../src/dashboard/dashboard.controller';
import { BossDashboardService } from '../src/dashboard/dashboard.service';

describe('DashboardController', () => {
  it('protects the boss dashboard with formal boss roles', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, DashboardController)).toEqual(
      expect.arrayContaining([FormalRoleGuard]),
    );
    expect(
      Reflect.getMetadata(
        FORMAL_ROLES_KEY,
        DashboardController.prototype.getBossDashboard,
      ) as FormalRole[] | undefined,
    ).toEqual(['admin', 'boss', 'sales_manager', 'purchase_manager']);
    expect(
      Reflect.getMetadata(
        FORMAL_MODULES_KEY,
        DashboardController,
      ),
    ).toEqual(['boss_dashboard']);
  });

  it('returns the boss summary read model', async () => {
    const getSummary = jest.fn().mockResolvedValue({
      workflowAlerts: [],
      salesOverview: { totalOrders: 12 },
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: BossDashboardService, useValue: { getSummary } }],
    }).compile();

    const controller = moduleRef.get(DashboardController);
    const result = await controller.getBossDashboard();

    expect(getSummary).toHaveBeenCalled();
    expect(result.salesOverview.totalOrders).toBe(12);
  });
});
