# GitHub Actions 构建镜像 + 服务器按 tag 拉取部署 设计

**日期:** 2026-09-20

**目标:** 将交付模式从「本地 buildx 构建 → docker save 打自包含介质 → 人工上传 → 服务器 docker load」重构为「打 git tag → GitHub Actions 构建并推送 GHCR → 服务器 `make deploy VERSION=vX.Y.Z` 拉取部署」。构建职责移交 CI，服务器端只做「指定镜像版本 → 部署」，升级与回退合并为同一条命令。

**范围:** CI 镜像构建与推送 workflow、服务器端 pull 式部署与启停命令、Makefile 职责重划分、本地构建链瘦身、ops 文件分发方式、旧介质打包流程剔除、文档同步。不涉及应用业务代码改动，不涉及 `ci.yml` 门禁逻辑，不引入 Kubernetes/多机编排，不做自动部署（服务器端始终人工触发）。

**取代:** `docs/superpowers/specs/2026-09-19-manual-media-deploy-design.md` 中的「本地构建 + 自包含介质」部分。该设计的服务器端执行器（`deploy-remote.sh` 的备份/迁移/健康检查/日志职责）与「固定部署目录、`.env`/`work/` 不入包」等不变量继续沿用。

> **修订（2026-09-21）：** ops 文件从「散落在仓库根目录 + `scripts/` 子目录」改为**集中在 `ops/` 目录**，且拆分为两个 Makefile —— 根 `Makefile` 只含本地开发机命令（开发/门禁/`tag`/`build-image`），`ops/Makefile` 只含服务器命令。§4.4 已按新布局重写；本文中其余出现的 `scripts/deploy-remote.sh` 一律读作 `ops/deploy-remote.sh`，`docker-compose.yml` / `.env.example` 一律读作 `ops/` 下的同名文件。§4.3 描述的「单一 Makefile」决策（Q3）已被此次修订取代。动因与取舍见 §4.4。

> **修订（2026-09-22）：** 服务器**拉取侧**的 registry 前缀参数化为 `${IMAGE_REGISTRY:-ghcr.io}`（`ops/docker-compose.yml` 两处 `image:`、`ops/deploy-remote.sh` 的 `IMAGE_REPO`），可在部署目录 `.env` 里切换；**CI 推送侧仍写死 `ghcr.io`**。§5 的「镜像名恒为 `ghcr.io/logda/tradechain-erp-{api,web}`、三处同一字面量」不变量随之收窄为「**仓库路径** `logda/tradechain-erp-{api,web}` 三处同步，registry 前缀只在拉取侧可配」；§4.3 提到的 `IMAGE_REPO ?= ghcr.io/logda` 现在只服务本地 `make build-image`。动因是国内服务器直连 `ghcr.io` 慢，见 §7 的风险行与下方说明。
>
> **但公共国内 GHCR 镜像站对本项目无效**：包是 private，公共镜像站是匿名/白名单代理。实测（2026-09，以公开镜像 `astral-sh/uv` 作对照组证明站点本身可用）：`ghcr.nju.edu.cn` → `404 MANIFEST_UNKNOWN` 且不返回 `Www-Authenticate`（不转发鉴权）；`ghcr.m.daocloud.io` → `403 这镜像不在白名单`。因此 `IMAGE_REGISTRY` 在 `.env.example` 里默认注释，机制就位但暂无可用取值。四条候选出路（GHCR 包改 public / 自建带鉴权反代 / CI 额外推国内 registry / dockerd 配 `HTTPS_PROXY`）尚未决策。
>
> `deploy` 的 `[2/5]` 拉取失败时打印当前源与三点排查提示，**不自动回落到 `ghcr.io`** —— 回落会让不同命令用到不同镜像名（这次从 `ghcr.io` 拉到了，下次 `make start` 又按 `.env` 里的源去拉），制造跨命令的状态不一致；而 pull 失败本身已是安全态（`up -d` 不执行，旧容器继续跑）。

---

## 1. 背景与动因

2026-09-19 的设计为了绕开「部署机入站 IP 随时变化、SSH 不可达」而放弃自动传输，改为本地构建镜像 + `docker save` 打介质 + 人工上传。但**入站不可达并不影响出站**：拉镜像只需要服务器能主动连出去。因此「人工上传几百 MB 镜像包」这一步是可以消除的。

同时，本地 buildx 跨架构构建（Apple Silicon → `linux/amd64`）引入了 `verify_arch` 这类架构校验负担，而 GitHub-hosted runner 本身就是 amd64，与生产服务器同架构，构建即所得。

