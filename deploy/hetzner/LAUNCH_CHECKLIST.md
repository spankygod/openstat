# OpenStat Early Access Launch Checklist

Use this before calling the deployment production-grade early access.

## Required Before Launch

- Set production backend secrets in `deploy/hetzner/.env`:
  - `NODE_ENV=production`
  - `BETTER_AUTH_SECRET`
  - `DATABASE_URL`
  - `POSTGRES_PASSWORD`
  - `API_PUBLIC_URL`
  - `APP_WEB_URL`
  - `BETTER_AUTH_URL`
  - `AUTH_EMAIL_PROVIDER=resend`
  - `AUTH_EMAIL_FROM`
  - `RESEND_API_KEY`
- Set the web deployment `NEXT_PUBLIC_OPENSTAT_API_URL` to the public API
  origin, never `localhost`.
- Run migrations on the deployed database.
- Start the API and worker from compiled output through Docker Compose.
- Confirm `curl https://api.openstat.online/health` returns 200.
- Confirm `curl https://api.openstat.online/ready` returns 200 and includes
  outbox health.
- Run the VPS health check:

```sh
deploy/hetzner/scripts/check-openstat.sh
```

- Create UptimeRobot monitors:
  - API health: `https://api.openstat.online/health`
  - API readiness: `https://api.openstat.online/ready`
  - Web app: `https://www.openstat.online`
  - SSL expiry monitors for the API and web domains
- Confirm nightly Hetzner/Postgres backups exist and that the latest backup is
  less than 26 hours old.
- Remove or move old VPS `deploy/hetzner/.env.bak.*` files outside the repo
  checkout.
- Send a real account verification email and a password reset email through the
  production provider.
- Ingest one native SDK event and one OTLP trace request with a production API
  key.
- Confirm the dashboard shows the new event/run after the worker processes it.

## Known Early Access Acceptances

- Backups are handled operationally through Hetzner/VPS backup tooling and the
  existing Postgres backup scripts, not by app code.
- GitBook remains the public documentation surface for launch.
- `apps/docs` remains in the monorepo for now.
- Final demo-identity/dashboard polish is intentionally left for the last
  pre-launch pass.
