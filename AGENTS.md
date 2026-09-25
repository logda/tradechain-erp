# AGENTS.md

面向 AI 编码代理的仓库说明书。人类向的概览与部署手册见 `README.md`；本文只写代理动手前必须知道的东西：确切命令、目录职责、以及一旦破坏就会静默出错的不变量。

## 项目概览

外贸全流程 ERP（询盘 → 报价 → 样品 → 销售订单 → 采购 → 库存 → 出货 → 售后）。pnpm 9 workspace monorepo：

| 包 | 名称 | 技术 | 端口 |
| --- | --- | --- | --- |
| `apps/api` | `api` | NestJS 10 + Prisma 7 + MySQL，`type: commonjs` | 3001 |
| `apps/web` | `web` | Next.js 15 App Router，`output: 'standalone'` | 3000 |
| `packages/shared` | `@erp/shared` | 纯 TypeScript 领域逻辑，同时产出 ESM + CJS | — |

Node ≥ 22，pnpm 版本由根 `package.json` 的 `packageManager` 锁定（`corepack enable` 启用）。

## 常用命令

全部经根目录 `Makefile`（`make help` 列出全部 target）：

```bash
make install      # pnpm install --frozen-lockfile
make dev-api      # pnpm --filter api start:dev（tsx watch；prestart:dev 会跑 prisma generate）
make dev-web      # pnpm --filter web dev
make test         # pnpm -r test
make build        # pnpm -r build
make ci           # install + build + test，顺序执行 —— 与 GitHub Actions 门禁完全同一入口
make clean        # 删 apps/api/dist、apps/web/.next、apps/web/.next-dev、packages/shared/dist
make tag VERSION=vX.Y.Z   # 打 tag 并推送，触发 CI 构建镜像
make build-image  # 本地验证 Dockerfile 能否构建（原生架构、tag 为 local、不推送）
```

本地验收页面应使用 `make dev-web`（或 `pnpm --filter web dev --port <端口>`）：开发缓存为 `.next-dev`，`make ci` 构建产物为 `.next`，互不覆盖。不要用长期运行的 `next start` 配合反复执行 `make ci`；重新构建后它会继续引用旧 chunk，必须重启进程。`make clean` 同时清理两份 Web 缓存。

**没有 lint / format 门禁**：根 `package.json` 里有 `pnpm lint` / `pnpm format`（转发到 `pnpm -r lint` / `-r format`），但三个包的 `lint`/`format` script 目前都只 `echo 'Scaffolding pending: ...'`，Makefile 里也没有对应 target。不要把它们当校验手段，也不要因为"跑过了"就认为风格已检查。

改完代码提交前跑 `make ci`。这是唯一的本地门禁。

## 测试

三个包用**两套框架、三种命名与位置约定**，不要混用：

| 包 | 框架 | 文件位置与命名 | 配置 |
| --- | --- | --- | --- |
| `packages/shared` | vitest（`globals: true`） | `src/**/*.spec.ts`，与被测源码同目录 | `packages/shared/vitest.config.mts` |
| `apps/api` | jest + ts-jest，`--runInBand` | 约定放 `apps/api/test/**/*.spec.ts`（见下方说明） | `apps/api/jest.config.ts`，`testRegex: '.*(\.e2e-)?spec\.ts$'`，`testEnvironment: node`，`rootDir: '.'` |
| `apps/web` | vitest + jsdom + @testing-library/react | `apps/web/tests/**/*.test.ts(x)` | `apps/web/vitest.config.mts`、`vitest.setup.ts` |

全量：`make test`。单文件（以下三条均已实测可用）：

```bash
pnpm --filter @erp/shared exec vitest run src/quote-list.spec.ts
pnpm --filter web exec vitest run tests/quotes-page.test.tsx
pnpm --filter api exec jest test/audit.service.spec.ts
```

按用例名过滤加 `-t "<名称>"`（vitest 与 jest 同参数）。

`apps/api` 的 `pretest` / `prebuild` / `prestart:dev` 都会跑 `prisma generate`。绕过 pnpm script 直接调 `jest` / `tsc` 时，若报找不到 `@prisma/client` 类型，先 `pnpm --filter api prisma:generate`。