镜像名前缀 `ghcr.io/logda` 与 `docker-compose.yml` 里的 `${TAG:-latest}` 参数化在上一版设计中已经就位，本次改动主要是把「谁构建、怎么送到服务器」这两件事换掉。

## 2. 目标流程

```
开发机                          GitHub Actions                    生产服务器（静态 ops 文件）
──────                          ──────────────                    ──────────────────────
make tag VERSION=v1.2.0    →    release.yml:
  校验 + git tag -a + push        gate:  make ci                  make deploy VERSION=v1.2.0
                                  build: api/web 原生 amd64           [1] 备份卷 + 库
                                         ↓ needs: gate                [2] docker compose pull
                                  push ghcr.io/logda/                 [3] prisma migrate deploy
                                    tradechain-erp-{api,web}:v1.2.0   [4] docker compose up -d
                                                                      [5] 健康检查 → 记 CURRENT_TAG
```

**镜像 tag == git tag == 部署版本号**，三者是同一个字符串，不存在映射表。

回退不是独立操作：`make deploy VERSION=v1.0.0` 就是回退到 v1.0.0。

## 3. 关键决策

| # | 决策点 | 结论 | 理由 |
|---|---|---|---|
| Q1 | registry | **GHCR `ghcr.io/logda`** | 与 compose 硬编码值一致，零改名；Actions 用内置 `GITHUB_TOKEN` 即可推送 |
| Q2 | 构建触发 | **push tag `v*.*.*`** | tag 不可变、可复现，版本号即镜像 tag，与「部署必须显式 VERSION」守卫天然对齐 |
| Q3 | 服务器拉取鉴权 | **一次性 `docker login ghcr.io`（PAT，`read:packages`）** | 凭据落 `~/.docker/config.json`，Makefile 与脚本里不出现任何密钥 |
| Q4 | 服务器 ops 文件 | **纯静态，人工上传，服务器不装 git** | 只有 4 个小文本文件，变更频率低；不引入 git 鉴权与检出状态管理 |
| Q5 | 回退语义 | **删除 `rollback` target**，升级与回退同为 `deploy VERSION=` | `up -d` 幂等，「没有就新建、有就停旧起新」由 compose 原生提供 |
| Q6 | 本地构建链 | **删 `build-release.sh` 全部逻辑**，`build-image` 瘦成 Makefile 一行且**本地原生架构** | 生产镜像一律以 CI 为准；本地构建仅用于验证 Dockerfile 改动 |
| Q7 | `latest` tag | **CI 不推 `latest`** | 已强制显式 VERSION，滚动指针只会诱导误部署 |
| Q8 | 版本查询 | **`make tags` 换成 `make versions`**（列本地已有镜像 tag） | 服务器无 git，列 GHCR tag 需额外一套鉴权；本地 tag 恰好就是「可离线回退的候选」 |
| Q9 | CI 门禁与构建的关系 | **`release.yml` 内含 `gate` job 跑 `make ci`，`build` job `needs: gate`** | 保证任何 tag 都不会推出没过测试的镜像 |
| Q10 | 跨架构构建 | **删除 `BUILD_PLATFORM` 与 `verify_arch`** | runner 与服务器同为 amd64，架构错配这类 bug 从根上消失 |
| Q11 | 磁盘/镜像清理 | **不清理**（沿用 2026-09-19 Q10） | 本地旧 tag 常驻 → 断网也能回退 |

## 4. 组件设计

### 4.1 CI：新增 `.github/workflows/release.yml`

- **触发:** `on: push: tags: ['v*.*.*']`
- **权限:** `contents: read`、`packages: write`
- **并发:** `group: ${{ github.workflow }}-${{ github.ref }}`，不设 `cancel-in-progress`（发版不应被后来的 tag 取消）
- **`gate` job:** checkout + pnpm + node 22 + `make ci`，与 `ci.yml` 的 `build-test` 同构
- **`build` job:** `needs: gate`，`strategy.matrix.app: [api, web]` 并行两个镜像
  - `docker/setup-buildx-action` + `docker/login-action`（`GITHUB_TOKEN`）
  - `docker/build-push-action`：`context: .`、`file: apps/${{ matrix.app }}/Dockerfile`、`push: true`、`tags: ghcr.io/logda/tradechain-erp-${{ matrix.app }}:${{ github.ref_name }}`
  - 缓存：`cache-from/cache-to: type=gha,scope=${{ matrix.app }}`
  - **不设 `platform`**：runner 原生 amd64
