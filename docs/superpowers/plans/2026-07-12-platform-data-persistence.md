# Platform Data Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ERP platform foundation ready for real database persistence while keeping the current runtime demo flow stable.

**Architecture:** First formalize the persistence boundary and Prisma schema for users, counterparties, products, audit logs, and attachment metadata. Keep runtime JSON stores as the default and add an explicit storage-mode selector so later Prisma-backed repositories can be introduced without breaking existing pages or tests.

**Tech Stack:** NestJS, TypeScript, Jest, Prisma schema, existing runtime JSON stores.

---

### Task 1: Storage Mode Boundary

**Files:**
- Create: `apps/api/src/storage/storage-mode.ts`
- Test: `apps/api/test/storage-mode.spec.ts`

- [ ] Add tests for default `runtime`, accepted `prisma`, and invalid mode fallback.
- [ ] Implement `resolveStorageMode()` returning `'runtime' | 'prisma'`.
- [ ] Run `CI=true pnpm --filter api test -- storage-mode.spec.ts`.

### Task 2: Platform Schema Readiness

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/test/prisma-schema.spec.ts`

- [ ] Add schema assertions for `passwordHash`, `fullAccess`, inactive lifecycle fields, normalized master-data fields, `AttachmentMeta`, and `OperationLog` JSON audit fields.
- [ ] Update Prisma schema with those fields while preserving existing business models.
- [ ] Run `CI=true pnpm --filter api test -- prisma-schema.spec.ts`.

### Task 3: Regression Verification

**Files:**
- Existing API and web tests.

- [ ] Run `CI=true pnpm -r test`.
- [ ] Confirm runtime mode remains the default and current demo chain is unaffected.
