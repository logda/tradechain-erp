import { Body, Controller, Inject, Post } from '@nestjs/common';
import { UserManagementService } from '../user-management/user-management.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(UserManagementService)
    private readonly userManagementService: UserManagementService,
  ) {}

  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    return this.userManagementService.authenticate(body);
  }
}
