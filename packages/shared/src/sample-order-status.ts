export const sampleOrderStatuses = [
  'draft',
  'pending_approval',
  'pending_sampling',
  'sampling',
  'sample_sent',
  'customer_confirmed',
  'closed_no_followup',
  'canceled',
  'replaced',
] as const;

export type SampleOrderStatus = (typeof sampleOrderStatuses)[number];

export const sampleOrderStatusLabels: Record<SampleOrderStatus, string> = {
  draft: '草稿',
  pending_approval: '待审批',
  pending_sampling: '待打样',
  sampling: '打样中',
  sample_sent: '已寄样',
  customer_confirmed: '客户已确认',
  closed_no_followup: '无后续',
  canceled: '已取消',
  replaced: '已替代',
};

export function formatSampleOrderStatus(status: string | undefined | null) {
  if (!status) {
    return '-';
  }

  return `${status} / ${
    sampleOrderStatusLabels[status as SampleOrderStatus] ?? '未知状态'
  }`;
}
