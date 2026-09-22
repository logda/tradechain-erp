# syntax=docker/dockerfile:1

# ---------- base: node + pnpm ----------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# Prisma 引擎需要 libssl 探测；slim 镜像默认不带 openssl，装上消除 prisma:warn
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# ---------- build ----------
FROM base AS build
WORKDIR /app

# 先拷 workspace 清单 + lockfile，命中依赖层缓存
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# 拷源码并构建：shared 必须先于 api（api 的 tsc 需要 shared 的 .d.ts）
# api 的 prebuild 会自动跑 prisma generate
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @erp/shared build && pnpm --filter api build

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
ENV ERP_DATA_DIR=/data
WORKDIR /app
# 保留完整 workspace：node_modules 内含 prisma CLI，一次性迁移容器直接复用此镜像
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
