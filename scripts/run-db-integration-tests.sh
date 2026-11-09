#!/usr/bin/env bash
# Integration tests: Postgres functions against Supabase Local.
# Unit tests stay on Vitest and do not open a database.
set -euo pipefail
cd "$(dirname "$0")/.."

INTEGRATION_DIR="supabase/tests/integration"
DB_PORT="$(awk '/^\[db\]/{found=1} found && /^port =/{print $3; exit}' supabase/config.toml)"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:${DB_PORT:-54322}/postgres}"
export PGCLIENTENCODING="${PGCLIENTENCODING:-UTF8}"

if ! compgen -G "${INTEGRATION_DIR}/*.sql" > /dev/null; then
  echo "No integration SQL files in ${INTEGRATION_DIR}" >&2
  exit 1
fi

if ! psql "${DB_URL}" -c "select 1" >/dev/null 2>&1; then
  echo "ERROR: local Postgres is not reachable at ${DB_URL}" >&2
  echo "Start with: npx supabase start" >&2
  exit 1
fi

shopt -s nullglob
integration_files=("${INTEGRATION_DIR}"/*.sql)
shopt -u nullglob

for sql in "${integration_files[@]}"; do
  echo "Running integration: $(basename "${sql}")"
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${sql}"
done

echo "All integration tests passed (${#integration_files[@]} file(s))."
