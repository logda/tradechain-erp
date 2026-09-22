'use client';

import { useState } from 'react';
import { UpdateQuoteSourceForm } from './update-quote-source-form';

type QuoteSourceOption = {
  code: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
};

type QuoteSourcePageClientProps = {
  initialItems: QuoteSourceOption[];
  endpoint: string;
  updatedBy: string;
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
};

const summaryCardStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '16px',
  background: '#f8fafc',
  padding: '16px 18px',
  display: 'grid',
  gap: '6px',
} satisfies React.CSSProperties;

function buildEnabledSummary(items: QuoteSourceOption[]) {
  const enabledItems = items
    .filter((item) => item.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    enabledCount: enabledItems.length,
    enabledLabels:
      enabledItems.length > 0
        ? enabledItems.map((item) => item.label.trim() || item.code.trim() || '未命名来源').join('、')
        : '暂无启用来源',
  };
}

export function QuoteSourcePageClient({
  initialItems,
  endpoint,
  updatedBy,
  actorAccessScopes,
}: QuoteSourcePageClientProps) {
  const [items, setItems] = useState(initialItems);
  const summary = buildEnabledSummary(items);

  return (
    <>
      <div style={summaryCardStyle}>
        <strong>当前启用来源：{summary.enabledCount} 个</strong>
        <span style={{ color: '#475569', lineHeight: 1.7 }}>
          {summary.enabledLabels}
        </span>
      </div>
      <UpdateQuoteSourceForm
        endpoint={endpoint}
        item={items}
        updatedBy={updatedBy}
        actorAccessScopes={actorAccessScopes}
        onSuccess={setItems}
      />
    </>
  );
}
