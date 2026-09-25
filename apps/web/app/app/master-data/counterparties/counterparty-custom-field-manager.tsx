'use client';

import { type FormEvent, useRef, useState } from 'react';
import { submitFormalJsonMutationAction } from '../../_actions/formal-mutation-action';
import { useMutationAttempt } from '../../_lib/use-mutation-attempt';
import { ConfirmDialog } from '../../_components/confirm-dialog';
import type { CounterpartyCustomField } from './counterparty-extra-fields';

const buttonStyle = { border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px', background: '#fff', color: '#0f172a', fontWeight: 700, cursor: 'pointer' } satisfies React.CSSProperties;
const inputStyle = { border: '1px solid #cbd5e1', borderRadius: '8px', padding: '9px 10px', background: '#fff' } satisfies React.CSSProperties;

export function CounterpartyCustomFieldManager({ fields, onChange, endpoint, requestHeaders }: {
  fields: CounterpartyCustomField[];
  onChange: (fields: CounterpartyCustomField[]) => void;
  endpoint: string;
  requestHeaders: Record<string, string>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<CounterpartyCustomField['type']>('text');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CounterpartyCustomField | null>(null);
  const deleteLocked = useRef(false);
  const attempt = useMutationAttempt();

  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy || fields.length >= 10) return;
    const key = attempt.begin();
    if (!key) return;
    setBusy(true);
    const result = await submitFormalJsonMutationAction(endpoint, 'POST', { name, type }, requestHeaders, key);
    setBusy(false);
    if (!result.ok) { attempt.fail(); setMessage(result.error); return; }
    const next = result.result as CounterpartyCustomField;
    onChange([...fields, next]);
    setName('');
    setMessage('字段已新增');
    attempt.succeed();
  }

  async function remove() {
    const field = pendingDelete;
    if (busy || deleteLocked.current || !field) return;
    deleteLocked.current = true;
    setBusy(true);
    try {
      const result = await submitFormalJsonMutationAction(`${endpoint}/${field.id}`, 'DELETE', {}, requestHeaders, crypto.randomUUID());
      setPendingDelete(null);
      if (!result.ok) { setMessage(result.error); return; }
      onChange(fields.filter((item) => item.id !== field.id));
      setMessage('字段已删除');
    } catch {
      setPendingDelete(null);
      setMessage('删除失败，请重试');
    } finally {
      deleteLocked.current = false;
      setBusy(false);
    }
  }

  return (
    <section style={{ border: '1px solid #cfd8e3', borderRadius: '20px', padding: '20px 24px', background: '#fff' }}>
      <details>
      <summary style={{ cursor: 'pointer', color: '#334155', fontWeight: 700, fontSize: '18px' }}>自定义字段管理</summary>
      <div style={{ paddingTop: '12px' }}>
      <p style={{ color: '#64748b', fontSize: '13px' }}>已启用 {fields.length}/10 个；删除后旧值保留，但不再显示。</p>
      {fields.length ? <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}><tbody>
        {fields.map((field) => <tr key={field.id}><td style={{ padding: '8px', borderBottom: '1px solid #e5ebf2' }}>{field.name}</td><td style={{ padding: '8px', borderBottom: '1px solid #e5ebf2' }}>{field.type === 'text' ? '文字' : field.type === 'number' ? '数字' : '日期'}</td><td style={{ textAlign: 'right', borderBottom: '1px solid #e5ebf2' }}><button type="button" style={buttonStyle} disabled={busy} onClick={() => setPendingDelete(field)}>删除</button></td></tr>)}
      </tbody></table> : null}
      {fields.length >= 10 ? <p role="status" style={{ color: '#b45309' }}>自定义字段数量已达上限（10 个）</p> : (
        <form onSubmit={create} onChangeCapture={attempt.resetAfterEdit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input aria-label="自定义字段名称" value={name} maxLength={64} required onChange={(event) => setName(event.target.value)} style={inputStyle} />
          <select aria-label="自定义字段类型" value={type} onChange={(event) => setType(event.target.value as CounterpartyCustomField['type'])} style={inputStyle}>
            <option value="text">文字</option><option value="number">数字</option><option value="date">日期</option>
          </select>
          <button type="submit" style={buttonStyle} disabled={busy || !name.trim() || attempt.isComplete}>{busy ? '保存中...' : '新增字段'}</button>
        </form>
      )}
      {message ? <p role="status" style={{ color: '#166534', fontSize: '13px' }}>{message}</p> : null}
      </div>
      </details>
      {pendingDelete ? <ConfirmDialog
        message={`确定删除自定义字段“${pendingDelete.name}”？旧值会保留在数据库，但页面不再显示。`}
        confirmLabel="确认删除"
        busy={busy}
        onConfirm={() => { void remove(); }}
        onCancel={() => setPendingDelete(null)}
      /> : null}
    </section>
  );
}
