'use client';

import { useMemo, useState } from 'react';
import type { CounterpartyOption } from '../_lib/counterparty-options';
import { formatCounterpartyBilingualDisplay } from '../_lib/counterparty-display';

type CounterpartyPickerProps = {
  title?: string;
  description?: string;
  buttonLabel?: string;
  selectedLabel?: string;
  nameOrder?: CounterpartyNameOrder;
  options: CounterpartyOption[];
  selectedId: string;
  onSelect: (option: CounterpartyOption) => void;
};

type CounterpartyNameOrder = 'default' | 'chinese-english';

const pageSize = 8;

const dialogOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.36)',
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  zIndex: 60,
} satisfies React.CSSProperties;

const dialogCardStyle = {
  width: 'min(960px, 100%)',
  maxHeight: 'min(80vh, 920px)',
  overflow: 'hidden',
  borderRadius: '24px',
  border: '1px solid #d8e1ea',
  background: '#ffffff',
  boxShadow: '0 28px 80px rgba(15, 23, 42, 0.18)',
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#0f172a',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '14px',
  color: '#0f172a',
  background: '#ffffff',
} satisfies React.CSSProperties;

const helperTextStyle = {
  margin: 0,
  color: '#64748b',
  fontSize: '13px',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '10px 14px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties;

const chipButtonStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  padding: '8px 12px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties;

function getCounterpartyShortName(option: CounterpartyOption | null | undefined) {
  const shortName = option?.shortName?.trim() ?? '';
  if (!shortName || shortName === option?.name || shortName === option?.code) {
    return '';
  }

  return shortName;
}

function hasChineseText(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function formatCounterpartyDefaultDisplayName(option: CounterpartyOption | null | undefined) {
  if (!option) {
    return '';
  }

  return [option.name, getCounterpartyShortName(option)].filter(Boolean).join(' / ');
}

function formatCounterpartyDisplayName(
  option: CounterpartyOption | null | undefined,
  nameOrder: CounterpartyNameOrder = 'default',
) {
  if (!option) {
    return '';
  }

  if (nameOrder === 'default') {
    return formatCounterpartyDefaultDisplayName(option);
  }

  const shortName = getCounterpartyShortName(option);
  if (option.name.trim() && shortName && hasChineseText(option.name) && hasChineseText(shortName)) {
    return formatCounterpartyDefaultDisplayName(option);
  }

  return formatCounterpartyBilingualDisplay(option.name, {
    code: option.code,
    fullName: shortName,
  });
}

export function formatCounterpartyOptionLabel(
  option: CounterpartyOption | null | undefined,
  options: { nameOrder?: CounterpartyNameOrder } = {},
) {
  if (!option) {
    return '';
  }

  return [option.code, formatCounterpartyDisplayName(option, options.nameOrder)]
    .filter(Boolean)
    .join(' / ');
}

export function CounterpartyPicker({
  title = '选择往来单位',
  description = '支持按编码、名称搜索，并在弹框中分页选择。',
  buttonLabel = '选择往来单位',
  selectedLabel = '当前选中',
  nameOrder = 'default',
  options,
  selectedId,
  onSelect,
}: CounterpartyPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const selectedOption = options.find((option) => String(option.id) === selectedId) ?? null;
  const filteredOptions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return options;
    }

    return options.filter((option) =>
      [option.code, option.name, option.shortName ?? '', option.type]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [options, searchQuery]);
  const pageCount = Math.max(1, Math.ceil(filteredOptions.length / pageSize));
  const normalizedPage = Math.min(page, pageCount);
  const pagedOptions = filteredOptions.slice(
    (normalizedPage - 1) * pageSize,
    normalizedPage * pageSize,
  );

  return (
    <>
      <button
        type="button"
        style={secondaryButtonStyle}
        onClick={() => {
          setIsOpen(true);
          setSearchQuery('');
          setPage(1);
        }}
      >
        {buttonLabel}
      </button>

      {isOpen ? (
        <div style={dialogOverlayStyle}>
          <div role="dialog" aria-modal="true" aria-labelledby="counterparty-picker-title" style={dialogCardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'center',
                padding: '20px 24px 12px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'grid', gap: '6px' }}>
                <h3 id="counterparty-picker-title" style={{ margin: 0, color: '#0f172a' }}>
                  {title}
                </h3>
                <p style={helperTextStyle}>{description}</p>
              </div>
              <button type="button" style={secondaryButtonStyle} onClick={() => setIsOpen(false)}>
                关闭
              </button>
            </div>

            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'grid',
                gap: '12px',
              }}
            >
              <label style={labelStyle}>
                搜索往来单位 Search Counterparty
                <input
                  aria-label="搜索往来单位 Search Counterparty"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setPage(1);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                    }
                  }}
                  placeholder="输入编码、名称或类型"
                  style={inputStyle}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <p style={helperTextStyle}>共 {filteredOptions.length} 条结果</p>
                <p style={helperTextStyle}>第 {normalizedPage} / {pageCount} 页</p>
              </div>
            </div>

            <div style={{ overflow: 'auto', padding: '0 24px 16px' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: '720px',
                  borderCollapse: 'collapse',
                  tableLayout: 'fixed',
                }}
              >
                <colgroup>
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '38%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr>
                    {[
                      '编码',
                      nameOrder === 'chinese-english' ? '中文名称 / 英文名称' : '单位名称 / 中文名称',
                      '类型',
                      '操作',
                    ].map((heading, index) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: index === 3 ? 'center' : 'left',
                          padding: '12px 16px',
                          fontSize: '13px',
                          color: '#475569',
                          background: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedOptions.length > 0 ? (
                    pagedOptions.map((option) => {
                      const displayName = formatCounterpartyDisplayName(option, nameOrder);

                      return (
                        <tr key={option.id}>
                          <td style={tableCellStyle}>{option.code}</td>
                          <td style={tableCellStyle}>
                            <div style={{ display: 'grid', gap: '4px' }}>
                              {displayName.includes(' / ') ? (
                                <span>
                                  {displayName.split(' / ').map((segment, index, segments) => (
                                    <span key={`${option.id}-${segment}-${index}`}>
                                      <span>{segment}</span>
                                      {index < segments.length - 1 ? <span> / </span> : null}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span>{displayName}</span>
                              )}
                            </div>
                          </td>
                          <td style={tableCellStyle}>{option.type}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                            <button
                              type="button"
                              style={chipButtonStyle}
                              onClick={() => {
                                onSelect(option);
                                setIsOpen(false);
                              }}
                            >
                              选择
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '18px 16px', textAlign: 'center', color: '#64748b' }}>
                        未找到匹配的往来单位
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'center',
                padding: '16px 24px 24px',
                borderTop: '1px solid #e2e8f0',
                flexWrap: 'wrap',
              }}
            >
              <p style={helperTextStyle}>
                {selectedLabel}：
                {selectedOption ? formatCounterpartyOptionLabel(selectedOption, { nameOrder }) : '未选择'}
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={normalizedPage <= 1}
                >
                  上一页
                </button>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={normalizedPage >= pageCount}
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const tableCellStyle = {
  padding: '14px 16px',
  fontSize: '14px',
  borderBottom: '1px solid #eef2f7',
  verticalAlign: 'middle',
  wordBreak: 'break-word',
} satisfies React.CSSProperties;
