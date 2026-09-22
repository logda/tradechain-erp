# Makefile 全流程 CI/CD（本地构建 → 宝塔部署）设计

> **⚠️ 已被取代（2026-09-19）：** 本设计中的「scp/rsync 传输 + SSH 远程触发」已废弃，改为「本地构建自包含安装介质 → 人工上传 → 服务器 `make` 部署」。最新设计见 `docs/superpowers/specs/2026-09-19-manual-media-deploy-design.md`。本文仅作历史留存。

**日期:** 2026-09-14

**目标:** 将现有「GitHub Actions 构建镜像 + 服务器拉取」的交付模式，重构为「本地 Makefile 构建打包镜像 → scp/rsync 传输到宝塔服务器 → 服务器加载运行」的全流程 Makefile 驱动闭环，覆盖构建、打包、传输、迁移、启动、健康检查、版本标签、回滚、备份与日志。CI 退居为 push/PR 的测试门禁。

**范围:** 本地构建与打包、传输与远程部署编排、服务器端加载/迁移/健康检查、版本与回滚/备份/日志、CI 精简、旧无用流程剔除。不涉及应用业务代码改动，不涉及 Kubernetes/多机编排，不引入额外 CI 平台。

---

## 1. 背景与现状

当前仓库（`0-erp-api-1-2-3-source-20260823-164845/`）的交付链路：

- **Makefile**：`install / dev-api / dev-web / test / build / ci / clean / release / deploy / rollback / backup / logs / help`。
  - `release` = `git tag` + `git push`，用于**触发 GitHub Actions** 构建镜像。
  - `deploy` = 在**服务器本地**执行 `scripts/deploy.sh`（假设已在服务器上）。
- **`.github/workflows/ci.yml`**：`build-test` job（push/PR→main 跑 install+build+test）+ `release` job（tag `v*` 时 `docker buildx build` → `docker save` 成 tar.gz 发 GitHub Release → 推 ghcr.io）。
- **`scripts/deploy.sh`**（服务器执行）：备份 erp-data 卷 → 取镜像（`docker compose pull` 或 `docker load` tar）→ `prisma migrate deploy`（一次性容器）→ `docker compose up -d` → `sleep 8` + `curl` 健康检查。
- **`docker-compose.yml`**：`api` + `web` 两个服务，镜像名 `ghcr.io/logda/tradechain-erp-{api,web}:${TAG:-latest}`，MySQL 经 `host.docker.internal` 访问宿主机（宝塔），上传数据持久化到 `erp-data` 卷。
- **`apps/api/Dockerfile` / `apps/web/Dockerfile`**：多阶段构建，`node:22-bookworm-slim` + pnpm；api 保留完整 workspace（含 prisma CLI 供迁移容器复用）；web 用 Next.js standalone 产物。

### 现状痛点

1. 镜像构建**依赖 GitHub Actions**，国内网络下 ghcr.io 推送/拉取常超时；本地无法一键产出可交付镜像。
2. `deploy.sh` 假设「人已在服务器上、镜像已可达」，缺少**从本地主动传输镜像**到服务器的环节。
3. 健康检查用固定 `sleep 8`，不够健壮。
4. `release`（触发 CI 构建）与新目标（本地构建）职责冲突，属需剔除的旧流程。

---

## 2. 范围与非目标

### 范围内

- 本地用 Makefile 完成镜像构建（跨架构 `linux/amd64`）与打包（`docker save | gzip` → tar.gz）。
- 本地通过 rsync/scp 将 tarball + `docker-compose.yml` + 远程脚本传输到宝塔服务器，并经 SSH 触发远程部署。
- 服务器端：加载镜像、`prisma migrate deploy`、`docker compose up -d`、轮询式健康检查。
- 版本标签贯穿（镜像 tag / tarball 名 / compose `TAG` 一致），支持镜像级秒回滚。
- 数据备份：erp-data 上传卷 + mysqldump 业务库（best-effort，缺工具时优雅降级）。
- 日志查看、健康检查、首次初始化、种子数据等运维 target。
- 精简 `ci.yml`：移除镜像构建/推送/发 Release，仅保留测试门禁。
- 剔除不再适用的旧 Makefile 流程（`release` 触发 CI 构建）。

