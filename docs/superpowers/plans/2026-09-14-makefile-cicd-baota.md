# Makefile 全流程 CI/CD（本地构建 → 宝塔部署）Implementation Plan

> **⚠️ 已被取代（2026-09-19）：** 本文描述的「rsync/SSH 自动传输 + 远程触发」交付流程已废弃，改为「本地出自包含安装介质 → 人工上传 → 服务器 `make` 部署」。最新设计见 `docs/superpowers/plans/2026-09-19-manual-media-deploy.md` 与 `docs/superpowers/specs/2026-09-19-manual-media-deploy-design.md`。本文仅作历史留存。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把交付模式从「GitHub Actions 构建镜像 + 服务器拉取」重构为「本地 Makefile 构建打包镜像 → rsync 传输到宝塔服务器 → 服务器加载运行」的全流程闭环。

**Architecture:** 双脚本 + 薄 Makefile。`scripts/deploy-local.sh`（本地编排 + SSH 分发，子命令式）读取 `.env.deploy`，用 `docker buildx --platform linux/amd64` 跨架构构建镜像、`docker save | gzip` 打包、`rsync` 传输、`ssh` 触发 `scripts/deploy-remote.sh`（服务器端执行器：备份→加载→迁移→启动→轮询健康检查）。Makefile target 是脚本子命令的薄封装。CI 精简为 push/PR 的测试门禁（`make ci`）。

**Tech Stack:** GNU Make、Bash（`set -euo pipefail`）、Docker + buildx + compose v2 插件、rsync/ssh、pnpm 9 workspace、Prisma 7、GitHub Actions。

---

## 关于本计划的验证方式（TDD 适配说明）

本仓库的测试框架（jest / vitest）只覆盖应用代码，**没有** shell/Makefile 的测试装置；新增 bats 等 shell 测试框架违反设计 spec 的非目标（不引入额外依赖）。因此本计划对基础设施代码采用**验证驱动**替代单测 TDD：每个脚本/配置写完后，用 `bash -n`（语法）、`shellcheck`（若可用）、`make -n`（干跑打印命令）、`git check-ignore`、`make help`、以及本地 Docker 冒烟构建作为「测试」门禁，每步都给出**精确命令与预期输出**。

> ⚠️ **Makefile 配方行必须用 TAB 缩进**（不是空格），否则 `make` 报 `missing separator`。写入后用 `make help` 验证。

---

## File Structure（文件职责映射）

| 文件 | 职责 | 动作 |
| --- | --- | --- |
| `.env.deploy.example` | 连接/构建配置模板（入库） | 创建 |
| `.gitignore` | 追加例外，让模板可入库 | 修改（1 行） |
| `scripts/deploy-remote.sh` | **服务器端**执行器：deploy/rollback/migrate/seed/backup/logs/health 子命令；自包含 | 创建（由 `deploy.sh` 演进） |
| `scripts/deploy.sh` | 旧的服务器端脚本 | 删除 |
| `scripts/deploy-local.sh` | **本地**编排器：加载 `.env.deploy`、ssh/rsync 助手、build-image/package/ship/deploy + 远程运维分发 | 创建 |
| `Makefile` | 所有 target 的薄封装（本地开发 + 构建打包 + 部署运维） | 重写 |
| `.github/workflows/ci.yml` | 精简为测试门禁，调用 `make ci` | 重写 |

**不改动**：`docker-compose.yml`、`apps/api/Dockerfile`、`apps/web/Dockerfile`（镜像名沿用 `ghcr.io/logda/tradechain-erp-{api,web}`，`docker load` 后 compose 直接复用）。

---

## Task 1: 配置基座（`.env.deploy.example` + `.gitignore` 例外）

**Files:**
- Create: `.env.deploy.example`
- Modify: `.gitignore:18`（在 `!.env.example` 之后插入一行）

- [ ] **Step 1: 创建配置模板 `.env.deploy.example`**

写入以下**完整内容**：

