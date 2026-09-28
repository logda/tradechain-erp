import type { DemoSession } from './demo-session';

export function getDataScopeLabel(session: DemoSession, dataScope?: string) {
  const scope = dataScope ?? session.accessScopes?.dataScope ?? (
    session.role === 'sales' ? 'own_sales' : session.role === 'sales_manager' ? 'sales_team' :
    session.role === 'purchase' ? 'own_purchase' : session.role === 'purchase_manager' ? 'purchase_team' : 'all'
  );
  return ({ all: '全部', own_sales: '我的销售', sales_team: '销售团队', own_purchase: '我的采购与运营', purchase_team: '采购团队' } as Record<string, string>)[scope] ?? scope;
}
