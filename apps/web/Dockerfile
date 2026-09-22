# syntax=docker/dockerfile:1

# ---------- base: node + pnpm ----------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
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

# shared 必须先构建：web 的类型检查要解析 @erp/shared 的 dist/esm/index.d.ts
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @erp/shared build && pnpm --filter web build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# outputFileTracingRoot=仓库根 → standalone 内布局为 apps/web/server.js
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
# standalone 不含 public/，必须显式拷；目录内至少要有 .gitkeep，否则 COPY 会因源不存在而失败
COPY --from=build /app/apps/web/public ./apps/web/public
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "server.js"]
