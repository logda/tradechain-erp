import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { resolveDemoSession } from '../_lib/demo-session';

type SearchParams = Record<string, string | string[] | undefined>;

const heroStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '22px',
  padding: '24px',
  background:
    'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, #edf8f3 48%, #eef4ff 100%)',
  boxShadow: '0 18px 56px rgba(15, 23, 42, 0.08)',
  display: 'grid',
  gap: '14px',
} satisfies React.CSSProperties;

const heroTitleStyle = {
  margin: 0,
  fontSize: '32px',
  color: '#0f172a',
} satisfies React.CSSProperties;

const heroTextStyle = {
  margin: 0,
  color: '#475569',
  lineHeight: 1.8,
  fontSize: '15px',
} satisfies React.CSSProperties;

const statusPillStyle = {
  display: 'inline-flex',
  width: 'fit-content',
  border: '1px solid #bbf7d0',
  borderRadius: '999px',
  padding: '8px 12px',
  background: '#ecfdf5',
  color: '#166534',
  fontSize: '13px',
  fontWeight: 700,
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '16px',
} satisfies React.CSSProperties;

const panelStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  padding: '20px',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 12px 36px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const panelTitleStyle = {
  margin: '0 0 12px',
  fontSize: '20px',
  color: '#0f172a',
} satisfies React.CSSProperties;

const listStyle = {
  margin: 0,
  paddingLeft: '20px',
  color: '#334155',
  lineHeight: 1.9,
} satisfies React.CSSProperties;

const actionBarStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '12px',
} satisfies React.CSSProperties;

const primaryLinkStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '10px 14px',
  background: '#0f172a',
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const secondaryLinkStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '12px',
  padding: '10px 14px',
  background: '#ffffff',
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const acceptanceSteps = [
  '1. 管理员创建或注销业务账号',
  '2. 维护客户、供应商和商品主数据',
  '3. 销售创建报价单或直接创建销售单',
  '4. 报价进入询价、样品或转销售链路',
  '5. 销售单提交审批并生成采购拆单',
  '6. 采购审批、驳回、重提或作废',
  '7. 发货批次推进回单与异常',
  '8. 售后单关联销售、采购和发货批次并财务复核',
  '9. 老板看板下钻审批、异常和财务队列',
  '10. 日志中心复核关键操作追溯',
];

const accountRows = [
  '管理员 admin / Admin123456',
  '老板 mia / Mia123456',
  '销售 zoe / Zoe123456',
  '采购 leo / Leo123456',
];

const readyScope = [
  '正式首页、销售中心、采购、发货、售后、待办、老板看板均已接入。',
  '销售、采购、发货、售后详情页已提供跨单据追溯入口。',
  '销售个人可见性、主管/老板全量可见性已纳入权限控制。',
  '主数据支持新增、编辑、停用式删除，管理员支持新增和注销账号。',
  '日志中心已聚合关键业务模块操作日志，支持老板汇报时复核追溯链路。',
];

const completionScope = [
  '正式数据库已完成迁移、种子数据和校验。',
  '权限、审计、待办、主数据和全链路页面已纳入 MVP 验收。',
  '报价、销售、采购、发货、售后和财务确认均可从正式入口进入。',
  '管理员、老板、销售、采购账号可用于验证不同角色的数据和操作边界。',
];

const limitScope = [
  '当前版本已支持 Prisma 正式数据库、正式权限账号、主链路页面和审计追溯，适合流程验收和老板汇报。',
  '正式上线仍建议继续补库存、深财务、通知、导入导出、生产级审计归档和发布流程。',
];

export default async function AppMvpPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);

  return (
    <AppShell
      title="全链路验收中心"
      subtitle="集中展示 MVP 账号、业务路径、验收步骤、关键入口和上线边界。"
      session={session}
    >
      <section style={heroStyle}>
        <span style={statusPillStyle}>MVP 状态：已完成，可进入验收</span>
        <h3 style={heroTitleStyle}>ERP MVP 全链路验收</h3>
        <p style={heroTextStyle}>
          这页用于老板汇报和内部验收：从账号、主数据、销售、采购、发货、售后、财务确认到老板看板下钻，
          按下方路径逐步点击即可跑完整个业务闭环。当前 MVP 已完成主流程、权限、审计和正式库落库验收口径。
        </p>
        <div style={actionBarStyle}>
          <Link href="/app/sales" style={primaryLinkStyle}>
            开始销售链路
          </Link>
          <Link href="/app/dashboard/boss" style={secondaryLinkStyle}>
            查看老板看板
          </Link>
          <Link href="/app/todos" style={secondaryLinkStyle}>
            进入待办中心
          </Link>
          <Link href="/app/logs" style={secondaryLinkStyle}>
            查看日志中心
          </Link>
        </div>
      </section>

      <section style={gridStyle}>
        <article style={panelStyle}>
          <h3 style={panelTitleStyle}>系统账号</h3>
          <ul style={listStyle}>
            {accountRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </article>

        <article style={panelStyle}>
          <h3 style={panelTitleStyle}>MVP 已覆盖</h3>
          <ul style={listStyle}>
            {readyScope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>完成口径</h3>
        <ul style={listStyle}>
          {completionScope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>推荐验收路径</h3>
        <ol style={listStyle}>
          {acceptanceSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>MVP 边界</h3>
        <ul style={listStyle}>
          {limitScope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
