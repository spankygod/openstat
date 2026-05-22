#!/usr/bin/env sh
set -eu

backup_dir="${BACKUP_DIR:-/backups/openstat}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="${backup_dir}/openstat-${timestamp}.dump"

mkdir -p "${backup_dir}"

docker compose -f deploy/hetzner/docker-compose.yml --env-file deploy/hetzner/.env exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-openstat}" -d "${POSTGRES_DB:-openstat}" --format=custom --no-owner --no-acl \
  > "${file}"

sha256sum "${file}" > "${file}.sha256"
find "${backup_dir}" -name "openstat-*.dump" -mtime +14 -delete
find "${backup_dir}" -name "openstat-*.dump.sha256" -mtime +14 -delete

echo "Wrote ${file}"