```bash
# 复制为 .env.deploy 并按实际填写；.env.deploy 含服务器信息，不入库（已被 .gitignore 忽略）。
#   cp .env.deploy.example .env.deploy

# ===== 宝塔服务器 SSH 连接 =====
DEPLOY_HOST=your-server-ip                # 服务器 IP 或域名
DEPLOY_USER=root                          # SSH 用户
DEPLOY_PORT=22                            # SSH 端口（宝塔常改为非 22）
REMOTE_PATH=/www/wwwroot/tradechain-erp   # 服务器项目目录（放 compose/.env/镜像包/脚本）

# ===== 构建 =====
BUILD_PLATFORM=linux/amd64                # 目标镜像架构；Apple Silicon 必须显式指定，服务器为 arm 则改 linux/arm64
IMAGE_REPO=ghcr.io/logda                  # 镜像仓库前缀，需与 docker-compose.yml 保持一致

# ===== 可选（默认注释）=====
# SSH_KEY=~/.ssh/id_rsa                   # 指定私钥（不要加引号，否则 ~ 不展开）；不设则用 ssh-agent/默认密钥
# HEALTH_RETRIES=10                       # 远程健康检查重试次数，每次间隔 3s
```

- [ ] **Step 2: 修改 `.gitignore` 让模板可入库**

在 `.gitignore` 第 18 行 `!.env.example` 之后新增一行，使这段变为：

```
# 环境变量（可能包含数据库连接串等敏感信息）
.env
.env.*
!.env.example
!.env.deploy.example
```

- [ ] **Step 3: 验证忽略规则正确**

Run:
```bash
git check-ignore -v .env.deploy.example || echo "NOT_IGNORED(正确)"
git check-ignore -v .env.deploy && echo "IGNORED(正确)"
git check-ignore -v dist/tradechain-erp-v1.tar.gz && echo "IGNORED(正确)"
```
Expected:
- `.env.deploy.example` → 输出 `NOT_IGNORED(正确)`（模板不被忽略，可入库）
- `.env.deploy` → 命中 `.env.*` 规则，输出 `IGNORED(正确)`
- `dist/...tar.gz` → 命中 `dist` 规则，输出 `IGNORED(正确)`

- [ ] **Step 4: 提交**

```bash
git add .env.deploy.example .gitignore
git commit -m "chore(deploy): add .env.deploy.example template and gitignore exception"
```

---

## Task 2: 服务器端执行器 `scripts/deploy-remote.sh`

**Files:**
- Create: `scripts/deploy-remote.sh`

- [ ] **Step 1: 写入脚本完整内容**

创建 `scripts/deploy-remote.sh`，内容如下（**完整、可直接运行**）：

