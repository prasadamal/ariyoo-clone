#!/usr/bin/env bash
# Applies every Wayfare migration to a throwaway local Postgres database (with a Supabase
# stub) and runs the RLS / RPC test suite. Usage: supabase/tests/run_local.sh
# Needs a reachable Postgres superuser (defaults: sudo -u postgres, or PGUSER/PGHOST env).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DB="${WAYFARE_TEST_DB:-wayfare_test}"

if [[ -n "${PGUSER:-}" || -n "${PGHOST:-}" ]]; then
  PSQL=(psql -v ON_ERROR_STOP=1 -X -q)
else
  PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1 -X -q)
fi

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" >/dev/null
"${PSQL[@]}" -d postgres -c "create database $DB" >/dev/null

echo "• Supabase stub"
"${PSQL[@]}" -d "$DB" < "$HERE/supabase_stub.sql" >/dev/null

for f in "$ROOT"/migrations/*.sql; do
  echo "• $(basename "$f")"
  "${PSQL[@]}" -d "$DB" < "$f" >/dev/null
done

# Applying twice proves the migrations are re-runnable.
for f in "$ROOT"/migrations/*.sql; do
  [[ "${f##*/}" < "20261006000000" ]] && continue
  "${PSQL[@]}" -d "$DB" < "$f" >/dev/null
done
echo "• re-run of v2 migrations ok"

for t in "$HERE"/test_*.sql; do
  echo "• $(basename "$t")"
  "${PSQL[@]}" -d "$DB" < "$t"
done

echo "All Wayfare database tests passed."
