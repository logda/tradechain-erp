# Quote Inquiry Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make formal quotes support draft/submit actions and automatically create linked inquiry documents that procurement can continue editing with supplier-side data.

**Architecture:** Keep the current formal quote and formal inquiry pages as separate modules, but make them share one business chain through source quote linkage and synchronized payload fields. Implement the first slice by extending the existing `quote` and `quote_inquiry` persistence model, then adapt the formal quote create flow and formal inquiry detail/list views around that linkage.

**Tech Stack:** Next.js App Router, server actions, NestJS, Prisma/runtime store dual persistence, Vitest

---

### Task 1: 固化设计与共享字段映射

**Files:**
- Create: `docs/superpowers/specs/2026-07-19-quote-inquiry-linkage-design.md`
- Create: `docs/superpowers/plans/2026-07-19-quote-inquiry-linkage.md`
- Modify: `outputs/erp-system-design.md`

- [ ] **Step 1: 写入设计文档**

记录：

- 报价单与询价单的主从关系
- 草稿/提交动作
- 客户/供应商类型约束
- 报价共享字段与询价私有字段

- [ ] **Step 2: 在系统设计稿中补充一期正式版口径**

补充“报价单提交生成询价单”的实施说明，保证后续交接文档统一。

### Task 2: 报价单提交动作测试

**Files:**
- Modify: `apps/api/test/quote.controller.spec.ts`
- Modify: `apps/api/test/quote.service.spec.ts`
- Modify: `apps/web/tests/app-formal-quote-create.test.tsx`
- Modify: `apps/web/tests/quote-create-actions.test.ts`

- [ ] **Step 1: 先写失败测试，覆盖动作区分**

覆盖：

- 草稿创建时状态为 `draft`
- 提交创建时状态为 `submitted`
- 提交后返回关联询价单信息

- [ ] **Step 2: 运行定向测试确认失败**

Run: `CI=true pnpm --filter api test -- quote.controller.spec.ts quote.service.spec.ts`

Run: `CI=true pnpm --filter web test -- app-formal-quote-create.test.tsx quote-create-actions.test.ts`

Expected: FAIL because create API and前端 action 还不支持 `submitMode`

### Task 3: API 侧报价创建支持草稿/提交

**Files:**
- Modify: `apps/api/src/quote/dto/create-quote.dto.ts`
- Modify: `apps/api/src/quote/quote.controller.ts`
- Modify: `apps/api/src/quote/quote.service.ts`
- Modify: `apps/api/src/quote/quote.store.ts`

- [ ] **Step 1: 给 DTO 增加提交动作字段**

增加：

- `submitMode?: 'draft' | 'submit'`

- [ ] **Step 2: 在服务层区分创建结果**

规则：

- `draft` -> 报价单状态 `draft`
- `submit` -> 报价单状态 `submitted`

- [ ] **Step 3: 返回关联询价信息占位**

创建结果中返回：

- `id`
- `status`
- `linkedInquiryId?`
- `linkedInquiryNo?`

- [ ] **Step 4: 运行定向 API 测试**

Run: `CI=true pnpm --filter api test -- quote.controller.spec.ts quote.service.spec.ts`

Expected: PASS

### Task 4: API 侧自动生成询价单

**Files:**
- Modify: `apps/api/src/inquiry/inquiry.service.ts`
- Modify: `apps/api/src/inquiry/inquiry.store.ts`
- Modify: `apps/api/src/inquiry/inquiry-list.data.ts`
- Modify: `apps/api/src/quote/quote.service.ts`
- Modify: `apps/api/test/inquiry-list.spec.ts`
- Modify: `apps/api/test/inquiry.persistence.spec.ts`

- [ ] **Step 1: 先写失败测试，覆盖生成联动**

覆盖：

- 提交报价单后自动生成 `quote_inquiry`
- 询价单保存来源报价单号、版本号和共享字段
- 询价单默认状态为 `draft`

- [ ] **Step 2: 运行测试确认失败**

Run: `CI=true pnpm --filter api test -- inquiry-list.spec.ts inquiry.persistence.spec.ts`

Expected: FAIL because quote create does not create inquiry documents

- [ ] **Step 3: 实现询价单创建方法**

在询价服务或共享 helper 中实现：

- 从报价单数据映射询价单 payload
- 默认共享图片、产品、需求、数量、目的地、询单日期
- 不向采购暴露客户目标价和销售单价

- [ ] **Step 4: 在报价提交逻辑中调用询价单创建**

提交报价单时：

- 仅当 `submitMode === 'submit'`
- 自动创建关联询价单
- 回写返回值

- [ ] **Step 5: 运行定向 API 测试**

Run: `CI=true pnpm --filter api test -- inquiry-list.spec.ts inquiry.persistence.spec.ts quote.service.spec.ts`

Expected: PASS

### Task 5: 客户/供应商类型约束测试

**Files:**
- Modify: `apps/api/test/quote.service.spec.ts`
- Modify: `apps/api/test/counterparty.service.spec.ts`
- Modify: `apps/web/tests/app-formal-quote-create.test.tsx`

