import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { FormalTodoListQuery, FormalTodoService } from './formal-todo.service';

@Controller('todos')
@UseGuards(FormalRoleGuard)
export class FormalTodoController {
  constructor(
    @Inject(FormalTodoService)
    private readonly formalTodoService: FormalTodoService,
  ) {}

  @FormalRoles(
    'admin',
    'boss',
    'sales_manager',
    'sales',
    'purchase_manager',
    'purchase',
  )
  @Get('formal')
  listFormalTodos(@Query() query: FormalTodoListQuery) {
    return this.formalTodoService.listFormalTodos(query);
  }
}
