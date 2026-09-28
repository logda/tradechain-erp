import { canViewFormalModule, type DemoSession } from './demo-session';

export type FormalDetailKind =
  | 'quote'
  | 'sales_order'
  | 'purchase_order'
  | 'shipment_batch'
  | 'after_sales'
  | 'sample';

function isFormalAdminOrBoss(session: DemoSession) {
  return session.role === 'admin' || session.role === 'boss';
}

function hasFormalAction(session: DemoSession, action: string) {
  if (session.accessScopes?.actions) {
    return session.accessScopes.actions.includes(action);
  }

  if (session.role === 'admin') {
    return true;
  }

  return false;
}

function isFormalPurchaseOperator(session: DemoSession) {
  return (
    isFormalAdminOrBoss(session) ||
    session.role === 'purchase_manager' ||
    session.role === 'purchase'
  );
}

export function resolveFormalUserId(session: Pick<DemoSession, 'user' | 'userId'> | string) {
  if (typeof session !== 'string' && Number.isSafeInteger(session.userId) && Number(session.userId) > 0) {
    return session.userId!;
  }
  // Unsigned demo identities are supported only by legacy test fixtures.
  const user = typeof session === 'string' ? session : session.user;
  const demoId = process.env.NODE_ENV === 'test'
    ? ({ Zoe: 2001, Leo: 2002, Admin: 9000, Mia: 2000 } as Record<string, number>)[user]
    : undefined;
  if (demoId) return demoId;
  throw new Error('登录身份缺少用户 ID，请重新登录');
}

export function canViewFormalQuoteDetail(
  session: DemoSession,
  quote: { salesUserId: number },
) {
  if ((isFormalAdminOrBoss(session) || session.role === 'sales_manager') && !session.accessScopes?.dataScope.startsWith('own')) {
    return true;
  }

  if (session.role === 'sales' && ['all', 'sales_team'].includes(session.accessScopes?.dataScope ?? '')) return true;
  return (session.role === 'sales' || session.role === 'sales_manager' || isFormalAdminOrBoss(session)) && [resolveFormalUserId(session), ...(session.legacyUserIds ?? [])].includes(quote.salesUserId);
}

export function canViewFormalSalesOrderDetail(
  session: DemoSession,
  salesOrder: { salesUserId?: number; createdBy?: number },
) {
  if ((isFormalAdminOrBoss(session) || session.role === 'sales_manager') && !session.accessScopes?.dataScope.startsWith('own')) {
    return true;
  }

  if (!['sales', 'sales_manager', 'admin', 'boss'].includes(session.role)) {
    return false;
  }

  if (['all', 'sales_team'].includes(session.accessScopes?.dataScope ?? '')) return true;
  const currentUserId = resolveFormalUserId(session);
  return (
    [currentUserId, ...(session.legacyUserIds ?? [])].includes(salesOrder.salesUserId ?? 0) ||
    [currentUserId, ...(session.legacyUserIds ?? [])].includes(salesOrder.createdBy ?? 0)
  );
}

export function canViewFormalPurchaseOrderDetail(
  session: DemoSession,
  purchaseOrder: { ownerName?: string; ownerId?: number; createdBy?: number },
) {
  if ((isFormalAdminOrBoss(session) || session.role === 'purchase_manager') && !session.accessScopes?.dataScope.startsWith('own')) {
    return true;
  }

  if (!['purchase', 'purchase_manager', 'admin', 'boss'].includes(session.role)) {
    return false;
  }

  if (['all', 'purchase_team'].includes(session.accessScopes?.dataScope ?? '')) return true;
  const currentUserId = resolveFormalUserId(session);
  return (
    (session.userId !== undefined ? [currentUserId, ...(session.legacyUserIds ?? [])].includes(purchaseOrder.ownerId ?? 0) : purchaseOrder.ownerName === session.user) ||
    [currentUserId, ...(session.legacyUserIds ?? [])].includes(purchaseOrder.createdBy ?? 0)
  );
}

export function canViewFormalShipmentBatchDetail(session: DemoSession) {
  if (isFormalAdminOrBoss(session)) {
    return true;
  }

  return (
    session.role === 'sales_manager' ||
    session.role === 'sales' ||
    session.role === 'purchase_manager' ||
    session.role === 'purchase'
  );
}

export function canViewFormalShipmentBatchModule(session: DemoSession) {
  if (session.accessScopes) {
    return (
      session.accessScopes.modules.includes('sales') ||
      session.accessScopes.modules.includes('operations')
    );
  }

  return (
    canViewFormalModule(session, 'sales') ||
    canViewFormalModule(session, 'operations')
  );
}