### 非目标

- 不改业务代码、不改 Prisma schema、不改 Dockerfile 的构建产物结构（仅在必要时加平台参数）。
- 不引入 Kubernetes、Swarm、多机蓝绿/金丝雀发布。
- 不引入 Jenkins/GitLab CI 等其他 CI 平台。
- 不做镜像签名、SBOM、漏洞扫描等供应链安全（可后续迭代）。
- 不做自动触发部署（部署由人在本地显式 `make deploy` 发起）。

---

## 3. 总体架构与数据流

```
[本地 macOS]                                             [宝塔服务器 REMOTE_PATH]
make deploy VERSION=v1.2.0
  └─ scripts/deploy-local.sh deploy
       ├─1 build-image  docker buildx build --platform linux/amd64 --load
       │     → ghcr.io/logda/tradechain-erp-api:v1.2.0
       │     → ghcr.io/logda/tradechain-erp-web:v1.2.0
       ├─2 package      docker save <两镜像> | gzip
       │     → dist/tradechain-erp-v1.2.0.tar.gz
       ├─3 ship         rsync: tarball + docker-compose.yml + scripts/deploy-remote.sh
       │                → $REMOTE_PATH/
       └─4 ssh 触发 ──────────────────────────────►  deploy-remote.sh deploy <tar> TAG=v1.2.0
                                                        ├─a 备份 erp-data 卷 (+ mysqldump)
                                                        ├─b gunzip -c <tar> | docker load
                                                        ├─c docker compose run --rm api prisma migrate deploy
                                                        ├─d TAG=v1.2.0 docker compose up -d
                                                        └─e 轮询 curl /api/health（重试 N 次）
                                                             失败 → 打印日志 + 回滚命令 + exit 1
```

**镜像命名保持不变**：本地构建仍打成 `ghcr.io/logda/tradechain-erp-{api,web}:$VERSION`，因此 `docker-compose.yml` **无需修改**——`docker load` 后本地已存在同名镜像，`compose up` 直接复用、不会去 ghcr 拉取。这样也保留了未来重新启用 ghcr 通道的兼容性。

---

## 4. 关键设计决策（已与用户确认）

| 决策点 | 选择 |
| --- | --- |
| CI 策略 | **CI 仅做测试门禁**：`ci.yml` 保留 `build-test`（push/PR→main），删除 `release` job；镜像改由本地 Makefile 构建打包。 |
| 镜像交付 | **tar.gz 传输为主**：本地 `docker save` → tar.gz → rsync/scp → 服务器 `docker load`（离线、不受 ghcr 网络影响）。 |
| 服务器连接 | **`.env.deploy` 配置**：项目根放 `.env.deploy`（含 host/user/port/path/platform），加入 `.gitignore` 不入库；提供 `.env.deploy.example` 入库。 |
| 编排粒度 | **一条龙 + 分步并存**：`make deploy` 一键全流程；同时保留 `build-image/package/ship/migrate/...` 分步 target。 |
| 脚本组织 | **2 脚本 + 子命令**：`deploy-local.sh`（本地编排 + SSH 分发）、`deploy-remote.sh`（服务器执行，由旧 `deploy.sh` 演进）。 |
| 备份范围 | **erp-data 卷 + mysqldump**：mysqldump 缺工具/失败时优雅降级（告警但不阻断）。 |
| 服务器架构 | 默认 **x86_64（`linux/amd64`）**，由 `BUILD_PLATFORM` 变量控制，可改为 arm64。 |

---

## 5. 配置：`.env.deploy`

项目根新增 `.env.deploy`（**gitignored**）与 `.env.deploy.example`（入库模板）。`deploy-local.sh` 启动时加载。

