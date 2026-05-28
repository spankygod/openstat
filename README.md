# OpenStat

OpenStat is a telemetry and monitoring stack for autonomous agents, with an
early focus on AI trading agents.

It gives agent builders a way to collect decision, risk, order, fill, heartbeat,
LLM usage, and PnL telemetry; process it through a backend worker; and inspect
agent behavior in a dashboard.

## Status

OpenStat is in early MVP development.

The current codebase includes:

- A Fastify backend API with auth, API keys, native JSON ingestion, read APIs,
  OTLP/HTTP ingestion, and OpenAPI schemas.
- A worker path for normalizing, redacting, and projecting ingested events.
- Configurable retention sweeps for raw and derived telemetry.
- Postgres schema and Drizzle migrations.
- A Next.js dashboard with overview, agents, runs, trades, alerts, settings, and
  API key pages.
- TypeScript and Python SDK helpers for sending native OpenStat telemetry and
  configuring OTLP/HTTP exporters.
- Hetzner Docker Compose deployment notes, backup scripts, and operations
  runbooks.

Still planned:

- Production-grade SDK instrumentation packages beyond the early-access helper
  clients.
- More complete dashboard management flows.
- End-to-end validation on a fresh production-like deployment.

## Repository Layout

```text
apps/
  backend/        Fastify API server and ingestion worker
  web/            Next.js dashboard app
  docs/           Next.js docs app
packages/
  auth/           API key and auth helpers
  db/             Drizzle schema, migrations, and database utilities
  ingestion/      Ingestion, redaction, projection, and read-query logic
  schemas/        Shared Zod contracts
  sdk-js/         TypeScript OpenStat SDK
  ui/             Shared React UI components
  eslint-config/  Shared ESLint configuration
  typescript-config/
sdks/
  python/         Python OpenStat SDK
deploy/
  hetzner/        Single-VPS deployment template and runbooks
docs/
  plans/          System design and implementation notes
```

## Prerequisites

- Node.js 18 or newer
- PNPM 9
- Postgres, if running the backend locally
- Redis, optional but recommended for local worker signaling

The repo uses PNPM workspaces and Turborepo.

## Local Development

Install dependencies:

```sh
pnpm install
```

Create a backend env file:

```sh
cp apps/backend/.env.example apps/backend/.env
```

On Windows PowerShell:

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
```

The default backend values expect:

```text
Postgres: postgres://openstat:openstat@localhost:5432/openstat
Redis:    redis://localhost:6379
API:      http://localhost:4000
Web:      http://localhost:3000
Docs:     http://localhost:3001
```

Run the whole monorepo:

```sh
pnpm dev
```

Or run apps individually:

```sh
pnpm --filter backend dev
pnpm --filter backend worker
pnpm --filter web dev
pnpm --filter docs dev
```

Run database migrations:

```sh
pnpm --filter @openstat/db db:migrate
```

Seed local demo data:

```sh
pnpm --filter backend seed:dev
```

For dashboard pages that should read with an API key instead of a browser
session, set `OPENSTAT_DASHBOARD_API_KEY`. The web app uses
`NEXT_PUBLIC_OPENSTAT_API_URL` and defaults to `http://localhost:4000`.

## Useful Commands

```sh
pnpm build
pnpm lint
pnpm check-types
pnpm format
pnpm --filter backend test
pnpm --filter backend test:integration
```

Integration tests require `OPENSTAT_INTEGRATION_DATABASE_URL` to point at a
disposable Postgres database.

## Ingestion

Native ingestion endpoints:

```text
POST /v1/ingest/events
POST /v1/ingest/batch
POST /v1/ingest/heartbeat
```

OTLP/HTTP ingestion endpoints:

```text
POST /v1/traces
POST /v1/logs
POST /v1/metrics
```

Requests are authenticated with:

```text
Authorization: Bearer ostat_...
```

The TypeScript SDK lives in `packages/sdk-js`, and the Python SDK lives in
`sdks/python`.

## Deployment

The `deploy/hetzner` directory contains a single-VPS Docker Compose template for:

- API
- worker
- Postgres
- Redis
- Caddy

Start with:

```sh
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env up -d --build
```

Copy `deploy/hetzner/.env.example` to `deploy/hetzner/.env` and replace every
secret before deploying.

For early-access launch, complete
`deploy/hetzner/LAUNCH_CHECKLIST.md` and run:

```sh
deploy/hetzner/scripts/check-openstat.sh
```

## Security And Privacy

OpenStat is designed to redact sensitive telemetry by default. The ingestion
pipeline treats prompts, tool arguments/results, account identifiers, secrets,
and raw order payloads as sensitive fields.

Do not commit real `.env` files, production credentials, private keys, customer
data, or production backup details.

## Contributing

Contributions are welcome while the project takes shape. Please keep changes
small and scoped, follow the existing package boundaries, and include tests when
changing backend behavior, auth, ingestion, validation, or response shapes.

Before opening a pull request, run the relevant checks:

```sh
pnpm lint
pnpm check-types
pnpm --filter backend test
```

## License

OpenStat is licensed under the MIT License. See `LICENSE` for details.
