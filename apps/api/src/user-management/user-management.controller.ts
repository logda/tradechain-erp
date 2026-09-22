import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminOnlyGuard } from '../auth/admin-only.guard';
import { FormalActions, FormalModules } from '../auth/formal-role.decorator';
import { normalizePaginationQuery } from '../common/pagination';
import {
  UserManagementService,
  type ListUsersQuery,
} from './user-management.service';

@Controller('admin/users')
@FormalModules('admin')
@UseGuards(AdminOnlyGuard)
export class UserManagementController {
  constructor(
    @Inject(UserManagementService)
    private readonly userManagementService: UserManagementService,
  ) {}

  @Get()
  list(@Query() query: ListUsersQuery) {
    return this.userManagementService.list(normalizePaginationQuery(query));
  }

  @Get('audit-logs')
  listAuditLogs() {
    return this.userManagementService.listAuditLogs();
  }

  @Get('role-permissions')
  listRolePermissions() {
    return this.userManagementService.listRolePermissions();
  }

  @Post('role-permissions/:roleCode')
  @FormalActions('admin.role.write')
  updateRolePermission(
    @Param('roleCode') roleCode: string,
    @Body()
    body: {
      modules: string[];
      dataScope: string;
      actions?: string[];
      updatedBy: string;
    },
  ) {
    return this.userManagementService.updateRolePermission(roleCode, body);
  }

  @Post()
  @FormalActions('admin.user.write')
  create(
    @Body()
    body: {
      username: string;
      realName: string;
      password: string;
      roleCode: string;
      createdBy: string;
    },
  ) {
    return this.userManagementService.create(body);
  }

  @Post(':id/deactivate')
  @FormalActions('admin.user.write')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.userManagementService.deactivate(id, body);
  }

  @Post(':id/activate')
  @FormalActions('admin.user.write')
  activate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { operatedBy: string; reason: string },
  ) {
    return this.userManagementService.activate(id, body);
  }

  @Post(':id/role')
  @FormalActions('admin.user.write')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { roleCode: string; operatedBy: string },
  ) {
    return this.userManagementService.updateUserRole(id, body);
  }
}
