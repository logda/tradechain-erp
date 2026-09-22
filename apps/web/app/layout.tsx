import './formal-ui.css';
import type { ReactNode } from 'react';

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body className="erp-document">{children}</body>
    </html>
  );
}
