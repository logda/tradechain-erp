'use client';

import { formatFormalUserLabel } from '../_lib/formal-user-display';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { FormalTodoItem } from '../_lib/formal-todos';
import { workspaceContentReadyEvent } from '../_lib/workspace-navigation';

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

export function TodoGroup({ title, todos, cacheKey }: { title: string; todos: FormalTodoItem[]; cacheKey?: string }) {
  const [expanded, setExpanded] = useState(true);
  const [requestedPage, setRequestedPage] = useState(1);
  const [relation, setRelation] = useState<'all' | 'action' | 'following'>('all');
  const [cacheReady, setCacheReady] = useState(false);
  const restoringPageRef = useRef(false);
  const actionCount = todos.filter((todo) => todo.relation === 'action').length;
  const followingCount = todos.filter((todo) => todo.relation === 'following').length;
  const filtered = relation === 'all' ? todos : todos.filter((todo) => todo.relation === relation);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const visibleTodos = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (!cacheKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(cacheKey) ?? 'null');
      if (saved && Number.isInteger(saved.page) && saved.page > 0 && ['all', 'action', 'following'].includes(saved.relation)) {
        restoringPageRef.current = true;
        setRequestedPage(saved.page);
        setRelation(saved.relation);
        if (typeof saved.expanded === 'boolean') setExpanded(saved.expanded);
      }
    } catch { /* No usable query context is available. */ }
    setCacheReady(true);
  }, [cacheKey]);
  useEffect(() => {
    if (!cacheKey || !cacheReady) return;
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ page, relation, expanded })); }
    catch { /* Query controls remain usable without storage. */ }
  }, [cacheKey, cacheReady, page, relation, expanded]);
  useEffect(() => {
    if (!cacheReady || !restoringPageRef.current) return;
    restoringPageRef.current = false;
    window.dispatchEvent(new Event(workspaceContentReadyEvent));
  }, [cacheReady, page, relation, expanded]);

  return (
    <section className="erp-home-todo-group" role="region" aria-label={title}>
      <div className="erp-home-todo-group__head">
        <h3><button type="button" className="erp-home-todo-group__toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> {title}
        </button></h3>
        <span>共 {todos.length} 条</span>
      </div>
      {expanded ? <>
        {actionCount + followingCount > 0 ? <div className="erp-home-todo-group__toolbar">
          <div className="erp-home-todo-views" role="group" aria-label="处理分工">
            {([['all', '全部', todos.length], ['action', '待我处理', actionCount], ['following', '我在跟进', followingCount]] as const).map(([value, label, count]) => <button key={value} type="button" className="erp-home-todo-views__button" aria-pressed={relation === value} onClick={() => { setRelation(value); setRequestedPage(1); }}>
              <span>{label}</span>{' '}<span className="erp-home-todo-views__count">{count}</span>
            </button>)}
          </div>
        </div> : null}
        {filtered.length === 0 ? <p className="erp-home-todo-empty">{relation === 'following' ? '暂无跟进任务' : '暂无待办'}</p> : (
          <ul className="erp-home-todo-list">
            {visibleTodos.map((todo) => {
              const imageUrl = safeImageUrl(todo.imageUrls?.[0]);
              return (
                <li key={todo.id} className="erp-home-todo-row" style={imageUrl ? undefined : { gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                  {imageUrl ? <div className="erp-home-todo-row__image"><img src={imageUrl} alt={todo.productNames?.[0] || '业务图片'} /></div> : null}
                  <div className="erp-home-todo-row__content">
                    <strong>{todo.title}</strong>
                    {todo.relation ? <span>{todo.relation === 'action' ? '待我处理' : '我在跟进'}</span> : null}
                    <span><span>{todo.docNo}</span>{todo.title.includes(todo.statusLabel) ? null : <> · {todo.statusLabel}</>}</span>
                    {todo.productNames?.length ? <span title={todo.productNames.join('、')}>产品：{todo.productNames.join('、')}</span> : null}
                    {todo.customerName ? <span>客户：{todo.customerName}</span> : null}
                    {todo.supplierName ? <span>供应商：{todo.supplierName}</span> : null}
                    {todo.nextAction ? <span>下一步：{todo.nextAction}</span> : null}
                    {todo.handlerLabel ? <span>当前处理人：{formatFormalUserLabel(todo, 'handlerLabel')}</span> : null}
                    {todo.dueDate ? <span>交期：{todo.dueDate}</span> : null}
                    {typeof todo.dueInDays === 'number' ? <strong>{todo.dueInDays < 0 ? `已逾期 ${-todo.dueInDays} 天` : todo.dueInDays === 0 ? '今天到期' : `还有 ${todo.dueInDays} 天`}</strong> : null}
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
        {pageCount > 1 ? <nav className="erp-home-todo-pagination" aria-label={`${title}分页`}>
          <span>第 {page} / {pageCount} 页</span>
          <button type="button" disabled={page === 1} onClick={() => setRequestedPage(page - 1)}>上一页</button>
          <button type="button" disabled={page === pageCount} onClick={() => setRequestedPage(page + 1)}>下一页</button>
        </nav> : null}
      </> : null}
    </section>
  );
}
