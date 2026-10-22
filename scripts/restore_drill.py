#!/usr/bin/env python3
"""Database restore drill: back up the main local stack, restore it into a FRESH local Supabase stack
(drill/, its own volumes and ports), inspect rights, policies, functions and rows BEFORE any migration,
then run allowed, forbidden and replay operations against the restored API.

Not covered: Storage objects, Auth configuration, Edge Functions, secrets. Timings are for this demo
dataset on this machine; they are not a recovery-time estimate for any production system.

Usage: uv run python scripts/restore_drill.py [--plain-restore]
  --plain-restore = broken variant v5: skip drill/restore_default_acl.sql
"""
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from tests.catalog import manifest  # noqa: E402
from tests.helpers import measurement  # noqa: E402
from tests.support import OPERATOR, Stack  # noqa: E402

STRIP = "--plain-restore" in sys.argv
NAME = "v5_restore_reapplies_default_grants" if STRIP else "main"
OUT = ROOT / "evidence" / ("variants/" + NAME if STRIP else "restore")
WORK = OUT / "backup"
STEPS = []
T0 = time.monotonic()


def step(text, **data):
    STEPS.append({"t_s": round(time.monotonic() - T0, 2), "text": text, **data})
    print(f"[{STEPS[-1]['t_s']:7.2f}s] {text}", flush=True)


def sh(cmd, **kw):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.exit(f"command failed: {' '.join(cmd)}\n{r.stdout[-3000:]}\n{r.stderr[-3000:]}")
    return r


