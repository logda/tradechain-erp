'use client';

import {
  buildAuditChangeSummary,
  formatAuditBizObject,
  formatAuditCreatedAt,
  formatAuditOperationType,
  formatAuditOperator,
  type AuditLogItem,
} from '../_lib/audit-log';
import { FormalDataTable } from './formal-data-table';

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  tableLayout: 'fixed' as const,
} satisfies React.CSSProperties;

const tableHeadCellStyle = {
  textAlign: 'left' as const,
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
  borderBottom: '1px solid #e2e8f0',
  padding: '12px 10px',
} satisfies React.CSSProperties;

const tableCellStyle = {
  padding: '14px 10px',
  borderBottom: '1px solid #eef2f7',
  fontSize: '14px',
  color: '#0f172a',
  verticalAlign: 'top' as const,
} satisfies React.CSSProperties;

const operationBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  border: '1px solid #bfdbfe',
  background: '#eff6ff',
  color: '#1d4ed8',
  fontWeight: 700,
  fontSize: '12px',
  lineHeight: 1.4,
  padding: '5px 9px',
  maxWidth: '100%',
  overflowWrap: 'anywhere' as const,
} satisfies React.CSSProperties;

const objectTextStyle = {
  display: 'block',
  color: '#0f172a',
  fontWeight: 700,
  overflowWrap: 'anywhere' as const,
} satisfies React.CSSProperties;

const operatorTextStyle = {
  color: '#334155',
  fontWeight: 700,
} satisfies React.CSSProperties;

const timeTextStyle = {
  color: '#475569',
  whiteSpace: 'nowrap' as const,
} satisfies React.CSSProperties;

const summaryWrapStyle = {
  display: 'grid',
  gap: '8px',
} satisfies React.CSSProperties;

const summaryTitleStyle = {
  margin: 0,
  color: '#0f172a',
  fontWeight: 800,
  fontSize: '13px',
} satisfies React.CSSProperties;

const changeRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(88px, 0.8fr) minmax(0, 1fr)',
  gap: '8px',
  alignItems: 'start',
} satisfies React.CSSProperties;

const fieldLabelStyle = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: 700,
} satisfies React.CSSProperties;

const changeValueStyle = {
  color: '#0f172a',
  fontSize: '13px',
  lineHeight: 1.6,
  overflowWrap: 'anywhere' as const,
} satisfies React.CSSProperties;

const arrowStyle = {
  color: '#0f766e',
  fontWeight: 800,
  padding: '0 5px',
} satisfies React.CSSProperties;

const emptyStyle = {
  color: '#64748b',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

function ChangeSummary({ item }: { item: AuditLogItem }) {
  const summary = buildAuditChangeSummary(item);

  return (
    <div style={summaryWrapStyle}>
      <p style={summaryTitleStyle}>{summary.title}</p>
      {summary.rows.length > 0 ? (
        summary.rows.map((row) => (
          <div key={`${row.field}-${row.before}-${row.after}`} style={changeRowStyle}>
            <span style={fieldLabelStyle}>{row.field}</span>
            <span style={changeValueStyle}>
              {row.before}
              <span style={arrowStyle}>→</span>
              {row.after}
            </span>
          </div>
        ))
      ) : (
        <span style={emptyStyle}>暂无可展示的字段变化</span>
      )}
    </div>
  );
}

export function AuditLogTable({
  items,
  title = '审计日志',
  limit = 8,
  showModule = false,
  total,
}: {
  items: Array<AuditLogItem & { moduleLabel?: string }>;
  title?: string;
  limit?: number;
  showModule?: boolean;
  total?: number;
}) {
  const visibleItems = [...items]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-limit)
    .reverse();

  return (
    <FormalDataTable title={title} total={total ?? items.length}>
      <table style={tableStyle}>
        {showModule ? (
          <colgroup>
            <col style={{ width: '14%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
        ) : (
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '39%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
        )}
        <thead>
          <tr>
            {showModule ? <th style={tableHeadCellStyle}>模块 Module</th> : null}
            <th style={tableHeadCellStyle}>动作 Operation</th>
            <th style={tableHeadCellStyle}>对象 Object</th>
            <th style={tableHeadCellStyle}>操作人 Operator</th>
            <th style={tableHeadCellStyle}>变更摘要 Change</th>
            <th style={tableHeadCellStyle}>时间 Time</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            visibleItems.map((item) => (
              <tr key={`${item.bizType}-${item.bizId}-${item.id}-${item.createdAt}`}>
                {showModule ? (
                  <td style={tableCellStyle}>
                    <span style={objectTextStyle}>{item.moduleLabel ?? '-'}</span>
                  </td>
                ) : null}
                <td style={tableCellStyle}>
                  <span style={operationBadgeStyle}>
                    {formatAuditOperationType(item.operationType)}
                  </span>
                </td>
                <td style={tableCellStyle}>
                  <span style={objectTextStyle}>{formatAuditBizObject(item)}</span>
                </td>
                <td style={tableCellStyle}>
                  <span style={operatorTextStyle}>{formatAuditOperator(item)}</span>
                </td>
                <td style={tableCellStyle}>
                  <ChangeSummary item={item} />
                </td>
                <td style={tableCellStyle}>
                  <span style={timeTextStyle}>{formatAuditCreatedAt(item.createdAt)}</span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td style={tableCellStyle} colSpan={showModule ? 6 : 5}>
                暂无审计记录
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </FormalDataTable>
  );
}
