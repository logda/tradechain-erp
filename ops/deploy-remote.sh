#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# TradeChain ERP 服务器端部署执行器（运行在生产服务器上）
# 部署目录为纯静态 ops 文件（人工上传，服务器不装 git），4 个文件平铺同级：
#   Makefile / docker-compose.yml / .env.example / deploy-remote.sh
# 即仓库里的 ops/ 目录 == 服务器上的部署根目录，不要多套一层子目录。
# 镜像来源：GHCR（ghcr.io/logda），由 GitHub Actions 按 git tag 构建推送。
# 拉取前需一次性 `make login`（docker login ghcr.io，PAT 仅需 read:packages）。
# 镜像源可在 .env 里用 IMAGE_REGISTRY 切换（默认 ghcr.io），但本仓库的包是 private，
# 公共国内镜像站代理不到 —— 详见 ops/.env.example 的说明。
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

# 本脚本就位于部署根目录（与 Makefile / docker-compose.yml / .env 同级），
# 故部署根 = 脚本自身所在目录。无论从哪里调用都能定位正确。
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
HEALTH_RETRIES="${HEALTH_RETRIES:-10}"
BACKUP_DIR="${PROJECT_DIR}/work/backups"
# 当前已部署版本的持久记录：deploy 成功后写入。start/restart/migrate/seed 等未显式
# 传版本的动作据此锁定“正在运行的版本”，由 require_tag 校验。
# 缺失时留空并明确报错，不回落到 :latest —— GHCR 不推 latest，回落只会在 compose
# 阶段抛出难懂的 manifest unknown，掩盖真正的原因（从未成功部署过）。
TAG_FILE="${PROJECT_DIR}/work/CURRENT_TAG"
TAG="${TAG:-$(cat "$TAG_FILE" 2>/dev/null || true)}"
export TAG

# 镜像源。默认直连 ghcr.io；可在部署目录的 .env 里设 IMAGE_REGISTRY 换成国内代理。
# compose 会自动读同目录 .env 做 ${IMAGE_REGISTRY} 插值，脚本这边也读一次，
# 保证 versions 的过滤与 compose 实际用的源一致。优先级：shell 环境变量 > .env > ghcr.io。
# 注意：本仓库的 GHCR 包是 private，公共镜像站（NJU / DaoCloud 等）代理不到，
# 详见 ops/.env.example 里的说明。切换源后必须重新 pull，旧源拉下来的镜像不会被复用。
_reg_from_env="$(grep -E '^IMAGE_REGISTRY=' "$PROJECT_DIR/.env" 2>/dev/null | head -n1 | sed -E 's/^IMAGE_REGISTRY=//; s/^"//; s/"$//' || true)"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-${_reg_from_env:-ghcr.io}}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-logda}"
# 仓库路径 logda/tradechain-erp-{api,web} 必须与 .github/workflows/release.yml 推送的一致
IMAGE_REPO="${IMAGE_REPO:-${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}}"
export IMAGE_REGISTRY IMAGE_NAMESPACE IMAGE_REPO

cd "$PROJECT_DIR"
ACTION="${1:-deploy}"

log()  { echo "==> $*"; }
warn() { echo "!!! $*" >&2; }
record_tag() { mkdir -p "$(dirname "$TAG_FILE")"; printf '%s\n' "$TAG" > "$TAG_FILE"; }

# 需要镜像版本的动作（start/restart/migrate/seed）在执行前调用
require_tag() {
  if [ -z "$TAG" ] || [ "$TAG" = "latest" ]; then
    warn "未记录已部署版本（work/CURRENT_TAG 缺失或为 latest），无法确定该操作哪个镜像版本"
    warn "请先执行: make deploy VERSION=vX.Y.Z"
    exit 1
  fi
}

# 备份 erp-data 上传卷（卷存在才备）
backup_volume() {
  mkdir -p "$BACKUP_DIR"
  if ! docker volume inspect erp-data >/dev/null 2>&1; then
    log "    跳过卷备份（首次部署，尚无 erp-data 卷）"
    return 0
  fi
  local ts mp
  ts="$(date +%Y%m%d_%H%M%S)"
  # 直接在宿主机 tar 卷挂载点，避免临时拉取 alpine（国内宝塔常拉不动 Docker Hub）
  mp="$(docker volume inspect erp-data -f '{{.Mountpoint}}' 2>/dev/null || true)"
  if [ -z "$mp" ] || [ ! -d "$mp" ]; then
    warn "    无法定位 erp-data 卷挂载点（需 root 读取 /var/lib/docker/volumes），中止部署以保护数据"
    return 1
  fi
  if tar czf "$BACKUP_DIR/erp-data_${ts}.tar.gz" -C "$mp" . 2>>"$BACKUP_DIR/last-backup.log"; then
    log "    卷备份: work/backups/erp-data_${ts}.tar.gz"
  else
    warn "    卷备份失败（详见 work/backups/last-backup.log），中止部署以保护数据"
    return 1
  fi
}

