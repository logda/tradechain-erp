export function formatFormalUserLabel(record: object, field: string, empty = '—') {
  const item = record as Record<string, unknown> & { userDisplayNames?: Record<string, string> };
  const username = item.userDisplayNames?.[field];
  if (username !== undefined) return username || empty;
  const value = item[field];
  if (value === undefined || value === null || value === '') return empty;
  const text = String(value).trim();
  if (/^(?:(?:用户|操作人|员工|User)\s*[-#]?\s*)?\d+$/i.test(text)) return '历史账号未关联';
  return text.replace(/\s+#\d+$/, '');
}
