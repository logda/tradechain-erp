import { Body, Controller, Get, Headers, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { UserManagementService } from '../user-management/user-management.service';
import { issueAuthSessionToken, readAuthSessionToken } from './auth-session-token';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(UserManagementService)
    private readonly userManagementService: UserManagementService,
  ) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const session = await this.userManagementService.authenticate(body);
    return { ...session, token: issueAuthSessionToken(session.username) };
  }

  @Get('session')
  async session(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    const username = readAuthSessionToken(token);
    if (!username) throw new UnauthorizedException('登录会话无效或已过期');
    const session = await this.userManagementService.getCurrentSession(username);
    if (!session) throw new UnauthorizedException('登录账号已停用或不存在');
    return session;
  }
}
