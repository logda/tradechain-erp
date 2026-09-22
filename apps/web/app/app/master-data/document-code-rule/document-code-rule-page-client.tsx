import {
  defaultCustomerOrderNoRule,
  defaultDemandNoRule,
  defaultQuoteNoRule,
  normalizeDocumentCodeRule,
  type DocumentCodeRule,
} from './document-code-rule';
import { UpdateDocumentCodeRuleForm } from './update-document-code-rule-form';

type DocumentCodeRuleSet = {
  demandNoRule: DocumentCodeRule;
  quoteNoRule: DocumentCodeRule;
  customerOrderNoRule: DocumentCodeRule;
};

type DocumentCodeRulePageClientProps = {
  initialRuleSet: DocumentCodeRuleSet;
  endpoint: string;
  updatedBy: string;
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
};

const sectionStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const cardStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '18px',
  background: '#ffffff',
  padding: '20px',
  display: 'grid',
  gap: '14px',
} satisfies React.CSSProperties;

export function DocumentCodeRulePageClient({
  initialRuleSet,
  endpoint,
  updatedBy,
  actorAccessScopes,
}: DocumentCodeRulePageClientProps) {
  const demandNoRule = normalizeDocumentCodeRule(
    initialRuleSet.demandNoRule ?? defaultDemandNoRule,
  );
  const quoteNoRule = normalizeDocumentCodeRule(
    initialRuleSet.quoteNoRule ?? defaultQuoteNoRule,
  );
  const customerOrderNoRule = normalizeDocumentCodeRule(
    initialRuleSet.customerOrderNoRule ?? defaultCustomerOrderNoRule,
  );

  return (
    <section style={sectionStyle}>
      <div style={cardStyle}>
        <UpdateDocumentCodeRuleForm
          endpoint={`${endpoint}/demand-no`}
          item={demandNoRule}
          updatedBy={updatedBy}
          title="需求单号规则"
          description="需求单号自动生成，默认前缀为 XQ，不允许手填。"
          examplePrefix="XQ"
          actorAccessScopes={actorAccessScopes}
        />
      </div>

      <div style={cardStyle}>
        <UpdateDocumentCodeRuleForm
          endpoint={`${endpoint}/quote-no`}
          item={quoteNoRule}
          updatedBy={updatedBy}
          title="报价单号规则"
          description="报价单号自动生成，默认前缀为 BJ，不允许手填。"
          examplePrefix="BJ"
          actorAccessScopes={actorAccessScopes}
        />
      </div>

      <div style={cardStyle}>
        <UpdateDocumentCodeRuleForm
          endpoint={`${endpoint}/customer-order-no`}
          item={customerOrderNoRule}
          updatedBy={updatedBy}
          title="客户订单号规则"
          description="销售单的客户订单号自动生成，默认前缀为 PO，不允许手填。"
          examplePrefix="PO"
          actorAccessScopes={actorAccessScopes}
        />
      </div>
    </section>
  );
}
