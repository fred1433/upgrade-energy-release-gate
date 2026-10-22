#!/usr/bin/env python3
"""Apply each deliberately broken variant to a freshly reset local database, run the one test that
guards that invariant, and check that it fails on the expected assertion (not on a syntax error).

Writes evidence/variants/<name>/{output.txt,summary.json} and evidence/variants/summary.json.
Usage: uv run python scripts/prove_variants.py [name ...]
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "evidence" / "variants"
DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

VARIANTS = [
    {"name": "v1_retry_writes_twice", "family": 1,
     "test": "tests/test_one_measurement.py::test_lost_reply_is_recorded_once",
     "expect": "one battery test, 2 measurement rows"},
    {"name": "v1b_upsert_overwrites", "family": 1,
     "test": "tests/test_contract.py::test_same_key_different_content_is_rejected",
     "expect": "same key with different content was accepted: HTTP 200, stored ACIR now 51.20"},
    {"name": "v2a_release_without_lock", "family": 2,
     "test": "tests/test_hold_release_race.py::test_hold_first_then_release_is_refused",
     "expect": "pack released while a hold is open"},
    {"name": "v2b_hold_leaves_eligibility", "family": 2,
     "test": "tests/test_hold_release_race.py::test_release_first_then_hold_withdraws_eligibility",
     "expect": "hold opened after release left the pack shippable"},
    {"name": "v3_column_revoke", "family": 3,
     "test": "tests/test_lift_hold_api.py::test_direct_write_is_refused",
     "expect": "operator direct write answered HTTP 204 without an error; hold row is now 'lifted'"},
    {"name": "v3b_policy_filters_silently", "family": 3,
     "test": "tests/test_lift_hold_api.py::test_direct_write_is_refused",
     "expect": "operator direct write answered HTTP 204 without an error; hold row is now 'open'"},
    {"name": "v3c_refuse_everyone", "family": 3,
     "test": "tests/test_lift_hold_api.py::test_quality_lifts_the_hold",
     "expect": "quality must be able to lift a hold: HTTP 403"},
    {"name": "v4_default_grants_on_audit", "family": 4,
     "test": "pgtap:supabase/tests/03_audit.sql",
     "expect": "Failed test 5: \"service_role cannot INSERT into audit_log\""},
    {"name": "v5_restore_reapplies_default_grants", "family": 5,
     "test": "drill:tests_restore/test_restore_drill.py::test_restored_grants_match_source",
     "expect": "AssertionError: rights changed by the restore"},
]


def sh(cmd, **kw):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, **kw)


def reset():
    r = sh(["supabase", "db", "reset"])
    if r.returncode != 0:
        sys.exit("supabase db reset failed:\n" + r.stdout[-2000:] + r.stderr[-2000:])


def run_variant(v):
    vdir = OUT / v["name"]
    vdir.mkdir(parents=True, exist_ok=True)
    reset()
    sql = ROOT / "variants" / f"{v['name']}.sql"
    if sql.exists():
        applied = sh(["psql", DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-f", str(sql)])
        if applied.returncode != 0:
            sys.exit(f"{v['name']}: the variant SQL itself failed:\n{applied.stderr}")
    t0 = time.monotonic()
    if v["test"].startswith("drill:"):
        res = sh(["uv", "run", "python", "scripts/restore_drill.py", "--plain-restore"])
        res.stdout = (vdir / "pytest_output.txt").read_text() + "\n" + res.stdout
        kind_ok = "FAILED " + v["test"].split(":", 1)[1] in res.stdout
    elif v["test"].startswith("pgtap:"):
        res = sh(["supabase", "test", "db", v["test"].split(":", 1)[1]])
        kind_ok = "Failed test" in res.stdout
    else:
        env = {**os.environ, "EVIDENCE_DIR": str(vdir), "VARIANT": v["name"]}
        res = sh(["uv", "run", "pytest", "-q", "-p", "no:cacheprovider", v["test"]], env=env)
        kind_ok = "AssertionError" in res.stdout and "SyntaxError" not in res.stdout
    output = res.stdout + res.stderr
    (vdir / "output.txt").write_text(output)
    detected = res.returncode != 0 and kind_ok and v["expect"] in output
    hits = [l.strip() for l in output.splitlines() if v["expect"] in l]
    line = next((l for l in hits if l.startswith(("E ", "#"))), hits[0] if hits else None)
    summary = {**v, "exit_code": res.returncode, "detected": detected, "failing_line": line,
               "seconds": round(time.monotonic() - t0, 2)}
    (vdir / "summary.json").write_text(json.dumps(summary, indent=2))
    print(f"{'DETECTED' if detected else 'MISSED  '}  {v['name']:32s} {line or output[-300:]}")
    return summary


def main():
    wanted = set(sys.argv[1:])
    results = [run_variant(v) for v in VARIANTS if not wanted or v["name"] in wanted]
    reset()  # leave the database as the migrations define it
    if not wanted:
        (OUT / "summary.json").write_text(json.dumps(results, indent=2))
    missed = [r["name"] for r in results if not r["detected"]]
    if missed:
        sys.exit(f"variants not detected: {missed}")
    print(f"all {len(results)} broken variants detected by their own assertion")


if __name__ == "__main__":
    main()
