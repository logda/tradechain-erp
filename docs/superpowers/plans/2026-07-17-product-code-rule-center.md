# Product Code Rule Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把产品采购编码从单一“供应商编码 + 流水号”升级为可配置的正式版规则中心，并打通规则页、产品创建页提示和后端真实生成逻辑。

**Architecture:** 在 `@erp/shared` 抽出统一规则类型与拼装/预览逻辑，前后端共同复用；API 层负责规则持久化与生成校验；Web 层负责规则配置、预览和创建页提示联动。

**Tech Stack:** TypeScript, Next.js, NestJS, Vitest, Jest, workspace package `@erp/shared`

---

### Task 1: 共享规则模型

**Files:**
- Create: `packages/shared/src/product-code-rule.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/product-code-rule.spec.ts`

- [ ] 写共享层失败测试，覆盖规则描述、规则校验、示例编码生成
- [ ] 运行共享层测试确认先失败
- [ ] 实现 `ProductCodeRule`、段定义、分类编码映射、描述函数、预览函数、校验函数
- [ ] 再跑共享层测试确认转绿

### Task 2: API 规则存储与读取兼容

**Files:**
- Modify: `apps/api/src/product/product-code-rule.store.ts`
- Modify: `apps/api/src/product/product.service.ts`
- Test: `apps/api/test/product.service.spec.ts`
- Test: `apps/api/test/product.controller.spec.ts`

- [ ] 先补失败测试，覆盖旧规则兼容、新规则保存、非法规则拒绝
- [ ] 运行 API 定向测试确认先失败
- [ ] 扩展规则存储结构，并兼容旧版 `supplier_sequence`
- [ ] 扩展 `getCodeRule` / `updateCodeRule`
- [ ] 再跑 API 定向测试确认通过

### Task 3: API 采购编码真实生成

**Files:**
- Modify: `apps/api/src/product/product.service.ts`
- Test: `apps/api/test/product.service.spec.ts`

- [ ] 先补失败测试，覆盖：
- [ ] `prefix + supplier + serial`
- [ ] `supplier + category + year_month + serial`
- [ ] `global` 流水
- [ ] `per_supplier` 流水
- [ ] 缺供应商或缺分类时报错
- [ ] 运行失败测试确认当前实现不满足
- [ ] 改造采购编码生成逻辑
- [ ] 再跑 API 定向测试确认通过

### Task 4: Web 规则中心页

**Files:**
- Modify: `apps/web/app/app/master-data/products/product-code-rule.ts`
- Modify: `apps/web/app/app/master-data/product-code-rule/page.tsx`
- Modify: `apps/web/app/app/master-data/product-code-rule/update-product-code-rule-form.tsx`
- Test: `apps/web/tests/app-product-code-rule-page.test.tsx`

- [ ] 先补失败测试，覆盖规则摘要、示例预览、规则段提示、保存按钮仍可见
- [ ] 运行 Web 定向测试确认先失败
- [ ] 切换到共享规则类型
- [ ] 把规则页改成正式版配置区 + 提示区 + 预览区
- [ ] 再跑 Web 定向测试确认通过

### Task 5: 产品创建页联动提示

**Files:**
- Modify: `apps/web/app/app/master-data/products/create-product-form.tsx`
- Modify: `apps/web/app/app/master-data/products/page.tsx`
- Test: `apps/web/tests/app-products-page.test.tsx`

- [ ] 先补失败测试，覆盖自动生成规则新文案、生成前提、缺失提示、样例编码
- [ ] 运行 Web 定向测试确认先失败
- [ ] 接入共享规则描述与预览逻辑
- [ ] 在创建页显示缺失字段提示与示例
- [ ] 再跑 Web 定向测试确认通过

### Task 6: 最终回归

**Files:**
- Verify only

- [ ] 运行 `CI=true pnpm --filter web test -- app-product-code-rule-page.test.tsx app-products-page.test.tsx`
- [ ] 运行 `CI=true pnpm --filter api test -- product.service.spec.ts product.controller.spec.ts`
- [ ] 运行 `CI=true pnpm --filter web test`
- [ ] 如共享层新增测试，运行 `pnpm --filter @erp/shared test`
