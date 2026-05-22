#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Usage: deploy/hetzner/scripts/restore-postgres.sh /path/to/openstat.dump"
  exit 1
fi

backup_file="$1"

docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env exec -T postgres \
  dropdb -U "${POSTGRES_USER:-openstat}" --if-exists "${POSTGRES_DB:-openstat}"
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env exec -T postgres \
  createdb -U "${POSTGRES_USER:-openstat}" "${POSTGRES_DB:-openstat}"
docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env exec -T postgres \
  pg_restore -U "${POSTGRES_USER:-openstat}" -d "${POSTGRES_DB:-openstat}" --clean --if-exists --no-owner --no-acl \
  < "${backup_file}"