```bash
#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# TradeChain ERP 服务器端部署执行器（运行在宝塔服务器上）
# 由本地 scripts/deploy-local.sh 经 SSH 调用，也可在服务器直接运行。
# 镜像来源：本地 docker save 的 tar.gz（docker load），不联网拉 ghcr。
#
# 子命令:
#   deploy <tarball>  备份 → 加载镜像 → 迁移 → 启动 → 健康检查
#   rollback <tag>    切回已加载的旧镜像 tag 并健康检查
#   migrate           仅执行 prisma migrate deploy
#   seed              仅执行 prisma db seed（首次初始化）
#   backup            备份 erp-data 卷 + mysqldump（best-effort）
#   logs [service]    跟随容器日志（api|web，默认全部）
#   health            单次健康检查
#
# 前提: 已装 Docker + compose 插件；$REMOTE_PATH/.env 存在
#       (DATABASE_URL 主机用 host.docker.internal，不是 127.0.0.1)
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
HEALTH_RETRIES="${HEALTH_RETRIES:-10}"
BACKUP_DIR="${PROJECT_DIR}/work/backups"
TAG="${TAG:-latest}"
export TAG

cd "$PROJECT_DIR"
ACTION="${1:-deploy}"

log()  { echo "==> $*"; }
warn() { echo "!!! $*" >&2; }

# 备份 erp-data 上传卷（卷存在才备）
backup_volume() {
  mkdir -p "$BACKUP_DIR"
  if docker volume inspect erp-data >/dev/null 2>&1; then
    local ts; ts="$(date +%Y%m%d_%H%M%S)"
    if docker run --rm -v erp-data:/data -v "$BACKUP_DIR":/backup alpine \
        tar czf "/backup/erp-data_${ts}.tar.gz" -C /data . 2>/dev/null; then
      log "    卷备份: work/backups/erp-data_${ts}.tar.gz"
    else
      warn "    卷为空或备份失败，跳过"
    fi
  else
    log "    跳过卷备份（首次部署，尚无 erp-data 卷）"
  fi
}

# 从 .env 的 DATABASE_URL 解析连接并 mysqldump；缺工具/失败仅告警不阻断
backup_db() {
  if ! command -v mysqldump >/dev/null 2>&1; then
    warn "    未找到 mysqldump，跳过 DB 备份（建议在宝塔安装 MySQL 客户端）"
    return 0
  fi
  [ -f .env ] || { warn "    无 .env，跳过 DB 备份"; return 0; }
  local url user pass db ts
  url="$(grep -E '^DATABASE_URL=' .env | head -n1 | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')"
  [ -n "$url" ] || { warn "    DATABASE_URL 为空，跳过 DB 备份"; return 0; }
  user="$(printf '%s' "$url" | sed -E 's#^mysql://([^:]+):.*#\1#')"
  pass="$(printf '%s' "$url" | sed -E 's#^mysql://[^:]+:([^@]+)@.*#\1#')"
  db="$(printf '%s' "$url" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')"
  ts="$(date +%Y%m%d_%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  if mysqldump -h 127.0.0.1 -u"$user" -p"$pass" --single-transaction --databases "$db" 2>/dev/null \
      | gzip > "$BACKUP_DIR/db_${ts}.sql.gz"; then
    log "    DB 备份: work/backups/db_${ts}.sql.gz"
  else
    warn "    mysqldump 失败，跳过 DB 备份"
    rm -f "$BACKUP_DIR/db_${ts}.sql.gz"
  fi
}

# 轮询健康检查：最多 HEALTH_RETRIES 次，每次间隔 3s
health_check() {
  local i
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    curl -sf "$HEALTH_URL" >/dev/null 2>&1 && return 0
    log "    健康检查未通过，重试 ${i}/${HEALTH_RETRIES} ..."
    sleep 3
  done
  return 1
}

on_success() {
  echo ""
  echo "========================================="
  echo "  部署成功！ 版本 TAG=${TAG}"
  docker compose ps
  echo "  API:  http://127.0.0.1:3001/api/health"
  echo "  Web:  http://127.0.0.1:3000"
  echo "========================================="
  echo ""
  echo "  首次部署请初始化种子数据（仅一次）: make seed"
}

on_fail() {
  echo ""
  warn "健康检查失败！"
  echo "    回滚: make rollback VERSION=<旧版本>"
  docker compose logs --tail=80 api || true
  exit 1
}

case "$ACTION" in
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
    if health_check; then on_success; else on_fail; fi
    ;;
  rollback)
    NEW_TAG="${2:-}"
    [ -n "$NEW_TAG" ] || { warn "用法: deploy-remote.sh rollback <tag>"; exit 1; }
    export TAG="$NEW_TAG"
    log "回滚到 TAG=${TAG} ..."
    docker compose up -d
    if health_check; then on_success; else on_fail; fi
    ;;
  migrate)
    log "数据库迁移 ..."
    docker compose run --rm api node_modules/.bin/prisma migrate deploy
    ;;
  seed)
    log "初始化种子数据 ..."
    docker compose run --rm api node_modules/.bin/prisma db seed
    ;;
  backup)
    log "备份数据 ..."
    backup_volume
    backup_db
    ;;
  logs)
    SERVICE="${2:-}"
    exec docker compose logs --tail=100 -f $SERVICE
    ;;
  health)
    if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
      log "健康检查通过: $HEALTH_URL"
    else
      warn "健康检查失败: $HEALTH_URL"; exit 1
    fi
    ;;
  *)
    warn "未知子命令: $ACTION"
    echo "可用: deploy <tarball> | rollback <tag> | migrate | seed | backup | logs [service] | health"
    exit 1
    ;;
esac
```

- [ ] **Step 2: 语法检查 + 赋可执行权限**

Run:
```bash
bash -n scripts/deploy-remote.sh && echo "SYNTAX_OK"
chmod +x scripts/deploy-remote.sh
command -v shellcheck >/dev/null 2>&1 && shellcheck scripts/deploy-remote.sh || echo "shellcheck 未安装，跳过"
```
Expected: 输出 `SYNTAX_OK`；shellcheck 无 error 级问题（warning 可接受，如 SC2086 关于 `$SERVICE` 故意不加引号以允许空值）。

- [ ] **Step 3: 子命令分派冒烟（无 Docker 环境下验证 usage 分支）**

Run:
```bash
bash scripts/deploy-remote.sh deploy 2>&1 | head -n1
bash scripts/deploy-remote.sh badcmd 2>&1 | head -n1
```
Expected:
- `deploy` 无第二参 → 首行 `!!! 用法: deploy-remote.sh deploy <tarball>`
- `badcmd` → 首行 `!!! 未知子命令: badcmd`

> 注意：这两条会因 `set -e` 以非零退出，用 `| head` 承接即可；只核对首行文案。

