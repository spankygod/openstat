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
