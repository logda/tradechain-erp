# 第 02 段会话与审计权限实施计划

> **For agentic workers:** 使用 `superpowers:executing-plans` 在本段内按测试先行执行，完成后停止等待用户验收。

**Goal:** 完成 R02-01～R02-04 的登录会话、刷新权限、审计授权和验收中心移除。

**Architecture:** API 签发可验证的短期会话票据并从 runtime/Prisma 读取实时用户与权限；Web 用 HttpOnly Cookie 保存票据，业务请求由中间件校验并注入当前权限。审计采用唯一的 `audit.view` 动作权限，页面和 API 同时执行。

**Tech Stack:** NestJS、Next.js 15、Prisma / runtime JSON、Jest、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-24-stage02-auth-audit-design.md`

## 全局约束

- 只修改本段必要的认证、权限、审计与验收入口代码；保留第 01 段及用户原始需求文档。
- 不清库，不回填历史单据；数据库已有 `RolePermission.actions` JSON，无 schema 迁移。
- 不发布、部署、合并或打标签；交付前运行 `make ci`。

## 步骤

- [x] 1. API 会话：先补测试覆盖签发、篡改/过期、停用、角色权限更新；实现登录返回票据、会话查询及 runtime/Prisma 当前资料读取。

  > 实际结果：新增 8 小时签名登录票据和 `/auth/session`；每次读取当前用户状态与角色权限。runtime 与 Prisma 均有回归用例，既有 Prisma 管理员权限自动识别 `audit.view`，无数据迁移。

- [x] 2. Web 会话：先补测试覆盖无 Cookie、复制链接、身份参数篡改、刷新权限；实现 Cookie 存票据、中间件校验和服务端操作取可信会话。

  > 实际结果：登录 Cookie 改存 API 票据，业务页中间件及写入操作重新取可信会话。联调发现内部重写的权限参数会再次解码并形成循环跳转，已用两种编码输入的回归测试修复；导航链接不再拼入角色参数。

- [x] 3. 审计权限：先补默认授权、管理员保存、集中/单据页面及接口拒绝/允许测试；实现 `audit.view` 的 UI 与接口控制。

  > 实际结果：`audit.view` 统一控制集中日志、单据审计区及 11 个审计 API。真实页面在隔离 runtime 数据中完成管理员授权、销售可见、撤权后不可见；直接伪造管理员请求头访问接口返回 403。管理员角色页原先会因缺签名而显示兜底数据，联调时补齐签名请求。

- [x] 4. 验收入口：测试首页、导航与旧链接；移除验收中心入口并重定向旧链接。

  > 实际结果：首页与侧栏移除“全链路验收中心”，`/app/mvp` 转到正式首页，相关页面测试通过。
- [x] 5. 联调与核验：运行有意义的 API/Web 场景测试及 `make ci`，用隔离 runtime 数据实际验证页面；检查 Prisma 测试、未提交改动及迁移需求；记录结果并停止。

  > 实际结果：最终 `make ci` 构建通过，shared 41、web 356、api 502，共 899 个测试通过。隔离 runtime 页面走通管理员登录、销售未授权拒绝、授权后可见、同一销售会话刷新后撤权即拒绝；裸请求伪造管理员 header 的集中及报价审计 API 均为 403。Prisma 权限用例通过；本段未改 Prisma schema，无迁移。用户的 `docs/requirements/` 未纳入改动。

## Review Focus

- 旧版明文 Cookie、复制 URL 或伪造 Referer 能否绕过登录。
- 直接请求 API 或伪造 `x-erp-role`、`x-erp-user`、`x-erp-actions` 能否读取审计或越权。
- 已登录用户刷新后，新增/撤销 `audit.view` 是否同步到导航、详情页和接口。
- runtime 与 Prisma 中角色权限更新及账号停用是否一致。
- 业务页既有操作与第 01 段列表/详情是否保持可用。
