# OpenStat Production Readiness Plan

## Summary

Bring OpenStat from early-access ready to production-grade by implementing the
accepted items: retention enforcement, OTLP ingestion, compiled backend runtime,
stronger CI, UptimeRobot plus VPS monitoring, worker lag and dead-letter
visibility, production auth UX, and releasable SDKs.

Backups remain an operational Hetzner task, `.env.bak.*` cleanup is a manual
reminder, `apps/docs` is left as an artifact for now, and the hardcoded demo
sidebar cleanup is deferred.

## Key Changes

### Retention

- Add a backend retention sweep that runs from the worker on a configurable
  interval and is also callable as a script.
- Enforce defaults from the existing schema policy: raw/redacted ingestion data
  retained 30 days, derived/projection data retained 365 days.
- Delete old `ingestion_outbox` payload rows and `ingestion_batches` once safe.
- Prune normalized raw signal/event tables according to retention settings
  without breaking current dashboard projections.
- Add environment variables for interval and enable/disable behavior, default
  enabled in production.

### OTLP/HTTP

- Add `POST /v1/traces`, `POST /v1/logs`, and `POST /v1/metrics`.
- Accept `application/x-protobuf` first and JSON protobuf for debugging.
- Authenticate with existing Bearer ingestion API keys and scope everything to
  the API key project.
- Decode OTLP requests into existing `otel_spans`, `otel_logs`, and
  `otel_metrics` tables.
- Return OTLP-style success and partial-success responses.
- Update OpenAPI and docs copy so OTLP is no longer config-only.

### Production Runtime

- Change backend production scripts to run compiled JavaScript:
  `node dist/server.js` and `node dist/worker.js`.
- Keep `tsx` only for dev and seed scripts.
- Update the Dockerfile to build packages/backend during image build and start
  compiled output.
- Update Compose commands to use the compiled production scripts.

### CI/CD

- Add CI/deploy validation for `pnpm build` and
  `pnpm --filter backend test`.
- Add integration test execution against disposable Postgres in GitHub Actions.
- Add Python SDK test execution using `pytest`.
- Keep deploy blocked unless typecheck, lint, build, backend tests, integration
  tests, and Python SDK tests pass.

### Monitoring

- Standardize on UptimeRobot plus VPS checks.
- UptimeRobot monitors:
  - `https://api.openstat.online/health`
  - `https://api.openstat.online/ready`
  - `https://www.openstat.online`
  - SSL expiry for API and web domains
- Add a VPS-side health script/runbook for deeper checks: Docker service status,
  disk usage, worker lag, dead-letter count, and backup reminder.
- Add worker/outbox operational counters to readiness or a small internal health
  command: pending count, oldest pending age, retryable count, and dead-letter
  count.

### Worker Visibility

- Add query helpers for ingestion outbox health.
- Log structured worker lag and dead-letter metrics each worker pass.
- Surface worker health in `/ready` with non-sensitive aggregate values.
- Define production thresholds:
  - pending outbox older than 5 minutes is a warning
  - any dead-lettered row is a warning
  - failed `/ready` is an alert

### Auth And Account UX

- Add production account flows for email verification and password reset.
- Add SMTP/email provider environment config and fail fast in production when
  email-password auth is enabled without required email settings.
- Add rate limiting or abuse protection around sign-in, sign-up, and password
  reset endpoints.
- Preserve Google OAuth support as optional.

### SDKs

- Make TypeScript and Python SDKs release-ready.
- Add JavaScript SDK unit tests for emitted native event payloads, batch
  behavior, API errors, and OTLP config.
- Expand Python SDK tests to match JavaScript coverage.
- Add package metadata, versioning, changelog/release notes, and publish
  instructions.
- Once OTLP backend routes exist, add documented exporter examples for
  JavaScript and Python.

## Explicit Non-Changes

- Do not implement backup automation in repo code; use the Hetzner/VPS backup
  process operationally.
- Add a launch checklist reminder to move or delete VPS
  `deploy/hetzner/.env.bak.*` files, but do not automate server cleanup in this
  code pass.
- Do not remove `apps/docs` yet; leave it as an artifact because GitBook is
  already the hosted docs source and landing-page forwarding is handled.
- Do not remove the dashboard demo identity yet; handle that as the final polish
  item later.

## Test Plan

- Run:
  - `pnpm check-types`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm --filter backend test`
  - `pnpm --filter backend test:integration`
  - Python SDK `pytest`
- Add backend route tests for:
  - OTLP traces/logs/metrics auth failures
  - protobuf content-type validation
  - JSON debug payloads
  - successful inserts into OTLP tables
  - partial-success responses
- Add retention tests for:
  - rows older than the retention cutoff are deleted
  - recent rows are preserved
  - projections needed by the dashboard are not accidentally broken
- Add production runtime smoke tests:
  - Docker image builds
  - API starts from compiled JavaScript
  - worker starts from compiled JavaScript
  - `/health` and `/ready` return 200
- Add monitoring smoke tests:
  - readiness includes worker/outbox health
  - VPS runbook/check script reports clean state on healthy deployment

## Assumptions

- Production launch claim remains early access until this plan is complete.
- OTLP means OTLP/HTTP only; OTLP/gRPC stays out of scope.
- Retention defaults remain 30 days for raw/redacted ingestion data and 365 days
  for derived data.
- UptimeRobot is the external monitor of choice, with VPS scripts/runbooks
  covering deeper operational checks.
- GitBook remains the official docs surface.