- [ ] **Step 4: 提交**

```bash
git add scripts/deploy-remote.sh
git commit -m "feat(deploy): add server-side deploy-remote.sh with subcommands and polling health check"
```

---

## Task 3: 删除旧 `scripts/deploy.sh`

**Files:**
- Delete: `scripts/deploy.sh`

- [ ] **Step 1: 确认职责已迁移**

Run:
```bash
grep -c "prisma migrate deploy\|docker compose up -d\|docker load\|erp-data" scripts/deploy-remote.sh
```
Expected: 输出 ≥ 4（迁移/启动/加载/卷备份逻辑均已在新脚本中）。

- [ ] **Step 2: 删除旧脚本**

Run:
```bash
git rm scripts/deploy.sh
```
Expected: `rm 'scripts/deploy.sh'`

- [ ] **Step 3: 确认无残留引用**

Run:
```bash
grep -rn "scripts/deploy.sh" . --include="*.sh" --include="Makefile" --include="*.yml" || echo "NO_REF(正确)"
```
Expected: 输出 `NO_REF(正确)`（Makefile 将在 Task 5 重写，此刻旧 Makefile 仍引用 deploy.sh —— 若此处命中 `Makefile`，属预期，Task 5 会消除；只需确保 scripts 与 ci.yml 无引用）。

- [ ] **Step 4: 提交**

```bash
git commit -m "chore(deploy): remove legacy scripts/deploy.sh (superseded by deploy-remote.sh)"
```

---

## Task 4: 本地编排器 `scripts/deploy-local.sh`

**Files:**
- Create: `scripts/deploy-local.sh`

- [ ] **Step 1: 写入脚本完整内容**

创建 `scripts/deploy-local.sh`，内容如下（**完整、可直接运行**）：

