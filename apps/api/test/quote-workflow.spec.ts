import {
  assertCustomerFeedbackTransition,
  assertQuoteCreationCombination,
  isQuoteConvertibleToSales,
  resolveSubmittedStatus,
  resolveWorkflowProgress,
} from '../src/quote/quote-workflow';

describe('quote workflow', () => {
  it.each([
    ['demand', 'existing'],
    ['demand', 'candidate'],
    ['quote', 'existing'],
  ] as const)('allows %s + %s', (documentType, productSource) => {
    expect(() =>
      assertQuoteCreationCombination({ documentType, productSource }),
    ).not.toThrow();
  });

  it('rejects quote + candidate', () => {
    expect(() =>
      assertQuoteCreationCombination({
        documentType: 'quote',
        productSource: 'candidate',
      }),
    ).toThrow('报价单只能选择产品库产品');
  });

  it.each([
    ['demand', 'existing', 'pending_boss_approval'],
    ['demand', 'candidate', 'inquiry_in_progress'],
    ['quote', 'existing', 'pending_boss_price_confirmation'],
  ] as const)(
    'resolves %s + %s to %s on submit',
    (documentType, productSource, expected) => {
      expect(resolveSubmittedStatus({ documentType, productSource })).toBe(expected);
    },
  );

  it('allows sales conversion only for boss-approved demand or customer-accepted quote', () => {
    expect(
      isQuoteConvertibleToSales({
        documentType: 'demand',
        status: 'boss_approved',
      }),
    ).toBe(true);
    expect(
      isQuoteConvertibleToSales({
        documentType: 'quote',
        status: 'customer_accepted',
      }),
    ).toBe(true);
    expect(
      isQuoteConvertibleToSales({
        documentType: 'quote',
        status: 'pending_customer_feedback',
      }),
    ).toBe(false);
    expect(
      isQuoteConvertibleToSales({
        documentType: 'demand',
        status: 'customer_accepted',
      }),
    ).toBe(false);
  });

  it('allows a no-follow-up quote to receive a later customer decision', () => {
    expect(() =>
      assertCustomerFeedbackTransition({
        status: 'customer_no_follow_up',
        result: 'accepted',
      }),
    ).not.toThrow();
    expect(() =>
      assertCustomerFeedbackTransition({
        status: 'customer_no_follow_up',
        result: 'price_issue',
      }),
    ).not.toThrow();
  });

  it('rejects customer feedback before boss pricing or after conversion', () => {
    expect(() =>
      assertCustomerFeedbackTransition({
        status: 'pending_boss_price_confirmation',
        result: 'accepted',
      }),
    ).toThrow('当前报价状态不能记录客户反馈');
    expect(() =>
      assertCustomerFeedbackTransition({
        status: 'ordered',
        result: 'price_issue',
      }),
    ).toThrow('当前报价状态不能记录客户反馈');
  });

  it('returns distinct readable progress labels', () => {
    expect(resolveWorkflowProgress('pending_boss_approval')).toBe('待老板审批需求单');
    expect(resolveWorkflowProgress('pending_boss_price_confirmation')).toBe(
      '待老板确认最终售价',
    );
    expect(resolveWorkflowProgress('pending_customer_feedback')).toBe('待客户反馈');
    expect(resolveWorkflowProgress('repricing_in_progress')).toBe('价格有问题 / 重新询价中');
  });
});
