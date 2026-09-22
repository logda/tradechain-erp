# ERP UI Consistency And Responsive Design

**Date:** 2026-09-22

## 1. Goal

Unify the visual language of the formal ERP route tree under `/app/**` and make its desktop layouts behave predictably in current Chrome, Edge, and Safari across common desktop viewport sizes and browser zoom levels.

This work changes presentation only. It must not change business workflows, API contracts, permissions, data models, storage behavior, or deployment configuration.

## 2. Confirmed Constraints

- Modify only `/Users/zhongzheng/Desktop/erp`.
- Keep all existing uncommitted changes and avoid overwriting unrelated work.
- Use local Git only; do not access Gitee or another remote.
- Keep local `runtime` and online `prisma` behavior unchanged.
- Do not add a large UI framework.
- Do not publish, deploy, commit, push, or pull.
- Prioritize formal pages under `/app/**`; legacy preview pages remain unchanged unless a shared root fix is required.
- Preserve the current brand palette and business interactions.

## 3. Current-State Audit

### 3.1 Fragmented Styling

- The formal frontend contains about 125 source files and 44 `AppShell` consumers.
- There are 2,958 inline `style` usages and 824 local style-object declarations under `apps/web/app/app`.
- There are no CSS files in `apps/web` today.
- Shared components exist but cover only part of the UI: `FilterPanel` is used by 9 files, `FormalDataTable` by 14, `FormalPagination` by 15, and the shared action-button style by 4.

This produces locally consistent pages but no system-wide control dimensions or responsive rules.

### 3.2 Concrete Inconsistencies

- Six formal list pages render `查询` with an unstyled native `<button>`.
- At a 1280px viewport, the quote-list query button renders at about 25px high while the sales-order query button renders at about 46px high.
- In the quote filter panel, visible single-line controls render at approximately 38px, 39px, and 48px. The sales-order filter controls render at 46px.
- Primary links, pagination pills, row actions, workflow actions, and mode selectors use unrelated radii, heights, shadows, and widths.
- Page cards mostly use 20–24px radii, while the desired enterprise density calls for 12–16px cards and 8px controls.

### 3.3 Responsive Problems

- `AppShell` has a fixed 272px sidebar and no media-query behavior.
- The main heading renders around 38.4px at 1280px and 44px at 2560px.
- At 2560px, the main content and cards stretch to about 2200px and one filter form expands to nine columns, reducing readability.
- At 1280px, the quote filter panel already has small internal horizontal overflow.
- Multiple tables set local minimum widths from 760px to 1180px, but `FormalDataTable` does not provide one shared horizontal scroll area.
- Narrow layouts and 200% text scaling have no shell-level fallback.

### 3.4 Browser Baseline Problems

- The root document uses `lang="en"` despite being a Chinese-first application.
- There is no global box-sizing or body-margin reset, leaving the browser-default 8px body margin.
- Native buttons and controls inherit browser defaults, which differ between Chromium and Safari.
- `backdrop-filter` is used without a normal-background fallback being treated as the primary readable surface.

## 4. Considered Approaches

### 4.1 Global Selector Overrides Only

Add broad CSS rules that force all buttons, inputs, cards, and tables into fixed dimensions.

This is fast but brittle. Inline styles win over normal CSS, broad `!important` overrides can break special controls, and semantic variants remain unclear. This approach is rejected as the primary strategy.

### 4.2 Lightweight Formal UI Layer — Selected

Introduce one small formal UI stylesheet with tokens and semantic classes, update shared formal components first, and then migrate high-value page controls in small groups.

This preserves the existing React and Next.js structure, supports media/container queries, avoids a new dependency, and lets every changed line map directly to consistency or responsive behavior.

### 4.3 Adopt A Third-Party UI Library

Replace existing controls with a component library and redesign pages around it.

This would create excessive churn, dependency weight, and business-regression risk. It conflicts with the minimal-change requirement and is rejected.

## 5. Design Direction

The target is a modern enterprise ERP rather than a visual showcase:

- calm neutral surfaces with the current dark navy primary color;
- high but readable information density;
- 8px control radii and 12–16px card radii;
- subtle borders and shadows;
- restrained gradients only where they already support hierarchy;
- one system-font stack with Chinese-first fallbacks;
- clear status, focus, disabled, loading, and destructive states;
- no heavy glass effects, neon color, large decorative typography, or complex animation.

## 6. Formal UI Foundation

### 6.1 Global Formal Styles

Add a small stylesheet imported by the root layout. It will provide:

- browser reset: body margin, box sizing, inherited font controls, image sizing;
- `lang="zh-CN"` on the root document;
- color, spacing, radius, shadow, typography, control-height, and focus-ring variables;
- shared semantic classes scoped to the formal ERP shell so legacy preview pages do not receive unintended visual changes;
- reduced-motion behavior;
- Safari-safe fallbacks for optional visual effects.

The stylesheet must not contain business-specific selectors or permission logic.

### 6.2 Shared Control Classes

Define a small vocabulary rather than a full component framework:

- buttons: primary, secondary, danger, ghost, and link;
- sizes: compact 32px and default 40px;
- single-line controls: 40px default height;
- form grid and form field;
- card/section;
- toolbar and action group;
- filter chips and status badges;
- table scroll container and compact row actions.

