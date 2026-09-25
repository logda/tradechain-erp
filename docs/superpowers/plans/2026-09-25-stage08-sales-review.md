# 第 08 段：销售单详情与成本提醒实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 R08-01～R08-06、R14-01、R14-02、R14-04、R14-05，并与第 07 段合并提交验收。

**Architecture:** 销售单详情页只调整现有栏目位置与展示，不改变收口判定。审核成本提醒由受权限保护的 API 读取销售单及产品库当前采购价，仅返回低于成本的产品名称；前端不接收成本数值。runtime 与 Prisma 复用产品服务的现有双模式查询。

**Tech Stack:** NestJS、Next.js App Router、Jest、Vitest。

**Spec:** `docs/requirements/v1.2.0-followups.md` 第 8、14 节；`docs/superpowers/plans/2026-09-24-v1.2.0-followups-stages.md` 第 08 段。

## Global Constraints

- 仅修改第 08 段所需文件，不回填历史单据，不改变采购和销售收口业务状态判定。
- 销售审核提醒只列实际产品名称，不返回采购价，不阻止审批；缺少产品库采购价时不提醒。
- 页面与接口都限制成本检查权限，成功后页面及时刷新；最终运行 `make ci`，不部署或打标签。

## Review Focus

- 产品库无采购价、销售价等于采购价：不提醒。
- 同一单有多行：只列低于成本的实际产品名称，不泄露采购金额。
- 审核节点以外与无审批权限角色：不得显示提醒或读取接口。
- 来源需求单：底部仅一条显著链接；直建销售单仍显示来源类型。
- 展示顺序改变后：销售收口判断和审批接口继续使用原有状态逻辑。

---

### Task 1: 销售单录入单位默认值

**Files:** `apps/web/app/app/sales/orders/new/create-sales-order-form.tsx`、`apps/api/src/sales-order/sales-order.service.ts`、`apps/web/tests/app-formal-sales-order-create.test.tsx`、`apps/api/test/sales-order-rules.spec.ts`。

- [x] 在 web/API 测试中断言新手填行与省略单位的直建请求默认 `个/pc`，选择产品和用户修改单位后能保留修改。
- [x] 运行相关测试确认先失败，再将新建默认值设为 `个/pc`；编辑既有单据时保留原单位。
- [x] 运行相关测试确认通过。
  > web 17 个、API 38 个定向测试通过；新建时使用默认值，已有草稿行沿用已保存单位。

### Task 2: 销售详情布局与来源

**Files:** `apps/web/app/app/sales/orders/[id]/page.tsx`、`apps/web/tests/app-formal-detail-pages.test.tsx`。

- [x] 测试固定状态、销售明细、收口检查、其余字段、底部来源的顺序，并断言关联采购单栏目消失；需求来源仅一条链接。
- [x] 运行测试确认先失败，再移动栏目与按“收款 → 财务 → 交货 → 回单 → 售后 → 交货代”排列六项展示。
- [x] 运行测试确认通过，并确认原有 `canClose` 与 API 状态逻辑未变。
  > web 相关 30 个测试通过；“交货”展示判断从已发货开始，“交货代”继续沿用原收口判断，API 状态规则未改。

### Task 3: 审核成本提醒

**Files:** `apps/api/src/product/product.service.ts`、`apps/api/src/sales-order/sales-order.controller.ts`、`apps/web/app/app/sales/orders/[id]/page.tsx`、相应 API/web 测试。

- [x] 测试以产品库当前采购价比较，覆盖低于、等于、缺价、多个明细及无权限；响应只含产品名称。
- [x] 运行测试确认先失败，再加受限成本提醒接口与审核页常驻提示；提醒不拦审批。
- [x] 运行相关测试确认通过，检查当前产品库价更新后重新查看会刷新提醒。
  > API 成本检查测试覆盖 runtime/Prisma 查询、审批节点、重新读取当前价；web 测试覆盖主管常驻提示及普通销售不发起查询。

### Task 4: 合并验证与交付

- [x] 运行 `make ci`；有条件时在隔离 runtime 页面验证第 07、08 段完整场景，并记录 Prisma 实库限制。
  > `make ci` 全绿：shared 42、web 376、API 544，共 962 项。隔离 runtime 页面验证新建销售单默认单位、低于成本常驻提醒、审批后提醒和按钮消失、销售单进入采购中及生成 `C2609250100` 关联采购单。Prisma 以 mock 测试双模式读取，未连接真实 MySQL。
- [x] 更新阶段进度、核对差异与未跟踪需求文档，提交第 08 段；一次性汇报 07/08 验收步骤后停止。
  > 已核对本段改动与未跟踪的 `docs/requirements/`，不把需求资料加入提交；第 07、08 段合并等待用户验收，不推进第 09 段。