api 的端到端测试命名为 `*.e2e-spec.ts`，与单元测试同放 `apps/api/test/`（jest 的 `testRegex` 两者都收）。注意 jest 的 `rootDir` 是包根，`src/` 下的 `*.spec.ts` 同样会被收集 —— 目前有 1 个历史例外 `apps/api/src/inquiry/inquiry.store.spec.ts`。**新增测试一律放 `test/`**，跟着主流约定走。涉及持久化的测试直接在用例里改 `process.env.ERP_DATA_DIR` 指向临时目录、结束时 `delete`，不要依赖宿主的 `.env`。

改了业务逻辑就补/改对应测试，即使没人要求。

## 目录职责

```
apps/api/src/<业务模块>/     # 一个模块一个目录：inquiry / quote / quote-source / sample-order /
                            # sales-order / purchase-order / stock-in / stock-out / inventory /
                            # shipment-batch / after-sales / warehouse / product / counterparty /
                            # user-management / document-code-rule / audit / dashboard / report /
                            # file-storage / todo / formal-lookup / auth / common / health / storage
apps/api/prisma/             # schema.prisma、migrations/、seed.ts
apps/api/test/               # jest 测试
apps/web/app/app/            # 【活路由树】全部 UI 在 /app/* 前缀下
apps/web/app/app/_lib/       #   跨页面共享的纯函数（含 formal-session）
apps/web/app/app/_components/
apps/web/app/app/_actions/
apps/web/tests/              # vitest 测试
packages/shared/src/         # 领域逻辑与测试同目录
ops/                         # 投产文件；本目录 == 服务器部署根目录（见下）
docs/superpowers/specs/      # 设计文档 YYYY-MM-DD-<topic>-design.md
docs/superpowers/plans/      # 实施计划 YYYY-MM-DD-<feature>.md
```

### web 有两棵路由树，别改错

`apps/web/app/` 根下同时存在 `quotes/`、`sales-orders/`、`purchase-orders/`、`samples/`、`after-sales/`、`shipment-batches/`、`dashboard/` 与一个 `app/` 子目录。

- **活的是 `apps/web/app/app/`**（URL 前缀 `/app/*`，例如 `/app/sales/quotes`）。
- 根级那几个目录是 **legacy 路由**：`apps/web/middleware.ts` 的 `legacyRouteRedirects` 会把 `/quotes/*` 等全部重定向到 `/app/*`，所以它们的 `page.tsx` / `actions.ts` 已经不可达。
- **但 legacy 目录里的组件与 helper 仍被活树 import**，例如 `app/app/sales/quotes/page.tsx` 引用 `../../../quotes/[id]/convert-quote-form` 和 `../../../quotes/quote-preview`；`app/app/sales/orders/page.tsx` 引用 `../../../sales-orders/sales-order-preview`。

因此：不要删 legacy 目录（会断活树的 import），也不要在 legacy 目录里加新页面（不可达）。新页面一律放 `apps/web/app/app/` 下对应模块。改 legacy 目录里的组件时，注意它同时被活树和它自己的 legacy 测试（如 `tests/create-quote-form.test.tsx`）引用。

### 存储模式

`ERP_STORAGE_MODE` 决定数据落地方式，解析逻辑在 `apps/api/src/storage/storage-mode.ts`：

- `runtime`（默认）—— 本地 JSON 文件，开箱即用，适合开发与演示
- `prisma` —— MySQL 持久化，**生产必须用此模式**，需配 `DATABASE_URL` 并跑迁移 + 种子

`resolveStorageMode()` 只在 trim + 小写后严格等于 `'prisma'` 时返回 prisma，其余一律回落 runtime。写涉及持久化的功能时，两条分支都要考虑到（历史上有过"prisma 模式下误读 runtime store"的 bug）。

Prisma 用 `@prisma/adapter-mariadb` 驱动适配器，不是默认引擎连接。

## 环境变量

代码中实际读取的：

