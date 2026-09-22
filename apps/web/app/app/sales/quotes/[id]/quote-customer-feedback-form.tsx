'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitFormalJsonMutationAction } from '../../../_actions/formal-mutation-action';

type CustomerFeedbackResult = 'accepted' | 'no_follow_up' | 'price_issue';

type QuoteCustomerFeedbackFormProps = {
  endpoint: string;
  currentVersionNo: number;
  requestHeaders?: Record<string, string>;
};

const feedbackOptions: Array<{
  value: CustomerFeedbackResult;
  label: string;
  help: string;
}> = [
  { value: 'accepted', label: '客户接受价格', help: '允许转为销售单' },
  { value: 'no_follow_up', label: '暂无后续', help: '报价单停留，后续仍可继续反馈' },
  { value: 'price_issue', label: '价格有问题', help: '从采购询价重新开始并保留同一报价链' },
];

export function QuoteCustomerFeedbackForm({
  endpoint,
  currentVersionNo,
  requestHeaders,
}: QuoteCustomerFeedbackFormProps) {
  let router: { refresh?: () => void } = {};
  try {
    router = useRouter();
  } catch {
    router = {};
  }
  const [result, setResult] = useState<CustomerFeedbackResult>('accepted');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await submitFormalJsonMutationAction(
        endpoint,
        'POST',
        { currentVersionNo, result, remark: remark.trim() },
        requestHeaders,
      );
      if (!response.ok) {
        setError(response.error);
        return;
      }
      router.refresh?.();
    } catch {
      setError('保存客户反馈失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="erp-card erp-workflow-card" onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
      <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: 1.6 }}>
        系统不提供客户入口，由销售根据线下沟通结果记录。
      </p>
      <div style={{ display: 'grid', gap: '8px' }}>
        {feedbackOptions.map((option) => (
          <label
            key={option.value}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '4px 10px',
              alignItems: 'center',
              border: '1px solid #d8e1ea',
              borderRadius: '12px',
              padding: '10px 12px',
              color: '#0f172a',
              fontWeight: 700,
            }}
          >
            <input
              aria-label={option.label}
              type="radio"
              name="customerFeedbackResult"
              value={option.value}
              checked={result === option.value}
              onChange={() => setResult(option.value)}
            />
            <span>{option.label}</span>
            <span />
            <small style={{ color: '#64748b', fontWeight: 500 }}>{option.help}</small>
          </label>
        ))}
      </div>
      <label style={{ display: 'grid', gap: '6px', color: '#334155', fontWeight: 700 }}>
        客户反馈备注
        <textarea
          className="erp-control"
          aria-label="客户反馈备注"
          rows={4}
          value={remark}
          onChange={(event) => setRemark(event.target.value)}
          placeholder="记录客户意见、目标价格等信息"
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '10px 12px',
            resize: 'vertical',
          }}
        />
      </label>
      {error ? <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{error}</p> : null}
      <button
        className="erp-button erp-button--primary"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? '保存中...' : '保存客户反馈'}
      </button>
    </form>
  );
}