```bash
#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# TradeChain ERP 本地部署编排器（运行在开发机 macOS/Linux 上）
# 读取 .env.deploy：本地跨架构构建 + 打包镜像，rsync 传输到宝塔服务器，
# 经 SSH 触发 scripts/deploy-remote.sh 执行部署 / 运维动作。
#
# 子命令:
#   build-image   docker buildx 跨架构构建 api+web 镜像
#   package       docker save | gzip → dist/tradechain-erp-<VERSION>.tar.gz
#   ship          rsync 传输镜像包+compose+远程脚本，并 SSH 触发远程 deploy
#   deploy        build-image → package → ship（一条龙）
#   migrate|seed|rollback|backup|logs|health|remote-init   远程运维动作
#
# 版本: 通过环境变量 VERSION 传入（默认 latest）；生产务必显式 VERSION=vX.Y.Z
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# ---- 加载 .env.deploy ----
if [ ! -f .env.deploy ]; then
  echo "错误: 缺少 .env.deploy。请先执行: cp .env.deploy.example .env.deploy 并填写。" >&2
  exit 1
fi
set -a; . ./.env.deploy; set +a

: "${DEPLOY_HOST:?未设置 DEPLOY_HOST}"
: "${DEPLOY_USER:?未设置 DEPLOY_USER}"
: "${REMOTE_PATH:?未设置 REMOTE_PATH}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
BUILD_PLATFORM="${BUILD_PLATFORM:-linux/amd64}"
IMAGE_REPO="${IMAGE_REPO:-ghcr.io/logda}"

VERSION="${VERSION:-latest}"
SERVICE="${SERVICE:-}"
API_IMAGE="${IMAGE_REPO}/tradechain-erp-api:${VERSION}"
WEB_IMAGE="${IMAGE_REPO}/tradechain-erp-web:${VERSION}"
TARBALL="dist/tradechain-erp-${VERSION}.tar.gz"
REMOTE_SCRIPT="scripts/deploy-remote.sh"

# ---- SSH / rsync 前缀 ----
SSH_OPTS=(-p "$DEPLOY_PORT")
RSYNC_SSH="ssh -p ${DEPLOY_PORT}"
if [ -n "${SSH_KEY:-}" ]; then
  SSH_OPTS+=(-i "$SSH_KEY")
  RSYNC_SSH="ssh -p ${DEPLOY_PORT} -i ${SSH_KEY}"
fi
SSH_DEST="${DEPLOY_USER}@${DEPLOY_HOST}"
run_ssh() { ssh "${SSH_OPTS[@]}" "$SSH_DEST" "$@"; }
run_rs()  { rsync -azP -e "$RSYNC_SSH" "$@"; }

log() { echo "==> $*"; }
die() { echo "错误: $*" >&2; exit 1; }

build_image() {
  command -v docker >/dev/null 2>&1 || die "未找到 docker"
  docker buildx version >/dev/null 2>&1 || die "docker buildx 不可用（请安装 Docker Desktop / buildx）"
  log "构建 api 镜像 (${BUILD_PLATFORM}): ${API_IMAGE}"
  docker buildx build --platform "$BUILD_PLATFORM" -f apps/api/Dockerfile -t "$API_IMAGE" --load .
  log "构建 web 镜像 (${BUILD_PLATFORM}): ${WEB_IMAGE}"
  docker buildx build --platform "$BUILD_PLATFORM" -f apps/web/Dockerfile -t "$WEB_IMAGE" --load .
}

package() {
  docker image inspect "$API_IMAGE" >/dev/null 2>&1 || die "缺少镜像 $API_IMAGE，请先: make build-image VERSION=$VERSION"
  docker image inspect "$WEB_IMAGE" >/dev/null 2>&1 || die "缺少镜像 $WEB_IMAGE，请先: make build-image VERSION=$VERSION"
  mkdir -p dist
  log "打包镜像 → ${TARBALL}"
  docker save "$API_IMAGE" "$WEB_IMAGE" | gzip > "$TARBALL"
  ls -lh "$TARBALL"
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$TARBALL";
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$TARBALL"; fi
}

ship() {
  [ -f "$TARBALL" ] || die "找不到 $TARBALL，请先: make package VERSION=$VERSION"
  log "传输部署文件到 ${SSH_DEST}:${REMOTE_PATH} ..."
  run_ssh "mkdir -p '${REMOTE_PATH}/scripts' '${REMOTE_PATH}/dist'"
  run_rs "docker-compose.yml" "${SSH_DEST}:${REMOTE_PATH}/"
  run_rs "$REMOTE_SCRIPT"     "${SSH_DEST}:${REMOTE_PATH}/scripts/"
  run_rs "$TARBALL"           "${SSH_DEST}:${REMOTE_PATH}/dist/"
  log "触发远程部署 (TAG=${VERSION}) ..."
  run_ssh "cd '${REMOTE_PATH}' && TAG='${VERSION}' bash scripts/deploy-remote.sh deploy 'dist/tradechain-erp-${VERSION}.tar.gz'"
}

remote_init() {
  log "初始化服务器目录 ${REMOTE_PATH} ..."
  run_ssh "mkdir -p '${REMOTE_PATH}/scripts' '${REMOTE_PATH}/dist' '${REMOTE_PATH}/work/backups'"
  run_rs "docker-compose.yml" "${SSH_DEST}:${REMOTE_PATH}/"
  run_rs "$REMOTE_SCRIPT"     "${SSH_DEST}:${REMOTE_PATH}/scripts/"
  run_rs ".env.example"       "${SSH_DEST}:${REMOTE_PATH}/"
  echo ""
  echo "下一步（登录服务器执行）:"
  echo "  1) cd ${REMOTE_PATH} && cp .env.example .env && vi .env   # 填 DATABASE_URL / ERP_PUBLIC_BASE_URL"
  echo "  2) 宝塔面板创建 MySQL 库与用户，与 DATABASE_URL 对应"
  echo "  3) 回到本地执行: make deploy VERSION=v1.0.0 && make seed"
}

ACTION="${1:-deploy}"
case "$ACTION" in
  build-image) build_image ;;
  package)     package ;;
  ship)        ship ;;
  deploy)      build_image; package; ship ;;
  migrate)     run_ssh "cd '${REMOTE_PATH}' && bash scripts/deploy-remote.sh migrate" ;;
  seed)        run_ssh "cd '${REMOTE_PATH}' && bash scripts/deploy-remote.sh seed" ;;
  rollback)
    [ "$VERSION" != "latest" ] || die "回滚需显式版本: make rollback VERSION=vX.Y.Z"
    run_ssh "cd '${REMOTE_PATH}' && bash scripts/deploy-remote.sh rollback '${VERSION}'"
    ;;
  backup)      run_ssh "cd '${REMOTE_PATH}' && bash scripts/deploy-remote.sh backup" ;;
  logs)        ssh -t "${SSH_OPTS[@]}" "$SSH_DEST" "cd '${REMOTE_PATH}' && bash scripts/deploy-remote.sh logs ${SERVICE}" ;;
  health)      run_ssh "cd '${REMOTE_PATH}' && bash scripts/deploy-remote.sh health" ;;
  remote-init) remote_init ;;
  *)           die "未知子命令: $ACTION（可用: build-image|package|ship|deploy|migrate|seed|rollback|backup|logs|health|remote-init）" ;;
esac
```