```bash
# ===== 宝塔服务器 SSH 连接 =====
DEPLOY_HOST=your-server-ip                # 服务器 IP 或域名
DEPLOY_USER=root                          # SSH 用户
DEPLOY_PORT=22                            # SSH 端口（宝塔常改为非 22）
REMOTE_PATH=/www/wwwroot/tradechain-erp   # 服务器项目目录（存 compose/.env/镜像包/脚本）

# ===== 构建 =====
BUILD_PLATFORM=linux/amd64                # 目标镜像架构；Apple Silicon 必须显式指定
IMAGE_REPO=ghcr.io/logda                  # 镜像仓库前缀（与 compose 保持一致）

# ===== 可选 =====
# SSH_KEY=~/.ssh/id_rsa                   # 指定私钥；不设则用 ssh-agent/默认密钥
# HEALTH_RETRIES=10                       # 远程健康检查重试次数（默认 10，每次间隔 3s）
```

> **服务器 `.env` 不由本地覆盖**：`DATABASE_URL`、`ERP_PUBLIC_BASE_URL` 等密钥保存在服务器 `$REMOTE_PATH/.env`，首次部署时初始化（见第 11 节），日常 deploy 不传输、不覆盖。

---

## 6. Makefile 命令定义

### 6.1 target 总览

| target | 命令实质 | 状态 |
| --- | --- | --- |
| `install` | `pnpm install --frozen-lockfile` | 保留 |
| `dev-api` | `pnpm --filter api start:dev` | 保留 |
| `dev-web` | `pnpm --filter web dev` | 保留 |
| `test` | `pnpm -r test` | 保留 |
| `build` | `pnpm -r build` | 保留 |
| `ci` | `install build test`（`ci.yml` 改为调用它，单一事实源） | 保留 |
| `clean` | 清 `apps/*/dist`、`apps/web/.next`、`packages/shared/dist`、`dist/*.tar.gz` | 扩展 |
| `build-image` | `deploy-local.sh build-image`：buildx 跨架构构建 api+web | **新增** |
| `package` | `deploy-local.sh package`：`docker save \| gzip` → `dist/*.tar.gz` | **新增** |
| `ship` | `deploy-local.sh ship`：rsync 传输 + SSH 触发远程 deploy | **新增** |
| `deploy` | `deploy-local.sh deploy`：build-image→package→ship 一条龙 | **新增** |
| `migrate` | `deploy-local.sh migrate`：SSH 远程仅跑 `prisma migrate deploy` | **新增** |
| `seed` | `deploy-local.sh seed`：SSH 远程 `prisma db seed`（首次用） | **新增** |
| `rollback` | `deploy-local.sh rollback`：SSH 远程 `TAG=<旧版> compose up -d` | 改造（远程化） |
| `backup` | `deploy-local.sh backup`：SSH 远程备份 erp-data 卷 + mysqldump | 改造（远程化） |
| `logs` | `deploy-local.sh logs`：SSH 远程 `compose logs --tail=100 -f [SERVICE]` | 改造（远程化） |
| `health` | `deploy-local.sh health`：SSH 远程 curl 健康检查 | **新增** |
| `remote-init` | `deploy-local.sh remote-init`：首次建目录 + 传 compose/scripts/.env.example | **新增** |
| `help` | grep 注释生成彩色帮助（保留现有实现） | 保留 |
| ~~`release`~~ | 旧：`git tag` 触发 CI 构建镜像 | **剔除** |

### 6.2 变量约定

```makefile
VERSION ?= latest                 # 镜像/tarball/compose TAG 统一版本；生产务必显式传 vX.Y.Z
SERVICE ?=                        # logs 可选过滤：make logs SERVICE=api
LOCAL   := bash scripts/deploy-local.sh
```

- 所有部署类 target 形如：`deploy: ; VERSION=$(VERSION) $(LOCAL) deploy`。
- **生产上线必须显式 `VERSION=vX.Y.Z`**：服务器按 tag 累积保留历史镜像，`rollback` 才能定位旧版本；`latest` 仅用于快速验证（会互相覆盖、无法回滚）。

### 6.3 剔除的旧流程

- **删除 `release` target**：其唯一作用是打 tag 触发 CI 构建镜像；新模式镜像在本地构建，该流程失效。
- **删除旧 `deploy` 实现**（`TAG=... bash scripts/deploy.sh $(TARBALL)`）：改为本地编排 `deploy-local.sh deploy`。
- **`rollback/backup/logs` 从「本地 docker」改为「SSH 远程 docker」**：因为运行环境在服务器，本地不再有这些容器/卷。
- 旧 `scripts/deploy.sh` **重命名并演进**为 `scripts/deploy-remote.sh`（服务器端执行）。