# 从 .env 的 DATABASE_URL 解析连接并 mysqldump；缺工具/失败仅告警不阻断
backup_db() {
  if ! command -v mysqldump >/dev/null 2>&1; then
    warn "    未找到 mysqldump，跳过 DB 备份（建议在宝塔安装 MySQL 客户端）"
    return 0
  fi
  [ -f .env ] || { warn "    无 .env，跳过 DB 备份"; return 0; }
  local url user pass db dbhost dbport ts
  # || true：无 DATABASE_URL 行时 grep 返回 1，避免 pipefail+set -e 直接中止部署（应走下面的降级守卫）
  url="$(grep -E '^DATABASE_URL=' .env | head -n1 | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//' || true)"
  [ -n "$url" ] || { warn "    DATABASE_URL 为空，跳过 DB 备份"; return 0; }
  user="$(printf '%s' "$url" | sed -nE 's#^mysql://([^:]+):.*#\1#p')"
  # 密码贪婪匹配到最后一个 @，兼容密码含 @ 的情形
  pass="$(printf '%s' "$url" | sed -nE 's#^mysql://[^:]+:(.*)@[^@]+$#\1#p')"
  db="$(printf '%s' "$url" | sed -nE 's#.*/([^/?]+)(\?.*)?$#\1#p')"
  dbhost="$(printf '%s' "$url" | sed -nE 's#.*@([^@:/?]+).*#\1#p')"
  dbport="$(printf '%s' "$url" | sed -nE 's#.*@[^@:/?]+:([0-9]+).*#\1#p')"
  # host.docker.internal 是容器侧别名，宿主机 mysqldump 应连本地；端口缺省 3306
  { [ -z "$dbhost" ] || [ "$dbhost" = "host.docker.internal" ]; } && dbhost="127.0.0.1"
  dbport="${dbport:-3306}"
  ts="$(date +%Y%m%d_%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  log "    DB 备份目标: ${dbhost}:${dbport}/${db}"
  # MYSQL_PWD 而非 -p 命令行：避免密码出现在 ps 进程列表；stderr 落日志便于诊断
  if MYSQL_PWD="$pass" mysqldump -h "$dbhost" -P "$dbport" -u"$user" --single-transaction --databases "$db" \
      2>>"$BACKUP_DIR/last-db-backup.log" | gzip > "$BACKUP_DIR/db_${ts}.sql.gz"; then
    log "    DB 备份: work/backups/db_${ts}.sql.gz"
  else
    warn "    mysqldump 失败，跳过 DB 备份（详见 work/backups/last-db-backup.log）"
    rm -f "$BACKUP_DIR/db_${ts}.sql.gz"
  fi
}

# 轮询健康检查：最多 HEALTH_RETRIES 次，每次间隔 3s
health_check() {
  if ! command -v curl >/dev/null 2>&1; then
    warn "    未找到 curl，无法自动健康检查；请手工确认服务已就绪"
    return 0
  fi
  local i
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1 && return 0
    if [ "$i" -lt "$HEALTH_RETRIES" ]; then
      log "    健康检查未通过，重试 ${i}/${HEALTH_RETRIES} ..."
      sleep 3
    fi
  done
  return 1
}

on_success() {
  echo ""
  echo "========================================="
  echo "  部署成功！ 版本 TAG=${TAG}"
  docker compose ps
  echo "  API:  ${HEALTH_URL}"
  echo "  Web:  http://127.0.0.1:3000"
  echo "========================================="
  echo ""
  echo "  首次部署请初始化种子数据（仅一次）: make seed"
}

on_fail() {
  echo ""
  warn "健康检查失败！当前服务仍在运行旧版本容器（若曾成功启动）。"
  echo "    回退: make deploy VERSION=<旧版本>    # make versions 可查本地已有版本"
  docker compose logs --tail=80 api || true
  exit 1
}

