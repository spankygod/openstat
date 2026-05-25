# OpenStat Hetzner Deployment

This deploys the API, ingestion worker, Postgres, Redis, and Caddy on one
Hetzner VPS. The web dashboard can stay on Vercel and point to `API_PUBLIC_URL`.

## First Boot

1. Provision a Hetzner VPS with Docker and the Docker Compose plugin.
2. Point the API domain A record at the VPS public IP.
3. Copy `.env.example` to `.env` and replace every secret.
4. Open only SSH, HTTP, and HTTPS in the firewall.
5. Keep Postgres and Redis private to the Docker network. Do not publish ports
   `5432` or `6379`.
6. Start the stack:

```sh
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env up -d --build
```

7. Run migrations:

```sh
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env run --rm api pnpm --filter @openstat/db db:migrate
```

8. Check health:

```sh
curl https://api.openstat.example.com/health
curl https://api.openstat.example.com/ready
```

## Vercel

Set `NEXT_PUBLIC_OPENSTAT_API_URL` to the API domain, for example
`https://api.openstat.example.com`.

## GitHub Actions Deploy

The repository includes `.github/workflows/deploy-hetzner.yml`. It deploys the
backend stack when `main` is pushed, after typecheck and lint pass.

Add these repository secrets in GitHub:

```text
HETZNER_HOST=37.27.196.51
HETZNER_USER=deploy
HETZNER_SSH_KEY=<private SSH key allowed for deploy@37.27.196.51>
HETZNER_REPO_DIR=/home/deploy/openstat
```

The deploy job updates the VPS checkout to `origin/main`, builds the API and
worker images, runs database migrations, restarts the Compose stack, and checks
the backend readiness endpoint from inside the API container.

## Future Two-VPS Split

When the database outgrows the single VPS, move Postgres to a second Hetzner VPS
on the private network only. Bind Postgres to the private interface, allow
`5432` only from the API/worker VPS private IP, update `DATABASE_URL`, and keep
public firewall access denied.

## Rollback

1. Keep the previous image available before pulling new changes.
2. If deploy fails, revert the Git SHA and rebuild:

```sh
git checkout <previous-sha>
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env up -d --build api worker
```

3. If a migration already ran, restore from the latest backup before restarting
   the old app version.