- [ ] **Step 2: 语法检查 + 赋可执行权限**

Run:
```bash
bash -n scripts/deploy-local.sh && echo "SYNTAX_OK"
chmod +x scripts/deploy-local.sh
command -v shellcheck >/dev/null 2>&1 && shellcheck scripts/deploy-local.sh || echo "shellcheck 未安装，跳过"
```
Expected: 输出 `SYNTAX_OK`；shellcheck 无 error 级问题。

- [ ] **Step 3: 缺失 `.env.deploy` 时的友好报错（此时仓库无 .env.deploy）**

Run:
```bash
bash scripts/deploy-local.sh health 2>&1 | head -n1
```
Expected: 首行 `错误: 缺少 .env.deploy。请先执行: cp .env.deploy.example .env.deploy 并填写。`

- [ ] **Step 4: 用临时配置验证变量装配与分派（不真正连服务器）**

Run:
```bash
cp .env.deploy.example .env.deploy
# 用 dry 子命令验证：未知子命令应报「未知子命令」，证明已越过 .env 加载与变量校验
bash scripts/deploy-local.sh __dryrun__ 2>&1 | head -n1
rm -f .env.deploy
```
Expected:
- 首行 `错误: 未知子命令: __dryrun__（可用: build-image|package|ship|deploy|migrate|seed|rollback|backup|logs|health|remote-init）`
- 说明 `.env.deploy.example` 的默认值已通过 `: "${DEPLOY_HOST:?...}"` 等必填校验（模板里 `DEPLOY_HOST=your-server-ip` 非空）。
- 结尾 `rm -f .env.deploy` 确保不把临时文件留下（且它本就被 gitignore）。

- [ ] **Step 5: 提交**

```bash
git add scripts/deploy-local.sh
git commit -m "feat(deploy): add local deploy-local.sh orchestrator (buildx build, package, rsync ship, ssh dispatch)"
```

---

## Task 5: 重写 `Makefile`

**Files:**
- Modify(overwrite): `Makefile`

- [ ] **Step 1: 用以下内容整体覆盖 `Makefile`**

> ⚠️ 每个 target 下方的配方行**必须以 TAB 开头**。`LOCAL`、`VERSION`、`SERVICE` 为 Make 变量。

```makefile
.PHONY: install dev-api dev-web test build ci clean \
        build-image package ship deploy migrate seed rollback backup logs health remote-init help

# 版本：生产务必显式传 VERSION=vX.Y.Z（服务器按 tag 累积镜像以支持回滚；latest 会互相覆盖）
VERSION ?= latest
SERVICE ?=
LOCAL   := bash scripts/deploy-local.sh

## ===== 本地开发 =====

install: ## 安装依赖（锁定 lockfile）
	pnpm install --frozen-lockfile

dev-api: ## 本地开发：启动 API
	pnpm --filter api start:dev

dev-web: ## 本地开发：启动 Web
	pnpm --filter web dev

test: ## 运行全部测试
	pnpm -r test

build: ## 构建全部应用
	pnpm -r build

ci: install build test ## CI 门禁入口：安装 + 构建 + 测试

clean: ## 清理构建产物与本地镜像包
	rm -rf apps/api/dist apps/web/.next packages/shared/dist dist/*.tar.gz

## ===== 本地构建与打包 =====

build-image: ## 跨架构构建 api+web 镜像: make build-image VERSION=v1.0.0
	VERSION=$(VERSION) $(LOCAL) build-image

package: ## docker save 打包为 dist/*.tar.gz: make package VERSION=v1.0.0
	VERSION=$(VERSION) $(LOCAL) package

## ===== 传输与部署（宝塔服务器）=====

ship: ## 传输镜像包并触发远程部署: make ship VERSION=v1.0.0
	VERSION=$(VERSION) $(LOCAL) ship

deploy: ## 一条龙：构建→打包→传输→部署: make deploy VERSION=v1.0.0
	VERSION=$(VERSION) $(LOCAL) deploy

migrate: ## 远程仅执行数据库迁移
	$(LOCAL) migrate

seed: ## 远程初始化种子数据（首次）
	$(LOCAL) seed

rollback: ## 回滚到旧版本镜像: make rollback VERSION=v0.9.0
	VERSION=$(VERSION) $(LOCAL) rollback

backup: ## 远程备份 erp-data 卷 + 数据库
	$(LOCAL) backup

logs: ## 跟踪远程容器日志: make logs [SERVICE=api|web]
	SERVICE=$(SERVICE) $(LOCAL) logs

health: ## 远程健康检查
	$(LOCAL) health

remote-init: ## 首次：初始化服务器目录并传配置
	$(LOCAL) remote-init

help: ## 显示帮助
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "};{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
```

