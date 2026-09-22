# GHCR 镜像 CI/CD + 按 tag 拉取部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把镜像构建从「本地 buildx + docker save 打介质 + 人工上传」改为「打 git tag → GitHub Actions 构建推 GHCR → 服务器 `make deploy VERSION=vX.Y.Z` 拉取部署」，并把升级与回退合并为同一条命令。

**Architecture:** CI 侧新增 `release.yml`（tag 触发，先跑 `make ci` 门禁再并行构建推送 api/web 镜像）。服务器侧 `deploy-remote.sh` 的 `deploy` 从 `docker load` 介质包改为 `docker compose pull`，删除 `rollback`（回退就是用旧版本号再 deploy 一次），新增 `stop`/`start`/`versions`。本地侧删除整条介质打包链，只留一个瘦身的 `build-image` 用于验证 Dockerfile，新增 `make tag` 作为发版入口。

**Tech Stack:** GitHub Actions（`docker/build-push-action`、`docker/login-action`、GHA buildx 层缓存）、GHCR、Docker Compose v2+、GNU Make、Bash、Prisma CLI（一次性迁移容器）。

**Spec:** `docs/superpowers/specs/2026-09-20-ghcr-cicd-deploy-design.md`

---

## 关于测试方式的说明

本次改动全是 CI YAML、Makefile 与 Bash，仓库没有对应的单测框架，**不写单元测试**。等价的红/绿循环是：

- **可执行验证**（优先）：先跑一条会失败的命令观察错误，实现后再跑同一条命令观察通过。Makefile 与脚本的**守卫分支**（版本号格式、`latest` 拦截、`CURRENT_TAG` 缺失、未知子命令）都能在本地真实执行，不碰 docker 网络、不改 git 状态。
- **静态验证**：`bash -n`（shell 语法）、`npx --yes js-yaml`（workflow YAML 语法）、`make -n`（recipe 展开）。
- **无法本地验证的部分**：`docker compose pull` 私有 GHCR 镜像、`make tag` 的真实推送、服务器端完整部署链路。这些只能在 Task 6 用真实 tag 走一遍，计划里已标明哪些步骤需要人工在服务器上执行。

本机现状（已确认）：`docker` daemon 运行中、`npx` 可用、**没有** `shellcheck`/`actionlint`/`yamllint`、宿主架构 `arm64`、`git` upstream 为 `origin/main`、现有 tag 为 `v1.0.0`/`v1.0.1`/`v1.0.3`、`make` 为 **GNU Make 3.81**（macOS 自带旧版）。

**关于 make 报错格式的校准**：本机 GNU Make 3.81 的错误输出与新版不同 —— 目标失败时是 `make: *** [deploy] Error 1`（**不含** `Makefile:行号:`），目标不存在时是 ``make: *** No rule to make target `stop'.  Stop.``（反引号开头、单引号结尾）。下文若写成 `[Makefile:NN: deploy]` 或 `'stop'`，以实际输出为准；断言的实质是**非 0 退出 + 报出该 target 名**，不要因引号或行号差异判定失败。

以下红步骤输出已在仓库当前状态下实测确认：`deploy-remote.sh deploy v1.0.4` → `!!! 找不到镜像包: v1.0.4`；`versions`/`start` → `!!! 未知子命令: <name>`；`make stop`/`make tag` → No rule to make target；`make deploy`（无 VERSION）→ `错误: deploy 需显式 VERSION=vX.Y.Z（latest 无法回滚）`；`npx --yes js-yaml` 对不存在的文件 → 退出码 2。

---

## File Structure

| 文件 | 职责 | 动作 |
| --- | --- | --- |
| `.github/workflows/release.yml` | tag 触发的镜像构建与推送：`gate`（`make ci`）→ `build`（matrix api/web，推 GHCR） | 新建 |
| `.github/workflows/ci.yml` | push/PR→main 的测试门禁 | **不动** |
| `scripts/deploy-remote.sh` | 服务器端执行器：备份、拉镜像、迁移、启停、健康检查、日志 | 修改 |
| `scripts/build-release.sh` | 本地 buildx 构建 + docker save + 自包含介质组装 | **删除** |
| `Makefile` | 全流程唯一命令入口（本地发版 + 服务器运维） | 整体重写 |
| `docker-compose.yml` | 服务编排，镜像名 `${TAG:-latest}` 已参数化 | **不动** |
| `apps/api/Dockerfile`、`apps/web/Dockerfile` | 镜像构建定义 | **不动** |
| `.env.example` | 服务器环境变量样例（GHCR 凭据走 `docker login`，不进此文件） | **不动** |
| `README.md` | 部署章节需按新流程重写 | 修改 |

三处共享同一个镜像名字面量 `ghcr.io/logda/tradechain-erp-{api,web}`：`docker-compose.yml`（已有）、`release.yml`（Task 1）、`Makefile` + `deploy-remote.sh`（Task 3/4）。改任一处必须同步其余。

---

### Task 1: 新增 release.yml（tag 触发构建推 GHCR）

**Files:**
- Create: `.github/workflows/release.yml`
- Reference (不改): `.github/workflows/ci.yml`

- [x] **Step 1: 先确认目标文件不存在（红）**

Run:
```bash
npx --yes js-yaml .github/workflows/release.yml > /dev/null
```
Expected: 非 0 退出，报找不到文件（`ENOENT` / `no such file`）。

- [x] **Step 2: 写入 workflow**

创建 `.github/workflows/release.yml`，内容如下（`gate` job 与现有 `ci.yml` 的 `build-test` 同构；`build` job `needs: gate`，保证任何 tag 都不会推出没过测试的镜像）：

```yaml
name: Release

on:
  push:
    tags: ['v*.*.*']

permissions:
  contents: read
  packages: write

# 发版不应被后一个 tag 取消，故只分组不 cancel-in-progress
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}

jobs:
  gate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install, build & test
        run: make ci

  build:
    needs: gate
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        app: [api, web]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v4

      - name: Log in to GHCR
        uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # 不设 platform：ubuntu runner 原生 amd64，与生产服务器同架构
      - name: Build and push
        uses: docker/build-push-action@v7
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          push: true
          tags: ghcr.io/logda/tradechain-erp-${{ matrix.app }}:${{ github.ref_name }}
          cache-from: type=gha,scope=${{ matrix.app }}
          cache-to: type=gha,mode=max,scope=${{ matrix.app }}
```

- [x] **Step 3: 校验 YAML 语法（绿）**

Run:
```bash
npx --yes js-yaml .github/workflows/release.yml > /dev/null && echo YAML_OK
```
Expected: 打印 `YAML_OK`，退出 0。

- [x] **Step 4: 校验关键字段**

Run:
```bash
grep -n 'needs: gate\|packages: write\|tradechain-erp-${{ matrix.app }}\|platform' .github/workflows/release.yml
```
Expected:
- 命中 `needs: gate`
- 命中 `packages: write`
- 命中 `tags: ghcr.io/logda/tradechain-erp-${{ matrix.app }}:${{ github.ref_name }}`
- **不**命中任何 `platform:`（跨架构构建已废除）

> 模式必须用**单引号**：`${{ matrix.app }}` 在双引号里会被 bash 当作参数展开并报 `bad substitution`。

- [x] **Step 5: 确认镜像名与 compose 一致**

Run:
```bash
grep -o 'ghcr\.io/logda/tradechain-erp-[a-z]*' docker-compose.yml | sort -u
```
Expected:
```
ghcr.io/logda/tradechain-erp-api
ghcr.io/logda/tradechain-erp-web
```
与 workflow 里拼出的名字逐字一致（workflow 用 `${{ matrix.app }}` 展开为 `api`/`web`）。

- [x] **Step 6: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): build and push api/web images to GHCR on version tags"
```

