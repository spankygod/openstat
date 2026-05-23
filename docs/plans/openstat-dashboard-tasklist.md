# OpenStat Dashboard Atomic Tasklist

## Summary

Build OpenStat's dashboard as a dark, run-investigation control room:
PostHog-style event analytics, Amplitude-style workbench density,
Snowflake-style operational history, and trading-agent-specific timelines.

The dashboard should answer, quickly:

- What happened?
- Which agent did it?
- Why did it trade?
- Did risk approve it?
- What filled?
- What was the outcome?

Reference inputs:

- Mobbin Amplitude analytics screens.
- Mobbin ElevenLabs analytics usage screen.
- Amplitude charts: https://amplitude.com/docs/analytics/charts
- Amplitude dashboards: https://amplitude.com/docs/analytics/dashboard-create
- Snowflake Query History: https://docs.snowflake.com/en/user-guide/ui-history
- PostHog: https://posthog.com/
- Mixpanel product analytics: https://mixpanel.com/platform/product-analytics

## Guardrails

- [ ] Scope work to `apps/web` unless a later task explicitly says otherwise.
- [ ] Do not modify backend behavior, `packages/ui`, generated folders, or cache folders.
- [ ] Use HeroUI v3 primitives before custom UI: `Surface`, `Table`, `Tabs`, `Drawer`, `Button`, `Chip`, `SearchField`, `Select`, `Dropdown`, `Skeleton`, `Toast`.
- [ ] Keep app CSS prefixed with `.dashboard-*`, `.agent-*`, `.run-*`, `.trade-*`, `.alert-*`.
- [ ] Do not add new dependencies for charts; use CSS, HTML, or SVG placeholders until a chart library is approved.
- [ ] Preserve current sidebar collapse, mobile drawer, sign-in modal, and backend error notice.
- [x] Keep the visual direction dark, compact, system-sans, and HeroUI finance-inspired.
- [ ] Do not create app-owned global CSS selectors that collide with HeroUI BEM classes.
- [ ] Do not override HeroUI primitive typography globally.

## Phase 0: Baseline Inventory

- [x] Confirm `/dashboard` currently fetches overview, analytics, agents, runs, trades, notifications, and API keys.
- [ ] Capture current desktop and mobile screenshots for visual regression.
- [x] List current backend read endpoints available to the web app.
- [x] Verify `pnpm --filter web check-types` passes before UI changes.
- [x] Verify `pnpm --filter web lint` passes before UI changes.

## Phase 1: Dashboard Data Contract

- [x] Extend `apps/web/lib/openstat-api.ts` types for analytics `range`, `series`, `breakdowns`, and `topTraces`.
- [x] Add a typed `DashboardRange = "24h" | "7d" | "30d"`.
- [x] Update `getDashboardData(range)` to request `/v1/analytics/summary?range=<range>`.
- [x] Add optional frontend fetches for `/v1/events`, `/v1/ingestion-batches`, and `/v1/trades/breakdowns` only if used by the first dashboard view.
- [x] Keep all server-side backend calls using the existing server-only API key behavior.
- [x] Preserve partial-data behavior when one backend request fails but others succeed.

## Phase 2: Shared Dashboard UI Primitives

- [x] Add app-local dashboard primitives under `apps/web/app/dashboard/`.
- [x] Create a top toolbar component.
- [x] Create a KPI card component.
- [x] Create a panel shell component.
- [x] Create a status chip component.
- [x] Create an empty state component.
- [x] Create a mini trend component.
- [x] Create an attention item component.
- [x] Create a data table wrapper component.
- [x] Use HeroUI components internally where appropriate.
- [x] Keep custom CSS limited to layout, spacing, dark dashboard composition, and product-specific chart scaffolds.

## Phase 3: Dashboard Command Center

