import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import {
  FORMAL_MODULES_KEY,
  FORMAL_ROLES_KEY,
  type FormalRole,
} from '../src/auth/formal-role.decorator';
import { FormalRoleGuard } from '../src/auth/formal-role.guard';
import { ReportController } from '../src/report/report.controller';
import { ReportService } from '../src/report/report.service';

describe('ReportController', () => {
  it('protects management reports with formal boss roles', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ReportController)).toEqual(
      expect.arrayContaining([FormalRoleGuard]),
    );
    expect(
      Reflect.getMetadata(
        FORMAL_ROLES_KEY,
        ReportController.prototype.getSalesSummary,
      ) as FormalRole[] | undefined,
    ).toEqual(['admin', 'boss', 'sales_manager', 'sales']);
    expect(
      Reflect.getMetadata(
        FORMAL_MODULES_KEY,
        ReportController.prototype.getSalesSummary,
      ),
    ).toEqual(['sales']);
    (
      ['getGrossProfitSummary', 'getPeriodSummary'] as const
    ).forEach((methodName) => {
      expect(
        Reflect.getMetadata(
          FORMAL_ROLES_KEY,
          ReportController.prototype[methodName],
        ) as FormalRole[] | undefined,
      ).toEqual(['admin', 'boss', 'sales_manager', 'purchase_manager']);
    });
  });

  it('exposes sales summary, gross profit, and period summary endpoints', async () => {
    const getSalesSummary = jest
      .fn()
      .mockResolvedValue({ totals: { salesOrderCount: 12 } });
    const getGrossProfitSummary = jest
      .fn()
      .mockResolvedValue({ grossProfit: 242000 });
    const getPeriodSummary = jest
      .fn()
      .mockResolvedValue({ reopenedApprovals: 2 });
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        {
          provide: ReportService,
          useValue: {
            getSalesSummary,
            getGrossProfitSummary,
            getPeriodSummary,
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(ReportController);

    expect((await controller.getSalesSummary()).totals.salesOrderCount).toBe(12);
    expect((await controller.getGrossProfitSummary()).grossProfit).toBe(242000);
    expect((await controller.getPeriodSummary()).reopenedApprovals).toBe(2);
  });
});
