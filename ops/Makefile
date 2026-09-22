.PHONY: init login deploy stop start restart migrate seed backup logs health versions help

# ============================================================
# TradeChain ERP 服务器端部署 Makefile（在生产服务器的固定部署目录内执行）
#
# 本目录（仓库里的 ops/）== 服务器上的部署根目录。4 个文件平铺同级：
#   Makefile  docker-compose.yml  .env.example  deploy-remote.sh
# 首次人工上传这 4 个文件到固定目录（如 /www/wwwroot/tradechain-erp），
# 之后正常发版**不需要再传文件**：镜像由 GitHub Actions 按 git tag 推到 GHCR，
# 服务器只需 make deploy VERSION=vX.Y.Z 拉取。只有这 4 个文件本身改了才需重传。
#
# 服务器不装 git、不 clone 仓库；拉镜像前需一次性 make login。
# 打 tag 发版是本地开发机的动作，见仓库根目录的 Makefile。
#
# 镜像源默认 ghcr.io，可在 .env 里设 IMAGE_REGISTRY 切换（私有包限制见 .env.example）；
# 这里不做插值，compose 与 deploy-remote.sh 各自读 .env，Makefile 只透传环境变量。
# ============================================================

# 版本：deploy 必须显式传 VERSION=vX.Y.Z（= git tag = GHCR 镜像 tag）
VERSION ?= latest
SERVICE ?=
HEALTH_RETRIES ?= 10

# 按本 Makefile 自身位置定位脚本，`make -C <部署目录> <target>` 也能正确工作
OPS_DIR := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
REMOTE  := bash '$(OPS_DIR)/deploy-remote.sh'

init: ## 首次：初始化部署目录（建 .env/work）并打印后续清单
	$(REMOTE) init

login: ## 一次性：登录镜像源获取拉取权限（默认 ghcr.io：GitHub 用户名 + read:packages PAT）
	@# 自建反代时用 IMAGE_REGISTRY=<域名> make login 覆盖；这里不读 .env
	docker login $${IMAGE_REGISTRY:-ghcr.io}

deploy: ## 部署/回退到指定镜像版本: make deploy VERSION=v1.0.0
	@test '$(VERSION)' != 'latest' || { echo '错误: deploy 需显式 VERSION=vX.Y.Z（latest 无法回退）'; exit 1; }
	HEALTH_RETRIES='$(HEALTH_RETRIES)' $(REMOTE) deploy '$(VERSION)'

stop: ## 停止容器（保留容器与 erp-data 卷）
	$(REMOTE) stop

start: ## 按上次部署的版本启动容器（读 work/CURRENT_TAG）
	HEALTH_RETRIES='$(HEALTH_RETRIES)' $(REMOTE) start

restart: ## 改配置后重建容器（不重拉镜像/不迁移）: make restart [SERVICE=api|web]
	HEALTH_RETRIES='$(HEALTH_RETRIES)' $(REMOTE) restart '$(SERVICE)'

migrate: ## 执行数据库迁移（针对服务器当前已部署版本）
	$(REMOTE) migrate

seed: ## 初始化种子数据（首次；针对当前已部署版本）
	$(REMOTE) seed

backup: ## 备份 erp-data 卷 + 数据库
	$(REMOTE) backup

logs: ## 跟踪容器日志: make logs [SERVICE=api|web]
	$(REMOTE) logs '$(SERVICE)'

health: ## 健康检查
	HEALTH_RETRIES='$(HEALTH_RETRIES)' $(REMOTE) health

versions: ## 列出本地已有的镜像版本（可离线部署的候选）
	$(REMOTE) versions

help: ## 显示帮助
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "};{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
