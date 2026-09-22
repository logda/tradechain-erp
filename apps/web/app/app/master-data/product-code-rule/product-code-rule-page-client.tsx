'use client';

import { useState } from 'react';
import {
  describeProductCodeRule,
  normalizeProductCodeRule,
  type ProductCodeRule,
} from '../products/product-code-rule';
import { UpdateProductCodeRuleForm } from './update-product-code-rule-form';

type ProductCodeRulePageClientProps = {
  initialRule: ProductCodeRule;
  endpoint: string;
  updatedBy: string;
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
};

export function ProductCodeRulePageClient({
  initialRule,
  endpoint,
  updatedBy,
  actorAccessScopes,
}: ProductCodeRulePageClientProps) {
  const [rule, setRule] = useState(initialRule);

  return (
    <>
      <div>
        <h2 style={{ margin: '0 0 10px' }}>当前规则</h2>
        <p style={{ margin: 0, color: '#475569', lineHeight: 1.8 }}>
          {describeProductCodeRule(rule)}
        </p>
        <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '13px' }}>
          最近更新：{rule.updatedAt} / {rule.updatedBy}
        </p>
      </div>
      <UpdateProductCodeRuleForm
        endpoint={endpoint}
        item={rule}
        updatedBy={updatedBy}
        actorAccessScopes={actorAccessScopes}
        onSuccess={(nextRule) => setRule(normalizeProductCodeRule(nextRule))}
      />
    </>
  );
}
