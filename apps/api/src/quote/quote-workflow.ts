import { BadRequestException } from '@nestjs/common';

export type QuoteDocumentType = 'demand' | 'quote';
export type ProductSource = 'existing' | 'candidate';
export type CustomerFeedbackResult = 'accepted' | 'no_follow_up' | 'price_issue';

export type DemandQuoteWorkflowStatus =
  | 'draft'
  | 'pending_boss_approval'
  | 'boss_approved'
  | 'inquiry_in_progress'
  | 'converted_to_quote'
  | 'pending_boss_price_confirmation'
  | 'pending_customer_feedback'
  | 'customer_accepted'
  | 'customer_no_follow_up'
  | 'repricing_in_progress'
  | 'ordered';

export type QuoteVersionSnapshot = {
  versionNo: number;
  status: string;
  confirmedAt?: string;
  confirmedBy?: string;
  sourceInquiryId?: number;
  items: Array<Record<string, unknown>>;
};

export function assertQuoteCreationCombination(input: {
  documentType: QuoteDocumentType;
  productSource: ProductSource;
}) {
  if (input.documentType === 'quote' && input.productSource === 'candidate') {
    throw new BadRequestException('报价单只能选择产品库产品');
  }
}

export function resolveSubmittedStatus(input: {
  documentType: QuoteDocumentType;
  productSource: ProductSource;
}): DemandQuoteWorkflowStatus {
  assertQuoteCreationCombination(input);

  if (input.documentType === 'demand' && input.productSource === 'existing') {
    return 'pending_boss_approval';
  }

  if (input.documentType === 'demand') {
    return 'inquiry_in_progress';
  }

  return 'pending_boss_price_confirmation';
}

export function assertCustomerFeedbackTransition(input: {
  status: string;
  result: CustomerFeedbackResult;
}) {
  if (
    input.status !== 'pending_customer_feedback' &&
    input.status !== 'customer_no_follow_up'
  ) {
    throw new BadRequestException('当前报价状态不能记录客户反馈');
  }
}

export function isQuoteConvertibleToSales(input: {
  documentType: QuoteDocumentType;
  status: string;
}) {
  return (
    (input.documentType === 'demand' && input.status === 'boss_approved') ||
    (input.documentType === 'quote' && input.status === 'customer_accepted')
  );
}

const workflowProgressLabels: Record<DemandQuoteWorkflowStatus, string> = {
  draft: '草稿',
  pending_boss_approval: '待老板审批需求单',
  boss_approved: '需求单审批通过',
  inquiry_in_progress: '采购询价中',
  converted_to_quote: '已转为报价单',
  pending_boss_price_confirmation: '待老板确认最终售价',
  pending_customer_feedback: '待客户反馈',
  customer_accepted: '客户已接受',
  customer_no_follow_up: '暂无后续',
  repricing_in_progress: '价格有问题 / 重新询价中',
  ordered: '已转销售单',
};

export function resolveWorkflowProgress(status: string) {
  return workflowProgressLabels[status as DemandQuoteWorkflowStatus] ?? status;
}
