import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import { MutationActionForm } from '../../_components/mutation-action-form';
import { canViewFormalModule, resolveDemoSession } from '../../_lib/demo-session';
import { canApproveFormalPurchaseOrder } from '../../_lib/formal-access';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';

type Assignment = { id: number; salesNo: string; title: string; customerName: string; purchaseOwnerName?: string };
type Owner = { id: number; realName: string; status: string };

export default async function PurchaseAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = resolveDemoSession(searchParams ? await searchParams : {});
  const canAssign = canViewFormalModule(session, 'purchase') &&
    ['admin', 'boss', 'purchase_manager'].includes(session.role) &&
    canApproveFormalPurchaseOrder(session);
  const baseUrl = process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
  let assignments: Assignment[] = [];
  let owners: Owner[] = [];
  let loadFailed = false;
  if (canAssign) {
    try {
      const headers = buildFormalApiRequestHeaders(session);
      const [assignmentResponse, ownerResponse] = await Promise.all([
        fetch(`${baseUrl}/sales-orders/purchase-assignments/pending`, { headers, cache: 'no-store' }),
        fetch(`${baseUrl}/purchase-orders/owner-options`, { headers, cache: 'no-store' }),
      ]);
      if (!assignmentResponse.ok || !ownerResponse.ok) {
        loadFailed = true;
      } else {
        const assignmentData = await assignmentResponse.json();
        const ownerData = await ownerResponse.json();
        assignments = Array.isArray(assignmentData) ? assignmentData : [];
        owners = Array.isArray(ownerData) ? ownerData : [];
      }
    } catch {
      loadFailed = true;
    }
  }

  return (
    <AppShell title="采购负责人分配" subtitle="销售单审批后，先明确采购负责人，再生成采购单。" session={session}>
      <section style={{ display: 'grid', gap: 16 }}>
        <Link href="/app/purchase-orders">返回采购单列表</Link>
        {!canAssign ? <p>当前角色无权分配采购负责人。</p> : null}
        {canAssign && loadFailed ? <p>待分配数据加载失败，请稍后刷新重试。</p> : null}
        {canAssign && !loadFailed && assignments.length === 0 ? <p>当前没有待分配的销售单。</p> : null}
        {canAssign && !loadFailed ? assignments.map((item) => (
          <article key={item.id} style={{ background: '#fff', border: '1px solid #d7e0ea', borderRadius: 20, padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>{item.salesNo}</h2>
            <p>{item.title} · {item.customerName}</p>
            <MutationActionForm
              endpoint={`${baseUrl}/sales-orders/${item.id}/assign-purchaser`}
              label="指定并生成采购单"
              successLabel="已指定采购负责人并生成采购单"
              requiredAction="purchase.order.approve"
              requiredActionLabel="采购主管审批"
              requestHeaders={buildFormalRequestHeaders(session)}
              fields={[{
                name: 'ownerName',
                value: item.purchaseOwnerName ?? '',
                display: 'select',
                label: '采购负责人',
                required: true,
                options: [
                  { value: '', label: '请选择采购负责人' },
                  ...owners.filter((owner) => owner.status === 'active' && owner.id > 0 &&
                    (!item.purchaseOwnerName || owner.realName === item.purchaseOwnerName)).map((owner) => ({
                    value: owner.realName,
                    label: owner.realName,
                  })),
                ],
              }]}
            />
          </article>
        )) : null}
      </section>
    </AppShell>
  );
}