Widths remain content-driven unless a form grid explicitly stretches a control. Common height, padding, type scale, and state behavior are shared.

### 6.3 Shared Component Migration

Update these boundaries first:

- `AppShell`
- `FilterPanel`
- `FormalDataTable`
- `FormalPagination`
- `StatStrip`
- `WorktileCard`
- shared formal action-button styles

After that, update formal list filters and high-use create/detail actions. Existing component props and behavior remain stable wherever possible.

## 7. Responsive Layout

### 7.1 Supported Range

Desktop-first support targets:

- 1280×720
- 1366×768
- 1440×900
- 1920×1080
- 2560×1440
- browser zoom at 80%, 100%, and 125%
- readable and operable layout at 200% text/page scaling

This work does not create a separate phone UI. At narrow effective widths it prioritizes access to content and actions over preserving the desktop composition.

### 7.2 Shell Behavior

- Use CSS layout classes instead of a fixed inline-only shell grid.
- Keep the sidebar at an enterprise-appropriate width on normal desktops and reduce it on smaller desktop widths.
- At narrow effective widths, move navigation above content in a compact wrapping grid rather than hiding navigation behind new JavaScript behavior.
- Limit the readable content width on very large displays while allowing data tables to use their own scrollable width.
- Reduce page titles to a 24–32px `clamp()` range.
- Let topbar metadata and actions wrap without overlap.

### 7.3 Forms And Filters

- Use `repeat(auto-fit, minmax(...))` for broad page grids.
- Use container queries where a reusable component must respond to its own width.
- Keep single-line controls at 40px and align filter actions with the final form row.
- Collapse multi-column forms progressively; use one column at narrow effective widths.
- Long labels may wrap, but must not change the control height below them.

### 7.4 Tables And Dialogs

- `FormalDataTable` owns a horizontal scroll area for wide tables.
- Wide-table minimum widths stay local when they express real business columns, but they must no longer expand the document itself.
- Do not hide business-critical columns merely to fit a viewport.
- Dialogs and image previews use bounded viewport-relative widths and heights.
- Images keep aspect ratio and use `object-fit` where necessary.

## 8. Accessibility And Interaction

- Preserve semantic buttons, links, labels, headings, and table structure.
- Provide visible `:focus-visible` treatment for all interactive controls.
- Keep pointer targets at least 24×24 CSS pixels; common actions use 32px or 40px heights.
- Do not use color as the only status signal.
- Keep disabled controls readable and recognizably inactive.
- Preserve all current permission-driven visibility and server-side validation.
- Respect `prefers-reduced-motion`.

## 9. Migration Order

1. Add the scoped formal UI foundation and root browser reset.
2. Migrate `AppShell` and shared formal components.
3. Normalize the six raw query buttons and all formal list filter controls.
4. Normalize shared table, pagination, toolbar, and row-action patterns.
5. Migrate create/edit forms and workflow action areas in small route groups.
6. Address modal, picker, image preview, and remaining special controls.
7. Validate representative and high-risk pages at every required viewport.

Each step must keep existing tests green before continuing. Unrelated inline styles are not removed merely for cleanup.

## 10. Testing Strategy

### 10.1 Component And Source-Level Tests

Add or update tests that verify:

- the formal root and shell use the shared UI scope;
- search controls use the same size and variant classes;
- shared forms and tables expose their responsive wrappers;
- critical business actions and permission conditions are unchanged;
- the root document language is Chinese;
- the shared stylesheet includes the required breakpoints, focus state, reduced-motion rule, and table overflow behavior.

JSDOM does not calculate full CSS layout, so it must not be treated as proof of responsive rendering.

### 10.2 Browser Validation

Use browser rendering to check representative routes from every formal module at 1280, 1366, 1440, 1920, and 2560 widths. Check 80%, 100%, and 125% zoom where the browser surface permits it, plus 200% scaling behavior.

Validate:

- no document-level horizontal overflow;
- no clipped or overlapping primary actions;
- consistent search and reset control dimensions;
- form-column collapse;
- table-local horizontal scrolling;
- legible titles and metadata;
- stable image proportions and modal bounds.

Chrome, Edge, and Safari must be checked when available. If a browser cannot be automated in the local environment, report that fact explicitly and perform the strongest available static/fallback review instead of claiming it was tested.

### 10.3 Regression Commands

Run:

```bash
pnpm test
pnpm build
git diff --check
git status --short
```

Do not run `pnpm build` while the Next.js development server is using the same `.next` directory. Stop the Web dev server before building, and restart it afterward if local preview must remain available.

## 11. Non-Goals

- No workflow, status, permission, API, database, runtime, or Prisma changes.
- No mobile-specific product redesign.
- No dark mode.
- No new icon system, animation framework, or third-party UI library.
- No legacy demo-route redesign.
- No deployment or repository integration work.

## 12. Success Criteria

- Equivalent actions have the same height, spacing, radius, typography, and state treatment.
- Search and reset controls no longer depend on browser-native button styling.
- The formal shell and key pages remain usable without document-level overflow at all target widths.
- Large displays do not stretch reading-oriented content without bound.
- Tables scroll inside their own containers when necessary.
- Chrome, Edge, and Safari differences are minimized with standard CSS and explicit fallbacks.
- Existing business behavior, permissions, tests, and data remain unchanged.
