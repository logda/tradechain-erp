import type { QUOTE_STATUSES } from '@erp/shared';

const quoteStatusLabels = {
  draft: '草稿',
  submitted: '已提交',
  pending_boss_approval: '待老板审批需求单',
  boss_approved: '需求单审批通过',
  inquiry_in_progress: '采购询价中',
  converted_to_quote: '已转为报价单',
  pending_boss_price_confirmation: '待老板确认最终售价',
  pending_customer_feedback: '待客户反馈',
  customer_accepted: '客户已接受',
  customer_no_follow_up: '暂无后续',
  repricing_in_progress: '价格有问题 / 重新询价中',
  quoted: '已报价',
  revised: '已修订',
  sample_requested: '已申请打样',
  ordered: '已转销售单',
  closed: '已关闭',
  boss_pending: '待老板确认',
  pending_boss_confirm: '待老板确认',
  pending_boss_confirmation: '待老板确认',
  pending_boss_review: '待老板确认',
  boss_confirmed: '老板已确认',
  revision_pending: '待修订',
} satisfies Record<(typeof QUOTE_STATUSES)[number], string> & Record<string, string>;

export function isKnownQuoteStatus(status: string | undefined) {
  return Object.hasOwn(quoteStatusLabels, status?.trim() ?? '');
}

export function formatQuoteStatus(status: string | undefined) {
  const normalized = status?.trim();
  if (!normalized) return '-';
  const label = isKnownQuoteStatus(normalized)
    ? quoteStatusLabels[normalized as keyof typeof quoteStatusLabels]
    : '未知状态';
  return `${normalized} / ${label}`;
}
