#!/usr/bin/env bash
# One command: start the local Supabase stack, run both test layers, the restore drill,
# and every deliberately broken variant. Outputs land in evidence/.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p evidence/run/pgtap
supabase start >/dev/null
supabase db reset >/dev/null
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

echo "== 1/4 SQL layer: supabase test db (pgTAP)"
supabase test db 2>&1 | grep -v -E 'new version|recommend updating' | tee evidence/run/pgtap.txt
# Same files through psql, to keep every individual assertion line as evidence.
psql "$DB_URL" -q -c 'create extension if not exists pgtap with schema extensions'
for f in supabase/tests/*.sql; do
  psql "$DB_URL" -At -q -f "$f" 2>&1 | grep -E '^(ok|not ok|1\.\.|#)' > "evidence/run/pgtap/$(basename "$f" .sql).tap"
done
psql "$DB_URL" -q -c 'drop extension if exists pgtap'

echo "== 2/4 API, concurrency and cuts: pytest"
uv run pytest -q -p no:cacheprovider --junitxml=evidence/run/junit.xml | tee evidence/run/pytest.txt

echo "== 3/4 restore drill into a fresh local stack"
uv run python scripts/restore_drill.py | tee evidence/run/restore_drill.txt

echo "== 4/4 broken variants, each must be caught by its own assertion"
uv run python scripts/prove_variants.py | tee evidence/run/variants.txt

{
  echo "commit=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "supabase_cli=$(supabase --version 2>/dev/null | head -1)"
  echo "postgres=$(psql "$DB_URL" -At -c 'show server_version')"
  echo "python=$(uv run python -c 'import sys; print(sys.version.split()[0])')"
  echo "finished_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > evidence/run/versions.txt
echo "all checks passed"