| 变量 | 用途 | 生产从哪来 |
| --- | --- | --- |
| `ERP_STORAGE_MODE` | `runtime` \| `prisma` | `.env`（api 侧 `env_file`） |
| `DATABASE_URL` | MySQL 连接串。容器内主机名必须用 `host.docker.internal`，**不是 `127.0.0.1`** | `.env` |
| `PORT` | api 监听端口（3001） | `.env` + compose `environment` |
| `ERP_DATA_DIR` | runtime 模式的数据目录；容器内为 `/data`（挂 `erp-data` 卷） | compose `environment` |
| `ERP_API_BASE_URL` | web 服务端调 api 的基址 | compose `environment`（`http://api:3001/api`） |
| `ERP_WEB_BASE_URL` | Server Action 回环调用自身 API Route 的基址 | compose `environment`（`http://127.0.0.1:3000`） |
| `ERP_PUBLIC_BASE_URL` | 上传附件对外访问基址，用于生成附件公开 URL（`apps/api/src/file-storage/file-storage.config.ts`） | `.env` |
| `ERP_FORMAL_SESSION_SECRET` | 正式会话 HMAC 签名密钥。**生产必填**，未配置直接抛错 | `.env`（api 经 `env_file`、web 经 compose `environment` 透传） |
| `ERP_REQUIRE_SIGNED_FORMAL_SESSION` | 是否强制校验签名会话（trim + 小写后等于 `true` 才开启） | 未设置 → 关闭 |
| `ERP_CORS_ORIGINS` | 追加到 api CORS 白名单的 origin，逗号分隔（`apps/api/src/app.setup.ts`）；本机 3000/3002/3003 恒定放行 | 未设置 → 只放行本机 |
| `ERP_EXTRA_DEV_ORIGINS` | 追加到 Next `allowedDevOrigins` 的主机名，逗号分隔（`apps/web/next.config.mjs`），仅 dev 生效 | 未设置 |
| `NEXT_PUBLIC_ERP_WEB_BASE_URL` | 浏览器侧可见的 web 基址，`ERP_WEB_BASE_URL` 的兜底 | 未设置 |

`ops/docker-compose.yml` 里 api 同时有 `env_file: .env` 和 `environment:` 块 —— **`environment` 优先级更高**，所以在 `.env` 里改 `PORT` / `ERP_DATA_DIR` 不会生效，必须改 compose。

密钥不进仓库、不进 `.env.example` 的真实值、不进任何脚本。**部署 IP / 域名 / 密码同样不进仓库** —— 一律走 `.env`（`ERP_CORS_ORIGINS` / `ERP_EXTRA_DEV_ORIGINS` / `ERP_PUBLIC_BASE_URL`），源码里只留 `your-server-ip`、`<db-password>` 这类占位符。

### `ERP_FORMAL_SESSION_SECRET`：两侧必须同值，且生产不再有兜底

`ops/docker-compose.yml` 里 **`api` 用 `env_file: .env`，`web` 不用**（避免把 `DATABASE_URL` 之类无关变量塞进 web 容器），web 只在 `environment:` 块里显式透传 `ERP_FORMAL_SESSION_SECRET: ${ERP_FORMAL_SESSION_SECRET:-}`。所以**在部署目录的 `.env` 里填一次，两侧自动拿到同一个值**。

- 历史上 web 缺这一行，导致「只在 `.env` 加密钥 → api 收到了、web 收不到 → web 用兜底常量签名、api 用新密钥验签 → 全部 `403 正式会话签名无效`」。现在 compose 已透传，别再删那行。
- 未设置时：`NODE_ENV=production` 下 `getFormalSessionSecret()` **直接抛错**（api `apps/api/src/auth/formal-role.guard.ts`、web `apps/web/app/app/_lib/formal-request-signature.ts`），不再回落到任何源码常量；非生产才用 `DEV_ONLY_SESSION_SECRET`，保证 `make dev-api` / `dev-web` 开箱即用。
- 曾经的兜底常量 `'erp-dev-formal-session-secret'` 已随仓库公开而失效，**不要再用它**。两个测试（`apps/api/test/formal-role.guard.spec.ts`、`apps/web/tests/formal-session.test.ts`）专门断言用它签出来的会话会被拒 —— 这是防回归的，别删。

## 架构不变量（破坏后会静默出错）

1. **镜像仓库路径 `logda/tradechain-erp-{api,web}` 必须三处同步**：`.github/workflows/release.yml`（推送方）、`ops/docker-compose.yml`、`ops/deploy-remote.sh`（`versions` 的过滤正则）。改一处必须改三处 —— 对不上不会立刻报错，只会在服务器上表现为 `manifest unknown` 或 `versions` 永远列不出镜像。
   registry 前缀则是**可配置的，且只在拉取侧**：compose 与脚本都用 `${IMAGE_REGISTRY:-ghcr.io}`，由部署目录的 `.env` 或 shell 环境变量注入（shell 优先）。**CI 推送侧永远写死 `ghcr.io`**，不要参数化 —— 推和拉用不同的源会静默产出「CI 推成功、服务器拉不到」。根 `Makefile` 的 `IMAGE_REPO ?= ghcr.io/logda` 只服务 `make build-image`（本地产物 tag 为 `local`，从不推送），与服务器无关。