---

### Task 2: deploy 改为 pull 式，删除 rollback

这是 `deploy-remote.sh` 与 `Makefile` 之间的**参数契约变更**（tarball 路径 → 版本号），必须在同一个 commit 里改完，否则中间状态不可用。

**Files:**
- Modify: `scripts/deploy-remote.sh`（头部注释、`on_fail`、`deploy` 分支、删 `rollback` 分支、末尾用法串）
- Modify: `Makefile:57-69`（`deploy` 与 `rollback` target）
- Modify: `Makefile:1-3`（`.PHONY` 去掉 `rollback`）

- [x] **Step 1: 观察当前行为（红）**

Run:
```bash
bash scripts/deploy-remote.sh deploy v1.0.4
```
Expected: 失败并打印 `!!! 找不到镜像包: v1.0.4` —— 现在的 `deploy` 把参数当 tarball 路径。

Run:
```bash
grep -n 'rollback' Makefile scripts/deploy-remote.sh | head
```
Expected: 两处都命中 `rollback`（Makefile 的 target、脚本的分支与提示语）。

- [x] **Step 2: 替换 `deploy-remote.sh` 头部注释块**

把文件顶部注释里描述镜像来源与子命令的段落（原第 6-19 行区间）替换为：

```bash
# ============================================================
# TradeChain ERP 服务器端部署执行器（运行在生产服务器上）
# 部署目录为纯静态 ops 文件（人工上传，服务器不装 git）：
#   Makefile / docker-compose.yml / .env.example / scripts/deploy-remote.sh
# 镜像来源：GHCR（ghcr.io/logda），由 GitHub Actions 按 git tag 构建推送。
# 拉取前需一次性 `make login`（docker login ghcr.io，PAT 仅需 read:packages）。
#
# 子命令:
#   init              首次引导：.env 缺失则从 .env.example 拷贝，建 work/ 目录，打印清单
#   deploy <version>  备份 → 拉镜像 → 迁移 → 启动 → 健康检查（升级与回退同为一条命令）
#   stop              停止容器（保留容器与数据卷）
#   start             按 work/CURRENT_TAG 记录的版本启动容器 + 健康检查
#   restart [service] 改配置后重建容器（不重拉镜像/不迁移），让 .env/compose 变更生效
#   migrate           仅执行 prisma migrate deploy
#   seed              仅执行 prisma db seed（首次初始化）
#   backup            备份 erp-data 卷 + mysqldump（best-effort）
#   logs [service]    跟随容器日志（api|web，默认全部）
#   health            单次健康检查
#   versions          列出本地已有的镜像 tag（可离线部署的候选）
#
# 前提: 已装 Docker + compose 插件；已 docker login ghcr.io；$PROJECT_DIR/.env 存在
#       (DATABASE_URL 主机用 host.docker.internal，不是 127.0.0.1)
# ============================================================
```

- [x] **Step 3: 在 `TAG` 定义之后加入 `IMAGE_REPO`**

找到这两行：

```bash
TAG="${TAG:-$(cat "$TAG_FILE" 2>/dev/null || echo latest)}"
export TAG
```

替换为：

```bash
TAG="${TAG:-$(cat "$TAG_FILE" 2>/dev/null || echo latest)}"
export TAG
# 与 docker-compose.yml / .github/workflows/release.yml 中的字面量必须一致
IMAGE_REPO="${IMAGE_REPO:-ghcr.io/logda}"
```

- [x] **Step 4: 改 `on_fail` 的回退提示**

找到：

```bash
on_fail() {
  echo ""
  warn "健康检查失败！"
  echo "    回滚: make rollback VERSION=<旧版本>"
  docker compose logs --tail=80 api || true
  exit 1
}
```

替换为：

```bash
on_fail() {
  echo ""
  warn "健康检查失败！当前服务仍在运行旧版本容器（若曾成功启动）。"
  echo "    回退: make deploy VERSION=<旧版本>    # make versions 可查本地已有版本"
  docker compose logs --tail=80 api || true
  exit 1
}
```

- [x] **Step 5: 重写 `deploy` 分支并删除 `rollback` 分支**

找到：

```bash
  deploy)
    TARBALL="${2:-}"
    [ -n "$TARBALL" ] || { warn "用法: deploy-remote.sh deploy <tarball>"; exit 1; }
    [ -f "$TARBALL" ] || { warn "找不到镜像包: $TARBALL"; exit 1; }
    log "[1/5] 备份数据 ..."
    backup_volume
    backup_db
    log "[2/5] 加载镜像 (TAG=${TAG}) ..."
    gunzip -c "$TARBALL" | docker load
    log "[3/5] 数据库迁移（一次性容器）..."
    docker compose run --rm api node_modules/.bin/prisma migrate deploy
    log "[4/5] 启动 / 更新容器 ..."
    docker compose up -d
    log "[5/5] 健康检查 ..."
    if health_check; then record_tag; on_success; else on_fail; fi
    ;;
  rollback)
    NEW_TAG="${2:-}"
    [ -n "$NEW_TAG" ] || { warn "用法: deploy-remote.sh rollback <tag>"; exit 1; }
    export TAG="$NEW_TAG"
    log "回滚到 TAG=${TAG} ..."
    docker compose up -d
    if health_check; then record_tag; on_success; else on_fail; fi
    ;;
```

替换为（`rollback` 整段消失；回退就是用旧版本号再 `deploy` 一次）：

```bash
  deploy)
    NEW_TAG="${2:-}"
    [ -n "$NEW_TAG" ] || { warn "用法: deploy-remote.sh deploy <version>"; exit 1; }
    # 脚本级兜底：Makefile 已有同样守卫，但直接调用脚本时也要拦住 latest（无法回退）
    [ "$NEW_TAG" != "latest" ] || { warn "deploy 需显式版本号 vX.Y.Z（latest 无法回退）"; exit 1; }
    export TAG="$NEW_TAG"
    log "[1/5] 备份数据 ..."
    backup_volume
    backup_db
    log "[2/5] 拉取镜像 (TAG=${TAG}) ..."
    docker compose pull
    log "[3/5] 数据库迁移（一次性容器，用刚拉下来的新镜像）..."
    docker compose run --rm api node_modules/.bin/prisma migrate deploy
    log "[4/5] 启动 / 更新容器 ..."
    docker compose up -d
    log "[5/5] 健康检查 ..."
    if health_check; then record_tag; on_success; else on_fail; fi
    ;;
```

- [x] **Step 6: 改 `restart` 分支的注释措辞**

找到：

```bash
  restart)
    # 改配置后重建容器：不重载镜像、不迁移，仅让 .env / compose 变更生效
```

替换为：

```bash
  restart)
    # 改配置后重建容器：不重拉镜像、不迁移，仅让 .env / compose 变更生效
```

- [x] **Step 7: 更新末尾未知子命令的用法串**

