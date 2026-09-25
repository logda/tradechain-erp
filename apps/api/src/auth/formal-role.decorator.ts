import { SetMetadata } from '@nestjs/common';

export type FormalRole =
  | 'admin'
  | 'boss'
  | 'sales_manager'
  | 'sales'
  | 'purchase_manager'
  | 'purchase';

export const FORMAL_ROLES_KEY = 'formal_roles';
export const FORMAL_ACTIONS_KEY = 'formal_actions';
export const FORMAL_ANY_ACTIONS_KEY = 'formal_any_actions';
export const FORMAL_MODULES_KEY = 'formal_modules';
export const FORMAL_ANY_MODULES_KEY = 'formal_any_modules';

export function FormalRoles(...roles: FormalRole[]) {
  return SetMetadata(FORMAL_ROLES_KEY, roles);
}

export function FormalActions(...actions: string[]) {
  return SetMetadata(FORMAL_ACTIONS_KEY, actions);
}

export function FormalAnyActions(...actions: string[]) {
  return SetMetadata(FORMAL_ANY_ACTIONS_KEY, actions);
}

export function FormalModules(...modules: string[]) {
  return SetMetadata(FORMAL_MODULES_KEY, modules);
}

export function FormalAnyModules(...modules: string[]) {
  return SetMetadata(FORMAL_ANY_MODULES_KEY, modules);
}
