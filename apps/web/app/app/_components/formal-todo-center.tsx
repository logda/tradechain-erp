'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { FormalTodoItem } from '../_lib/formal-todos';
import { formatFormalUserLabel } from '../_lib/formal-user-display';
import { FilterPanel } from './filter-panel';
import { TodoGroup } from './todo-group';

type Filters = { keyword: string; domain: string; status: string };
const emptyFilters: Filters = { keyword: '', domain: '', status: '' };

function isFilters(value: unknown): value is Filters {
  const filters = value as Filters | null;
  return !!filters && typeof filters.keyword === 'string' && typeof filters.status === 'string' &&
    ['', 'sales', 'purchase', 'operations', 'after_sales'].includes(filters.domain);
}

function matches(todo: FormalTodoItem, filters: Filters) {
  const keyword = filters.keyword.trim().toLocaleLowerCase();
  const text = [todo.docNo, todo.title, todo.moduleLabel, todo.statusLabel,
    formatFormalUserLabel(todo, 'ownerName'), formatFormalUserLabel(todo, 'handlerLabel'), todo.nextAction, todo.description, todo.customerName, todo.supplierName,
    ...(todo.productNames ?? [])].join(' ').toLocaleLowerCase();
  return (!keyword || text.includes(keyword)) &&
    (!filters.domain || todo.domain === filters.domain) &&
    (!filters.status || todo.statusLabel === filters.status);
}

export function FormalTodoCenter({ todos, sessionKey }: { todos: FormalTodoItem[]; sessionKey?: string }) {
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [filterVersion, setFilterVersion] = useState(0);
  const [cacheReady, setCacheReady] = useState(false);
  const cacheKey = sessionKey ? `erp-todo-query:${sessionKey}` : null;
  const filtered = todos.filter((todo) => matches(todo, applied));
  const statuses = [...new Set(todos.map((todo) => todo.statusLabel))].sort();
  const groupKey = `${filterVersion}:${JSON.stringify(applied)}`;
  const groupCacheKey = (domain: string, filters = applied) => sessionKey ? `erp-todo-group:${sessionKey}:${JSON.stringify(filters)}:${domain}` : undefined;

  useEffect(() => {
    if (!cacheKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(cacheKey) ?? 'null');
      if (saved && isFilters(saved.draft) && isFilters(saved.applied)) {
        setDraft(saved.draft);
        setApplied(saved.applied);
      }
    } catch { /* No usable query context is available. */ }
    setCacheReady(true);
  }, [cacheKey]);
  useEffect(() => {
    if (!cacheKey || !cacheReady) return;
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ draft, applied })); }
    catch { /* Query controls remain usable without storage. */ }
  }, [cacheKey, cacheReady, draft, applied]);

  function resetGroupPages(filters: Filters) {
    for (const domain of ['purchase', 'sales', 'after-sales']) {
      const key = groupCacheKey(domain, filters);
      if (key) try { sessionStorage.removeItem(key); } catch { /* Storage is optional. */ }
    }
  }

  function query(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetGroupPages(draft);
    setApplied(draft);
    setFilterVersion((version) => version + 1);
  }

  function reset() {
    resetGroupPages(emptyFilters);
    setDraft(emptyFilters);
    setApplied(emptyFilters);
    setFilterVersion((version) => version + 1);
  }

  return <>
    <FilterPanel title="待办筛选" appliedSummary={[applied.keyword && `关键词：${applied.keyword}`, applied.domain && `业务：${({ sales: '销售', purchase: '采购', operations: '运营', after_sales: '售后' } as Record<string, string>)[applied.domain]}`, applied.status && `状态：${applied.status}`].filter(Boolean).join('；')} onClear={reset}>
    <form className="erp-todo-filters" onSubmit={query}>
      <label>关键词<input aria-label="关键词" value={draft.keyword} onChange={(event) => setDraft({ ...draft, keyword: event.target.value })} placeholder="单号、产品、客户、供应商或负责人" /></label>
      <label>业务范围<select aria-label="业务范围" value={draft.domain} onChange={(event) => setDraft({ ...draft, domain: event.target.value })}>
        <option value="">全部</option><option value="sales">销售</option><option value="purchase">采购</option><option value="operations">运营</option><option value="after_sales">售后</option>
      </select></label>
      <label>状态<select aria-label="状态" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
        <option value="">全部</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select></label>
      <div className="erp-todo-filters__actions"><button type="submit" className="erp-todo-button erp-todo-button--primary">查询</button><button type="button" className="erp-todo-button" onClick={reset}>重置</button></div>
    </form>
    </FilterPanel>
    <p className="erp-todo-result-count">查询结果：共 {filtered.length} 条</p>
    <div className="erp-home-todo-groups">
      <TodoGroup key={`purchase-${groupKey}`} cacheKey={groupCacheKey('purchase')} title="采购与运营待办" todos={filtered.filter((todo) => todo.domain === 'purchase' || todo.domain === 'operations')} />
      <TodoGroup key={`sales-${groupKey}`} cacheKey={groupCacheKey('sales')} title="销售待办" todos={filtered.filter((todo) => todo.domain === 'sales')} />
      <TodoGroup key={`after-sales-${groupKey}`} cacheKey={groupCacheKey('after-sales')} title="售后待办" todos={filtered.filter((todo) => todo.domain === 'after_sales')} />
    </div>
  </>;
}
