# OpenStat Atomic Implementation Tasklist

## Working Assumptions

- Keep the web app on Vercel for now.
- Deploy the backend API, ingestion worker, Postgres, and Redis on Hetzner.
- Start with one Hetzner VPS for MVP, but keep the deployment ready to split the
  database onto a private second VPS later.
- Use Postgres first; defer ClickHouse or another OLAP store until volume proves
  the need.
- Treat each checkbox as a small commit or pull request.
- Use commit messages like `feat(ingestion): add native batch acceptance`.

## Phase 0: Baseline And Repo Recovery

- [ ] Confirm the current backend fails only because the `@openstat/*` workspace
  packages are missing.
- [ ] Create `packages/db` with `package.json`, `tsconfig.json`, ESLint config,
  and `src/index.ts`.
- [ ] Create `packages/schemas` with `package.json`, `tsconfig.json`, ESLint
  config, and `src/index.ts`.
- [ ] Create `packages/auth` with `package.json`, `tsconfig.json`, ESLint config,
  and `src/index.ts`.
- [ ] Create `packages/ingestion` with `package.json`, `tsconfig.json`, ESLint
  config, and `src/index.ts`.
- [ ] Set package names to `@openstat/db`, `@openstat/schemas`,
  `@openstat/auth`, and `@openstat/ingestion`.
- [ ] Add package build/typecheck scripts that match the existing monorepo
  patterns.
- [ ] Run `pnpm install` and verify the workspace links resolve.
- [ ] Run `pnpm check-types` and capture the remaining compile errors as the
  implementation backlog.

## Phase 1: Database Foundation

- [ ] Add a Drizzle/Postgres connection factory exported as `createDatabase`.
- [ ] Add schema exports under `@openstat/db/schema`.
- [ ] Define auth/user tables needed by Better Auth and current backend routes.
- [ ] Define `organizations`, `projects`, and `memberships`.
- [ ] Define `api_keys` with prefix, secret hash, revoked/expiry timestamps, and
  project scope.
- [ ] Define `agents` with external id, status, mode, tags, metadata, and
  heartbeat timestamps.
- [ ] Define `ingestion_batches` with source, status, counts, request id, error
  fields, metadata, and timestamps.
- [ ] Define `ingestion_outbox` with payload, status, worker lock, attempts,
  processed/dead-letter timestamps, and batch linkage.
- [ ] Define normalized `events` with agent id, event type, source, timestamp,
  trace id, span id, run id, data, metadata, and tags.
- [ ] Define normalized `otel_spans`, `otel_logs`, and `otel_metrics` tables.
- [ ] Define `event_property_catalog` for discovered event/data/metadata fields.
- [ ] Define `llm_usage` for provider, model, tokens, latency, and status.
- [ ] Define `heartbeats` for heartbeat-specific projection data.
- [ ] Define trading tables: `agent_runs`, `trading_decisions`, `risk_checks`,
  `orders`, `fills`, `positions`, and `pnl_snapshots`.
- [ ] Define `notifications`, `dashboard_preferences`, and `artifacts`.
- [ ] Add project-scoped indexes for event lists, trace lookup, agent timelines,
  ingestion batches, and trade timelines.
- [ ] Add Drizzle migrations for all new tables.
- [ ] Add a local migration command for development and deployment.
- [ ] Add a seed script that creates one user, organization, project, API key,
  sample agents, sample decisions, sample orders, sample fills, and sample PnL.

## Phase 2: Auth And Scope

- [ ] Implement `generateApiKey` with an `ostat_` plaintext format, stored prefix,
  and stored secret hash.
- [ ] Implement `authenticateApiKey` from a Bearer authorization header.
- [ ] Return stable auth error codes for missing, invalid, revoked, expired, and
  missing-default-project API keys.
- [ ] Implement `createOpenStatAuth` as the Better Auth wrapper used by the
  backend.
- [ ] Add unit tests for API key generation and authentication.
- [ ] Add unit tests for revoked and expired API keys.
- [ ] Add route tests that prove API keys are scoped to one organization/project.

## Phase 3: Schemas And Domain Contracts

- [ ] Implement native ingestion Zod schemas for one event, batch events, and
  heartbeat.
- [ ] Implement agent input schema with stable external id, name, and tags.
- [ ] Implement normalized event types for `decision`, `risk_check`, `order`,
  `fill`, `heartbeat`, `error`, and `completion`.
- [ ] Implement broker-agnostic trading schemas for strategy, symbol, venue,
  side, quantity, price, order type, fill status, risk result, realized PnL, and
  unrealized PnL.
- [ ] Implement normalized OTLP signal types for spans, logs, and metrics.
- [ ] Implement redaction policy schemas with default redaction enabled.
- [ ] Export all schemas from `@openstat/schemas`.
- [ ] Add schema tests for valid native events, invalid batches, and trading
  payload edge cases.

## Phase 4: Native Ingestion Core

- [ ] Implement `acceptIngestionBatch` to create an `ingestion_batches` row.
- [ ] Implement `acceptIngestionBatch` to create one `ingestion_outbox` row per
  accepted event.
