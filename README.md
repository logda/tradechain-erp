# TradeChain ERP

外贸全流程 ERP 系统，覆盖 **询盘 → 报价 → 样品 → 销售订单 → 采购 → 库存 → 出货 → 售后** 完整业务链路，并提供仪表盘、报表、单据编码规则、审计日志等支撑能力。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 后端 API | NestJS 10 + Prisma 7 + MySQL（端口 3001） |
| 前端 | Next.js 15 App Router（端口 3000） |
| 共享层 | TypeScript（列表查询、状态机、编码规则等领域逻辑） |
| 包管理 | pnpm 9 workspace（monorepo） |
| 部署 | Docker + docker compose，打 git tag → GitHub Actions 构建推 GHCR → 服务器 `make deploy` 拉取 |

## 项目结构

```
tradechain-erp/
├── apps/api/           # NestJS 后端服务（src/<业务模块>/、prisma/、test/）
├── apps/web/           # Next.js 前端（活路由树在 app/app/，tests/）
├── packages/shared/    # 前后端共享的领域逻辑（测试与源码同目录）
├── ops/                # 投产文件（整体上传到服务器，即服务器上的部署根目录）
│   ├── Makefile        #   服务器端运维命令入口
│   ├── docker-compose.yml
│   ├── .env.example
│   └── deploy-remote.sh
├── .github/workflows/  # ci.yml（门禁）、release.yml（打 tag 构建推 GHCR）
├── Makefile            # 本地开发机命令入口（开发 / 门禁 / 打 tag 发版）
├── AGENTS.md           # 面向 AI 编码代理的仓库说明书
└── docs/superpowers/   # 迭代计划（plans）与设计文档（specs）
```

## 业务模块

- **基础数据**：用户与角色权限、交易对手、产品库、仓库
- **销售侧**：询盘、报价、样品单、销售订单（含审批生命周期）
- **采购/库存**：采购订单、出入库、库存台账与余额
- **交付/售后**：出货批次、售后工单（含财务确认）
- **支撑能力**：仪表盘、报表、单据编码规则、文件存储、审计日志、待办

---

## 标准流程

命令分两个入口，各自 `make help` 查看全部 target：**根目录 `Makefile`** 是本地开发机用的（开发 / 门禁 / 打 tag 发版），**`ops/Makefile`** 是服务器上用的（部署与运维）。以下四条流程覆盖从开发到运维的完整生命周期，第五节是可选的镜像源配置。

### 一、开发（本地）

环境要求：**Node.js ≥ 22、pnpm 9**（`corepack enable` 启用，版本由 `packageManager` 锁定）、Docker（仅本地验证 Dockerfile 时需要）。

```bash
make install          # 按 lockfile 安装依赖
make dev-api          # 启动后端 API（:3001）
make dev-web          # 启动前端（:3000）
make ci               # 提交前门禁：install + build + test（等价 GitHub Actions 所跑）
```

- 前端默认经 `http://127.0.0.1:3001/api` 调用后端，可用 `ERP_API_BASE_URL` 覆盖。
- **存储模式**（`ERP_STORAGE_MODE`）：`runtime`（默认，本地 JSON，开箱即用，适合开发/演示）｜`prisma`（MySQL 持久化，**生产必须用此模式**，需配 `DATABASE_URL` 并跑迁移+种子）。

### 二、发版（本地打 tag，CI 构建镜像）

```bash
make tag VERSION=vX.Y.Z
```

校验版本号格式（`vX.Y.Z`）、工作区干净、HEAD 已推送到 origin，然后打 annotated tag 并推送。推送触发 `.github/workflows/release.yml`：

```
gate  : make ci                      # 未过测试则不产镜像
build : api / web 并行构建（matrix）  # ubuntu runner 原生 amd64，与服务器同架构
      → 推 ghcr.io/logda/tradechain-erp-{api,web}:vX.Y.Z
```

进度看 <https://github.com/logda/tradechain-erp/actions>。

> **镜像 tag == git tag == 部署版本号**，同一个字符串，不存在映射表。CI 不推 `latest`，服务器端 `deploy` 也拒绝 `latest` —— 每个可部署版本都对应一个不可变的 tag。
>
> `make build-image` 仅供本地验证 Dockerfile 改动能否构建通过（原生架构、tag 为 `local`、不推送），生产镜像一律以 CI 产物为准。

### 三、第一次投产（服务器）

**1）本地**按上面「二、发版」打好 tag，等 Actions 构建完成（两个镜像都推送成功）。目前 GHCR 上可用的版本是 `v1.0.4`，下面的命令以它为例。

