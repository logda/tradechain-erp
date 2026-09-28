import type { DemoSession } from '../_lib/demo-session';
import { getDataScopeLabel } from '../_lib/data-scope';

export function DataScopeNote({ session, dataScope, generatedAt, timeRange = 'all_time' }: {
  session: DemoSession; dataScope?: string; generatedAt?: string; timeRange?: string;
}) {
  return <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '13px', lineHeight: 1.7 }}>
    数据范围：{getDataScopeLabel(session, dataScope)} · 统计时间：{timeRange === 'all_time' ? '全部时间' : timeRange}
    {generatedAt && !Number.isNaN(Date.parse(generatedAt)) ? <> · 数据更新时间 <time dateTime={generatedAt}>{new Date(generatedAt).toLocaleString('zh-CN')}</time></> : null}
  </p>;
}
