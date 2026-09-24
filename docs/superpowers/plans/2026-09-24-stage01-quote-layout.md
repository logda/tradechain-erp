# 第 01 段：需求/报价页面 Implementation Plan

> **For agentic workers:** 使用 superpowers:executing-plans 在当前会话逐项执行；只实施本段，结束后等待用户验收。

**Goal:** 交付 R05-01～R05-07 的可页面验收场景。

**Architecture:** 单据快照增加只读列表明细投影；web 共用双语状态展示，调整活路由列表与详情布局，复用现有操作表单。

**Tech Stack:** pnpm 9.12.0、NestJS/Prisma、Next.js/React、Jest/Vitest。

**Spec:** `docs/superpowers/specs/2026-09-24-stage01-quote-layout-design.md`

## Global Constraints

- 保留已有未提交需求文件，基于 0cf42df / v1.2.0 开发。
- 活路由为 `apps/web/app/app/`。不修改 legacy 页面，不改变业务审批与转单条件。
- runtime 与 Prisma 均从单据快照读取明细，不从当前主数据补写历史。
- 不发布、部署、合并或打标签。完成 `make ci` 后交付验收。

## Review Focus

- 多产品长名称：全文可访问，产品与数量逐条对齐。
- 无明细历史/演示记录：仍为一行并显示空值，不报错、不编造数据。
- 新旧状态与版本历史：不出现仅英文状态，不把来源码当状态。
- 采购信息隔离：列表仅投影四个安全明细字段。
- 待审批、已审批、已转单和无操作权限：布局变化不丢操作、不增加权限或重复说明。

## Task 1：列表明细与双语状态

文件：`packages/shared/src/quote-list.ts`、`apps/api/src/quote/quote.service.ts`、`apps/web/app/app/_lib/quote-status.ts`、`apps/web/app/app/sales/quotes/page.tsx`。

接口：`QuoteListItem.items?: Array<{lineNo: number; productName: string; quantity: number; unit: string}>`；`formatQuoteStatus(status?: string): string`。

- [x] 写 API 测试，验证多行历史快照的安全投影、角色范围及两种存储；运行观察缺少 items 的失败。
- [x] 写状态及列表页面测试，验证所有规范状态、历史状态、八列与多行对应；运行观察失败。
- [x] 以显式字段投影实现：`items: item.items.map(({ lineNo, productName, quantity, unit }) => ({ lineNo, productName, quantity, unit }))`。前端各行按同序显示产品和数量，不在单号下重复标题。
- [x] 运行 API 针对性测试、web 针对性测试，确认通过。

> 实际结果：新增 API 双模式测试先出现 2 个预期失败（列表没有 items），实现后报价相关 14 个测试通过。新增页面用例先出现列顺序/状态/布局等 5 个预期失败；修正实现和原测试中的列索引后通过。原有空明细记录不造数据，列表显示“-”。

## Task 2：详情布局与原操作回归

文件：`apps/web/app/app/sales/quotes/[id]/page.tsx`；测试：`apps/web/tests/app-formal-detail-pages.test.tsx` 及本段新增页面场景测试。

消费 Task 1 的 `formatQuoteStatus`。不新增写接口。

- [x] 增补详情验收场景：附件→明细→版本；老板待审批、销售待审批只读、审批后可转单、已转单不再出现转单入口；先运行确认新增行为失败。
- [x] 移动版本区，合并需求审批与转单动作，使用共用状态函数处理详情/版本/反馈状态。
- [x] 执行报价列表/详情/表单及 API 回归；运行 `PATH=<pnpm9-bin>:$PATH make ci`。
- [x] 使用隔离临时数据验证真实页面，记录角色、入口、截图和不能验证的限制。
- [x] 审查最终 diff，更新本计划的实际结果；向用户汇报并停止。

> 实际结果：详情附件位置原本已在明细前，保留该位置；版本移动到明细后。审批/转换仍使用原表单、原接口、原授权和状态条件。浏览器与独立审查发现审计区 status 仍纯英文，新增失败测试后，在 `audit-log.ts` 仅对 bizType=quote 的 status 字段复用双语展示，保留原始审计快照和其他模块格式。针对性审计/页面 19 个用例通过。