---

## 7. 部署脚本逻辑

### 7.1 `scripts/deploy-local.sh`（本地编排 + SSH 分发）

- 顶部：`set -euo pipefail`；加载 `.env.deploy`（缺失则报错并提示复制 example）；校验必填变量（`DEPLOY_HOST/USER/REMOTE_PATH`）。
- 组装 `SSH_CMD`（`ssh -p $DEPLOY_PORT [-i $SSH_KEY] $DEPLOY_USER@$DEPLOY_HOST`）与 `RSYNC` 前缀（`rsync -azP -e "ssh -p $DEPLOY_PORT [-i key]"`）。
- 计算镜像名：`API_IMAGE=$IMAGE_REPO/tradechain-erp-api:$VERSION`、`WEB_IMAGE=...-web:$VERSION`；tarball 路径 `dist/tradechain-erp-$VERSION.tar.gz`。
- 子命令：
  - **`build-image`**：对 api、web 各执行
    `docker buildx build --platform $BUILD_PLATFORM -f apps/<x>/Dockerfile -t <IMAGE> --load .`
    （构建上下文为仓库根，与现有 CI/Dockerfile 的 COPY 路径一致）。
  - **`package`**：`mkdir -p dist`；`docker save $API_IMAGE $WEB_IMAGE | gzip > $TARBALL`；打印体积与 sha256。
  - **`ship`**：`rsync` 传 `$TARBALL` → `$REMOTE_PATH/dist/`、`docker-compose.yml` → `$REMOTE_PATH/`、`scripts/deploy-remote.sh` → `$REMOTE_PATH/scripts/`；随后
    `$SSH_CMD "cd $REMOTE_PATH && TAG=$VERSION bash scripts/deploy-remote.sh deploy dist/tradechain-erp-$VERSION.tar.gz"`。
    （若 tarball 不存在则先提示跑 `package`；`ship` 只负责传输+触发，不重复构建。）
  - **`deploy`**：依次调用 `build-image` → `package` → `ship`（任一步失败即中止）。
  - **`migrate` / `seed`**：`$SSH_CMD "cd $REMOTE_PATH && bash scripts/deploy-remote.sh <migrate|seed>"`。
  - **`rollback`**：校验 `$VERSION != latest`；`$SSH_CMD "… deploy-remote.sh rollback $VERSION"`。
  - **`backup`**：`$SSH_CMD "… deploy-remote.sh backup"`。
  - **`logs`**：`$SSH_CMD "… deploy-remote.sh logs $SERVICE"`（`-t` 分配伪终端以支持 `-f` 跟随）。
  - **`health`**：`$SSH_CMD "… deploy-remote.sh health"`。
  - **`remote-init`**：`ssh mkdir -p $REMOTE_PATH/{scripts,dist,work/backups}`；rsync 传 `docker-compose.yml`、`scripts/deploy-remote.sh`、`.env.example`（落到服务器供改名 `.env`）；打印后续手工步骤提示。

### 7.2 `scripts/deploy-remote.sh`（服务器执行，自包含）

由旧 `deploy.sh` 演进，**不依赖本地 lib**（因为独立运行在服务器）。`set -euo pipefail`；`PROJECT_DIR` = 脚本上级目录；`TAG=${TAG:-latest}` 并 `export TAG`；`HEALTH_URL=http://127.0.0.1:3001/api/health`；`HEALTH_RETRIES=${HEALTH_RETRIES:-10}`。子命令（`$1`）：

- **`deploy <tarball>`**：
  1. 备份：若存在 `erp-data` 卷 → `docker run --rm -v erp-data:/data -v $BACKUP_DIR:/backup alpine tar czf …`；再 best-effort `mysqldump`（见 7.2.1）。
  2. 加载：`gunzip -c <tarball> | docker load`。
  3. 迁移：`docker compose run --rm api node_modules/.bin/prisma migrate deploy`。
  4. 启动：`docker compose up -d`。
  5. 健康检查：循环 `HEALTH_RETRIES` 次、每次 `sleep 3` + `curl -sf $HEALTH_URL`；成功打印 `compose ps` + 访问地址 + 首次 seed 提示；失败打印 `compose logs --tail=80 api` + 回滚命令并 `exit 1`。