2. **镜像 tag == git tag == 部署版本号**，同一个字符串，没有映射表。CI **不推 `latest`**；`deploy` 也拒绝 `latest`。`ops/docker-compose.yml` 里的 `${TAG:-latest}` 只是 compose 的插值兜底，不代表 latest 可用。

3. **`ops/` 目录 == 服务器部署根目录**，4 个文件平铺同级（`Makefile`、`docker-compose.yml`、`.env.example`、`deploy-remote.sh`），不要加子目录。服务器**不装 git、不 clone 仓库**，ops 文件是人工上传的纯静态文件。因此：
   - 任何脚本都不能依赖仓库里的其他文件
   - `ops/deploy-remote.sh` 用 `PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"` 自定位
   - `ops/Makefile` 用 `$(lastword $(MAKEFILE_LIST))` + `$(abspath ...)` 自定位，使 `cd 目录 && make x` 与 `make -C 目录 x` 都成立

4. **`.env` 与 `work/` 永不被 ops 文件更新触碰** —— 里面有密钥、`work/CURRENT_TAG`、备份历史。`init` 遇到已存在的 `.env` 必须跳过而非覆盖。

5. **api 镜像 COPY 的是整个 workspace**（`COPY --from=build /app /app`），所以 `apps/api/prisma/migrations` 在镜像内。服务器的一次性迁移容器 `docker compose run --rm api node_modules/.bin/prisma migrate deploy` 依赖这一点。别"优化"成只拷 `apps/api`。

6. **web 镜像的 standalone 布局是 `apps/web/server.js`**，因为 `next.config.mjs` 设了 `outputFileTracingRoot` = monorepo 根。runtime 阶段必须显式 COPY 三样东西：`.next/standalone` → `./`、`.next/static` → `./apps/web/.next/static`、`public` → `./apps/web/public`。standalone 不含后两者，漏了就是线上 404 而本地正常。`apps/web/public/` 里有 `.gitkeep` 占位，因为 `COPY` 的源目录不存在会直接构建失败 —— 别删。

7. **`packages/shared` 必须先于 api/web 构建**。`pnpm -r build` 靠 workspace 依赖拓扑排序自动保证；两个 Dockerfile 里是显式的 `pnpm --filter @erp/shared build && pnpm --filter <app> build`。别调换顺序。

8. **Prisma 迁移是单向的**。`make deploy VERSION=<旧版本>` 只切镜像，不回退 schema。设计破坏性迁移时必须考虑回退场景。

9. **GNU Make 可能是 3.81**（老 CentOS / 宝塔环境）。两个后果：
   - **含 `$(MAKE)` 的 recipe 在 `make -n` 下仍会真实执行**。永远不要用 `make -n ci` 当"干跑检查"，它会真的装依赖、构建、跑测试。
   - 报错格式是 `make: *** [target] Error 1`，不是新版的彩色输出。

10. **不要原地覆盖正在运行的 shell 脚本**。bash 是流式读取 `.sh` 的，改写运行中的文件会损坏执行。任何自更新逻辑都必须写 `.new` 再原子 `mv`，且不要在旧脚本里 `exec` 新脚本。

## 构建与部署

### CI

| workflow | 触发 | 做什么 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push / PR → `main` | 跑 `make ci`。`concurrency` 带 `cancel-in-progress: true` |
| `.github/workflows/release.yml` | push tag `v*.*.*` | `gate`（同一套 `make ci`）→ `build`（matrix `api`/`web`，`fail-fast: false`）推 GHCR。只分组不 cancel，避免后一个 tag 取消前一个构建 |

`release.yml` 的 `permissions: packages: write` 是必需的 —— 仓库默认 `default_workflow_permissions` 是 `read`。build job **不设 `platform`**：ubuntu runner 原生 amd64，与生产服务器同架构。layer cache 用 `type=gha,scope=<app>`，两个 app 分开。

**两个 workflow 都不自动部署。** 服务器端始终人工执行 `make deploy`。

### 服务器

`ops/Makefile` 提供全部运维命令（在部署目录内 `make help` 查看）。核心是 `make deploy VERSION=vX.Y.Z`，固定 5 步：