找到：

```bash
  *)
    warn "未知子命令: $ACTION"
    echo "可用: init | deploy <tarball> | rollback <tag> | restart [service] | migrate | seed | backup | logs [service] | health"
    exit 1
    ;;
```

替换为：

```bash
  *)
    warn "未知子命令: $ACTION"
    echo "可用: init | deploy <version> | stop | start | restart [service] | migrate | seed | backup | logs [service] | health | versions"
    exit 1
    ;;
```

> `stop`/`start`/`versions` 在 Task 3 才实现；此处先把用法串写全是刻意的 —— 它与头部注释保持一致，Task 3 无需再回来改这一行。

- [x] **Step 8: 语法检查**

Run:
```bash
bash -n scripts/deploy-remote.sh && echo SYNTAX_OK
```
Expected: 打印 `SYNTAX_OK`。

- [x] **Step 9: 改 Makefile 的 `.PHONY` 与 `deploy`/`rollback`**

`Makefile` 第 1-3 行，找到：

```make
.PHONY: install dev-api dev-web test build ci clean \
        release build-image package \
        init deploy migrate seed rollback restart backup logs health help
```

替换为（`rollback` 移除；`tag`/`login`/`stop`/`start`/`versions` 在此先登记，避免后续任务再改这一行）：

```make
.PHONY: install dev-api dev-web test build ci clean \
        tag build-image \
        init login deploy stop start restart migrate seed backup logs health versions help
```

`Makefile` 的 `deploy` 与 `rollback` target，找到：

```make
deploy: ## 部署当前介质版本（需显式 VERSION）: make deploy VERSION=v1.0.0
	@test '$(VERSION)' != 'latest' || { echo '错误: deploy 需显式 VERSION=vX.Y.Z（latest 无法回滚）'; exit 1; }
	TAG='$(VERSION)' HEALTH_RETRIES='$(HEALTH_RETRIES)' $(REMOTE) deploy 'dist/tradechain-erp-$(VERSION).tar.gz'

migrate: ## 执行数据库迁移（针对服务器当前已部署版本）
	$(REMOTE) migrate

seed: ## 初始化种子数据（首次；针对当前已部署版本）
	$(REMOTE) seed

rollback: ## 回滚到旧版本镜像: make rollback VERSION=v0.9.0
	@test '$(VERSION)' != 'latest' || { echo '错误: rollback 需显式 VERSION=vX.Y.Z'; exit 1; }
	TAG='$(VERSION)' $(REMOTE) rollback '$(VERSION)'
```

替换为：

```make
deploy: ## 部署/回退到指定镜像版本: make deploy VERSION=v1.0.0
	@test '$(VERSION)' != 'latest' || { echo '错误: deploy 需显式 VERSION=vX.Y.Z（latest 无法回退）'; exit 1; }
	HEALTH_RETRIES='$(HEALTH_RETRIES)' $(REMOTE) deploy '$(VERSION)'

migrate: ## 执行数据库迁移（针对服务器当前已部署版本）
	$(REMOTE) migrate

seed: ## 初始化种子数据（首次；针对当前已部署版本）
	$(REMOTE) seed
```

> `deploy` 不再通过 `TAG=` 环境变量传版本，改为位置参数，与 `deploy <version>` 契约一致。

- [x] **Step 10: 验证 deploy 契约已切换（绿）**

Run:
```bash
make -n deploy VERSION=v1.0.4
```
Expected: 输出包含 `bash scripts/deploy-remote.sh deploy 'v1.0.4'`，且**不含** `dist/` 或 `.tar.gz`。

Run:
```bash
make deploy 2>&1 | head -3
```
Expected: 打印 `错误: deploy 需显式 VERSION=vX.Y.Z（latest 无法回退）`，随后 `make: *** [Makefile:NN: deploy] Error 1`，退出非 0。

Run:
```bash
bash scripts/deploy-remote.sh deploy 2>&1 | head -2
```
Expected: 打印 `!!! 用法: deploy-remote.sh deploy <version>`，退出非 0。

Run:
```bash
bash scripts/deploy-remote.sh deploy latest 2>&1 | head -2
```
Expected: 打印 `!!! deploy 需显式版本号 vX.Y.Z（latest 无法回退）`，退出非 0。

- [x] **Step 11: 验证 rollback 已彻底消失**

Run:
```bash
grep -rn 'rollback' Makefile scripts/ && echo "STILL_PRESENT" || echo "ROLLBACK_GONE"
```
Expected: 打印 `ROLLBACK_GONE`。

Run:
```bash
bash scripts/deploy-remote.sh rollback v1.0.0 2>&1 | head -3
```
Expected: 落到未知子命令分支，打印 `!!! 未知子命令: rollback` 与新的用法串，退出非 0。

Run:
```bash
make rollback VERSION=v1.0.0 2>&1 | head -2
```
Expected: `make: *** No rule to make target 'rollback'.  Stop.`

- [x] **Step 12: Commit**

```bash
git add scripts/deploy-remote.sh Makefile
git commit -m "refactor(deploy)!: pull images from GHCR by version tag, drop rollback target

deploy 参数从介质包路径改为镜像版本号，[2/5] 由 docker load 改为
docker compose pull。升级与回退合并为 make deploy VERSION=vX.Y.Z。

BREAKING CHANGE: 服务器端 Makefile 与 deploy-remote.sh 必须同时更新"
```

---

### Task 3: 新增服务器端 stop / start / versions / login，修正 init

**Files:**
- Modify: `scripts/deploy-remote.sh`（`init` 分支、新增 `stop`/`start`/`versions` 分支）
- Modify: `Makefile`（新增 `login`/`stop`/`start`/`versions` target、`init` 上方注释）

- [x] **Step 1: 观察当前行为（红）**

Run:
```bash
bash scripts/deploy-remote.sh versions 2>&1 | head -2
```
Expected: `!!! 未知子命令: versions`。

Run:
```bash
bash scripts/deploy-remote.sh start 2>&1 | head -2
```
Expected: `!!! 未知子命令: start`。

Run:
```bash
make stop 2>&1 | head -2
```
Expected: `make: *** No rule to make target 'stop'.  Stop.`

- [x] **Step 2: 重写 `init` 分支**

找到：

```bash
  init)
    log "初始化服务器部署目录 ${PROJECT_DIR} ..."
    mkdir -p work/backups dist scripts
    if [ -f .env ]; then
      log "    .env 已存在，跳过（不覆盖）"
    elif [ -f .env.example ]; then
      cp .env.example .env
      log "    已从 .env.example 创建 .env"
    else
      warn "    未找到 .env.example，无法创建 .env（请确认介质解压完整）"
    fi
    echo ""
    echo "下一步:"
    echo "  1) vi .env                     # 填 DATABASE_URL(主机用 host.docker.internal) / ERP_PUBLIC_BASE_URL"
    echo "  2) 宝塔面板创建 MySQL 库与用户，与 DATABASE_URL 对应"
    echo "  3) make deploy VERSION=<版本>   # 加载镜像→迁移→启动→健康检查"
    echo "  4) make seed                    # 首次初始化种子数据（仅一次）"
    ;;
```

替换为：