- **`rollback <tag>`**：`export TAG=<tag>` → `docker compose up -d` → 健康检查（同上）。
- **`migrate`**：`docker compose run --rm api node_modules/.bin/prisma migrate deploy`。
- **`seed`**：`docker compose run --rm api node_modules/.bin/prisma db seed`。
- **`backup`**：erp-data 卷 tar + mysqldump（同 deploy 第 1 步），产物落 `$REMOTE_PATH/work/backups/`。
- **`logs [service]`**：`docker compose logs --tail=100 -f $service`。
- **`health`**：单次 `curl -sf $HEALTH_URL` 并回显状态。

#### 7.2.1 mysqldump 优雅降级

从服务器 `.env` 的 `DATABASE_URL`（`mysql://user:pass@host:3306/db`）解析 `user/pass/db`；host 固定用 `127.0.0.1`（服务器上 MySQL 在宿主机）。若 `command -v mysqldump` 存在 → `mysqldump --single-transaction … | gzip > work/backups/db_<ts>.sql.gz`；否则打印告警「未找到 mysqldump，跳过 DB 备份，建议在宝塔安装 MySQL 客户端」并**继续**（不 `exit`）。

### 7.3 对 `docker-compose.yml` / `Dockerfile` 的影响

- **`docker-compose.yml`**：**不改**。镜像名与本地构建 tag 一致，`docker load` 后 compose 直接复用本地镜像。
- **`Dockerfile`**：**不改内容**。跨架构由 `docker buildx --platform` 在构建命令层处理。
- **`.gitignore`**：`dist`、`.env.deploy` 已被现有规则（`dist`、`.env.*`）忽略，仅需新增例外 `!.env.deploy.example` 以纳入配置模板。

---

## 8. CI 改造（`.github/workflows/ci.yml`）

- **删除整个 `release` job**（不再 `buildx build`、不 `docker save`、不发 GitHub Release、不推 ghcr.io）。
- **保留并精简 `build-test` job**：
  - 触发器 `on` 移除 `tags: ['v*']`，仅保留 `push: branches:[main]` 与 `pull_request: branches:[main]`。
  - `permissions` 收敛为 `contents: read`（不再需要 `packages: write`）。
  - 步骤：checkout → setup pnpm → setup node 22（cache pnpm）→ **`run: make ci`**（统一入口，等价 install+build+test）。
- 结果：CI 只在 push/PR 时做质量门禁，交付完全由本地 Makefile 负责。

---

## 9. 版本标签、回滚、备份、健康检查

- **版本标签**：`VERSION` 单一变量贯穿「镜像 tag = tarball 名 = compose `TAG`」。生产用 `vX.Y.Z`，服务器按 tag 累积保留镜像。
- **回滚（双保险）**：
  - 镜像级：`make rollback VERSION=v1.1.0` → 服务器 `TAG=v1.1.0 compose up -d`，秒级切回旧镜像（前提：旧镜像仍在服务器，未被清理）。
  - 数据级：每次 deploy 前自动备份 erp-data 卷 + mysqldump 到 `work/backups/`；必要时人工恢复。
- **备份**：`make backup` 手动触发；deploy 前自动触发；产物带时间戳。
- **健康检查**：轮询重试替代固定 sleep；失败即暴露日志与回滚命令，`exit 1` 让 `make deploy` 明确失败。
- **日志**：`make logs [SERVICE=api|web]` 经 SSH 跟随远程容器日志。

---

## 10. 跨架构构建注意事项

- 本机为 macOS（很可能 Apple Silicon/arm64），宝塔服务器通常 x86_64。**必须** `docker buildx build --platform linux/amd64`，否则产出 arm64 镜像在服务器 `exec format error`。
- 依赖 Docker Desktop 的 buildx + QEMU/binfmt（默认内置）。首次跨架构构建较慢（模拟执行 `pnpm install`/`tsc`），属正常。
- `--load` 将单平台镜像载入本地 daemon，供 `docker save` 导出；不支持多平台 `--load`（本方案只需单平台）。
- 若服务器实为 arm64，改 `.env.deploy` 的 `BUILD_PLATFORM=linux/arm64` 即可。

