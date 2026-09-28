import type { DemoSession } from './demo-session';

export type FormalTodoDomain = 'sales' | 'purchase' | 'operations' | 'after_sales';

export type FormalTodoItem = {
  id: string;
  docNo: string;
  title: string;
  domain: FormalTodoDomain;
  moduleLabel: string;
  statusLabel: string;
  ownerName: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  relation?: 'action' | 'following';
  nextAction?: string;
  handlerLabel?: string;
  dueDate?: string;
  dueInDays?: number;
  createdAt?: string;
  productNames?: string[];
  customerName?: string;
  supplierName?: string;
  imageUrls?: string[];
  lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
  closeReason?: string;
  visibility?: 'owner_only' | 'purchase_team' | 'purchase_manager_only' | 'finance_only';
};

function isOpenTodo(todo: FormalTodoItem) {
  return todo.lifecycleStatus === undefined || todo.lifecycleStatus === 'open';
}

// The API applies account permissions and data scope before returning these items.
export function getFormalTodos(_session: DemoSession, sourceTodos: FormalTodoItem[] = []) {
  return sourceTodos.filter(isOpenTodo);
}
