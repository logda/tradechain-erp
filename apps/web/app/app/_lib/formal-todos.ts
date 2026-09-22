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
  lifecycleStatus?: 'open' | 'auto_closed' | 'voided';
  closeReason?: string;
  visibility?: 'owner_only';
};

const formalTodos: FormalTodoItem[] = [
  {
    id: 'quote-boss-confirm-2',
    docNo: 'Q202607080002',
    title: '报价待老板确认',
    domain: 'sales',
    moduleLabel: '报价',
    statusLabel: '待老板确认',
    ownerName: 'Zoe',
    href: '/app/sales/quotes/2',
    priority: 'high',
    description: '客户报价已完成销售侧提交，需要老板确认价格与利润口径。',
  },
  {
    id: 'sales-follow-arrival-1',
    docNo: 'S202607080001',
    title: '销售单部分发货待跟进',
    domain: 'sales',
    moduleLabel: '销售单',
    statusLabel: '部分货代发出',
    ownerName: 'Zoe',
    href: '/app/sales/orders/1',
    priority: 'medium',
    description: '已部分交付货代，需要销售继续跟进到港、回单和客户沟通。',
    visibility: 'owner_only',
  },
  {
    id: 'sales-manager-approval-2',
    docNo: 'S202607080002',
    title: '销售单待主管审批',
    domain: 'sales',
    moduleLabel: '销售单',
    statusLabel: '待销售主管审批',
    ownerName: 'Mia',
    href: '/app/sales/orders/2',
    priority: 'high',
    description: '直建销售单已提交，需要销售主管确认客户、金额和采购触发口径。',
  },
  {
    id: 'purchase-approval-2',
    docNo: 'P202607080002',
    title: '采购单待主管审批',
    domain: 'purchase',
    moduleLabel: '采购单',
    statusLabel: '待采购主管审批',
    ownerName: 'Leo',
    href: '/app/purchase-orders/2',
    priority: 'high',
    description: '销售单拆出的采购需求已生成，需采购主管审批后进入采购执行。',
  },
  {
    id: 'shipment-exception-2',
    docNo: 'SH202607080002',
    title: '发货批次异常待处理',
    domain: 'operations',
    moduleLabel: '发货批次',
    statusLabel: '异常待处理',
    ownerName: 'Leo',
    href: '/app/shipment-batches/2',
    priority: 'high',
    description: '批次运输节点出现异常，需要采购/运营确认处理方案并更新追踪记录。',
  },
  {
    id: 'after-sales-finance-1',
    docNo: 'AS202607080001',
    title: '售后单待财务复核',
    domain: 'after_sales',
    moduleLabel: '售后',
    statusLabel: '财务复核中',
    ownerName: 'Leo',
    href: '/app/after-sales/1',
    priority: 'medium',
    description: '售后处理已进入财务确认节点，需要复核退款/抵扣与收款状态。',
  },
  {
    id: 'sales-voided-follow-up-3',
    docNo: 'S202607080003',
    title: '销售单已作废待办',
    domain: 'sales',
    moduleLabel: '销售单',
    statusLabel: '已联动作废',
    ownerName: 'Zoe',
    href: '/app/sales/orders/3',
    priority: 'low',
    description: '销售单作废后，相关采购和发货待办已自动收口。',
    lifecycleStatus: 'auto_closed',
    closeReason: '销售单作废，采购与发货待办已联动收口',
  },
];

function isOpenTodo(todo: FormalTodoItem) {
  return todo.lifecycleStatus === undefined || todo.lifecycleStatus === 'open';
}

function canSeeTodo(session: DemoSession, todo: FormalTodoItem) {
  if (todo.visibility === 'owner_only') {
    return todo.ownerName === session.user;
  }

  if (session.role === 'admin' || session.role === 'boss') {
    return true;
  }

  if (session.role === 'sales_manager') {
    return todo.domain === 'sales';
  }

  if (session.role === 'sales') {
    return todo.domain === 'sales' && todo.ownerName === session.user;
  }

  if (session.role === 'purchase_manager') {
    return (
      todo.domain === 'purchase' ||
      todo.domain === 'operations' ||
      todo.domain === 'after_sales'
    );
  }

  return (
    (todo.domain === 'purchase' ||
      todo.domain === 'operations' ||
      todo.domain === 'after_sales') &&
    todo.ownerName === session.user
  );
}

export function getFormalTodos(
  session: DemoSession,
  sourceTodos: FormalTodoItem[] = formalTodos,
) {
  return sourceTodos
    .filter((todo) => isOpenTodo(todo))
    .filter((todo) => canSeeTodo(session, todo));
}

export function getFormalClosedTodoCount(
  session: DemoSession,
  sourceTodos: FormalTodoItem[] = formalTodos,
) {
  return sourceTodos.filter((todo) => !isOpenTodo(todo) && canSeeTodo(session, todo)).length;
}

export function getFormalTodoCount(session: DemoSession) {
  return getFormalTodos(session).length;
}