> 最终门禁：`CI=true NODE_OPTIONS=--dns-result-order=ipv4first PATH=/tmp/erp-stage01-tools/bin:$PATH make ci` 退出 0；安装、shared/API/Web 构建全部成功；shared 16 文件 / 41 测试，Web 67 文件 / 347 测试，API 94 套 / 485 测试，共 873 测试通过。日志 `/tmp/erp-stage01-ci-final.log`。`git diff --check` 通过。

## 执行记录

> 环境实际情况：系统 pnpm 为 11.19.0、没有 corepack；项目已装依赖由 pnpm 11 生成。找到本机缓存 pnpm 9.12.0 后，在 `/tmp/erp-stage01-tools/bin` 建立工具入口；官方源最初超时，使用 IPv4 优先成功按原 lockfile 安装。未改 package.json、lockfile 或仓库工具配置。
> 原有需求已完整确认，用户要求一般技术实现自行判断。本段采用现有流程上的有限设计，直接执行已授权第一段；不重复请求规则/技术方案批准。

## 页面验收记录与入口

- 原 3000/3001 端口被用户 SSH 转发占用，因此独立运行 Web `http://127.0.0.1:3100`、API `http://127.0.0.1:3101/api`；数据仅在 `/tmp/erp-stage01-acceptance-data`。服务在交付时保持运行，未动原服务/真实业务数据。
- 销售 Zoe：查看 XQ-STAGE01-810，只看到自己的需求；两产品分别为长名称风扇/台灯，数量为 12 个 / 3.5 箱，列表一行，产品名截断但详情完整；已检查浏览器截图。
- Boss/Mia：在 810 点击“审批通过”，当前状态自动变为 `boss_approved / 需求单审批通过`，同一“需求单操作”区显示转单，审批按钮消失。
- 销售 Zoe：刷新后转单成功跳转 S202607110100，原长名称、12 / 3.5 数量及单位保留；返回需求后只剩关联销售单入口，不再提供转换按钮。
- 最终构建重启后核对审计区：审批和转单两次 status 前后值均为英文 + 中文。
- 验收数据 XQ-STAGE01-811（所属销售 Leo）现已推进到 `ordered`，不再用它重复演示审批与转单。仍可打开 [销售 Leo 列表](http://127.0.0.1:3100/app/sales/quotes?role=sales&user=Leo&keyword=STAGE01) 检查多产品、数量及分隔，再打开 [需求详情](http://127.0.0.1:3100/app/sales/quotes/811?role=sales&user=Leo) 检查附件→明细→版本及动态标题。

## 限制与既有问题

- Prisma 路径使用存储边界 mock 测试，未连接真实 MySQL；本段没有 schema 变更、迁移或历史数据回填。
- 当前 URL 角色会话机制、全系统防重复保护属于后续 R02/R19；本段复用既有逻辑，不代表这些后续需求已完成。
- 真实验收观察到既有审计归属问题：Boss/Mia 执行审批，审计“操作人”显示单据所属销售 Zoe。代码 `QuoteService.approveDemand` 原本用 `existing.salesUserId` 写 operatorId。本段只修展示，不改写历史审计；后续审计段需核对此项。
- 未提交、发布、部署、合并或打版本标签。第 01 段等待用户验收，不自动进入下一段。

## 用户首次验收反馈修复

- 列表多产品及数量都显示 `lineNo.`，用同一行号对应，并在后续项之间加细分隔线；长产品名仍可通过悬停或详情查看全文。
- 需求单详情显示“附件 Attachments”和“需求明细”；报价单详情保留“报价附件 Quote Attachments”并显示“报价明细”。需求单草稿详情中的嵌入表单同步使用相应标签。
- 先修改验收测试并确认针对性失败，再完成页面修改；针对性 3 个测试文件 / 59 个用例通过。
- 修复后重新执行完整 `make ci`，shared 41、Web 347、API 485，共 873 个测试通过，三个包构建通过；日志 `/tmp/erp-stage01-ci-feedback.log`。`git diff --check` 通过。
- 浏览器复验：Leo 列表的两项产品及数量均按 `1.`、`2.` 对应显示；811 需求详情显示“附件”和“需求明细”，未显示“报价附件”或“报价明细”。
- 本段继续等待用户验收，不进入第 02 段。
