import type { CounterpartyType } from './owner-options';

export type CounterpartyCustomField = {
  id: number;
  name: string;
  type: 'text' | 'number' | 'date';
};

export type CounterpartyExtraValues = {
  createdAt?: string;
  paymentMethod?: string;
  settlementMethod?: string;
  unitTags?: string[];
  openingReceivable?: string | null;
  payableReceivable?: string | null;
  moldFee?: string | null;
  customValues?: Record<string, string>;
};

export function readCounterpartyExtraFields(formData: FormData, fields: CounterpartyCustomField[]) {
  return {
    paymentMethod: String(formData.get('paymentMethod') ?? ''),
    settlementMethod: String(formData.get('settlementMethod') ?? ''),
    unitTags: String(formData.get('unitTags') ?? '').split(/[，,]/).map((value) => value.trim()).filter(Boolean),
    ...(formData.has('openingReceivable') ? { openingReceivable: String(formData.get('openingReceivable') ?? '') || null } : {}),
    ...(formData.has('payableReceivable') ? { payableReceivable: String(formData.get('payableReceivable') ?? '') || null } : {}),
    moldFee: String(formData.get('moldFee') ?? '') || null,
    customValues: Object.fromEntries(fields.map((field) => [String(field.id), String(formData.get(`custom.${field.id}`) ?? '')])),
  };
}

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px 14px', marginTop: '12px' } satisfies React.CSSProperties;
const fieldStyle = { display: 'grid', gap: '6px', color: '#475569', fontSize: '13px', fontWeight: 600 } satisfies React.CSSProperties;
const inputStyle = { border: '1px solid #cfd8e3', borderRadius: '4px', padding: '9px 10px', background: '#fff', minHeight: '42px', width: '100%' } satisfies React.CSSProperties;

export function CounterpartyExtraFields({ type, item, fields }: {
  type: CounterpartyType;
  item?: CounterpartyExtraValues;
  fields: CounterpartyCustomField[];
}) {
  return (
    <div style={gridStyle}>
      <div style={fieldStyle}>
        <span>入库时间</span>
        {item?.createdAt ? (
          <time dateTime={item.createdAt} style={{ color: '#0f172a', fontSize: '14px', fontWeight: 500 }}>{new Date(item.createdAt).toLocaleString('zh-CN')}</time>
        ) : <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 400 }}>建档后自动生成</span>}
      </div>
      <label style={fieldStyle}>付款方式
        <input name="paymentMethod" defaultValue={item?.paymentMethod ?? ''} style={inputStyle} />
      </label>
      <label style={fieldStyle}>结算方式
        <input name="settlementMethod" defaultValue={item?.settlementMethod ?? ''} style={inputStyle} />
      </label>
      <label style={fieldStyle}>单位标签（逗号分隔）
        <input name="unitTags" defaultValue={(item?.unitTags ?? []).join('，')} style={inputStyle} />
      </label>
      {(type === 'customer' || type === 'both') ? (
        <label style={fieldStyle}>期初应收款
          <input name="openingReceivable" type="number" step="0.01" defaultValue={item?.openingReceivable ?? ''} style={inputStyle} />
        </label>
      ) : null}
      {(type === 'supplier' || type === 'both') ? (
        <label style={fieldStyle}>应付应收款
          <input name="payableReceivable" type="number" step="0.01" defaultValue={item?.payableReceivable ?? ''} style={inputStyle} />
        </label>
      ) : null}
      <label style={fieldStyle}>模具费用
        <input name="moldFee" type="number" step="0.01" defaultValue={item?.moldFee ?? ''} style={inputStyle} />
      </label>
      {fields.map((field) => (
        <label key={field.id} style={fieldStyle}>{field.name}
          <input name={`custom.${field.id}`} type={field.type} step={field.type === 'number' ? 'any' : undefined} defaultValue={item?.customValues?.[String(field.id)] ?? ''} style={inputStyle} />
        </label>
      ))}
    </div>
  );
}
