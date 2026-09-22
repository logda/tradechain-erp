# 本地出介质 + 手工上传 + 服务器 make 部署 设计

> **⚠️ 部分被取代（2026-09-20）：** 本文的「本地 buildx 构建 + `docker save` 打自包含介质 + 人工上传镜像包 + 服务器 `docker load`」已废弃，改为「打 git tag → GitHub Actions 构建推 GHCR → 服务器 `docker compose pull`」，`rollback` target 亦被删除（升级与回退同为 `deploy VERSION=`）。最新设计见 `docs/superpowers/specs/2026-09-20-ghcr-cicd-deploy-design.md`。
>
> **仍然有效的部分：** 服务器端执行器 `deploy-remote.sh` 的职责划分（备份/迁移/健康检查/日志）、固定部署目录、`.env` 与 `work/` 不入包、`work/CURRENT_TAG` 版本记录机制、镜像 tag 不清理以支撑回退。

**日期:** 2026-09-19

**目标:** 将交付模式从「本地构建 → rsync/SSH 自动传输 → 远程触发部署」重构为「本地构建自包含安装介质 → 人工上传到生产服务器 → 服务器上经 Makefile 直接部署」。彻底移除脚本层的网络传输（rsync/SSH），解决部署机为「外网、IP 随时变化」时自动连接不可用的问题。

**范围:** 本地构建与打包、自包含介质组装、服务器端加载/迁移/健康检查/回滚/备份/日志、Makefile 职责重划分、旧 SSH 流程与 `.env.deploy` 剔除、文档同步。不涉及应用业务代码改动，不涉及 CI 门禁逻辑（`make ci` 保持不变）。

**取代:** `docs/superpowers/specs/2026-09-14-makefile-cicd-baota-design.md`

---

## 1. 背景与动因

旧流程（2026-09-14）用 `scripts/deploy-local.sh` 在本地 `docker buildx` 构建、`docker save` 打包，再经 `rsync` 传输、`ssh` 触发服务器端 `scripts/deploy-remote.sh`。该设计假定服务器有**稳定可达的 SSH 地址**。

实际部署目标是**一台经外网访问、IP 随时变化的电脑**（用途为测试/演示）。这使 rsync/SSH 自动传输不可用：IP 一变 `.env.deploy` 就失效，且 NAT/CGNAT 下未必可直连。因此改为**人工上传介质 + 服务器本地部署**，把「网络可达性」问题从脚本中剥离，交给运维者用最合适的方式（宝塔文件管理器 / scp / U 盘 / Tailscale 等）解决。

## 2. 目标流程

```
本地开发机                         生产服务器（固定部署目录）
─────────────                      ──────────────────────────
make release VERSION=vX            ① 人工上传 bundle.tar.gz
  ├ build-image (buildx 跨架构)     ② tar -xzf bundle -C <固定目录> --strip-components=1
  ├ package (docker save|gzip)      ③ 首次: make init → 填 .env + 建库
  └ media (自包含 bundle)           ④ make deploy VERSION=vX
       │                               (备份→docker load→migrate→up→健康检查)
       └── dist/*-bundle.tar.gz      ⑤ 首次: make seed
```

## 3. 关键决策（13 项）

| # | 决策点 | 结论 |
|---|---|---|
| Q1 | 改动范围 | **彻底替换** rsync/SSH 自动部署，删除相关逻辑与 `.env.deploy` 连接配置 |
| Q2 | 介质形态 | **自包含单包**：一个 tar.gz 内含镜像包 + Makefile + compose + deploy-remote.sh + .env.example |
| Q3 | Makefile 组织 | **单一 Makefile**，按角色区分 target（本地构建 vs 服务器部署），同一份打进介质 |
| Q4 | 包内结构 | **迷你仓库结构**（保留 `scripts/`、`dist/` 子目录），现有脚本路径零改动 |
| Q5 | 解压位置 | **固定目录覆盖**（如 `/www/wwwroot/tradechain-erp`）；`.env`、`work/` 不在包内故天然保留 |
| Q6 | 构建脚本 | 保留**瘦身版本地构建脚本**，Makefile 薄封装；新增 `media` 子命令 |
| Q7 | 构建配置来源 | **删除 `.env.deploy`**；`BUILD_PLATFORM`、`IMAGE_REPO` 改为 Makefile 变量 + 默认值 |
| Q8 | 本地 target | 新增 `make release` 一条龙；保留 `build-image`、`package` 细粒度 |
| Q9 | 服务器引导 | 新增 `make init`；`make deploy` **强制显式 VERSION** |
| Q10 | 磁盘清理 | **不清理**：dist 介质包与 docker 镜像 tag 无限累积（回滚依赖镜像 tag，禁止删） |
| Q11 | 脚本命名 | `deploy-local.sh` **重命名为 `build-release.sh`** |
| Q12 | 完整性校验 | **轻量**：release 打印 bundle sha256 + 包内放 SHA256SUMS；deploy 不加强制阻断 |
| Q13 | 文档同步 | 新写 plan/spec；旧文档标注「已被取代」；更新 README 部署章节 |

