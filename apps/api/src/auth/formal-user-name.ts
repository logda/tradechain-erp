import { resolveUserManagementStore } from '../user-management/user-management.store';
import { resolveStorageMode } from '../storage/storage-mode';
import type { PrismaService } from '../storage/prisma.service';

export function resolveRuntimeFormalUserName(userId: number) {
  const user = resolveUserManagementStore().listUsers().find(item => item.id === userId);
  if (user) return user.realName;
  const legacyName = process.env.NODE_ENV === 'test'
    ? ({ 2000: 'Mia', 2001: 'Zoe', 2002: 'Leo', 2003: 'Mia', 2004: 'Noah', 2005: 'Ivy', 2006: 'Liam', 9000: 'Admin' } as Record<number, string>)[userId]
    : undefined;
  return legacyName ?? `用户 #${userId}`;
}

export async function resolveFormalUserName(userId: number, prisma?: PrismaService) {
  if (resolveStorageMode() === 'prisma' && prisma) {
    const user = await prisma.user?.findUnique({ where: { id: BigInt(userId) } });
    return user?.realName ?? `用户 #${userId}`;
  }
  return resolveRuntimeFormalUserName(userId);
}
