const noteStyle = {
  margin: '0 0 16px',
  border: '1px solid #d8e1ea',
  borderRadius: '14px',
  padding: '12px 14px',
  background: '#f8fafc',
  color: '#334155',
  fontSize: '13px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

export function ActionPermissionNote({ children }: { children: string }) {
  return <p style={noteStyle}>{children}</p>;
}
