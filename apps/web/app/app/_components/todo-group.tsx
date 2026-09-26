'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormalTodoItem } from '../_lib/formal-todos';

const PAGE_SIZE = 5;

function formatTodoTime(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function safeImageUrl(value?: string) {
  return value && (/^https?:\/\//i.test(value) || (value.startsWith('/') && !value.startsWith('//')))
    ? value : null;
}

export function TodoGroup({ title, todos }: { title: string; todos: FormalTodoItem[] }) {
  const [expanded, setExpanded] = useState(true);
  const [requestedPage, setRequestedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(todos.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const visibleTodos = todos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section className="erp-home-todo-group" role="region" aria-label={title}>
      <div className="erp-home-todo-group__head">
        <h3><button type="button" className="erp-home-todo-group__toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> {title}
        </button></h3>
        <span>共 {todos.length} 条</span>
      </div>
      {expanded ? <>
        {todos.length === 0 ? <p className="erp-home-todo-empty">暂无待办</p> : (
          <ul className="erp-home-todo-list">
            {visibleTodos.map((todo) => {
              const imageUrl = safeImageUrl(todo.imageUrls?.[0]);
              return (
                <li key={todo.id} className="erp-home-todo-row">
                  <div className="erp-home-todo-row__image">
                    {imageUrl ? <img src={imageUrl} alt={todo.productNames?.[0] || '业务图片'} /> : <span>暂无图片</span>}
                  </div>
                  <div className="erp-home-todo-row__content">
                    <strong>{todo.title}</strong>
                    <span><span>{todo.docNo}</span> · {todo.statusLabel}</span>
                    {todo.productNames?.length ? <span title={todo.productNames.join('、')}>产品：{todo.productNames.join('、')}</span> : null}
                    {todo.customerName ? <span>客户：{todo.customerName}</span> : null}
                    {todo.supplierName ? <span>供应商：{todo.supplierName}</span> : null}
                  </div>
                  <div className="erp-home-todo-row__action">
                    <time>{formatTodoTime(todo.createdAt)}</time>
                    <Link href={todo.href}>打开单据</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {todos.length > 0 ? <nav className="erp-home-todo-pagination" aria-label={`${title}分页`}>
          <span>第 {page} / {pageCount} 页</span>
          <button type="button" disabled={page === 1} onClick={() => setRequestedPage(page - 1)}>上一页</button>
          <button type="button" disabled={page === pageCount} onClick={() => setRequestedPage(page + 1)}>下一页</button>
        </nav> : null}
      </> : null}
    </section>
  );
}