```
[1/5] 备份 erp-data 卷 + mysqldump   ← 卷备份失败即中止部署
[2/5] docker compose pull
[3/5] prisma migrate deploy（一次性容器）
[4/5] docker compose up -d           ← 没有就新建、有就重建，天然幂等
[5/5] 健康检查（最多 10 次 × 3s）→ 通过才写 work/CURRENT_TAG
```

升级与回退是**同一条命令**，没有独立的 rollback。

`start` / `restart` / `migrate` / `seed` 都消费镜像版本，由 `require_tag` 统一守卫：`work/CURRENT_TAG` 缺失或为 `latest` 时明确报错退出，而不是回落到 `:latest` 让 compose 抛难懂的 `manifest unknown`。`init` / `versions` / `stop` / `logs` / `health` / `backup` 不守卫 —— 部署失败时仍要能看日志、查状态。

GHCR 凭据只落在服务器的 `~/.docker/config.json`（`make login` 一次性写入，PAT 只需 `read:packages`），**不进 `.env`、不进仓库、不出现在任何脚本里**。生产服务器上不放任何能读私有源码的凭据。

### 国内镜像源：机制已就位，但目前用不了

`IMAGE_REGISTRY`（部署目录 `.env`）可切换拉取源，`deploy` 的 `[2/5]` 会打印当前源，失败时给出三点排查提示且**不自动回落**（回落会造成跨命令不一致：这次从 `ghcr.io` 拉到了，下次 `make start` 又按 `.env` 里的镜像名去拉，反而失败；而 pull 失败本身是安全的 —— `up -d` 不会执行，旧容器继续跑）。

**本仓库的 GHCR 包是 private，公共国内镜像站代理不到。** 实测（2026-09，用公开镜像 `astral-sh/uv` 作对照组证明镜像站本身可用）：`ghcr.nju.edu.cn` → `404 MANIFEST_UNKNOWN` 且不返回 `Www-Authenticate`（不转发鉴权）；`ghcr.m.daocloud.io` → `403 这镜像不在白名单`。所以 `.env.example` 里 `IMAGE_REGISTRY` 默认是注释掉的。真要国内加速只有四条路：把 GHCR 包设为 public（仓库仍可 private，代价是编译产物任何人可拉）、自建带鉴权的反代、CI 额外推一份到国内 registry（服务器在腾讯云，TCR 走内网最快）、或给 dockerd 配 `HTTPS_PROXY`（零仓库改动）。**把包改 public 会影响共享资源并外泄产物，必须用户明确授权，不要自行执行。**

## 提交与 PR 约定

Conventional Commits，**英文 subject + 中文 body**（body 写动机与取舍，不复述 diff）：

```
fix(ops): require a recorded version for start/restart/migrate/seed

TAG 在 work/CURRENT_TAG 缺失时回落到 latest，而只有 deploy/start 拦 latest，
于是 restart/migrate/seed 会拿 :latest 去 compose —— GHCR 不推 latest，报出来
的是 manifest unknown，掩盖了"从未成功部署过"这个真正原因。
```

常用 scope：`api`、`web`、`shared`、`ops`、`deploy`、`build`、`ci`、`release`、`docs`、`plan`、`readme`、`compose`，也可用业务模块名（`quote`、`inventory` 等）。

破坏性变更用 `type(scope)!:` 并在 footer 写 `BREAKING CHANGE:` 说明影响与迁移动作。

提交前必须 `make ci` 全绿。**不要** `--no-verify`、不要 amend 已推送的 commit。

## 文档工作流

设计与计划落在 `docs/superpowers/`：

- `specs/YYYY-MM-DD-<topic>-design.md` —— 设计文档，含背景、决策表（Q1/Q2/...）、取舍
- `plans/YYYY-MM-DD-<feature>.md` —— 实施计划，checkbox 步骤

新 spec 取代旧 spec 时，在新 spec 顶部写 `**取代:** <旧路径>` 并注明沿用了哪些不变量；被取代的决策要在修订说明里点名（例如 `§4.3 描述的「单一 Makefile」决策（Q3）已被此次修订取代`）。不要在旧 spec 里就地改写历史。

实施完成后把 plan 里的 checkbox 勾掉，并在对应步骤下用引用块记录**实际结果**（尤其是与计划不符之处：踩到的坑、降级的验证手段、真实产出的摘要）。
