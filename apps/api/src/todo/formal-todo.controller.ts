import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { FormalRoles } from '../auth/formal-role.decorator';
import { FormalRoleGuard } from '../auth/formal-role.guard';
import { readFormalSession } from '../auth/formal-session';
import { FormalTodoService } from './formal-todo.service';

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
  listFormalTodos(@Req() request: { headers: Record<string, string | string[] | undefined> }) {
    return this.formalTodoService.listFormalTodos(readFormalSession(request.headers));
  }
}
