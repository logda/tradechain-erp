import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { FormalActions, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { AuditService } from './audit.service';
import { parseAuditBizId } from './audit-log-query';

const formalRoles = [
  'admin',
  'boss',
  'sales_manager',
  'sales',
  'purchase_manager',
  'purchase',
] as const;

@Controller('audit-logs')
@UseGuards(FormalRoleGuard)
export class AuditController {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @FormalRoles(...formalRoles)
  @FormalActions('audit.view')
  list(@Query('bizType') bizType?: string, @Query('bizId') bizId?: string) {
    return this.auditService.list({ bizType, bizId: parseAuditBizId(bizId) });
  }
}