export function canViewFormalAfterSalesDetail(session: DemoSession) {
  if (isFormalAdminOrBoss(session)) {
    return true;
  }

  return session.role === 'purchase_manager' || session.role === 'purchase';
}

export function canViewFormalSampleDetail(session: DemoSession) {
  if (isFormalAdminOrBoss(session)) {
    return true;
  }

  return (
    session.role === 'sales_manager' ||
    session.role === 'sales' ||
    session.role === 'purchase_manager' ||
    session.role === 'purchase'
  );
}

export function canUseFormalSalesPurchaseActions(session: DemoSession) {
  return canCreateFormalPurchaseOrder(session);
}

export function canCreateFormalPurchaseOrder(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'purchase.order.create');
  }

  return (
    isFormalAdminOrBoss(session) ||
    session.role === 'purchase_manager' ||
    session.role === 'purchase'
  );
}

export function canSubmitFormalPurchaseOrder(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'purchase.order.submit');
  }

  return (
    isFormalAdminOrBoss(session) ||
    session.role === 'purchase_manager' ||
    session.role === 'purchase'
  );
}

export function canUseFormalSalesFinanceActions(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'finance.confirm');
  }

  return isFormalAdminOrBoss(session);
}

export function canUseFormalQuoteActions(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'sales.quote.write');
  }

  return canViewFormalModule(session, 'sales');
}

export function canUseFormalInquirySubmitAction(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'sales.inquiry.submit');
  }

  return canViewFormalModule(session, 'purchase');
}

export function canUseFormalInquiryBossConfirmAction(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'boss.confirm');
  }

  return isFormalAdminOrBoss(session);
}

export function canUseFormalSampleSubmitAction(session: DemoSession) {
  if (session.role === 'admin') {
    return true;
  }

  if (session.accessScopes) {
    return hasFormalAction(session, 'sales.sample.submit');
  }

  return canViewFormalModule(session, 'sales');
}

export function canUseFormalSampleApprovalAction(session: DemoSession) {
  if (session.role === 'admin') {
    return true;
  }

  if (session.accessScopes) {
    return hasFormalAction(session, 'sales.sample.approve');
  }

  return isFormalAdminOrBoss(session) || session.role === 'sales_manager';
}

export function canUseFormalSampleExecutionAction(session: DemoSession) {
  if (session.role === 'admin') {
    return true;
  }

  if (session.accessScopes) {
    return (
      hasFormalAction(session, 'sales.sample.execute') ||
      hasFormalAction(session, 'purchase.sample.execute')
    );
  }

  return canViewFormalModule(session, 'sales') || canViewFormalModule(session, 'purchase');
}

export function canUseFormalSamplePurchaseExecutionAction(session: DemoSession) {
  if (session.role === 'admin') {
    return true;
  }

  if (session.accessScopes) {
    return hasFormalAction(session, 'purchase.sample.execute');
  }

  return isFormalAdminOrBoss(session) ||
    session.role === 'purchase_manager' ||
    session.role === 'purchase';
}

export function canUseFormalSampleSalesExecutionAction(session: DemoSession) {
  if (session.role === 'admin') {
    return true;
  }

  if (session.accessScopes) {
    return hasFormalAction(session, 'sales.sample.execute');
  }

  return canViewFormalModule(session, 'sales');
}

export function canApproveFormalPurchaseOrder(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'purchase.order.approve');
  }

  return isFormalAdminOrBoss(session) || session.role === 'purchase_manager';
}

export function canConfirmFormalAfterSalesFinance(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'finance.confirm');
  }

  return isFormalAdminOrBoss(session);
}

export function canUseFormalMasterDataActions(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'master_data.write');
  }

  return session.role === 'admin';
}

export function canUseFormalProductActions(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'product.write');
  }

  return isFormalAdminOrBoss(session);
}

export function canUseFormalSalesOrderActions(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'sales.order.write');
  }

  return canViewFormalModule(session, 'sales');
}

export function canUseFormalShipmentUpdateActions(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'shipment.update');
  }

  return canViewFormalModule(session, 'operations');
}

export function canUseFormalAfterSalesProcessActions(session: DemoSession) {
  if (session.accessScopes) {
    return hasFormalAction(session, 'after_sales.process');
  }

  return canViewFormalModule(session, 'operations');
}

export function getFormalDetailAccessDeniedLabel(kind: FormalDetailKind) {
  if (kind === 'quote') {
    return '无权限访问报价单';
  }

  if (kind === 'sales_order') {
    return '无权限访问销售单';
  }

  if (kind === 'shipment_batch') {
    return '无权限访问发货批次';
  }

  if (kind === 'after_sales') {
    return '无权限访问售后单';
  }

  if (kind === 'sample') {
    return '无权限访问样品单';
  }

  return '无权限访问采购单';
}
