import React from 'react';
import RootLayout from '../app/layout';

describe('formal UI foundation', () => {
  it('declares a Chinese document and the shared application surface', () => {
    const layout = RootLayout({ children: <div>ERP</div> });

    expect(layout.type).toBe('html');
    expect(layout.props.lang).toBe('zh-CN');
    expect(layout.props.children.type).toBe('body');
    expect(layout.props.children.props.className).toBe('erp-document');
  });
});