- [ ] **Step 2: 验证 `make help` 列出全部 target（证明 TAB 正确、无 `release`）**

Run:
```bash
make help
```
Expected: 打印彩色帮助，包含 `install dev-api dev-web test build ci clean build-image package ship deploy migrate seed rollback backup logs health remote-init help`；**不含** `release`。若报 `missing separator` → 说明配方行用了空格，需改回 TAB。

- [ ] **Step 3: 干跑验证部署 target 调用正确（不真正执行）**

Run:
```bash
make -n deploy VERSION=v0.0.1
make -n rollback VERSION=v0.0.1
make -n logs SERVICE=api
```
Expected:
- `deploy` → 打印 `VERSION=v0.0.1 bash scripts/deploy-local.sh deploy`
- `rollback` → 打印 `VERSION=v0.0.1 bash scripts/deploy-local.sh rollback`
- `logs` → 打印 `SERVICE=api bash scripts/deploy-local.sh logs`

- [ ] **Step 4: 确认旧 `release` 已移除**

Run:
```bash
grep -n "^release:" Makefile || echo "NO_RELEASE(正确)"
```
Expected: 输出 `NO_RELEASE(正确)`

- [ ] **Step 5: 提交**

```bash
git add Makefile
git commit -m "refactor(make): rewrite Makefile for local build/package/ship + remote ops targets, drop release"
```

---

## Task 6: 精简 `.github/workflows/ci.yml`

**Files:**
- Modify(overwrite): `.github/workflows/ci.yml`

- [ ] **Step 1: 用以下内容整体覆盖 `ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-test:
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
```

- [ ] **Step 2: 校验 YAML 合法 + 确认精简点**

