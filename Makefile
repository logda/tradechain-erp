.PHONY: install dev-api dev-web test build ci clean \
        tag build-image help

# ============================================================
# 本地开发机 Makefile：开发、门禁、打 tag 发版。
# 服务器端部署与运维命令在 ops/Makefile（上传 ops/ 里的 4 个文件到服务器后在那边执行）。
# ============================================================

# 版本：make tag 必须显式传 VERSION=vX.Y.Z（= git tag = GHCR 镜像 tag）
VERSION ?= latest
# 镜像名前缀：必须与 ops/docker-compose.yml 和 .github/workflows/release.yml 的字面量一致
IMAGE_REPO ?= ghcr.io/logda

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

ci: ## CI 门禁入口：安装 + 构建 + 测试（顺序执行，避免 make -j 并发乱序）
	$(MAKE) install && $(MAKE) build && $(MAKE) test

clean: ## 清理构建产物
	rm -rf apps/api/dist apps/web/.next packages/shared/dist

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

## ===== 服务器部署与运维 =====
## 不在本 Makefile 内。把 ops/ 目录里的 4 个文件（Makefile、docker-compose.yml、
## .env.example、deploy-remote.sh）上传到服务器固定部署目录，平铺同级，然后在那边
## `make help` 查看全部运维命令。首次上传一次即可 —— 正常发版不需要重传文件，
## 服务器只需 `make deploy VERSION=vX.Y.Z` 从 GHCR 拉取镜像。

help: ## 显示帮助
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "};{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