- [ ] Implement idempotency for sender-provided event ids within a project.
- [ ] Reject project overrides that do not match the authenticated API key scope.
- [ ] Publish an ingestion signal when outbox rows are created and Redis is
  configured.
- [ ] Return accepted count, batch id, project id, and outbox ids.
- [ ] Implement empty batch and invalid payload errors.
- [ ] Add unit tests for native batch acceptance.
- [ ] Add integration tests for batch rows and outbox rows.

## Phase 5: Worker And Projection Pipeline

- [ ] Implement `claimIngestionOutbox` with worker id, lock TTL, attempt count,
  and batch limit.
- [ ] Implement `processClaim` with processed, retryable, and dead-lettered
  counts.
- [ ] Implement native event normalization from outbox payload to `events`.
- [ ] Upsert agents from event agent input.
- [ ] Project heartbeat events into agent status and `heartbeats`.
- [ ] Project completion/error events into `llm_usage` when model/token data is
  available.
- [ ] Project decision events into `agent_runs` and `trading_decisions`.
- [ ] Project risk-check events into `risk_checks`.
- [ ] Project order events into `orders`.
- [ ] Project fill events into `fills`.
- [ ] Project position/PnL events into `positions` and `pnl_snapshots`.
- [ ] Update `event_property_catalog` from normalized data and metadata.
- [ ] Mark batches as processed, partially processed, or failed.
- [ ] Create deduped notifications for repeated failures.
- [ ] Create stale/offline notifications from heartbeat sweeps.
- [ ] Mark stale/offline notifications read when an agent recovers.
- [ ] Add worker integration tests for event projection.
- [ ] Add worker integration tests for retry and dead-letter behavior.

## Phase 6: Redaction And Retention

- [ ] Implement default recursive redaction for prompts, tool args/results,
  account identifiers, secrets, and raw order payloads.
- [ ] Preserve safe summaries, hashes, model/provider metadata, token counts,
  status, and trading projections.
- [ ] Add project settings for raw capture opt-in.
- [ ] Enforce raw capture retention separately from derived projections.
- [ ] Add a retention job for raw/redacted telemetry older than 30 days.
- [ ] Add a retention job for derived aggregates older than 1 year.
- [ ] Add tests that prove sensitive fields are redacted by default.
- [ ] Add tests that prove raw capture only works when explicitly enabled.

## Phase 7: OTLP/HTTP Ingestion

- [ ] Add backend raw-body handling for OTLP routes without affecting JSON routes.
- [ ] Add OTLP content-type validation for `application/x-protobuf` and
  `application/json`.
- [ ] Vendor the required OpenTelemetry proto definitions into the ingestion
  package or generate local decoder types from them.
- [ ] Decode `ExportTraceServiceRequest` payloads into normalized spans.
- [ ] Decode `ExportLogsServiceRequest` payloads into normalized logs.
- [ ] Decode `ExportMetricsServiceRequest` payloads into normalized metrics.
- [ ] Decode JSON protobuf OTLP payloads for local debugging.
- [ ] Map OTel resource attributes into service, deployment, environment, agent,
  and project metadata.
- [ ] Map OTel GenAI attributes into `llm_usage`.
- [ ] Map OpenStat trading attributes from spans/logs/metrics into trading
  projections.
- [ ] Store original OTLP batches in `ingestion_batches` metadata or raw payload
  storage according to redaction policy.
- [ ] Implement OTLP full-success responses.
- [ ] Implement OTLP partial-success responses with rejected item counts.
- [ ] Implement OTLP non-retryable validation errors for malformed payloads.
- [ ] Add route tests for `/v1/traces`.
- [ ] Add route tests for `/v1/logs`.
- [ ] Add route tests for `/v1/metrics`.
- [ ] Add fixture-based tests for protobuf and JSON protobuf payloads.

## Phase 8: Backend Read APIs

- [ ] Restore existing overview, agent, event, ingestion batch, notification, and
  analytics read queries in `@openstat/ingestion`.
- [ ] Add event filters for agent, event type, model, text query, range, source,
  status, and trace.
- [ ] Add `getTraceDetail` with spans, events, logs, tool calls, errors, and
  artifacts.
- [ ] Add `listAgentRuns` with project-scoped pagination.
- [ ] Add `getAgentRunTimeline`.
- [ ] Add `listTrades` with strategy, symbol, status, range, and PnL filters.
- [ ] Add `getTradeDetail`.
- [ ] Add strategy and symbol breakdown queries.
- [ ] Add analytics summary totals for decisions, orders, fills, PnL, failures,
  and risk rejects.
- [ ] Add route tests for run timelines.
- [ ] Add route tests for trade lists and trade details.

## Phase 9: TypeScript SDK

- [ ] Create `packages/sdk-js` named `@openstat/sdk`.
- [ ] Add SDK config for API key, endpoint, service name, environment, and
  default redaction.
