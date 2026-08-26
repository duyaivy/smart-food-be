#!/usr/bin/env bash
set -euo pipefail

# Minimal, production-friendly entrypoint:
# - waits for PostgreSQL TCP socket if DATABASE_URL is set
# - runs Prisma migrations (migrate deploy) if enabled
# - execs the container CMD (pm2-runtime)

log() {
  echo "[entrypoint] $*"
}

connection_url="${DATABASE_URL:-}"

# If we are going to run migrations and DIRECT_URL is provided, prefer it.
if [[ "${RUN_PRISMA_MIGRATIONS:-true}" == "true" && -n "${DIRECT_URL:-}" ]]; then
  connection_url="${DIRECT_URL}"
fi

if [[ -n "${connection_url:-}" ]]; then
  # Parse host/port from URL using Node's URL parser
  db_host="$(CONNECTION_URL="$connection_url" node -e "try{const u=new URL(process.env.CONNECTION_URL);process.stdout.write(u.hostname||'');}catch(e){process.stdout.write('');}")"
  db_port="$(CONNECTION_URL="$connection_url" node -e "try{const u=new URL(process.env.CONNECTION_URL);process.stdout.write(String(u.port||'5432'));}catch(e){process.stdout.write('5432');}")"

  if [[ -n "$db_host" ]]; then
    max_tries="${DB_WAIT_MAX_TRIES:-60}"
    sleep_seconds="${DB_WAIT_SLEEP_SECONDS:-2}"

    log "Waiting for PostgreSQL at ${db_host}:${db_port} (max ${max_tries} tries)..."

    try=1
    while true; do
      if timeout 2 bash -c "</dev/tcp/${db_host}/${db_port}" >/dev/null 2>&1; then
        log "PostgreSQL TCP is reachable."
        break
      fi

      if [[ "$try" -ge "$max_tries" ]]; then
        log "ERROR: PostgreSQL not reachable after ${max_tries} tries."
        exit 1
      fi

      log "PostgreSQL not ready yet (${try}/${max_tries}); sleeping ${sleep_seconds}s..."
      try=$((try + 1))
      sleep "$sleep_seconds"
    done
  else
    log "WARN: Could not parse host from DATABASE_URL/DIRECT_URL; skipping DB wait."
  fi
else
  log "DATABASE_URL/DIRECT_URL not set; skipping DB wait."
fi

if [[ "${RUN_PRISMA_MIGRATIONS:-true}" == "true" ]]; then
  log "Running Prisma migrations (prisma migrate deploy)..."
  ./node_modules/.bin/prisma migrate deploy
else
  log "RUN_PRISMA_MIGRATIONS=false; skipping migrations."
fi

log "Starting application: $*"
exec "$@"