```bash
  init)
    log "初始化服务器部署目录 ${PROJECT_DIR} ..."
    mkdir -p work/backups
    if [ -f .env ]; then
      log "    .env 已存在，跳过（不覆盖）"
    elif [ -f .env.example ]; then
      cp .env.example .env
      log "    已从 .env.example 创建 .env"
    else
      warn "    未找到 .env.example，无法创建 .env（请确认 4 个 ops 文件已上传完整）"
    fi
    echo ""
    echo "下一步:"
    echo "  1) make login                  # docker login ghcr.io（GitHub 用户名 + read:packages PAT）"
    echo "  2) vi .env                     # 填 DATABASE_URL(主机用 host.docker.internal) / ERP_PUBLIC_BASE_URL"
    echo "  3) 宝塔面板创建 MySQL 库与用户，与 DATABASE_URL 对应"
    echo "  4) make deploy VERSION=<版本>   # 拉镜像→迁移→启动→健康检查"
    echo "  5) make seed                    # 首次初始化种子数据（仅一次）"
    ;;
```

> `mkdir` 去掉了 `dist`（介质包已废除）与 `scripts`（脚本本身就在这个目录里，目录必然已存在）。

- [x] **Step 3: 新增 `stop` / `start` / `versions` 三个分支**

在 `restart)` 分支**之前**插入（即紧跟 `deploy)` 分支的 `;;` 之后）：

```bash
  stop)
    log "停止容器（保留容器、网络与 erp-data 卷）..."
    docker compose stop
    log "已停止。恢复运行: make start"
    ;;
  start)
    # TAG 来自 work/CURRENT_TAG（脚本顶部已加载）；缺失时回落到 latest，此处拦住
    [ "$TAG" != "latest" ] || { warn "未记录已部署版本（work/CURRENT_TAG 缺失或为 latest），请先: make deploy VERSION=vX.Y.Z"; exit 1; }
    log "启动容器 (TAG=${TAG}) ..."
    docker compose up -d
    if health_check; then on_success; else on_fail; fi
    ;;
  versions)
    log "当前运行版本: ${TAG}"
    log "本地已有镜像 tag（无需联网即可 deploy）:"
    local_img=""
    for name in api web; do
      echo "  ${IMAGE_REPO}/tradechain-erp-${name}:"
      local_img="$(docker images --format '{{.Tag}}' "${IMAGE_REPO}/tradechain-erp-${name}" 2>/dev/null | sort -u)"
      if [ -n "$local_img" ]; then
        printf '%s\n' "$local_img" | sed 's/^/    /'
      else
        echo "    （无）"
      fi
    done
    echo ""
    log "全部历史版本见 GHCR: https://github.com/logda?tab=packages"
    ;;
```

> `start` 用 `docker compose up -d` 而非 `docker compose start`：前者幂等，容器不存在时新建、已停止时拉起、配置变更时重建，无需前置条件；后者要求容器已存在。

- [x] **Step 4: 语法检查**

Run:
```bash
bash -n scripts/deploy-remote.sh && echo SYNTAX_OK
```
Expected: 打印 `SYNTAX_OK`。

- [x] **Step 5: 验证 versions 可用（绿）**

Run:
```bash
bash scripts/deploy-remote.sh versions
```
Expected: 打印 `==> 当前运行版本: latest`（本机没有 `work/CURRENT_TAG`）、两个镜像名标题、各自下方 `（无）`（本机没拉过这些镜像），最后一行 GHCR 链接，退出 0。

- [x] **Step 6: 验证 start 的 CURRENT_TAG 守卫**

Run:
```bash
bash scripts/deploy-remote.sh start 2>&1 | head -2
```
Expected: 打印 `!!! 未记录已部署版本（work/CURRENT_TAG 缺失或为 latest），请先: make deploy VERSION=vX.Y.Z`，退出非 0。**不会**触碰 docker。

- [x] **Step 7: 在 Makefile 中新增 4 个服务器 target**

找到 `init` target 及其上方的前置注释块：

```make
## ===== 服务器部署与运维（在生产服务器固定部署目录执行）=====
## 前置：手工上传 dist/tradechain-erp-<VERSION>-bundle.tar.gz 到服务器，并解压：
##   tar -xzf tradechain-erp-<VERSION>-bundle.tar.gz -C /www/wwwroot/tradechain-erp --strip-components=1

init: ## 首次：初始化服务器目录（建 .env/work）并打印后续清单
	$(REMOTE) init
```

替换为：

```make
## ===== 服务器部署与运维（在生产服务器固定部署目录执行）=====
## 前置：人工上传 4 个 ops 文件到固定目录（如 /www/wwwroot/tradechain-erp），
##       保持 scripts/ 子目录结构：
##   Makefile  docker-compose.yml  .env.example  scripts/deploy-remote.sh
## 镜像由 GitHub Actions 按 git tag 构建推到 GHCR，服务器只需 docker login 一次。

init: ## 首次：初始化服务器目录（建 .env/work）并打印后续清单
	$(REMOTE) init

login: ## 一次性：登录 GHCR 获取拉取权限（GitHub 用户名 + read:packages PAT）
	docker login ghcr.io
```

然后找到 `restart` target：

```make
restart: ## 改配置后重建容器（不重载镜像/不迁移）: make restart [SERVICE=api|web]
	HEALTH_RETRIES='$(HEALTH_RETRIES)' $(REMOTE) restart '$(SERVICE)'
```

替换为（在其前面插入 `stop`/`start`，并把 `restart` 的措辞与脚本对齐）：

```make
stop: ## 停止容器（保留容器与 erp-data 卷）
	$(REMOTE) stop

start: ## 按上次部署的版本启动容器（读 work/CURRENT_TAG）
	HEALTH_RETRIES='$(HEALTH_RETRIES)' $(REMOTE) start

restart: ## 改配置后重建容器（不重拉镜像/不迁移）: make restart [SERVICE=api|web]
	HEALTH_RETRIES='$(HEALTH_RETRIES)' $(REMOTE) restart '$(SERVICE)'
```

最后找到 `health` target：

```make
health: ## 健康检查
	HEALTH_RETRIES='$(HEALTH_RETRIES)' $(REMOTE) health
```

替换为（追加 `versions`）：

```make
health: ## 健康检查
	HEALTH_RETRIES='$(HEALTH_RETRIES)' $(REMOTE) health

versions: ## 列出本地已有的镜像版本（可离线部署的候选）
	$(REMOTE) versions
```

- [x] **Step 8: 验证 Makefile 命令面（绿）**

Run:
```bash
make help
```
Expected: 列表中出现 `login`、`stop`、`start`、`versions`，**不出现** `rollback`、`release`、`package`（后两个在 Task 4 删，此时可能仍在 —— 若在，属预期）。

Run:
```bash
make -n stop && make -n start && make -n versions && make -n login
```
Expected: 依次输出
```
bash scripts/deploy-remote.sh stop
HEALTH_RETRIES='10' bash scripts/deploy-remote.sh start
bash scripts/deploy-remote.sh versions
docker login ghcr.io
```

Run:
```bash
make versions
```
Expected: 与 Step 5 相同的输出（Makefile 转发成功）。

- [x] **Step 9: Commit**

```bash
git add scripts/deploy-remote.sh Makefile
git commit -m "feat(deploy): add stop/start/versions targets and one-time GHCR login"
```

---

### Task 4: 本地侧瘦身 —— 删介质打包链，加 make tag