- `.github/workflows/ci.yml` **完全不动**（push/PR→main 仍跑 `make ci`）

### 4.2 服务器：`scripts/deploy-remote.sh`

- `deploy <version>`：参数语义从「tarball 路径」改为「镜像版本号」。`export TAG=<version>` 后
  `[1]` 备份卷+库 → `[2]` `docker compose pull`（替代 `gunzip -c | docker load`）→ `[3]` `docker compose run --rm api node_modules/.bin/prisma migrate deploy` → `[4]` `docker compose up -d` → `[5]` 健康检查，成功则 `record_tag`
  - 第 `[3]` 步用的是**刚拉下来的新镜像**，迁移脚本与被部署版本严格一致
- **删除 `rollback` 分支**；`on_fail` 的提示改为 `make deploy VERSION=<旧版本>`
- 新增 `stop`（`docker compose stop`）、`start`（按 `CURRENT_TAG` `docker compose up -d` + 健康检查）、`versions`（`docker images` 过滤 `ghcr.io/logda/tradechain-erp-{api,web}` 列本地 tag）
- `init`：不再 `mkdir dist`；提示语改为「上传 4 个 ops 文件 → `make login` → 填 `.env` → 宝塔建库 → `make deploy VERSION=`」
- `backup` / `logs` / `health` 语义不变（都不需要镜像版本）；`migrate` / `seed` / `restart` 增加版本守卫，见下
- `TAG_FILE`（`work/CURRENT_TAG`）机制不变：仅 `deploy` 健康检查通过后写入（`start` 只是读它，不重写），未显式传 VERSION 的动作据此锁定运行版本

### 4.3 `Makefile`

**变量:** `VERSION ?= latest`、`SERVICE ?=`、`HEALTH_RETRIES ?= 10`、`IMAGE_REPO ?= ghcr.io/logda`。删除 `BUILD_PLATFORM`。

**本地 target:**
- `tag`：依次校验后打 tag 并推送
  1. `VERSION` 匹配 `^v[0-9]+\.[0-9]+\.[0-9]+$`
  2. 工作区干净：`git status --porcelain` 输出为空（含未跟踪文件）
  3. 当前分支的 HEAD 已存在于 `origin`（否则 CI checkout 该 tag 会失败）
  4. `git tag -a <VERSION> -m <VERSION>` → `git push origin <VERSION>` → 打印 Actions 运行页链接
- `build-image`：`docker build -f apps/{api,web}/Dockerfile -t $(IMAGE_REPO)/tradechain-erp-{api,web}:local .`，**本地原生架构，仅构建不推送**，用途仅为验证 Dockerfile 改动能否构建通过
- **删除** `release`、`package`

**服务器 target:** `init`、`login`、`deploy`、`stop`、`start`、`restart`、`migrate`、`seed`、`backup`、`logs`、`health`、`versions`。
- `login`：`docker login ghcr.io`（一次性，交互式输入 GitHub 用户名 + `read:packages` PAT）
- `deploy` 保留 `VERSION=latest` 拦截守卫，透传版本号而非 tarball 路径
- `start`、`restart`、`migrate`、`seed` 都消费镜像版本，统一由 `require_tag` 守卫：读 `work/CURRENT_TAG`，缺失/为空/为 `latest` 时报错退出并提示先 `make deploy VERSION=`。脚本顶部**不再回落到 `latest`**（GHCR 不推 `latest`，回落只会在 compose 阶段抛难懂的 `manifest unknown`，掩盖“从未成功部署过”这个真正原因）。`init`、`versions`、`stop`、`logs`、`health`、`backup` 不需要版本，故不守卫 —— 部署失败时仍要能看日志、查状态
- `stop` 不做健康检查（停服本身就是目的）
- **删除** `rollback`

**开发/CI target 不变:** `install`、`dev-api`、`dev-web`、`test`、`build`、`ci`、`clean`、`help`。
`clean` 去掉 `dist/*.tar.gz`、`dist/bundle` 相关清理项。

### 4.4 ops 文件分发

投产所需的 4 个文件集中在仓库的 `ops/` 目录，**该目录本身即服务器上的部署根目录**，文件平铺同级、无子目录：

```
仓库 ops/                     →   服务器 /www/wwwroot/tradechain-erp/
├── Makefile                        ├── Makefile
├── docker-compose.yml              ├── docker-compose.yml
├── .env.example                    ├── .env.example
└── deploy-remote.sh                └── deploy-remote.sh
```

