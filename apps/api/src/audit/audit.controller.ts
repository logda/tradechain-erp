import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { FormalModules, FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { AuditService } from './audit.service';

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
@FormalModules('audit')
export class AuditController {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @FormalRoles(...formalRoles)
  list() {
    return this.auditService.list();
  }
}