**2）上传 `ops/` 目录**到服务器固定部署目录（示例 `/www/wwwroot/tradechain-erp`）—— 把 `ops/` **里面的 4 个文件平铺**到该目录，不要再套一层子目录：

```
/www/wwwroot/tradechain-erp/
├── Makefile              ← ops/Makefile
├── docker-compose.yml
├── .env.example
└── deploy-remote.sh
```

宝塔文件管理器 / scp 均可。**仓库里的 `ops/` 目录 == 服务器上的部署根目录**，一一对应。

**3）服务器**配置并部署：

```bash
cd /www/wwwroot/tradechain-erp

make init             # 从 .env.example 生成 .env、建 work/ 目录、打印后续清单
make login            # docker login ghcr.io：GitHub 用户名 + read:packages PAT（一次性）
vi .env               # ERP_STORAGE_MODE=prisma
                      # DATABASE_URL 主机必须用 host.docker.internal（非 127.0.0.1）
                      # ERP_PUBLIC_BASE_URL=你的正式域名
                      # ERP_FORMAL_SESSION_SECRET=$(openssl rand -base64 48)  ← 必填，见下方警告
# 宝塔面板创建 MySQL 库与用户，与 DATABASE_URL 对应

make deploy VERSION=v1.0.4    # 备份 → compose pull → prisma migrate → up -d → 健康检查
make seed                     # 初始化种子数据（仅一次）
```

> **`ERP_FORMAL_SESSION_SECRET` 现在是生产必填项。** 未配置时 api 与 web 都会在 `NODE_ENV=production` 下抛错拒绝签名/验签（不再回落到源码内置的开发密钥）。compose 里 api 经 `env_file` 读 `.env`、web 经 `environment` 显式透传同名变量，所以**只在 `.env` 里填一次即可，两侧自动一致** —— 历史上 web 缺 `env_file` 导致的两侧密钥不一致问题已修复。

> GHCR 凭据只落在 `~/.docker/config.json`，**不进 `.env`、不进仓库、不出现在任何脚本里**。PAT 过期后重跑 `make login` 即可。
>
> **这 4 个文件只需首次上传一次。** 之后正常发版完全不用碰它们 —— 镜像由 CI 按 tag 推到 GHCR，服务器上只跑 `make deploy VERSION=vX.Y.Z`。只有 `ops/` 里的文件**本身**被改动时（改部署逻辑、改 compose 配置）才需要重新上传，这种情况很少。
>
> ops 文件是纯静态的（服务器不装 git、不 clone 仓库）。上传后服务器与仓库之间唯一的联系就是 GHCR 镜像。

### 四、升级 / 回退 / 启停

升级与回退是**同一条命令**，区别只在版本号：

```bash
cd /www/wwwroot/tradechain-erp

make versions                    # 看本地已有哪些镜像 tag（可离线部署的候选）
make deploy VERSION=v1.1.0       # 升级：备份 → 拉镜像 → 迁移 → up -d → 健康检查
make deploy VERSION=v1.0.4       # 回退：同一条命令，换成要退回的旧版本号
```

日常启停：

```bash
make stop                        # 停止容器（保留容器与 erp-data 卷）
make start                       # 按 work/CURRENT_TAG 记录的版本重新启动
make restart SERVICE=api         # 改了 .env/compose 后重建容器（不重拉镜像、不迁移）
```

