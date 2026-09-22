import { Test } from '@nestjs/testing';
import { AuthController } from '../src/auth/auth.controller';
import { UserManagementService } from '../src/user-management/user-management.service';

describe('AuthController', () => {
  it('authenticates a user account by username and password', async () => {
    const authenticate = jest.fn().mockResolvedValue({
      role: 'admin',
      user: 'Admin',
      username: 'admin',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: UserManagementService, useValue: { authenticate } }],
    }).compile();

    const controller = moduleRef.get(AuthController);
    const result = await controller.login({
      username: 'admin',
      password: 'Admin123456',
    });

    expect(authenticate).toHaveBeenCalledWith({
      username: 'admin',
      password: 'Admin123456',
    });
    expect(result.role).toBe('admin');
    expect(result.user).toBe('Admin');
  });
});