**Files:**
- Delete: `scripts/build-release.sh`
- Modify: `Makefile`（变量区、`clean`、删 `release`/`package`、重写 `build-image`、新增 `tag`）

- [x] **Step 1: 观察当前行为（红）**

Run:
```bash
make tag VERSION=v9.9.9 2>&1 | head -2
```
Expected: `make: *** No rule to make target 'tag'.  Stop.`

Run:
```bash
make -n release VERSION=v9.9.9
```
Expected: 输出包含 `bash scripts/build-release.sh release`。

- [x] **Step 2: 删除本地构建脚本**

```bash
git rm scripts/build-release.sh
```
Expected: `rm 'scripts/build-release.sh'`。

- [x] **Step 3: 改 Makefile 变量区**

找到：

```make
# 版本：生产务必显式传 VERSION=vX.Y.Z（服务器按 tag 累积镜像以支持回滚；latest 会互相覆盖）
VERSION ?= latest
SERVICE ?=
HEALTH_RETRIES ?= 10
# 构建配置（本地 release/build-image/package 用；无需 .env.deploy）
BUILD_PLATFORM ?= linux/amd64
IMAGE_REPO     ?= ghcr.io/logda

LOCAL  := bash scripts/build-release.sh    # 本地：构建 + 打镜像包 + 出自包含介质
REMOTE := bash scripts/deploy-remote.sh    # 服务器：加载镜像 + 迁移 + 启动 + 运维
```

替换为：

```make
# 版本：deploy 必须显式传 VERSION=vX.Y.Z（= git tag = GHCR 镜像 tag）
VERSION ?= latest
SERVICE ?=
HEALTH_RETRIES ?= 10
# 镜像名前缀：必须与 docker-compose.yml 和 .github/workflows/release.yml 的字面量一致
IMAGE_REPO ?= ghcr.io/logda

REMOTE := bash scripts/deploy-remote.sh    # 服务器：拉镜像 + 迁移 + 启停 + 运维
```

- [x] **Step 4: 改 `clean`**

找到：

```make
clean: ## 清理构建产物与本地介质包
	rm -rf apps/api/dist apps/web/.next packages/shared/dist dist/*.tar.gz dist/bundle
```

替换为：

```make
clean: ## 清理构建产物
	rm -rf apps/api/dist apps/web/.next packages/shared/dist
```

- [x] **Step 5: 用 `tag` + 瘦身版 `build-image` 替换整个本地构建段**

找到：

```make
## ===== 本地构建与出介质（在开发机执行）=====

release: ## 一条龙出介质：构建→打镜像包→自包含介质: make release VERSION=v1.0.0
	VERSION='$(VERSION)' BUILD_PLATFORM='$(BUILD_PLATFORM)' IMAGE_REPO='$(IMAGE_REPO)' $(LOCAL) release

build-image: ## 跨架构构建 api+web 镜像: make build-image VERSION=v1.0.0
	VERSION='$(VERSION)' BUILD_PLATFORM='$(BUILD_PLATFORM)' IMAGE_REPO='$(IMAGE_REPO)' $(LOCAL) build-image

package: ## docker save 打包为 dist/*.tar.gz（镜像包）: make package VERSION=v1.0.0
	VERSION='$(VERSION)' BUILD_PLATFORM='$(BUILD_PLATFORM)' IMAGE_REPO='$(IMAGE_REPO)' $(LOCAL) package
```

替换为（**注意：recipe 行必须以真实 TAB 开头，不能用空格**）：

```make
## ===== 发版（本地只打 tag，镜像由 GitHub Actions 构建推 GHCR）=====

tag: ## 打版本 tag 并推送以触发镜像构建: make tag VERSION=v1.0.0
	@test '$(VERSION)' != 'latest' || { echo '错误: tag 需显式 VERSION=vX.Y.Z'; exit 1; }
	@echo '$(VERSION)' | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$$' || { echo '错误: VERSION 格式须为 vX.Y.Z，当前: $(VERSION)'; exit 1; }
	@test -z "$$(git status --porcelain)" || { echo '错误: 工作区不干净，先提交或 stash：'; git status --short; exit 1; }
	@git merge-base --is-ancestor HEAD '@{upstream}' 2>/dev/null || { echo '错误: HEAD 未包含在 origin 对应分支中（或未设 upstream），CI 将 checkout 不到此 tag；先 git push'; exit 1; }
	git tag -a '$(VERSION)' -m '$(VERSION)'
	git push origin '$(VERSION)'
	@echo ''
	@echo '==> 镜像构建中: https://github.com/logda/tradechain-erp/actions'
	@echo '==> 构建完成后到服务器执行: make deploy VERSION=$(VERSION)'

build-image: ## 本地验证 Dockerfile 可构建（原生架构、tag 为 local、不推送；生产镜像以 CI 为准）
	docker build -f apps/api/Dockerfile -t '$(IMAGE_REPO)/tradechain-erp-api:local' .
	docker build -f apps/web/Dockerfile -t '$(IMAGE_REPO)/tradechain-erp-web:local' .
```

> `build-image` 刻意**不带** `--platform`：它的用途只是验证 Dockerfile 改动能不能构建通过，原生 arm64 最快；生产镜像一律由 CI 在 amd64 runner 上构建。这也是 `BUILD_PLATFORM` 与 `verify_arch` 能整体删除的原因。

- [x] **Step 6: 验证 `tag` 的守卫（绿，全部在触碰 git 之前失败）**

Run:
```bash
make tag 2>&1 | head -2
```
Expected: `错误: tag 需显式 VERSION=vX.Y.Z`，退出非 0。

Run:
```bash
make tag VERSION=1.0.4 2>&1 | head -2
```
Expected: `错误: VERSION 格式须为 vX.Y.Z，当前: 1.0.4`（缺 `v` 前缀），退出非 0。

Run:
```bash
make tag VERSION=v1.0.4-rc1 2>&1 | head -2
```
Expected: 同样的格式错误（三段式数字之外一律拒绝）。

Run:
```bash
git tag --list | grep -c 'v9.9.9' || true
```
Expected: `0` —— 上面所有失败路径都没有真的创建 tag。

> **不要**在本地跑 `make tag VERSION=v1.0.4`：它会真的创建并推送 tag，触发 CI 构建。真实发版验证放在 Task 6。

- [x] **Step 7: 验证 `build-image` 展开**

Run:
```bash
make -n build-image
```
Expected:
```
docker build -f apps/api/Dockerfile -t 'ghcr.io/logda/tradechain-erp-api:local' .
docker build -f apps/web/Dockerfile -t 'ghcr.io/logda/tradechain-erp-web:local' .
```
不含 `--platform`、不含 `build-release.sh`。

- [x] **Step 8: 验证介质链已彻底消失**

Run:
```bash
grep -rn 'build-release\|BUILD_PLATFORM\|docker load\|docker save\|bundle' Makefile scripts/ && echo STILL_PRESENT || echo MEDIA_CHAIN_GONE
```
Expected: 打印 `MEDIA_CHAIN_GONE`。

Run:
```bash
ls scripts/
```
Expected: 只剩 `deploy-remote.sh`。

Run:
```bash
make release VERSION=v1.0.4 2>&1 | head -2; make package VERSION=v1.0.4 2>&1 | head -2
```
Expected: 两条都是 `make: *** No rule to make target '...'.  Stop.`

