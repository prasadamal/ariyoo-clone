#!/usr/bin/env bash
# End-to-end API checks through PostgREST (same request path the app uses, real JWTs).
# Usage: POSTGREST_BIN=/path/to/postgrest supabase/tests/run_http.sh
# Needs: a local Postgres superuser (sudo -u postgres) and apps/wayfare-mobile/node_modules.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
DB="${WAYFARE_HTTP_DB:-wayfare_http}"
PORT="${WAYFARE_HTTP_PORT:-3911}"
BIN="${POSTGREST_BIN:-postgrest}"
SECRET="wayfare-local-test-secret-at-least-32-characters"
PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1 -X -q)

command -v "$BIN" >/dev/null || [ -x "$BIN" ] || { echo "PostgREST binary not found (set POSTGREST_BIN)"; exit 1; }

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" >/dev/null
"${PSQL[@]}" -d postgres -c "create database $DB" >/dev/null
"${PSQL[@]}" -d "$DB" < "$HERE/supabase_stub.sql" >/dev/null
for f in "$ROOT"/migrations/*.sql; do "${PSQL[@]}" -d "$DB" < "$f" >/dev/null; done

"${PSQL[@]}" -d postgres >/dev/null <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'authenticator-test';
  end if;
end \$\$;
grant anon, authenticated, service_role to authenticator;
SQL

CONF="$(mktemp)"
cat > "$CONF" <<CONFIG
db-uri = "postgres://authenticator:authenticator-test@127.0.0.1:5432/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = $PORT
log-level = "warn"
CONFIG

"$BIN" "$CONF" > "${TMPDIR:-/tmp}/wayfare-postgrest.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; rm -f "$CONF"' EXIT
for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$PORT/" >/dev/null 2>&1 && break
  sleep 0.25
done

WAYFARE_HTTP_URL="http://127.0.0.1:$PORT" WAYFARE_JWT_SECRET="$SECRET" WAYFARE_HTTP_DB="$DB" \
  node --test "$HERE/http/api.test.mjs"
