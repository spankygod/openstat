#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-deploy/hetzner/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-deploy/hetzner/.env}"
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-80}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

API_URL="${API_PUBLIC_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-/backups/openstat}"

failures=0
warnings=0

ok() {
  printf 'ok: %s\n' "$1"
}

warn() {
  warnings=$((warnings + 1))
  printf 'warn: %s\n' "$1"
}

fail() {
  failures=$((failures + 1))
  printf 'fail: %s\n' "$1"
}

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

check_container() {
  local service="$1"
  local status

  status="$(compose ps --status running --services "$service" 2>/dev/null || true)"

  if [[ "$status" == "$service" ]]; then
    ok "$service container is running"
  else
    fail "$service container is not running"
  fi
}

check_http() {
  local path="$1"

  if [[ -z "$API_URL" ]]; then
    warn "API_PUBLIC_URL is not configured; skipping $path"
    return
  fi

  if curl -fsS --max-time 10 "${API_URL%/}${path}" >/dev/null; then
    ok "${API_URL%/}${path} responds"
  else
    fail "${API_URL%/}${path} failed"
  fi
}

check_disk() {
  local usage

  usage="$(df -P . | awk 'NR == 2 { gsub("%", "", $5); print $5 }')"

  if [[ -z "$usage" ]]; then
    warn "could not read disk usage"
  elif ((usage >= DISK_WARN_PERCENT)); then
    warn "disk usage is ${usage}%"
  else
    ok "disk usage is ${usage}%"
  fi
}

check_backup() {
  local backup_file="${BACKUP_DIR%/}/openstat-latest.dump"
  local max_age_seconds=$((BACKUP_MAX_AGE_HOURS * 3600))
  local now
  local modified

  if [[ ! -f "$backup_file" ]]; then
    warn "latest backup not found at $backup_file"
    return
  fi

  now="$(date +%s)"
  modified="$(stat -c %Y "$backup_file" 2>/dev/null || stat -f %m "$backup_file" 2>/dev/null || true)"

  if [[ -z "$modified" ]]; then
    warn "could not read latest backup timestamp"
  elif ((now - modified > max_age_seconds)); then
    warn "latest backup is older than ${BACKUP_MAX_AGE_HOURS} hours"
  else
    ok "latest backup is fresh"
  fi
}

check_container api
check_container worker
check_container postgres
check_container redis
check_container caddy

check_http /health
check_http /ready

if compose exec -T postgres pg_isready -U "${POSTGRES_USER:-openstat}" >/dev/null; then
  ok "Postgres accepts connections"
else
  fail "Postgres is unavailable"
fi

if compose exec -T redis redis-cli ping | grep -q PONG; then
  ok "Redis responds to ping"
else
  warn "Redis ping failed"
fi

check_disk
check_backup

if ((failures > 0)); then
  printf 'summary: %s failures, %s warnings\n' "$failures" "$warnings"
  exit 1
fi

printf 'summary: healthy with %s warnings\n' "$warnings"