- [x] **Step 9: 完整跑一遍 help，确认命令面**

Run:
```bash
make help
```
Expected: 完整列表为
```
  install        安装依赖（锁定 lockfile）
  dev-api        本地开发：启动 API
  dev-web        本地开发：启动 Web
  test           运行全部测试
  build          构建全部应用
  ci             CI 门禁入口：安装 + 构建 + 测试（顺序执行，避免 make -j 并发乱序）
  clean          清理构建产物
  tag            打版本 tag 并推送以触发镜像构建: make tag VERSION=v1.0.0
  build-image    本地验证 Dockerfile 可构建（原生架构、tag 为 local、不推送；生产镜像以 CI 为准）
  init           首次：初始化服务器目录（建 .env/work）并打印后续清单
  login          一次性：登录 GHCR 获取拉取权限（GitHub 用户名 + read:packages PAT）
  deploy         部署/回退到指定镜像版本: make deploy VERSION=v1.0.0
  stop           停止容器（保留容器与 erp-data 卷）
  start          按上次部署的版本启动容器（读 work/CURRENT_TAG）
  restart        改配置后重建容器（不重拉镜像/不迁移）: make restart [SERVICE=api|web]
  migrate        执行数据库迁移（针对服务器当前已部署版本）
  seed           初始化种子数据（首次；针对当前已部署版本）
  backup         备份 erp-data 卷 + 数据库
  logs           跟踪容器日志: make logs [SERVICE=api|web]
  health         健康检查
  versions       列出本地已有的镜像版本（可离线部署的候选）
  help           显示帮助
```
无 `release`、`package`、`rollback`。

- [x] **Step 10: Commit**

```bash
git add Makefile scripts/
git commit -m "refactor(build)!: drop local media packaging chain, add make tag

删除 scripts/build-release.sh 与 release/package target：镜像构建已移交
GitHub Actions。build-image 瘦身为本地原生架构的 Dockerfile 验证。
新增 make tag 作为发版入口（校验版本号格式、工作区干净、HEAD 已推送）。

BREAKING CHANGE: make release / make package 不再存在"
```

---

### Task 5: 重写 README 部署章节

**Files:**
- Modify: `README.md`（技术栈表的「部署」行、`二/三/四` 三节、运维命令表、CI 说明行、项目结构里的 `scripts/` 描述）

- [x] **Step 1: 改技术栈表的部署行**

找到：

```markdown
| 部署 | Docker + docker compose，本地出介质 → 手工上传 → 服务器 `make` 部署 |
```

替换为：

```markdown
| 部署 | Docker + docker compose，打 git tag → GitHub Actions 构建推 GHCR → 服务器 `make deploy` 拉取 |
```

- [x] **Step 2: 改项目结构里的 scripts 描述**

找到：

```markdown
├── scripts/            # build-release.sh（本地构建）/ deploy-remote.sh（服务器部署）
```

替换为：

```markdown
├── scripts/            # deploy-remote.sh（服务器端部署执行器）
```

- [x] **Step 3: 用新流程替换「二、打包」整节**

找到从 `### 二、打包（本地出发版介质）` 开始、到 `### 三、第一次投产（服务器）` 之前的整段（含其中的 `dist/tradechain-erp-v1.0.0-bundle.tar.gz` 结构块与「脚本**不做任何网络传输**」引用块），替换为：

````markdown
### 二、发版（本地打 tag，CI 构建镜像）

```bash
make tag VERSION=v1.0.0
```

校验版本号格式（`vX.Y.Z`）、工作区干净、HEAD 已推送到 origin，然后打 annotated tag 并推送。推送触发 `.github/workflows/release.yml`：

```
gate  : make ci                      # 未过测试则不产镜像
build : api / web 并行构建（matrix）  # ubuntu runner 原生 amd64，与服务器同架构
      → 推 ghcr.io/logda/tradechain-erp-{api,web}:v1.0.0
```

进度看 <https://github.com/logda/tradechain-erp/actions>。

> **镜像 tag == git tag == 部署版本号**，同一个字符串，不存在映射表。CI 不推 `latest`，服务器端 `deploy` 也拒绝 `latest` —— 每个可部署版本都对应一个不可变的 tag。
>
> `make build-image` 仅供本地验证 Dockerfile 改动能否构建通过（原生架构、tag 为 `local`、不推送），生产镜像一律以 CI 产物为准。
````

- [x] **Step 4: 重写「三、第一次投产」整节**

找到从 `### 三、第一次投产（服务器）` 到 `### 四、后期升级版本` 之前的整段，替换为：

````markdown
### 三、第一次投产（服务器）

**1）本地** `make tag VERSION=v1.0.0`，等 Actions 构建完成（两个镜像都推送成功）。

**2）上传 ops 文件**到服务器固定部署目录（示例 `/www/wwwroot/tradechain-erp`），保持 `scripts/` 子目录结构。宝塔文件管理器 / scp 均可，共 4 个文件：

```
Makefile
docker-compose.yml
.env.example
scripts/deploy-remote.sh
```

**3）服务器**配置并部署：

```bash
cd /www/wwwroot/tradechain-erp

make init             # 从 .env.example 生成 .env、建 work/ 目录、打印后续清单
make login            # docker login ghcr.io：GitHub 用户名 + read:packages PAT（一次性）
vi .env               # ERP_STORAGE_MODE=prisma
                      # DATABASE_URL 主机必须用 host.docker.internal（非 127.0.0.1）
                      # ERP_PUBLIC_BASE_URL=你的正式域名
# 宝塔面板创建 MySQL 库与用户，与 DATABASE_URL 对应

make deploy VERSION=v1.0.0    # 备份 → compose pull → prisma migrate → up -d → 健康检查
make seed                     # 初始化种子数据（仅一次）
```

> GHCR 凭据只落在 `~/.docker/config.json`，**不进 `.env`、不进仓库、不出现在任何脚本里**。PAT 过期后重跑 `make login` 即可。
>
> ops 文件是纯静态的（服务器不装 git）。日后改了 `docker-compose.yml` / `Makefile` / `deploy-remote.sh`，需要重新人工上传这几个文件。
````

- [x] **Step 5: 重写「四、后期升级版本」整节**

找到从 `### 四、后期升级版本` 到 `---`（其后紧跟 `## 运维命令（服务器执行）`）之前的整段，替换为：

````markdown
### 四、升级 / 回退 / 启停

升级与回退是**同一条命令**，区别只在版本号：

```bash
cd /www/wwwroot/tradechain-erp

make versions                    # 看本地已有哪些镜像 tag（可离线部署的候选）
make deploy VERSION=v1.1.0       # 升级：备份 → 拉镜像 → 迁移 → up -d → 健康检查
make deploy VERSION=v1.0.0       # 回退：同一条命令，换旧版本号
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
> 本地旧镜像 tag 不做清理，断网时仍可 `make deploy` 到任意已拉取过的版本。全部历史版本见 [GHCR packages](https://github.com/logda?tab=packages)。
````

- [x] **Step 6: 重写运维命令表与 CI 说明**

找到从 `## 运维命令（服务器执行）` 到 `## 默认账号` 之前的整段（含表格与其后的 CI 引用块），替换为：

````markdown
## 运维命令

服务器端（固定部署目录内执行）：

