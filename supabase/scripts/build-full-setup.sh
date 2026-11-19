#!/usr/bin/env bash
# Concatenates every migration, in order, into one file you can paste into the Supabase SQL Editor
# for a brand-new, empty project (used once for the live `wayfare` project on 19 Nov 2026).
# Usage: bash supabase/scripts/build-full-setup.sh > /tmp/wayfare_full_setup.sql
set -euo pipefail
cd "$(dirname "$0")/.."
echo "-- Wayfare full setup: all migrations in order. Run once on an EMPTY public schema."
for f in migrations/*.sql; do
  printf '\n-- ===== %s =====\n' "$f"
  cat "$f"
done
