# Formal List Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前所有缺少分页结构的正式列表页补齐统一的分页查询、分页返回和分页交互。

**Architecture:** 沿用现有正式页的分页模式，在 API 层统一返回 `{ items, total, page, pageSize }`，在页面层统一从 `searchParams` 读取 `page/pageSize`、透传到 API、保留筛选参数，并渲染总数和上一页/下一页。优先保持现有页面结构，不做无关重构。

**Tech Stack:** NestJS, Next.js App Router, Vitest, React Testing Library, TypeScript

---

### Task 1: 锁定缺分页页面范围与统一行为

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/docs/superpowers/plans/2026-07-16-formal-list-pagination.md`

- [ ] 需要补分页的正式列表页范围固定为：
  - `apps/web/app/app/master-data/counterparties/page.tsx`
  - `apps/web/app/app/master-data/products/page.tsx`
  - `apps/web/app/app/admin/users/page.tsx`
  - `apps/web/app/app/warehouses/page.tsx`
  - `apps/web/app/app/stock-in/page.tsx`
  - `apps/web/app/app/stock-out/page.tsx`
  - `apps/web/app/app/inventory/page.tsx`
- [ ] 对应 API 范围固定为：
  - `apps/api/src/counterparty/*`
  - `apps/api/src/product/*`
  - `apps/api/src/user-management/*`
  - `apps/api/src/warehouse/*`
  - `apps/api/src/stock-in/*`
  - `apps/api/src/stock-out/*`
  - `apps/api/src/inventory/*`
- [ ] 统一行为固定为：
  - 默认 `page=1`
  - 默认 `pageSize=20`
  - 非法页码回退到默认值
  - 响应结构统一包含 `items`、`total`、`page`、`pageSize`
  - 前端分页条至少包含总数、当前页、上一页、下一页

### Task 2: 先写前端失败测试，锁定分页 UI 和参数透传

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/app-counterparties-page.test.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/app-products-page.test.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/app-admin-users-page.test.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/tests/app-inventory-pages.test.tsx`

- [ ] 为 `counterparties` 增加测试，断言请求 URL 含 `page=2&pageSize=20`，且页面出现分页信息与上一页/下一页。
- [ ] 为 `products` 增加测试，断言请求 URL 带分页参数，且列表下方出现总数与分页操作。
- [ ] 为 `admin/users` 增加测试，断言用户列表请求带分页参数，审计日志和角色权限接口保持原样。
- [ ] 为 `inventory` 增加测试，断言余额与台账接口分别带分页参数，并各自展示分页区块。
- [ ] 视情况新增 `warehouses`、`stock-in`、`stock-out` 页面测试文件，至少覆盖一条分页参数透传与分页文案渲染。

### Task 3: 先写后端失败测试，锁定分页返回结构

**Files:**
- Modify or Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/counterparty/*.spec.ts`
- Modify or Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/product/*.spec.ts`
- Modify or Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/user-management/*.spec.ts`
- Modify or Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/warehouse/*.spec.ts`
- Modify or Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/stock-in/*.spec.ts`
- Modify or Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/stock-out/*.spec.ts`
- Modify or Create: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/inventory/*.spec.ts`

- [ ] 为 `counterparty.service` 增加分页测试，断言过滤后分页切片正确，且返回 `total/page/pageSize`。
- [ ] 为 `product.service` 增加分页测试，断言筛选和分页可同时生效。
- [ ] 为 `user-management.service` 增加分页测试，断言排序后分页返回正确。
- [ ] 为 `warehouse.service` 增加分页测试，断言列表总数和当前页数据正确。
- [ ] 为 `stock-in.service`、`stock-out.service` 增加分页测试，断言默认按最新时间排序后切片。
- [ ] 为 `inventory.service` 增加余额和台账双列表分页测试。

### Task 4: 实现后端统一分页查询与返回

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/counterparty/counterparty.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/counterparty/counterparty.controller.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/product/product.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/product/product.controller.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/user-management/user-management.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/user-management/user-management.controller.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/warehouse/warehouse.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/warehouse/warehouse.controller.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/stock-in/stock-in.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/stock-in/stock-in.controller.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/stock-out/stock-out.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/stock-out/stock-out.controller.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/inventory/inventory.service.ts`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/api/src/inventory/inventory.controller.ts`

- [ ] 为每个查询类型加入 `page`、`pageSize`。
- [ ] 在 controller 中把字符串参数规范化成正整数，并回退默认值。
- [ ] 在 service 中先完成原有过滤/排序，再计算 `total` 与 `slice`。
- [ ] 确保审计日志、角色权限等非列表接口不被改坏。

### Task 5: 实现前端分页条与参数透传

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/master-data/counterparties/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/master-data/products/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/admin/users/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/warehouses/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/stock-in/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/stock-out/page.tsx`
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/apps/web/app/app/inventory/page.tsx`

- [ ] 页面 query 对象增加 `page/pageSize`。
- [ ] API 请求拼接分页参数，同时保留现有筛选参数。
- [ ] fallback 数据也按同样分页结构处理，保证接口失败时页面结构不变。
- [ ] 在表格下方增加统一风格的分页信息与按钮，保持现有正式页视觉语言。
- [ ] `inventory` 需分别给“库存余额”和“库存台账”处理独立分页参数，避免相互干扰。

### Task 6: 运行验证并记录结果

**Files:**
- Modify: `/Users/zhongzheng/Documents/Codex/2026-07-07/0-erp-api-1-2-3/docs/superpowers/plans/2026-07-16-formal-list-pagination.md`

- [ ] 运行前端测试：`CI=true pnpm --filter web test`
- [ ] 运行后端测试：`CI=true pnpm --filter api test`
- [ ] 运行数据库校验：`DATABASE_URL='mysql://erp_app:<db-password>@127.0.0.1:3306/erp' CI=true pnpm --filter api db:verify`
- [ ] 如有失败，先修复失败后再报告结果。
- [ ] 输出结果时明确说明通过/失败数量和受影响范围。
