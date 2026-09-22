# Formal Quote Inquiry Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing formal quote module with inquiry-style fields, source dictionary support, sales-user selection, and customer select-or-manual entry behavior without replacing the current quote flow.

**Architecture:** Keep the current formal quote flow as the main spine, then expand quote payloads, persistence, and UI with additional quote-header fields and product-line fields. Reuse existing counterparty and user-management data sources where possible, and compute the current progress field from quote lifecycle actions instead of exposing manual editing.

**Tech Stack:** Next.js App Router, React, NestJS, Vitest, Prisma/runtime dual storage

---
