#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

if ! command -v psql >/dev/null; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

if ! sudo pg_ctlcluster 16 main status >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start
fi
until pg_isready -q; do sleep 1; done

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'ariyoo'" | grep -q 1 \
  || sudo -u postgres createdb ariyoo
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" >/dev/null

if [[ ! -f services/api/.env ]]; then
  cp services/api/.env.example services/api/.env
fi
if grep -q '^PORT=' services/api/.env; then
  sed -i 's/^PORT=.*/PORT=5296/' services/api/.env
else
  echo 'PORT=5296' >> services/api/.env
fi

(
  cd "$ROOT/services/api"
  npm ci
  npx prisma generate
  npx prisma db push --accept-data-loss
  npm run prisma:seed
)

(
  cd "$ROOT/apps/web"
  npm ci
)