## 4. 组件设计

### 4.1 本地：`scripts/build-release.sh`（原 deploy-local.sh 瘦身重命名）

- 移除：全部 rsync/ssh、`.env.deploy` 加载与校验、ship/deploy/remote-init/migrate/seed/rollback/backup/logs/health 的远程转发分支。
- 保留：`build_image`（buildx 跨架构 + `verify_arch` 架构校验）、`package`（docker save|gzip + sha256）。
- 新增：`media`（组装迷你仓库结构 bundle + SHA256SUMS）、`release`（build-image→package→media）。
- 配置：`BUILD_PLATFORM`（默认 `linux/amd64`）、`IMAGE_REPO`（默认且强校验 `ghcr.io/logda`）、`VERSION`，均来自环境变量。

### 4.2 服务器：`scripts/deploy-remote.sh`

- 基本不变（本就是服务器执行器）。
- 新增 `init` 子命令：`.env` 缺失则从 `.env.example` 拷贝、`mkdir -p work/backups`、打印后续清单。
- `deploy <tarball>` / `rollback <tag>` / `migrate` / `seed` / `backup` / `logs` / `health` 保持原语义。

### 4.3 `Makefile`

- 变量：`VERSION?=latest`、`SERVICE?=`、`HEALTH_RETRIES?=10`、`BUILD_PLATFORM?=linux/amd64`、`IMAGE_REPO?=ghcr.io/logda`；`LOCAL=bash scripts/build-release.sh`、`REMOTE=bash scripts/deploy-remote.sh`。
- 本地 target：`release`、`build-image`、`package`（透传 VERSION/BUILD_PLATFORM/IMAGE_REPO 给 `$(LOCAL)`）。
- 服务器 target：`init`、`deploy`、`migrate`、`seed`、`rollback`、`backup`、`logs`、`health`（直接调 `$(REMOTE)`，无 SSH）。
- `deploy`/`rollback` 前置守卫：`VERSION=latest` 时报错退出。
- 删除：`ship`、`remote-init`、本地一条龙 `deploy`。
- 开发/CI target 不变：`install`/`dev-api`/`dev-web`/`test`/`build`/`ci`/`clean`/`help`。

### 4.4 介质 bundle 结构

```
tradechain-erp-<VERSION>/
├── Makefile
├── docker-compose.yml
├── .env.example
├── SHA256SUMS                       # 对 dist 镜像包的摘要
├── scripts/
│   ├── deploy-remote.sh
│   └── build-release.sh
└── dist/
    └── tradechain-erp-<VERSION>.tar.gz   # api+web 镜像
```

产物：`dist/tradechain-erp-<VERSION>-bundle.tar.gz`（上传此单文件）。

## 5. 不变量与安全约束

- **镜像名前缀恒为 `ghcr.io/logda`**：与 `docker-compose.yml` 硬编码一致，build-release.sh 强校验；仅本地 `docker load`，不发生任何 registry 推拉。
- **`.env`、`work/` 绝不进介质包**：保护服务器密钥、`CURRENT_TAG`、备份历史；解压覆盖天然不触碰。
- **架构一致性**：构建后 `verify_arch` 立即校验，防 Apple Silicon→amd64 错配。
- **回滚依赖 docker 镜像 tag**：Q10 决定不清理，历史 tag 常驻；禁止删镜像 tag。
- **deploy/rollback 需显式 VERSION**：`latest` 会互相覆盖、无法回滚，Makefile 层守卫拦截。

## 6. 影响面

- 删除：`scripts/deploy-local.sh`、`.env.deploy.example`（`.gitignore` 去掉对应例外行）。
- 新增：`scripts/build-release.sh`、本 spec、对应 plan。
- 修改：`Makefile`、`scripts/deploy-remote.sh`、`README.md`、旧 plan/spec 顶部标注。
- 不变：`.github/workflows/ci.yml`（仍 `make ci`）、`docker-compose.yml`、两个 Dockerfile、应用代码。