---

## 11. 首次部署与日常操作指南

### 首次（one-time）

1. 服务器安装 Docker + compose 插件 + rsync（宝塔一般已具备 Docker，rsync 缺则装）。
2. 本地 `cp .env.deploy.example .env.deploy`，填 `DEPLOY_HOST/USER/PORT/REMOTE_PATH`。
3. `make remote-init`：建远程目录、传 `docker-compose.yml` + `scripts/deploy-remote.sh` + `.env.example`。
4. SSH 上服务器：`cd $REMOTE_PATH && cp .env.example .env`，填 `DATABASE_URL`（host 用 `host.docker.internal`）、`ERP_PUBLIC_BASE_URL`。
5. 宝塔面板创建 MySQL 库 + 用户，授予权限，与 `.env` 的 `DATABASE_URL` 对应。
6. 本地 `make deploy VERSION=v1.0.0`。
7. 首次初始化数据：`make seed`（远程 `prisma db seed`）。

### 日常闭环

| 场景 | 命令 |
| --- | --- |
| 上线新版本 | `make deploy VERSION=v1.2.0` |
| 已构建、仅重传+部署 | `make ship VERSION=v1.2.0` |
| 仅重新打包 | `make package VERSION=v1.2.0` |
| 仅跑迁移 | `make migrate` |
| 看日志 | `make logs SERVICE=api` |
| 健康检查 | `make health` |
| 手动备份 | `make backup` |
| 回滚 | `make rollback VERSION=v1.1.0` |

---

## 12. 验证计划

- **静态**：`make help` 列出全部 target 且描述正确；`shellcheck scripts/*.sh`（若可用）无致命告警；`bash -n` 语法检查通过。
- **本地构建**：`make build-image VERSION=test` 产出两镜像；`docker image inspect` 确认 `Architecture=amd64`。
- **打包**：`make package VERSION=test` 生成 `dist/tradechain-erp-test.tar.gz`；`docker load` 干跑验证包完整。
- **CI**：push 分支触发 `build-test`，`make ci` 通过；确认无 `release` job、无 tag 触发。
- **端到端（需一台测试服务器）**：`remote-init` → 配 `.env` → `deploy VERSION=v0.0.1` → `health` 绿 → `seed` → 页面可访问 → `rollback` 到旧 tag 生效 → `backup` 产出卷包与 db dump。
- **降级路径**：服务器无 `mysqldump` 时 `backup` 仅告警不失败；无 `erp-data` 卷时首次 deploy 跳过备份。

---

## 13. 落地文件清单

| 文件 | 动作 |
| --- | --- |
| `Makefile` | 重写：新增 `build-image/package/ship/deploy/migrate/seed/health/remote-init`，改造 `clean/rollback/backup/logs`（`ci` 保留、由 ci.yml 调用），删除 `release` 与旧 `deploy`。 |
| `scripts/deploy-local.sh` | 新增：本地编排 + SSH 分发（子命令）。 |
| `scripts/deploy-remote.sh` | 由 `scripts/deploy.sh` 演进：服务器执行（deploy/rollback/migrate/seed/backup/logs/health），健康检查改轮询，加 mysqldump 降级。 |
| `scripts/deploy.sh` | 删除（内容迁移至 `deploy-remote.sh`）。 |
| `.env.deploy.example` | 新增：连接/构建配置模板（入库）。 |
| `.env.deploy` | 用户本地创建（gitignored）。 |
| `.gitignore` | 追加例外 `!.env.deploy.example`（`dist`/`.env.deploy` 已被现有规则忽略）。 |
| `.github/workflows/ci.yml` | 精简：删 `release` job，`build-test` 改调 `make ci`，收敛触发器与权限。 |
| `docker-compose.yml` | 不改。 |
| `apps/*/Dockerfile` | 不改。 |