case "$ACTION" in
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
    echo "                                 # 以及 ERP_FORMAL_SESSION_SECRET（必填，生产缺失会拒绝服务）："
    echo "                                 #   openssl rand -base64 48"
    echo "  3) 宝塔面板创建 MySQL 库与用户，与 DATABASE_URL 对应"
    echo "  4) make deploy VERSION=<版本>   # 拉镜像→迁移→启动→健康检查"
    echo "  5) make seed                    # 首次初始化种子数据（仅一次）"
    echo "  6) 登录后立刻修改 admin/mia/zoe/leo 的种子密码（seed 里的密码是公开的演示值）"
    ;;
  deploy)
    NEW_TAG="${2:-}"
    [ -n "$NEW_TAG" ] || { warn "用法: deploy-remote.sh deploy <version>"; exit 1; }
    # 脚本级兜底：Makefile 已有同样守卫，但直接调用脚本时也要拦住 latest（无法回退）
    [ "$NEW_TAG" != "latest" ] || { warn "deploy 需显式版本号 vX.Y.Z（latest 无法回退）"; exit 1; }
    export TAG="$NEW_TAG"
    log "[1/5] 备份数据 ..."
    backup_volume
    backup_db
    log "[2/5] 拉取镜像 (TAG=${TAG}, 源=${IMAGE_REGISTRY}) ..."
    if ! docker compose pull; then
      warn "    拉取失败。依次检查: 版本号是否存在于该源（make versions / GHCR packages）、"
      warn "    make login 的 PAT 是否过期、IMAGE_REGISTRY 是否配错（当前: ${IMAGE_REGISTRY}）"
      exit 1
    fi
    log "[3/5] 数据库迁移（一次性容器，用刚拉下来的新镜像）..."
    docker compose run --rm api node_modules/.bin/prisma migrate deploy
    log "[4/5] 启动 / 更新容器 ..."
    docker compose up -d
    log "[5/5] 健康检查 ..."
    if health_check; then record_tag; on_success; else on_fail; fi
    ;;
  stop)
    log "停止容器（保留容器、网络与 erp-data 卷）..."
    docker compose stop
    log "已停止。恢复运行: make start"
    ;;
  start)
    require_tag   # TAG 来自 work/CURRENT_TAG（脚本顶部已加载）
    log "启动容器 (TAG=${TAG}) ..."
    docker compose up -d
    if health_check; then on_success; else on_fail; fi
    ;;
  versions)
    if [ -n "$TAG" ]; then
      log "当前运行版本: ${TAG}"
    else
      log "当前运行版本: （未记录，尚无成功部署；先 make deploy VERSION=vX.Y.Z）"
    fi
    log "当前镜像源: ${IMAGE_REGISTRY}（在 .env 里设 IMAGE_REGISTRY 可切换）"
    log "本地已有镜像（列出所有源；只有属于当前源的那些能被 compose 直接复用）:"
    local_img=""
    for name in api web; do
      echo "  ${IMAGE_NAMESPACE}/tradechain-erp-${name}:"
      local_img="$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -E "/${IMAGE_NAMESPACE}/tradechain-erp-${name}:" | sort -u || true)"
      if [ -n "$local_img" ]; then
        printf '%s\n' "$local_img" | sed 's/^/    /'
      else
        echo "    （无）"
      fi
    done
    echo ""
    log "全部历史版本见 GHCR: https://github.com/logda?tab=packages"
    ;;
  restart)
    # 改配置后重建容器：不重拉镜像、不迁移，仅让 .env / compose 变更生效
    require_tag
    SERVICE="${2:-}"
    case "$SERVICE" in ""|api|web) ;; *) warn "非法 SERVICE: ${SERVICE}（可用: api|web）"; exit 1 ;; esac
    log "重建容器以应用新配置 (TAG=${TAG}${SERVICE:+, SERVICE=${SERVICE}}) ..."
    docker compose up -d --force-recreate $SERVICE
    if health_check; then on_success; else on_fail; fi
    ;;
  migrate)
    require_tag   # 一次性容器要按已部署版本起，否则会用错 schema 的镜像跑迁移
    log "数据库迁移 (TAG=${TAG}) ..."
    docker compose run --rm api node_modules/.bin/prisma migrate deploy
    ;;
  seed)
    require_tag
    log "初始化种子数据 (TAG=${TAG}) ..."
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
    if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      log "健康检查通过: $HEALTH_URL"
    else
      warn "健康检查失败: $HEALTH_URL"; exit 1
    fi
    ;;
  *)
    warn "未知子命令: $ACTION"
    echo "可用: init | deploy <version> | stop | start | restart [service] | migrate | seed | backup | logs [service] | health | versions"
    exit 1
    ;;
esac
