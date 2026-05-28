# OpenStat Operations

## Nightly Backups

Run the backup script from the repository root on the VPS:

```sh
BACKUP_DIR=/backups/openstat deploy/hetzner/scripts/backup-postgres.sh
```

Install as a nightly cron entry:

```cron
15 2 * * * cd /opt/openstat && BACKUP_DIR=/backups/openstat deploy/hetzner/scripts/backup-postgres.sh >> /var/log/openstat-backup.log 2>&1
```

For offsite backups, sync `/backups/openstat` to encrypted object storage with
restic, rclone crypt, or your Hetzner Storage Box over SSH. Keep credentials
outside the repository.

## PITR Plan

The MVP backup is nightly `pg_dump`. Before production trading volume, add WAL
archiving with pgBackRest or WAL-G:

- Store WAL archives in encrypted offsite storage.
- Keep at least 7 days of point-in-time recovery.
- Test recovery into a clean Postgres container before trusting it.

## Restore Drill

Monthly:

1. Create a fresh disposable VPS or local Docker host.
2. Start only Postgres.
3. Restore the latest dump:

```sh
deploy/hetzner/scripts/restore-postgres.sh /backups/openstat/openstat-latest.dump
```

4. Run migrations against the restored DB.
5. Start API and worker.
6. Check `/ready`, list agents, and verify recent events.
7. Record the result in the operations log.

## Health Checks

- API: `GET /ready`
- Worker: check logs for fresh `Processed ingestion outbox rows` messages.
- Postgres: `pg_isready`
- Redis: `redis-cli ping`
- Disk: alert before 80% usage and page before 90%.
- Backups: alert if no dump file was written in the last 26 hours.

Run the bundled VPS health check from the repository root after deploys and
before early-access launch:

```sh
deploy/hetzner/scripts/check-openstat.sh
```

The script checks Compose services, `/health`, `/ready`, Postgres, Redis, disk
usage, and backup freshness. It exits non-zero when a critical check fails and
prints warnings for degraded but recoverable items.

## UptimeRobot

Use UptimeRobot for external checks that do not depend on the VPS itself:

- `https://api.openstat.online/health`
- `https://api.openstat.online/ready`
- `https://www.openstat.online`
- SSL expiry monitors for `api.openstat.online` and `www.openstat.online`

Treat a failed `/ready` monitor as an alert. Treat worker outbox rows older than
5 minutes or any dead-lettered row in `/ready.outbox` as a warning that should
be investigated before customer traffic increases.

## Auth Email

Production email-password auth requires provider-backed email delivery. Set:

```text
AUTH_REQUIRE_EMAIL_VERIFICATION=true
AUTH_EMAIL_PROVIDER=resend
AUTH_EMAIL_FROM="OpenStat <noreply@openstat.online>"
RESEND_API_KEY=<resend-api-key>
```

The backend refuses to boot in production with `AUTH_EMAIL_PROVIDER=log`, and it
refuses `AUTH_EMAIL_PROVIDER=resend` without `RESEND_API_KEY`.

## Redis Operations

Redis accelerates short-lived wake-up signals and caches only. Postgres remains
the source of truth for ingestion, projections, auth state, idempotency, and
dashboard reads.

The Hetzner Compose deployment keeps Redis private to the Docker network and
starts it with a conservative `768mb` memory cap plus `volatile-lru` eviction so
only TTL-bearing keys are eviction candidates. Prefer TTLs for every cache or
counter key, and avoid permanent Redis keys unless there is a clear operational
reason.

Health check Redis with:

```sh
docker compose exec redis redis-cli ping
```

The API `/ready` response also reports optional Redis status and in-process
Redis telemetry counters. Redis should be `ok` when configured, but `/ready`
still returns ready if Redis is temporarily `error` because Postgres remains the
source of truth and Redis has fallback paths.

Watch these `/ready.telemetry.redis` counters after deploys and incidents:

- `projectCache.hits`, `projectCache.misses`, `projectCache.readErrors`, and
  `projectCache.writeErrors`
- `apiKeyCache.hits`, `apiKeyCache.misses`, and `apiKeyCache.errors`
- `projectUpdatePublish.errors`
- `projectInvalidation.deletedKeys` and `projectInvalidation.errors`
- `rateLimit.increments` and `rateLimit.errors`
- `wakeups.messages`, `wakeups.lastLatencyMs`, and `wakeups.maxLatencyMs`

During incidents, it is safe to clear project cache keys because they are
rebuildable from Postgres:

```sh
docker compose exec redis redis-cli --scan --pattern 'openstat:project:<project-id>:*'
```

Review keys first, then delete the matched cache keys only for the affected
project.

Smoke test Redis acceleration after deploy:

1. `docker compose exec redis redis-cli ping`
2. Call `GET /ready` and confirm `redis: "ok"` when `REDIS_URL` is configured.
3. Ingest one event and confirm worker logs show an ingestion wake-up and cache
   invalidation for the project.
4. Load dashboard endpoints twice and confirm cache hit/miss counters move.
5. Temporarily stop Redis, call a dashboard endpoint, and confirm Postgres still
   serves the response while Redis error counters move.

## Alerts

Start with simple VPS monitors:

- API 5xx spike or failed `/ready`
- Worker dead letters greater than zero
- Worker lag: pending outbox rows older than 5 minutes
- Failed backup job
- Disk usage above thresholds
- Postgres unavailable
- Redis unavailable

## Log Rotation

Docker Compose uses `json-file` rotation with `max-size=10m` and `max-file=5`
for API, worker, Postgres, Redis, and Caddy.