| 命令 | 用途 |
| --- | --- |
| `make deploy VERSION=vX.Y.Z` | 部署/回退到指定镜像版本（备份→拉取→迁移→启动→健康检查） |
| `make stop` | 停止容器（保留容器与数据卷） |
| `make start` | 按上次部署的版本启动容器 |
| `make restart SERVICE=api` | 改配置后重建容器（不重拉镜像/不迁移；不传 SERVICE 则全部） |
| `make versions` | 列出本地已有的镜像 tag |
| `make migrate` | 仅执行数据库迁移 |
| `make seed` | 初始化种子数据（仅首次） |
| `make backup` | 备份 erp-data 卷 + 数据库 |
| `make logs SERVICE=api` | 跟随容器日志（`api`/`web`，不传则全部） |
| `make health` | 健康检查 |
| `make login` | 一次性登录 GHCR（PAT 过期后重跑） |
| `make init` | 首次初始化部署目录 |

本地开发机：

| 命令 | 用途 |
| --- | --- |
| `make tag VERSION=vX.Y.Z` | 打 tag 并推送，触发 CI 构建镜像 |
| `make build-image` | 本地验证 Dockerfile 可构建（不推送） |
| `make ci` | 提交前门禁：install + build + test |

> **CI 分工：** `ci.yml` 在 push/PR→`main` 时跑 `make ci` 测试门禁；`release.yml` 在 push tag `v*.*.*` 时先跑同一套门禁、再构建并推送镜像到 GHCR。两者都不自动部署 —— 服务器端始终由人工执行 `make deploy`。
>
> 部署设计详见 `docs/superpowers/specs/2026-09-20-ghcr-cicd-deploy-design.md`。
````

- [x] **Step 7: 校验 README 无残留旧流程**

Run:
```bash
grep -n 'bundle\|docker load\|docker save\|rollback\|make release\|make package\|build-release\|tar -xzf\|scp\|rsync' README.md && echo STILL_PRESENT || echo README_CLEAN
```
Expected: 打印 `README_CLEAN`。

- [x] **Step 8: 校验 README 提到的 target 都真实存在**

Run:
```bash
for t in $(grep -oE '`make [a-z-]+' README.md | sed 's/`make //' | sort -u); do
  grep -qE "^${t}:" Makefile || echo "MISSING: $t"
done; echo CHECK_DONE
```
Expected: 只打印 `CHECK_DONE`，没有 `MISSING:` 行。

> 这里刻意用**静态 grep** 而不是 `make -n "$t"`：GNU Make 对 recipe 中含 `$(MAKE)` 的行即使带 `-n` 也会真实执行，`make -n ci` 会意外触发一次完整的 `install + build + test`。

- [x] **Step 9: Commit**

```bash
git add README.md
git commit -m "docs(readme): rewrite deploy sections for GHCR pull-based flow"
```

---

### Task 6: 端到端验证（需要真实推送与服务器操作）

> 前 5 个 task 的验证都是本地的。这个 task 是唯一能证明「CI 真的推出了镜像、服务器真的能拉下来跑起来」的环节。Step 1-5 在本机执行，Step 6-9 **必须由人工在生产服务器上执行**（agent 无法访问）。

**Files:** 无改动（纯验证）

- [x] **Step 1: 推送前确认工作区与分支状态**

Run:
```bash
git status --short && git log --oneline -6
```
Expected: `git status --short` 输出为空（`.qoder/` 等未跟踪目录如有则忽略或先处理）；log 顶部是 Task 1-5 的 5 个 commit。

- [x] **Step 2: 推送 main**

```bash
git push origin main
```
Expected: 推送成功。`ci.yml` 会跑一次 `make ci`（与本次改动无关，但可顺带确认门禁没被 Makefile 改动打破）。

- [x] **Step 3: 确认 CI 门禁通过**

Run:
```bash
gh run list --workflow=ci.yml --limit 1
```
Expected: 最新一条 `ci.yml` 运行状态为 `completed` / 结论 `success`。若失败，先修门禁再继续 —— `release.yml` 的 `gate` job 跑的是同一套 `make ci`，门禁不过就不会产镜像。

- [x] **Step 4: 打 tag 触发镜像构建**

```bash
make tag VERSION=v1.0.4
```
Expected:
- 四条守卫全部通过（版本号格式、工作区干净、HEAD 已在 origin）
- 输出 `[main xxxxxxx] v1.0.4` 之类的 tag 创建信息与 `git push` 的推送结果
- 末尾打印 `==> 镜像构建中: https://github.com/logda/tradechain-erp/actions` 与 `==> 构建完成后到服务器执行: make deploy VERSION=v1.0.4`

> `v1.0.4` 是现有 tag（`v1.0.0`/`v1.0.1`/`v1.0.3`）之后的下一个版本号。

- [x] **Step 5: 盯住 release workflow 直到两个镜像都推送成功**

Run:
```bash
gh run list --workflow=release.yml --limit 1
```
Expected: 一条 `Release` 运行，`v1.0.4` 触发。

Run:
```bash
gh run watch $(gh run list --workflow=release.yml --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```
Expected: `gate` job 成功 → `build (api)` 与 `build (web)` 并行成功，整体退出 0。

失败时的排查顺序：
1. `gate` 失败 → 与 Step 3 同源，修 `make ci`
2. `build` 失败在 `Log in to GHCR` → 检查 `permissions: packages: write` 是否生效（首次可能需要在仓库 Settings → Actions → General 里把 Workflow permissions 设为 read/write）
3. `build` 失败在 `Build and push` → 看是不是 Dockerfile 本身的问题，本地用 `make build-image` 复现

- [x] **Step 6: 确认镜像真的进了 GHCR**

Run:
```bash
docker manifest inspect ghcr.io/logda/tradechain-erp-api:v1.0.4 > /dev/null && echo API_IMAGE_OK
```
Expected: 若本机已 `docker login ghcr.io`，打印 `API_IMAGE_OK`；未登录则报 `unauthorized` —— 此时改用 `gh api /users/logda/packages/container/tradechain-erp-api/versions` 或直接看 GHCR 网页确认，不要为此给本机加凭据。

同样确认 `tradechain-erp-web:v1.0.4`。

> **实际结果（2026-09-20）：** 本机 `gh` token 无 `read:packages` scope，`gh api .../versions` 返回 403；按计划约定**不给本机加凭据**，改从 release run `35504344184` 的 `Build and push` 日志取推送摘要作为凭证：
>
> - `ghcr.io/logda/tradechain-erp-api:v1.0.4@sha256:b3fbd37d4fb50fb11dc461cdd6882086000182cc383e4ddf5264c8c43919fdef`
> - `ghcr.io/logda/tradechain-erp-web:v1.0.4@sha256:76adaf012d1be571f14ca2456bbbb1f613169502a1809bc6aa29efbf2a98c3b4`
>
> 同时从 api job 日志确认架构：只有 `linux/amd64`（14 处命中），无 `arm64` —— §5「runner 原生 amd64 == 服务器架构」不变量成立，`BUILD_PLATFORM`/`verify_arch` 的删除是安全的。
>
> 三个 job 结论：`gate` success、`build (api)` success（2m36s）、`build (web)` success（2m51s），run conclusion `success`。

- [ ] **Step 7: 【人工 · 服务器】上传 ops 文件并登录 GHCR**

