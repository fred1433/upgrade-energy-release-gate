"""Family 5: database restore drill. Runs against the FRESH drill stack after scripts/restore_drill.py
restored roles, schema and data into it, and before any migration touches it."""
import json
import os
from pathlib import Path

import psycopg
import pytest

from tests.catalog import diff, manifest

MANIFEST = os.environ.get("RESTORE_MANIFEST")
pytestmark = pytest.mark.skipif(not MANIFEST, reason="run through scripts/restore_drill.py")


@pytest.fixture(scope="module")
def source():
    return json.loads(Path(MANIFEST).read_text())


@pytest.fixture(scope="module")
def restored(stack):
    with psycopg.connect(stack.db_url, autocommit=True) as conn:
        return manifest(conn)


def test_restored_grants_match_source(source, restored, evidence):
    problems = diff(source["catalog"], restored,
                    ["table_grants", "column_grants", "schema_acl", "execute_rights", "default_acl", "roles", "memberships"])
    evidence.step("inspection", "grants", problems=problems)
    worst = sorted(problems, key=lambda p: not any(k in p for k in (
        "service_role:public.audit_log:INSERT", "authenticated:public.holds:UPDATE", "anon:public.lift_hold")))
    assert not problems, f"rights changed by the restore ({len(problems)} differences), e.g. " + "; ".join(worst[:3])


def test_restored_policies_functions_and_triggers_match_source(source, restored, evidence):
    problems = diff(source["catalog"], restored, ["rls", "policies", "functions", "triggers", "constraints"])
    evidence.step("inspection", "policies, functions, triggers", problems=problems)
    assert not problems, "definitions changed by the restore: " + "; ".join(problems[:6])


def test_restored_rows_match_source(source, restored, evidence):
    evidence.step("inspection", "rows", source=source["catalog"]["rows"], restored=restored["rows"])
    assert restored["rows"] == source["catalog"]["rows"]


def test_checks_target_the_restored_instance(stack, source, restored, evidence):
    evidence.step("inspection", "instance", api=stack.api_url, source_id=source["catalog"]["system_identifier"],
                  restored_id=restored["system_identifier"])
    assert restored["system_identifier"] != source["catalog"]["system_identifier"], "this is the source database"
    assert stack.api_url == source["drill_api_url"]


def test_authorized_operation_succeeds_on_restored_instance(stack, source, evidence):
    r = stack.api("POST", "/rest/v1/rpc/lift_hold", "quality",
                  {"p_hold_id": source["probe"]["hold_for_quality"], "p_note": "Drill check (fictional)",
                   "p_workstation": "WS-QA-01"})
    evidence.step("api", "quality lifts a pre-backup hold", **r)
    assert r["status"] == 200 and r["body"]["outcome"] == "hold_lifted"
    with psycopg.connect(source["source_db_url"], autocommit=True) as src:
        still = src.execute("select status from public.holds where id = %s",
                            [source["probe"]["hold_for_quality"]]).fetchone()[0]
    evidence.step("inspection", "the same hold in the source database", status=still)
    assert still == "open", "the call must have changed the restored instance only"


def test_forbidden_operation_fails_on_restored_instance(stack, source, evidence):
    r1 = stack.api("POST", "/rest/v1/rpc/lift_hold", "operator",
                   {"p_hold_id": source["probe"]["hold_for_operator"], "p_note": "x", "p_workstation": "WS-TEST-02"})
    r2 = stack.api("PATCH", f"/rest/v1/holds?id=eq.{source['probe']['hold_for_operator']}", "operator",
                   {"status": "lifted"}, prefer="return=minimal")
    evidence.step("api", "operator lifts through the RPC", **r1)
    evidence.step("api", "operator writes the row directly", **r2)
    assert r1["status"] == 403 and r1["body"]["code"] == "PT403"
    assert r2["status"] == 403, f"direct write on the restored instance answered HTTP {r2['status']}"


def test_pre_backup_operation_key_is_replayed(stack, source, evidence):
    r = stack.api("POST", "/rest/v1/rpc/record_measurement", "operator", source["probe"]["measurement_payload"])
    evidence.step("api", "resend of a measurement recorded before the backup", **r)
    assert r["status"] == 200 and r["body"]["outcome"] == "replayed"
    assert r["body"]["measurement_id"] == source["probe"]["measurement_id"]