Run:
```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML_OK')"
grep -c "release:" .github/workflows/ci.yml || true
grep -c "tags:" .github/workflows/ci.yml || true
grep -c "make ci" .github/workflows/ci.yml
```
Expected:
- `YAML_OK`
- `release:` 计数为 `0`（release job 已删）
- `tags:` 计数为 `0`（不再 tag 触发）
- `make ci` 计数为 `1`

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: slim workflow to build-test gate via 'make ci'; drop image build/push/release job"
```

---

## Task 7: 端到端验证（本地冒烟 + 服务器联调清单）

**Files:** 无（纯验证；如发现问题回到对应 Task 修复）

- [ ] **Step 1: 全量静态检查**

Run:
```bash
bash -n scripts/deploy-local.sh scripts/deploy-remote.sh && echo "SYNTAX_OK"
make help >/dev/null && echo "MAKE_OK"
ls scripts/deploy.sh 2>/dev/null || echo "OLD_SCRIPT_GONE(正确)"
```
Expected: `SYNTAX_OK`、`MAKE_OK`、`OLD_SCRIPT_GONE(正确)`

- [ ] **Step 2: 本地跨架构构建冒烟（需 Docker Desktop，耗时数分钟）**

Run:
```bash
cp .env.deploy.example .env.deploy
make build-image VERSION=vsmoke
docker image inspect ghcr.io/logda/tradechain-erp-api:vsmoke --format '{{.Architecture}}'
docker image inspect ghcr.io/logda/tradechain-erp-web:vsmoke --format '{{.Architecture}}'
```
Expected: 两条均输出 `amd64`（验证 `--platform linux/amd64` 生效，Apple Silicon 上尤为关键）。

- [ ] **Step 3: 本地打包冒烟**

Run:
```bash
make package VERSION=vsmoke
ls -lh dist/tradechain-erp-vsmoke.tar.gz
```
Expected: 生成 tar.gz，体积通常数百 MB；`package` 输出含 sha256 校验行。

- [ ] **Step 4: 清理本地冒烟产物**

Run:
```bash
docker rmi ghcr.io/logda/tradechain-erp-api:vsmoke ghcr.io/logda/tradechain-erp-web:vsmoke || true
rm -f dist/tradechain-erp-vsmoke.tar.gz .env.deploy
```
Expected: 无残留冒烟镜像/包/临时配置。

- [ ] **Step 5: 服务器联调清单（需一台宝塔测试服务器，手动执行）**

按序执行并核对：
1. 服务器已装 Docker + compose 插件 + rsync（`docker compose version`、`rsync --version`）。
2. 本地 `cp .env.deploy.example .env.deploy`，填真实 `DEPLOY_HOST/USER/PORT/REMOTE_PATH`。
3. `make remote-init` → 服务器 `$REMOTE_PATH` 下出现 `docker-compose.yml`、`scripts/deploy-remote.sh`、`.env.example`、空 `dist/`、`work/backups/`。
4. 登录服务器 `cd $REMOTE_PATH && cp .env.example .env && vi .env`（填 `DATABASE_URL` 用 `host.docker.internal`、`ERP_PUBLIC_BASE_URL`）。
5. 宝塔建 MySQL 库 + 用户，与 `DATABASE_URL` 对应。
6. 本地 `make deploy VERSION=v1.0.0` → 观察 5 步日志，健康检查通过、打印 `compose ps`。
7. `make seed` → 种子数据写入。
8. `make health` → 通过；浏览器访问 Web/API 正常。
9. `make logs SERVICE=api`（Ctrl-C 退出）。
10. `make backup` → 服务器 `work/backups/` 出现 `erp-data_*.tar.gz`（及 `db_*.sql.gz`，若装了 mysqldump）。
11. 再发一版 `make deploy VERSION=v1.0.1`，随后 `make rollback VERSION=v1.0.0` → 容器切回旧镜像、健康检查通过。

Expected: 全部步骤成功；任一步失败时，`deploy`/`rollback` 会打印 api 日志尾部与回滚提示并以非零码退出。

- [ ] **Step 6: 收尾提交（若验证期间有微调）**

```bash
git status --short
# 如有修复：git add -A && git commit -m "fix(deploy): adjustments from end-to-end verification"
# 如无改动：跳过
```

---

## Self-Review（计划自检结果）

**1. Spec 覆盖：**
- spec §3 架构/数据流 → Task 2/4/5 实现三脚本+Makefile 链路 ✓
- spec §5 `.env.deploy` → Task 1（模板）+ Task 4（加载/校验）✓
- spec §6 Makefile target 清单（增/改/剔除）→ Task 5 全覆盖，`release` 已删（Step 4 验证）✓
- spec §7.1 deploy-local 子命令 → Task 4 完整实现 ✓
- spec §7.2 deploy-remote 子命令 + 轮询健康检查 + §7.2.1 mysqldump 降级 → Task 2 完整实现 ✓
- spec §7.3 compose/Dockerfile 不改、.gitignore 例外 → Task 1（例外）+ File Structure 声明不改 ✓
- spec §8 CI 精简 → Task 6 ✓
- spec §9 版本/回滚/备份/健康/日志 → Task 2/4/5 分摊实现 ✓
- spec §10 跨架构 → Task 4（buildx --platform）+ Task 7 Step 2 验证 amd64 ✓
- spec §11 首次+日常操作 → Task 7 Step 5 清单 ✓
- spec §12 验证计划 → Task 7 全覆盖 ✓
- spec §13 落地文件清单 → File Structure 一致 ✓

**2. 占位符扫描：** 无 TBD/TODO；每个脚本、Makefile、ci.yml 均给出完整可用内容；每个验证步骤给出精确命令与预期输出。`.env.deploy.example` 中的 `your-server-ip` 是模板占位（用户填写），非计划占位。✓

**3. 类型/命名一致性：**
- 镜像名 `ghcr.io/logda/tradechain-erp-{api,web}` 在 compose、deploy-local、Task 7 验证中一致 ✓
- tarball 路径 `dist/tradechain-erp-${VERSION}.tar.gz` 在 package（本地）、ship（传输到 `$REMOTE_PATH/dist/`）、deploy-remote（`gunzip -c`）中一致 ✓
- 子命令名 `build-image/package/ship/deploy/migrate/seed/rollback/backup/logs/health/remote-init` 在 Makefile、deploy-local、deploy-remote 三处一致 ✓
- 环境变量 `VERSION/SERVICE/TAG/DEPLOY_*/BUILD_PLATFORM/IMAGE_REPO/HEALTH_RETRIES` 跨脚本命名一致 ✓
- `deploy-remote.sh` 用 `TAG`（compose 语义），`deploy-local.sh` 用 `VERSION`（用户语义），ship 时 `TAG='${VERSION}'` 显式桥接 ✓
