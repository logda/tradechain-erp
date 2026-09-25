'use client';

import { useState } from 'react';
import {
  describeProductCodeRule,
  normalizeProductCodeRule,
  type ProductCodeRule,
  type ProductCodeRuleKind,
  type ProductCodeRuleSet,
} from '../products/product-code-rule';
import { UpdateProductCodeRuleForm } from './update-product-code-rule-form';

type ProductCodeRulePageClientProps = {
  initialRules: ProductCodeRuleSet;
  endpointBase: string;
  updatedBy: string;
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
};

export function ProductCodeRulePageClient({
  initialRules,
  endpointBase,
  updatedBy,
  actorAccessScopes,
}: ProductCodeRulePageClientProps) {
  const [rules, setRules] = useState(initialRules);

  function renderRule(kind: ProductCodeRuleKind, title: string) {
    const rule: ProductCodeRule = rules[kind];
    return (
      <section
        key={kind}
        style={{
          display: 'grid',
          gap: '18px',
          border: '1px solid #d7e0ea',
          borderRadius: '18px',
          padding: '18px',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 10px' }}>{title}</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.8 }}>
            {describeProductCodeRule(rule)}
          </p>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '13px' }}>
            最近更新：{rule.updatedAt} / {rule.updatedBy}
          </p>
        </div>
        <UpdateProductCodeRuleForm
          kind={kind}
          endpoint={`${endpointBase}/${kind}`}
          item={rule}
          updatedBy={updatedBy}
          actorAccessScopes={actorAccessScopes}
          onSuccess={(nextRule) =>
            setRules((current) => ({
              ...current,
              [kind]: normalizeProductCodeRule(nextRule),
            }))
          }
        />
      </section>
    );
  }

  return (
    <>
      {renderRule('purchase', '采购编码规则')}
      {renderRule('sales', '产品编码生成规则')}
    </>
  );
}
