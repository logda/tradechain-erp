import type { CounterpartyCustomField } from '../counterparties/counterparty-extra-fields';

export function readProductCustomValues(formData: FormData, fields: CounterpartyCustomField[]) {
  return Object.fromEntries(fields.map((field) => [String(field.id), String(formData.get(`custom.${field.id}`) ?? '')]));
}

export function ProductCustomValueFields({ fields, values = {} }: {
  fields: CounterpartyCustomField[];
  values?: Record<string, string>;
}) {
  if (!fields.length) return null;
  return <details style={{ border: '1px solid #d8e1ea', borderRadius: '14px', padding: '16px', background: '#fff' }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#334155' }}>自定义字段</summary>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '12px' }}>
      {fields.map((field) => <label key={field.id} style={{ display: 'grid', gap: '6px', fontSize: '13px', color: '#475569' }}>
        {field.name}
        <input name={`custom.${field.id}`} type={field.type} step={field.type === 'number' ? 'any' : undefined} defaultValue={values[String(field.id)] ?? ''} className="erp-control" />
      </label>)}
    </div>
  </details>;
}