- [ ] **Step 1: 先写失败测试**

覆盖：

- 报价单客户只能来自客户类往来单位
- 手填客户同步创建时类型固定为 `customer`
- 询价单位只能来自供应商类往来单位

- [ ] **Step 2: 运行测试确认失败**

Run: `CI=true pnpm --filter api test -- quote.service.spec.ts counterparty.service.spec.ts`

Expected: FAIL because current validation does not fully distinguish customer/supplier usage

### Task 6: 报价与询价的类型约束实现

**Files:**
- Modify: `apps/api/src/quote/quote.service.ts`
- Modify: `apps/api/src/counterparty/counterparty.service.ts`
- Modify: `apps/api/src/inquiry/inquiry.service.ts`

- [ ] **Step 1: 报价单客户选择增加客户类校验**

existing 客户模式下，若往来单位不是客户类，则报错。

- [ ] **Step 2: 询价单位选择增加供应商类校验**

询价单维护采购侧字段时，若往来单位不是供应商类，则报错。

- [ ] **Step 3: 运行定向测试**

Run: `CI=true pnpm --filter api test -- quote.service.spec.ts counterparty.service.spec.ts inquiry.persistence.spec.ts`

Expected: PASS

### Task 7: 前端报价单创建页支持双动作

**Files:**
- Modify: `apps/web/app/app/sales/quotes/new/create-formal-quote-form.tsx`
- Modify: `apps/web/app/app/sales/quotes/new/actions.ts`
- Modify: `apps/web/app/app/sales/quotes/new/formal-quote-validation.ts`
- Modify: `apps/web/tests/app-formal-quote-create.test.tsx`

- [ ] **Step 1: 先写失败测试**

覆盖：

- 页面显示 `保存草稿` 与 `提交并进入询价`
- 提交时带上 `submitMode=submit`
- 保存草稿时带上 `submitMode=draft`

- [ ] **Step 2: 运行前端测试确认失败**

Run: `CI=true pnpm --filter web test -- app-formal-quote-create.test.tsx`

Expected: FAIL because current form only has one create action

- [ ] **Step 3: 实现双动作提交**

通过隐藏字段或按钮值区分：

- 草稿
- 提交

- [ ] **Step 4: 运行前端测试**

Run: `CI=true pnpm --filter web test -- app-formal-quote-create.test.tsx quote-create-actions.test.ts`

Expected: PASS

### Task 8: 询价单详情页补采购侧字段

**Files:**
- Modify: `apps/web/app/app/sales/inquiries/[id]/page.tsx`
- Modify: `apps/web/tests/app-formal-inquiry-pages.test.tsx`
- Modify: `apps/api/src/inquiry/inquiry.service.ts`

- [ ] **Step 1: 先写失败测试**

覆盖页面展示：

- 采购
- 询价单位
- 采购价格
- 当前进度

并确保不展示：

- 客户目标价
- 销售单价

- [ ] **Step 2: 运行测试确认失败**

Run: `CI=true pnpm --filter web test -- app-formal-inquiry-pages.test.tsx`

Expected: FAIL because current inquiry detail does not expose procurement-side fields

- [ ] **Step 3: 实现详情页第一阶段展示**

先完成展示和追溯区，不在本任务里做完整编辑弹层。

- [ ] **Step 4: 运行测试**

Run: `CI=true pnpm --filter web test -- app-formal-inquiry-pages.test.tsx`

Expected: PASS

### Task 9: 报价详情页增加询价追溯

**Files:**
- Modify: `apps/web/app/app/sales/quotes/[id]/page.tsx`
- Modify: `apps/web/tests/app-formal-detail-pages.test.tsx`

- [ ] **Step 1: 写失败测试**

覆盖：

- 报价详情可看到关联询价单号
- 可从报价详情跳转询价详情

- [ ] **Step 2: 运行测试确认失败**

Run: `CI=true pnpm --filter web test -- app-formal-detail-pages.test.tsx`

Expected: FAIL because quote detail does not show linked inquiry metadata

- [ ] **Step 3: 实现最小追溯 UI**

在详情页增加“询价追溯”区块。

- [ ] **Step 4: 运行测试**

Run: `CI=true pnpm --filter web test -- app-formal-detail-pages.test.tsx`

Expected: PASS

### Task 10: 回归验证

**Files:**
- Modify: `outputs/erp-system-design.md`
- Modify: `outputs/erp-mvp-handoff.md`

- [ ] **Step 1: 更新交接文档**

补充正式版报价-询价联动第一阶段说明。

- [ ] **Step 2: 跑后端测试**

Run: `CI=true pnpm --filter api test`

Expected: PASS

- [ ] **Step 3: 跑前端测试**

Run: `CI=true pnpm --filter web test`

Expected: PASS

- [ ] **Step 4: 数据库校验**

Run: `DATABASE_URL='mysql://erp_app:<db-password>@127.0.0.1:3306/erp' CI=true pnpm --filter api db:verify`

Expected: `ok: true`