在生产服务器固定部署目录（如 `/www/wwwroot/tradechain-erp`）：

```bash
# 上传 4 个文件（宝塔文件管理器 / scp），保持 scripts/ 子目录结构：
#   Makefile  docker-compose.yml  .env.example  scripts/deploy-remote.sh
cd /www/wwwroot/tradechain-erp
make init      # .env 已存在则跳过，不会覆盖
make login     # GitHub 用户名 + read:packages PAT
make versions  # 首次应为「（无）」
```

> **首次切换注意**：服务器上原有的 `Makefile` / `deploy-remote.sh` 是介质包版本（`deploy` 收 tarball 路径）。必须**先覆盖上传新版 ops 文件**再执行 `make deploy` —— 新旧混用会因参数契约不同而失败。

- [ ] **Step 8: 【人工 · 服务器】部署并验证**

```bash
make deploy VERSION=v1.0.4
```
Expected 输出五步：
```
==> [1/5] 备份数据 ...
==> [2/5] 拉取镜像 (TAG=v1.0.4) ...
==> [3/5] 数据库迁移（一次性容器，用刚拉下来的新镜像）...
==> [4/5] 启动 / 更新容器 ...
==> [5/5] 健康检查 ...
=========================================
  部署成功！ 版本 TAG=v1.0.4
=========================================
```

然后逐个验证新命令：

```bash
make versions                    # 应列出 v1.0.4（api 与 web 各一行）
cat work/CURRENT_TAG             # 应为 v1.0.4
make health                      # 应通过
make stop                        # 容器停止
curl -sf http://127.0.0.1:3001/api/health || echo "STOPPED_AS_EXPECTED"
make start                       # 按 CURRENT_TAG 拉起，健康检查通过
make deploy VERSION=v1.0.3       # 回退到旧版本（若 v1.0.3 镜像存在于 GHCR）
cat work/CURRENT_TAG             # 应变为 v1.0.3
make deploy VERSION=v1.0.4       # 再升回去
```

> `v1.0.3` 是介质包时代打的 tag，GHCR 上**可能没有**对应镜像。若 `make deploy VERSION=v1.0.3` 在 `[2/5]` 拉取阶段失败，属预期 —— 这恰好验证了「pull 失败即中止、旧容器不受影响」。此时改用 `make versions` 列出的任一本地已有 tag 验证回退。

- [ ] **Step 9: 【人工 · 服务器】确认失败路径不会留下半死状态**

```bash
make deploy VERSION=v99.99.99
```
Expected: 在 `[2/5] 拉取镜像` 阶段失败（manifest unknown），部署中止，**正在运行的容器不受影响**。随后：

```bash
make health        # 应仍然通过（旧版本还在跑）
cat work/CURRENT_TAG   # 应仍是 v1.0.4（失败不写 tag 记录）
```

- [ ] **Step 10: 记录验证结果**

无需提交代码。把 Step 5 / 8 / 9 的实际结果（成功或偏差）反馈给用户，特别是：
- `gate` + `build (api)` + `build (web)` 三个 job 是否全绿
- 服务器 `docker compose pull` 从 GHCR 拉取的实际耗时（国内网络，用于判断是否需要后续加镜像加速）
- 回退路径是否真的可用

---

## Self-Review 结果

**1. Spec 覆盖检查**（逐条对照 `2026-09-20-ghcr-cicd-deploy-design.md`）

| Spec 条目 | 对应 Task |
| --- | --- |
| §4.1 `release.yml`（触发/权限/gate/build/matrix/缓存/不设 platform） | Task 1 |
| §4.2 `deploy <version>` 改 pull、删 rollback、新增 stop/start/versions、init 调整、on_fail 文案 | Task 2 + Task 3 |
| §4.3 Makefile 变量区、`tag`、瘦身 `build-image`、删 release/package、服务器 target 全集 | Task 2 + Task 3 + Task 4 |
| §4.4 ops 文件分发（4 个文件、保持 scripts/ 结构） | Task 3（init 文案 + Makefile 注释）+ Task 5（README）+ Task 6（人工上传） |
| §5 不变量：镜像名三处一致 | Task 1 Step 5 显式校验 |
| §5 不变量：服务器不存 registry 密钥 | Task 3（`login` 走 `docker login`）+ Task 5（README 明示不进 `.env`） |
| §5 不变量：deploy 拒绝 latest | Task 2 Step 9（Makefile）+ Step 5（脚本兜底），Step 10 双向验证 |
| §5 不变量：本地旧 tag 不清理 | Task 5 Step 5 README 说明；无清理代码需删除（沿用现状） |
| §5 不变量：tag 未过 ci 不产镜像 | Task 1（`needs: gate`），Step 4 显式 grep 校验 |
| §6 删除项（build-release.sh / release / package / rollback / BUILD_PLATFORM / docker load） | Task 2 Step 11 + Task 4 Step 8 用 grep 断言归零 |
| §6 不变项（ci.yml / docker-compose.yml / Dockerfile / .dockerignore / .env.example） | 计划中无任何 task 触碰这些文件 |
| §7 风险缓解（pull 失败即中止、PAT 过期重跑 login、init 打印清单） | Task 2 Step 5（pull 在 up 之前）+ Task 3（login/init）+ Task 6 Step 9（实测失败路径） |

无遗漏条目。

**2. 占位符扫描**：计划内无 `TBD`/`TODO`/「类似 Task N」/「适当处理错误」类表述；每个改代码的 step 都给了完整的旧→新内容；每条验证命令都写了预期输出。

**3. 契约一致性检查**（跨 task 的名字与签名）

- `deploy-remote.sh` 子命令名在头部注释（Task 2 Step 2）、末尾用法串（Task 2 Step 7）、实际分支（Task 2 Step 5 / Task 3 Step 3）三处一致：`init | deploy <version> | stop | start | restart | migrate | seed | backup | logs | health | versions`
- Makefile 调用形式与脚本签名一致：`$(REMOTE) deploy '$(VERSION)'` ↔ `deploy)` 分支读 `${2:-}`；`$(REMOTE) stop|start|versions` ↔ 无参分支
- `IMAGE_REPO` 在 Makefile（Task 4 Step 3）与 `deploy-remote.sh`（Task 2 Step 3）都定义，默认值同为 `ghcr.io/logda`，与 `docker-compose.yml`、`release.yml` 字面量一致
- `TAG_FILE` = `work/CURRENT_TAG`：写入点 `record_tag`（deploy 成功）、读取点脚本顶部与 `start` 守卫、`versions` 展示 —— 三处路径一致
- `.PHONY` 在 Task 2 Step 9 一次性登记了全部 target（含 Task 3/4 才实现的 `tag`/`login`/`stop`/`start`/`versions`），后续 task 无需再改该行
- `BUILD_PLATFORM` 在 Task 4 Step 3（变量区删除）与 Step 5（`build-image` 不再引用）两处同时消失，Task 4 Step 8 用 grep 断言

**4. 已知的中间态**：Task 2 结束时 Makefile 的 `.PHONY` 已声明 `stop`/`start`/`versions`/`tag`/`login` 但 target 尚未存在 —— GNU Make 允许 `.PHONY` 声明不存在的 target，`make help` 与其余 target 不受影响，Task 3/4 会补齐。这是刻意的，避免同一行被改三次。
