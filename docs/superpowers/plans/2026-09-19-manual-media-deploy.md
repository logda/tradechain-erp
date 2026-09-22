# 本地出介质 + 手工上传 + 服务器 make 部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把交付模式从「本地构建 → rsync/SSH 自动传输 → 远程触发」重构为「本地构建自包含安装介质 → 人工上传 → 服务器 `make` 部署」，彻底移除脚本层网络传输。

**Architecture:** 双脚本 + 单一薄 Makefile。本地 `scripts/build-release.sh`（buildx 跨架构构建 → docker save 打镜像包 → 组装自包含 bundle）；服务器 `scripts/deploy-remote.sh`（init/备份/加载/迁移/启动/健康检查/回滚/备份/日志）。Makefile 按角色划分 target：本地 `release/build-image/package`，服务器 `init/deploy/migrate/seed/rollback/backup/logs/health`。CI 门禁 `make ci` 不变。

**Tech Stack:** GNU Make、Bash（`set -euo pipefail`）、Docker + buildx + compose v2、pnpm 9 workspace、Prisma 7、GitHub Actions（仅测试门禁）。

**设计依据:** `docs/superpowers/specs/2026-09-19-manual-media-deploy-design.md`

---

## Task 1: 本地构建脚本瘦身重命名

- [x] 新建 `scripts/build-release.sh`：保留 `build_image`（buildx + `verify_arch`）、`package`（docker save|gzip + sha256）
- [x] 移除全部 rsync/ssh、`.env.deploy` 加载与校验、远程转发分支
- [x] 新增 `media`：组装迷你仓库结构 bundle（Makefile/compose/.env.example/scripts/dist 镜像包 + SHA256SUMS）
- [x] 新增 `release`：build-image → package → media
- [x] 配置改环境变量：`BUILD_PLATFORM`（默认 linux/amd64）、`IMAGE_REPO`（强校验 ghcr.io/logda）、`VERSION`
- [x] 删除旧 `scripts/deploy-local.sh`

## Task 2: 服务器执行器新增 init

- [x] `scripts/deploy-remote.sh` 头部文档更新（去掉「由 deploy-local.sh 经 SSH 调用」表述）
- [x] 新增 `init` 子命令：`.env` 缺失则从 `.env.example` 拷贝、`mkdir -p work/backups dist scripts`、打印后续清单
- [x] 末尾帮助行加入 `init`
- [x] `deploy/rollback/migrate/seed/backup/logs/health` 语义保持不变

## Task 3: Makefile 职责重划分

- [x] 变量：`VERSION?=latest`、`SERVICE?=`、`HEALTH_RETRIES?=10`、`BUILD_PLATFORM?=linux/amd64`、`IMAGE_REPO?=ghcr.io/logda`
- [x] `LOCAL=bash scripts/build-release.sh`、`REMOTE=bash scripts/deploy-remote.sh`
- [x] 本地 target：`release`（新）、`build-image`、`package`（透传构建变量）
- [x] 服务器 target：`init`（新）、`deploy`、`migrate`、`seed`、`rollback`、`backup`、`logs`、`health`（直调 `$(REMOTE)`）
- [x] `deploy`/`rollback` 前置守卫：`VERSION=latest` 报错退出
- [x] 删除 `ship`、`remote-init`、本地一条龙 `deploy`
- [x] `clean` 增加清理 `dist/bundle`
- [x] 更新 `.PHONY` 与 `help`

## Task 4: 配置与忽略项清理

- [x] 删除 `.env.deploy.example`
- [x] `.gitignore` 去掉 `!.env.deploy.example` 例外行
- [ ] 提醒用户手工删除本地已存在的 `.env.deploy`（含服务器信息，gitignored，不由脚本删）

## Task 5: 文档同步

- [x] 旧 `plans/2026-09-14-makefile-cicd-baota.md` 顶部标注「已被取代」
- [x] 旧 `specs/2026-09-14-makefile-cicd-baota-design.md` 顶部标注「已被取代」
- [x] 新写 `specs/2026-09-19-manual-media-deploy-design.md`
- [x] 新写本 plan
- [x] 更新 `README.md`：新增「部署」章节（本地 release → 手工上传 → 服务器 init/deploy/seed）

## Task 6: 校验

- [x] `bash -n scripts/build-release.sh scripts/deploy-remote.sh` 语法检查
- [x] `make help` / `make -n deploy VERSION=v1.0.0` 干跑，确认 target 与路径正确
- [x] 临时目录验证 `deploy-remote.sh init`（建 .env/work、打印清单、未知子命令帮助）
- [ ] （有 Docker 时）`make build-image VERSION=vTest` 验证跨架构构建 + 架构校验链路

---

## 运维手册（交付后）

**本地发版：**
```bash
make release VERSION=v1.1.0        # 产出 dist/tradechain-erp-v1.1.0-bundle.tar.gz
```

**人工上传**（宝塔文件管理器 / scp / U 盘均可）该 bundle 到服务器。

**服务器部署：**
```bash
cd /www/wwwroot/tradechain-erp
tar -xzf /path/to/tradechain-erp-v1.1.0-bundle.tar.gz -C . --strip-components=1
make deploy VERSION=v1.1.0         # 备份→加载→迁移→启动→健康检查
```

**首次上线额外步骤：**
```bash
make init                          # 建 .env/work
vi .env                            # 填 DATABASE_URL(host.docker.internal)/ERP_PUBLIC_BASE_URL
# 宝塔面板建 MySQL 库与用户
make deploy VERSION=v1.0.0
make seed                          # 仅一次
```

**回滚：**
```bash
make rollback VERSION=v1.0.0       # 切回已加载的旧镜像 tag（需显式版本）
```