def seed_source(stack):
    """A fictional dataset written through the RPCs as the operator, so audit rows exist too."""
    with stack.admin() as admin:
        admin.execute("insert into public.packs (serial, model) select format('DRILL-6S1P-%s', lpad(g::text, 4, '0')), "
                      "'RED V4 6S1P 5Ah (demo)' from generate_series(1, 400) g on conflict do nothing")
    with stack.user_conn(OPERATOR) as conn:
        for g in range(1, 401):
            serial = f"DRILL-6S1P-{g:04d}"
            p = measurement(serial, acir_mohm=48.0 + (g % 13) * 1.1 if g % 9 else 66.4)
            conn.execute("select public.record_measurement(%s::uuid, %s, %s, %s, %s::numeric, %s::numeric, %s)",
                         [p["p_operation_key"], p["p_serial"], p["p_cycle"], p["p_workstation"],
                          p["p_voltage_v"], p["p_acir_mohm"], p["p_measured_at"]])
            if g % 9 == 0:
                conn.execute("select public.open_hold(%s, 'ACIR above limit (fictional)', 'WS-TEST-02')", [serial])
        conn.commit()
    probe_serial = "DRILL-6S1P-0001"
    payload = measurement(probe_serial, acir_mohm=47.9)
    r = stack.api("POST", "/rest/v1/rpc/record_measurement", "operator", payload)
    h1 = stack.api("POST", "/rest/v1/rpc/open_hold", "operator",
                   {"p_serial": "DRILL-6S1P-0002", "p_reason": "Drill probe (fictional)", "p_workstation": "WS-TEST-02"})
    h2 = stack.api("POST", "/rest/v1/rpc/open_hold", "operator",
                   {"p_serial": "DRILL-6S1P-0003", "p_reason": "Drill probe (fictional)", "p_workstation": "WS-TEST-02"})
    return {"measurement_payload": payload, "measurement_id": r["body"]["measurement_id"],
            "hold_for_quality": h1["body"]["hold_id"], "hold_for_operator": h2["body"]["hold_id"]}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    src = Stack()
    step("source: main local stack", api=src.api_url)
    probe = seed_source(src)
    with src.admin() as conn:
        src_catalog = manifest(conn)
    step("source: catalog and row checksums recorded", rows=src_catalog["rows"])

    t = time.monotonic()
    for args, name in ((["--role-only"], "roles.sql"), ([], "schema.sql"), (["--data-only", "--use-copy"], "data.sql")):
        sh(["supabase", "db", "dump", "--local", *args, "-f", str(WORK / name)])
    backup_s = round(time.monotonic() - t, 2)
    sizes = {n: (WORK / n).stat().st_size for n in ("roles.sql", "schema.sql", "data.sql")}
    step("backup: roles, schema and data dumped separately", seconds=backup_s, bytes=sizes)

    if STRIP:
        step("BROKEN VARIANT: plain restore, the fresh instance's default privileges stay active during CREATE")

    subprocess.run(["supabase", "stop", "--workdir", "drill", "--no-backup"], cwd=ROOT, capture_output=True)
    t = time.monotonic()
    sh(["supabase", "start", "--workdir", "drill"])
    start_s = round(time.monotonic() - t, 2)
    os.environ["SUPABASE_WORKDIR"] = "drill"
    drill = Stack()
    step("drill: fresh local Supabase stack started (new volumes, no migrations, no seed)",
         seconds=start_s, api=drill.api_url)

    t = time.monotonic()
    fix = [] if STRIP else ["-f", "drill/restore_default_acl.sql"]
    sh(["psql", drill.db_url, "--single-transaction", "-v", "ON_ERROR_STOP=1", "-q",
        "-f", str(WORK / "roles.sql"), "-f", "drill/restore_prelude.sql", *fix, "-f", str(WORK / "schema.sql"),
        "-f", "drill/restore_postlude.sql", "-c", "SET session_replication_role = replica",
        "-f", str(WORK / "data.sql")])
    restore_s = round(time.monotonic() - t, 2)
    step("drill: roles, prelude, default-privilege fix, schema, postlude, data restored in one transaction" if not STRIP else "drill: roles, prelude, schema, postlude, data restored in one transaction", seconds=restore_s)

    manifest_path = OUT / "source_manifest.json"
    manifest_path.write_text(json.dumps({"catalog": src_catalog, "probe": probe, "source_db_url": src.db_url,
                                         "drill_api_url": drill.api_url}, indent=2, default=str))
    env = {**os.environ, "RESTORE_MANIFEST": str(manifest_path), "EVIDENCE_DIR": str(OUT / "tests"),
           "VARIANT": NAME, "SUPABASE_WORKDIR": "drill"}
    t = time.monotonic()
    res = subprocess.run(["uv", "run", "pytest", "-q", "-p", "no:cacheprovider", "tests_restore"],
                         cwd=ROOT, env=env, capture_output=True, text=True)
    checks_s = round(time.monotonic() - t, 2)
    (OUT / "pytest_output.txt").write_text(res.stdout + res.stderr)
    tail = res.stdout.strip().splitlines()[-1] if res.stdout.strip() else res.stderr[-300:]
    step("drill: inspection before any migration, then API checks", seconds=checks_s, result=tail)

    cli = subprocess.run(["supabase", "--version"], capture_output=True, text=True).stdout.strip().splitlines()[0]
    summary = {
        "variant": NAME,
        "finished_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset_rows": {k: v["count"] for k, v in src_catalog["rows"].items()},
        "dump_bytes": sizes,
        "versions": {"postgres": src_catalog["server_version"], "supabase_cli": cli},
        "seconds": {"backup": backup_s, "fresh_stack_start": start_s, "restore": restore_s, "checks": checks_s},
        "not_covered": ["Storage objects", "Auth and project configuration", "Edge Functions", "secrets"],
        "pytest_exit": res.returncode,
        "pytest_tail": tail,
        "steps": STEPS,
    }
    (OUT / "drill.json").write_text(json.dumps(summary, indent=2))
    if os.environ.get("KEEP_DRILL") != "1":
        subprocess.run(["supabase", "stop", "--workdir", "drill", "--no-backup"], cwd=ROOT, capture_output=True)
        step("drill: stack stopped and its volumes deleted")
    print(res.stdout[-2500:])
    sys.exit(res.returncode)


if __name__ == "__main__":
    main()