- [x] Redesign `/dashboard` around a command-center layout.
- [x] Add a top toolbar with project label, range selector, search field, refresh action, alerts action, and sign-in or user action.
- [x] Add a KPI strip for agents online, events, decisions, orders, fills, risk rejects, failures, and PnL snapshots.
- [x] Add a main events/errors chart panel using `analytics.series`.
- [x] Show a useful empty state when `analytics.series` is empty.
- [x] Add a "Needs attention" queue from backend errors, unread notifications, stale or failing agents, risk rejects, and failures.
- [x] Add a latest runs table.
- [x] Add a latest trades table.
- [x] Add a latest events or traces panel if data is available.
- [x] Ensure all rows have stable click targets for future inspector routing.
- [x] Preserve the existing backend unavailable notice at the top of dashboard content.

## Phase 4: Inspector Drawer

- [x] Add query-param driven inspector state: `?inspect=run|trade|event|agent|notification|trace&id=<id>`.
- [x] Add a server helper to fetch selected detail without exposing backend API keys to the browser.
- [x] Fetch run timeline when `inspect=run`.
- [x] Fetch trade detail when `inspect=trade`.
- [x] Fetch event detail and event resources when `inspect=event`.
- [x] Fetch agent timeline when `inspect=agent`.
- [x] Fetch notification detail when `inspect=notification`.
- [x] Fetch trace detail when `inspect=trace`.
- [x] Render a HeroUI `Drawer` inspector on the right.
- [x] Add inspector tabs: `Summary`, `Timeline`, `Raw`, `Artifacts`.
- [x] Add a close action that returns to `/dashboard` with the current range preserved.
- [ ] Use existing dashboard preferences for inspector width or collapsed behavior when practical.

## Phase 5: Dedicated Dashboard Routes

- [x] Add `/dashboard/agents` with agent table, heartbeat recency, status, and inspector links.
- [x] Add `/dashboard/runs` with filter rail, run table, and inspector links.
- [x] Add `/dashboard/trades` with range-aware table and trade detail links.
- [x] Add `/dashboard/alerts` with notification inbox and inspector links.
- [x] Add `/dashboard/api-keys` with visible key list and status copy.
- [x] Add `/dashboard/settings` for project preferences, range default, inspector preference, redaction/retention copy, and raw-capture placeholders.
- [x] Reuse the existing dashboard shell and sidebar on every dashboard route.

## Phase 6: Responsive Behavior

- [x] Desktop: fixed sidebar, dense toolbar, multi-column command center, right inspector drawer.
- [x] Tablet: keep sidebar visible when space allows, collapse secondary panels below the main chart.
- [x] Mobile: sidebar drawer, stacked panels, horizontally scrollable tables, full-width inspector drawer.
- [ ] Verify no CTA, table cell, nav label, chip, or heading clips across mobile widths.
- [ ] Verify no CTA, table cell, nav label, chip, or heading clips across tablet widths.
- [ ] Verify no CTA, table cell, nav label, chip, or heading clips across desktop widths.

## Phase 7: Empty, Error, And Loading States

- [x] Preserve backend unavailable notice at the top of dashboard content.
- [x] Add empty states for no agents.
- [x] Add empty states for no runs.
- [x] Add empty states for no trades.
- [x] Add empty states for no events.
- [x] Add empty states for no alerts.
- [ ] Add empty states for no API keys.
- [ ] Add skeletons for future client/refetch surfaces.
- [x] Show partial-data states when one endpoint fails but others succeed.
- [x] Keep error copy concise and product-specific.

## Phase 8: Verification

- [x] Run `pnpm --filter web check-types`.
- [x] Run `pnpm --filter web lint`.
- [x] Run `pnpm --filter web build`.
- [ ] Inspect `/dashboard` on desktop.
- [ ] Inspect `/dashboard` on tablet.
- [ ] Inspect `/dashboard` on mobile.
- [x] Inspect each new dashboard route after it is added.
- [ ] Verify sidebar collapse.
- [ ] Verify mobile drawer.
- [ ] Verify sign-in modal.
- [x] Verify range selector.
- [x] Verify inspector drawer.
- [x] Verify backend error notice.
- [x] Confirm no app CSS collides with HeroUI BEM class names.

## Assumptions

- First implementation pass remains frontend-only.
- The dashboard prioritizes run investigation over generic analytics building.
- Current read APIs are enough for the command center and first route pass.
- Rich charting can wait until backend series and breakdowns are populated and a chart dependency is approved.
