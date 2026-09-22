import {
  afterSalesStatuses,
  financeConfirmStatuses,
  purchaseFulfillmentStatuses,
  receiptCollectionStatuses,
  salesFulfillmentStatuses,
  shipmentBatchStatuses,
} from '@erp/shared';

const workflowAlerts = [
  { label: '待老板确认报价', count: 2 },
  { label: '发货异常批次', count: 1 },
  { label: '售后待闭环', count: 3 },
] as const;

export default function BossDashboardPage() {
  return (
    <main>
      <h1>老板经营看板</h1>
      <p>只读查看销售、采购、发货、售后与财务汇总</p>

      <section aria-labelledby="dashboard-alerts">
        <h2 id="dashboard-alerts">风险提醒</h2>
        <ul>
          {workflowAlerts.map((alert) => (
            <li key={alert.label}>
              {alert.label}：{alert.count}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dashboard-sales">
        <h2 id="dashboard-sales">销售汇总</h2>
        <p>关注销售履约推进和部分状态汇总</p>
        <ul>
          {salesFulfillmentStatuses.slice(1, 4).map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dashboard-purchase">
        <h2 id="dashboard-purchase">采购汇总</h2>
        <p>关注采购执行、发货协同与异常留痕</p>
        <ul>
          {purchaseFulfillmentStatuses.slice(0, 1).map((status) => (
            <li key={status}>{status}</li>
          ))}
          {shipmentBatchStatuses.slice(1, 3).map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dashboard-after-sales-finance">
        <h2 id="dashboard-after-sales-finance">售后与财务</h2>
        <p>关注售后闭环、收款状态和财务确认</p>
        <ul>
          {afterSalesStatuses.slice(1, 4).map((status) => (
            <li key={status}>{status}</li>
          ))}
          {receiptCollectionStatuses.slice(1, 3).map((status) => (
            <li key={status}>{status}</li>
          ))}
          {financeConfirmStatuses.map((status) => (
            <li key={status}>{status}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