- [ ] Add OpenTelemetry setup for OTLP/HTTP traces, logs, and metrics.
- [ ] Add helper to start an agent run.
- [ ] Add helper to record a decision.
- [ ] Add helper to record a risk check.
- [ ] Add helper to record an order.
- [ ] Add helper to record a fill.
- [ ] Add helper to record a PnL snapshot.
- [ ] Add helper to send a heartbeat.
- [ ] Add helper to record model usage and tool calls.
- [ ] Add SDK unit tests for emitted attributes.
- [ ] Add a Node trading-agent example.
- [ ] Add README usage docs for the TypeScript SDK.

## Phase 10: Python SDK

- [ ] Create `sdks/python` with `pyproject.toml` and package name `openstat`.
- [ ] Add SDK config for API key, endpoint, service name, environment, and
  default redaction.
- [ ] Add OpenTelemetry setup for OTLP/HTTP traces, logs, and metrics.
- [ ] Add helper to start an agent run.
- [ ] Add helper to record a decision.
- [ ] Add helper to record a risk check.
- [ ] Add helper to record an order.
- [ ] Add helper to record a fill.
- [ ] Add helper to record a PnL snapshot.
- [ ] Add helper to send a heartbeat.
- [ ] Add helper to record model usage and tool calls.
- [ ] Add pytest tests for emitted attributes.
- [ ] Add a Python trading-agent example.
- [ ] Add README usage docs for the Python SDK.

## Phase 11: Dashboard On Vercel

- [ ] Add `NEXT_PUBLIC_OPENSTAT_API_URL` to the web app config.
- [ ] Add server/client API helpers for calling the backend.
- [ ] Build login/session wiring against the backend auth routes.
- [ ] Build workspace bootstrap UI.
- [ ] Build API key list/create/revoke/rotate UI.
- [ ] Build agent overview cards.
- [ ] Build decision-to-trade run timeline page.
- [ ] Build trade list page with symbol, strategy, status, and range filters.
- [ ] Build trade detail page with decision, risk check, order, fill, and PnL.
- [ ] Build event/trace detail drawer.
- [ ] Build notification center for stale/offline/failing/risk events.
- [ ] Add empty states for no agents, no API keys, no runs, and no trades.
- [ ] Add error states for API failures and auth failures.
- [ ] Add smoke tests or Playwright checks for the main dashboard flow.

## Phase 12: Hetzner Deployment

- [ ] Add a backend Dockerfile.
- [ ] Add a worker Dockerfile or shared backend image command.
- [ ] Add `deploy/hetzner/docker-compose.yml` for API, worker, Postgres, Redis,
  and Caddy.
- [ ] Add `deploy/hetzner/.env.example`.
- [ ] Configure Caddy for the API domain and automatic HTTPS.
- [ ] Configure backend CORS for the Vercel web domain.
- [ ] Mount Postgres data to a named Docker volume or dedicated host path.
- [ ] Keep Postgres and Redis private to the Docker network on single-VPS setup.
- [ ] Document the future two-VPS split with Postgres bound to Hetzner private
  network only.
- [ ] Add a firewall checklist: allow SSH, HTTP, HTTPS; deny public Postgres and
  Redis.
- [ ] Add a deployment runbook for first boot, migrations, seed data, and health
  checks.
- [ ] Add a rollback runbook for failed deploys.

## Phase 13: Backups And Operations

- [ ] Add nightly `pg_dump` backup script for simple early recovery.
- [ ] Add encrypted offsite backup target configuration.
- [ ] Add WAL/PITR backup plan with pgBackRest or WAL-G.
- [ ] Add restore drill documentation.
- [ ] Add a monthly restore-drill task to the operations checklist.
- [ ] Add health checks for API, worker, Postgres, Redis, and disk space.
- [ ] Add worker lag metrics.
- [ ] Add ingestion error rate metrics.
- [ ] Add alerts for failed backups, high disk usage, worker dead letters, and
  API 5xx spikes.
- [ ] Add log rotation for backend and worker containers.

## Phase 14: End-To-End Acceptance

- [ ] Start the local stack from a clean checkout.
- [ ] Run migrations successfully.
- [ ] Create a workspace and API key from the dashboard.
- [ ] Send a native heartbeat event.
- [ ] Send native decision, risk check, order, fill, and PnL events.
- [ ] Send OTLP traces from the TypeScript SDK.
- [ ] Send OTLP traces from the Python SDK.
- [ ] Send OTLP logs and metrics from at least one SDK.
- [ ] Verify worker processes all outbox rows.
- [ ] Verify agent status, run timeline, trade detail, and PnL projections appear
  in the dashboard.
- [ ] Verify sensitive payload fields are redacted by default.
- [ ] Verify backup job completes.
- [ ] Verify a documented restore drill works on a fresh database.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm check-types`.
- [ ] Run backend unit tests.
- [ ] Run backend integration tests against a disposable Postgres database.
- [ ] Run SDK tests.
- [ ] Run dashboard smoke tests.

## First Milestone Definition Of Done

The first useful milestone is complete when:

- Native ingestion accepts decision-to-trade events.
- The worker projects agents, runs, orders, fills, and PnL.
- The dashboard shows one complete decision-to-trade timeline.
- Postgres, Redis, backend, and worker run on Hetzner.
- The web app remains deployed on Vercel and points to the Hetzner API.
- Backups run automatically and one restore drill has been completed.
