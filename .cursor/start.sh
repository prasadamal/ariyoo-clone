#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

if ! sudo pg_ctlcluster 16 main status >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start
fi
until pg_isready -q; do sleep 1; done

if [[ ! -f services/api/.env ]]; then
  cp services/api/.env.example services/api/.env
  sed -i 's/^PORT=.*/PORT=5296/' services/api/.env
fi

export NG_CLI_ANALYTICS=false

TMUX=(tmux -f /exec-daemon/tmux.portal.conf)

if ! "${TMUX[@]}" has-session -t api 2>/dev/null; then
  "${TMUX[@]}" new-session -d -s api -c "$ROOT/services/api" \
    "npm run dev 2>&1 | tee /tmp/ariyoo-api.log"
fi

for _ in $(seq 1 60); do
  if curl -sf -o /dev/null -X POST http://localhost:5296/auth/login \
    -H 'Content-Type: application/json' -d '{"email":"solver@example.com","password":"password"}'; then
    break
  fi
  sleep 1
done

if ! "${TMUX[@]}" has-session -t web 2>/dev/null; then
  "${TMUX[@]}" new-session -d -s web -c "$ROOT/apps/web" \
    "npx ng serve --host 0.0.0.0 --port 4200 --disable-host-check 2>&1 | tee /tmp/ariyoo-web.log"
fi

for _ in $(seq 1 120); do
  if curl -sf -o /dev/null http://localhost:4200/; then
    exit 0
  fi
  sleep 2
done

echo "Angular dev server did not become ready in time" >&2
exit 1