路径解析不依赖调用位置：`deploy-remote.sh` 以自身所在目录为 `PROJECT_DIR`（`cd "$(dirname "$0")"`），`ops/Makefile` 用 `$(lastword $(MAKEFILE_LIST))` 推出脚本绝对路径，故 `cd 部署目录 && make deploy` 与 `make -C 部署目录 deploy` 都正确。

**上传时机：首次一次，之后正常发版不需要重传。** 镜像由 CI 按 tag 推到 GHCR，服务器只跑 `make deploy VERSION=vX.Y.Z`；只有 `ops/` 里的文件**本身**被改动时才需重新上传。`.env` 与 `work/` 不在 `ops/` 内，上传覆盖天然不触碰。

**为什么拆两个 Makefile（取代 Q3 的「单一 Makefile」）：** 原设计让同一份 Makefile 同时服务本地开发机与服务器，代价是服务器上带着一堆永不执行的开发 target，且「哪条命令该在哪台机器跑」只能靠注释区分，容易误用。拆开后每个 Makefile 只有一个受众，`make help` 的输出就是该机器的完整命令面。两者共享的变量只有 `VERSION` 与 `HEALTH_RETRIES`（`IMAGE_REPO` 仅本地 `build-image` 用，服务器侧由 `deploy-remote.sh` 自带默认值），重复面很小。

## 5. 不变量与安全约束

- **仓库路径恒为 `logda/tradechain-erp-{api,web}`**（2026-09-22 修订，原为「镜像名恒为 `ghcr.io/logda/...`」）：`release.yml`（推送）、`docker-compose.yml`、`deploy-remote.sh`（`versions` 过滤）三处同一路径，改动必须同步；registry 前缀仅拉取侧可配（`IMAGE_REGISTRY`），推送侧写死 `ghcr.io`
- **服务器不存任何 registry 密钥**：PAT 只存在于 `~/.docker/config.json`，不进 `.env`、不进仓库、不进脚本
- **`.env`、`work/` 绝不被 ops 文件更新触碰**：保护密钥、`CURRENT_TAG`、备份历史
- **tag 即不可变版本**：CI 不推 `latest`，deploy 拒绝 `latest`，回退依赖 GHCR 上的历史 tag 与本地已加载 tag
- **本地旧镜像 tag 不清理**：断网仍可回退
- **deploy 前必备份，卷备份失败即中止**（沿用现状，保护上传附件与数据库）
- **tag 未过 `make ci` 则不产镜像**：`build` job `needs: gate`

## 6. 影响面

- **删除:** `scripts/build-release.sh`；Makefile 的 `release`/`package`/`rollback` target 与 `BUILD_PLATFORM` 变量；`deploy-remote.sh` 的 `rollback` 分支与 `docker load` 逻辑
- **新增:** `.github/workflows/release.yml`；Makefile 的 `tag`/`login`/`stop`/`start`/`versions` target；`deploy-remote.sh` 的 `stop`/`start`/`versions` 分支；本 spec 与对应 plan
- **修改:** `Makefile`、`scripts/deploy-remote.sh`、`README.md`（部署章节重写）、`docs/superpowers/specs/2026-09-19-manual-media-deploy-design.md` 顶部标注被取代
- **不变:** `.github/workflows/ci.yml`、`docker-compose.yml`、两个 Dockerfile、`.dockerignore`、`.env.example`（GHCR 凭据走 `docker login`，不进 `.env`）、应用代码

## 7. 已知风险

| 风险 | 缓解 |
|---|---|
| 国内服务器拉 `ghcr.io` 慢或偶发失败 | `docker compose pull` 失败即中止部署，服务保持旧版本运行，不会半死。拉取侧 registry 已参数化（`IMAGE_REGISTRY`），但**公共国内镜像站代理不到 private 包**（实测 NJU 404 / DaoCloud 403，见顶部 2026-09-22 修订），所以还没有可用的国内取值；四条候选出路未决策。首次部署时需实测 `docker compose pull` 的真实耗时再定 |
| PAT 过期导致服务器突然拉不动 | `make login` 可随时重跑；`deploy` 在 pull 阶段就失败，不影响正在运行的容器 |
| ops 文件人工上传时漏文件 | `init` 打印清单；`deploy-remote.sh` 路径由 `PROJECT_DIR` 推断，缺文件会立即报错而非静默 |
| 服务器上 compose 版本落后于镜像需求（如新增了环境变量） | 属人工同步纪律问题；`make versions` 与部署日志会暴露 tag，必要时重传 ops 文件 |