> `make deploy` 每次都会先备份 `erp-data` 卷与数据库，**卷备份失败即中止部署**以保护数据。
>
> 回退只切镜像版本，**不回退数据库 schema**（Prisma 迁移是单向的）。若新版本做过破坏性迁移，回退前需评估数据兼容性 —— 这也是每次部署前自动备份的原因。
>
> 回退目标必须在 GHCR 上真实存在，否则会卡在 `[2/5] 拉取镜像`。`make versions` 列本地已拉取的，[GHCR packages](https://github.com/logda?tab=packages) 列全部历史版本。
>
> `start` / `restart` / `migrate` / `seed` 都要用到镜像版本，因此需要曾成功部署过一次：`work/CURRENT_TAG` 缺失时它们会直接报错并提示先 `make deploy VERSION=`，而不是回落到 `latest`（GHCR 上没有 `latest`，回落只会报难懂的 `manifest unknown`）。`stop` / `logs` / `health` / `versions` / `backup` / `init` 不受此限制，部署失败时照样能看日志、查状态。
>
> 本地旧镜像 tag 不做清理，断网时仍可 `make deploy` 到任意已拉取过的版本。

### 五、镜像源（国内加速）

拉取源默认直连 `ghcr.io`，可在部署目录的 `.env` 里用 `IMAGE_REGISTRY` 切换，`docker-compose.yml` 与部署脚本都会读它：

```bash
# .env
IMAGE_REGISTRY=your-registry.example.com
```

改完必须重新 `make deploy`（镜像名含 registry 前缀，旧源拉下来的镜像不会被复用）。

> **⚠️ 公共国内 GHCR 镜像站目前对本项目无效**：仓库的 GHCR 包是 private，而公共镜像站（NJU、DaoCloud 等）是匿名 / 白名单代理，拿不到私有包 —— 实测分别返回 `404 MANIFEST_UNKNOWN` 与 `403 这镜像不在白名单`（同一时刻公开镜像可正常拉取，说明不是站点故障）。因此 `.env.example` 里该项默认注释掉。
>
> 真需要国内加速，四条路：① 把 GHCR 包设为 public（仓库仍可 private，代价是编译产物任何人可拉）；② 自建带鉴权的反代，`IMAGE_REGISTRY` 填自己的域名并跑一次 `IMAGE_REGISTRY=<域名> make login`；③ CI 额外推一份到国内 registry（服务器在腾讯云，TCR 走内网最快），凭据放 Actions secrets；④ 给 dockerd 配 `HTTPS_PROXY`（零仓库改动，通常最省事）。
>
> `make deploy` 的 `[2/5]` 会打印当前使用的源，拉取失败时给出排查提示且**不自动回落到 ghcr.io** —— 回落会让不同命令用到不同的镜像名，反而更难排查。拉取失败本身是安全的：`up -d` 不会执行，旧容器继续运行。

---

## 命令速查

服务器端 —— `ops/Makefile`（在固定部署目录内执行）：

| 命令 | 用途 |
| --- | --- |
| `make deploy VERSION=vX.Y.Z` | 部署/回退到指定镜像版本（备份→拉取→迁移→启动→健康检查） |
| `make stop` | 停止容器（保留容器与数据卷） |
| `make start` | 按上次部署的版本启动容器 |
| `make restart SERVICE=api` | 改配置后重建容器（不重拉镜像/不迁移；不传 SERVICE 则全部） |
| `make versions` | 列出本地已有的镜像 tag |
| `make migrate` | 仅执行数据库迁移（针对当前已部署版本） |
| `make seed` | 初始化种子数据（仅首次；针对当前已部署版本） |
| `make backup` | 备份 erp-data 卷 + 数据库 |
| `make logs SERVICE=api` | 跟随容器日志（`api`/`web`，不传则全部） |
| `make health` | 健康检查 |
| `make login` | 一次性登录 GHCR（PAT 过期后重跑） |
| `make init` | 首次初始化部署目录 |

> `start` / `restart` / `migrate` / `seed` 需要 `work/CURRENT_TAG`（即曾成功部署过），否则报错退出；其余命令不受此限制。

本地开发机 —— 根目录 `Makefile`：

| 命令 | 用途 |
| --- | --- |
| `make install` | 按 lockfile 安装依赖 |
| `make dev-api` / `make dev-web` | 启动后端（:3001）/ 前端（:3000） |
| `make test` / `make build` | 跑全部测试 / 构建全部应用 |
| `make ci` | 提交前门禁：install + build + test |
| `make tag VERSION=vX.Y.Z` | 打 tag 并推送，触发 CI 构建镜像 |
| `make build-image` | 本地验证 Dockerfile 可构建（不推送） |
| `make clean` | 清理构建产物 |

> **CI 分工：** `ci.yml` 在 push/PR→`main` 时跑 `make ci` 测试门禁；`release.yml` 在 push tag `v*.*.*` 时先跑同一套门禁、再构建并推送镜像到 GHCR。两者都不自动部署 —— 服务器端始终由人工执行 `make deploy`。
>
> 部署设计详见 `docs/superpowers/specs/2026-09-20-ghcr-cicd-deploy-design.md`。

## 默认账号

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| admin | Admin123456 | 系统管理员 |
| mia | Mia123456 | 老板 |
| zoe | Zoe123456 | 销售 |
| leo | Leo123456 | 采购 |

> **这些是 `apps/api/prisma/seed.ts` 写死的演示账号，密码是公开的。生产跑过 `make seed` 后必须立刻逐个改掉**（登录后在 `/app/admin/users` 改密，或直接改库）。密码用无盐 SHA-256 存储，配合这张公开表，库里任何 hash 都能被反查 —— 别把演示密码带上线。

## 文档

- `AGENTS.md` —— 面向 AI 编码代理的仓库说明书：确切命令、测试约定、目录职责、以及一旦破坏就会静默出错的架构不变量。人工改代码时同样值得先读一遍。
- `docs/superpowers/specs/` —— 功能设计文档（含背景、决策表与取舍）。
- `docs/superpowers/plans/` —— 实施计划与执行记录。

## License

ISC
