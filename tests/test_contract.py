"""Family 1: the server contract for record_measurement, through the real API and two real connections."""
from datetime import datetime, timedelta, timezone
import uuid

from tests.helpers import call_sql, measurement, record
from tests.support import OPERATOR, measurement_rows, new_pack, pack_state, run_in_thread, wait_blocked_or_done

RPC_SQL = ("select public.record_measurement(%s::uuid, %s, %s, %s, %s::numeric, %s::numeric, %s::timestamptz)")


def as_params(p):
    return [p["p_operation_key"], p["p_serial"], p["p_cycle"], p["p_workstation"],
            p["p_voltage_v"], p["p_acir_mohm"], p["p_measured_at"]]


def test_new_key_is_recorded(stack, admin, evidence):
    serial = new_pack(admin)
    r = record(stack, "operator", measurement(serial))
    evidence.step("api", "response", **r)
    assert r["status"] == 200 and r["body"]["outcome"] == "recorded"
    assert len(measurement_rows(admin, serial)) == 1


def test_same_key_same_content_returns_original_result(stack, admin, evidence):
    serial = new_pack(admin)
    body = measurement(serial)
    r1 = record(stack, "operator", body)
    r2 = record(stack, "operator", body)
    evidence.step("api", "first", **r1)
    evidence.step("api", "resend", **r2)
    rows = measurement_rows(admin, serial)
    assert len(rows) == 1, f"one battery test, {len(rows)} measurement rows"
    assert r2["status"] == 200 and r2["body"]["outcome"] == "replayed"
    assert r2["body"]["measurement_id"] == r1["body"]["measurement_id"]
    assert r2["body"]["recorded_at"] == r1["body"]["recorded_at"]


def test_same_key_different_content_is_rejected(stack, admin, evidence):
    serial = new_pack(admin)
    body = measurement(serial, acir_mohm=48.6)
    r1 = record(stack, "operator", body)
    r2 = record(stack, "operator", {**body, "p_acir_mohm": 51.2})
    rows = measurement_rows(admin, serial)
    evidence.step("api", "first", **r1)
    evidence.step("api", "same key, ACIR changed", **r2)
    evidence.step("database", "checked", rows=rows)
    assert r2["status"] == 409, (
        f"same key with different content was accepted: HTTP {r2['status']}, stored ACIR now {rows[0]['acir_mohm']}")
    assert r2["body"]["code"] == "PT409"
    assert [r["acir_mohm"] for r in rows] == ["48.60"]


def test_two_simultaneous_deliveries_record_one_measurement(stack, admin, evidence):
    serial = new_pack(admin)
    p = measurement(serial)
    a, b = stack.user_conn(OPERATOR), stack.user_conn(OPERATOR)
    try:
        ra = a.execute(RPC_SQL, as_params(p)).fetchone()[0]
        evidence.step("connection A", "ran, not committed", result=ra)
        fut = run_in_thread(lambda: call_sql(b, RPC_SQL, as_params(p)))
        barrier = wait_blocked_or_done(admin, b.info.backend_pid, fut)
        evidence.step("connection B", f"same delivery started: {barrier}")
        a.commit()
        evidence.step("connection A", "COMMIT")
        rb = fut.result(timeout=15)
        evidence.step("connection B", "returned", **rb)
    finally:
        a.close()
        b.close()
    rows = measurement_rows(admin, serial)
    evidence.step("database", "checked", rows=rows)
    assert len(rows) == 1, f"two simultaneous deliveries, {len(rows)} measurement rows"
    assert rb["ok"] and rb["result"]["outcome"] == "replayed"
    assert rb["result"]["measurement_id"] == ra["measurement_id"]


def test_real_retest_with_new_key_is_recorded(stack, admin, evidence):
    serial = new_pack(admin)
    r1 = record(stack, "operator", measurement(serial, acir_mohm=48.6))
    r2 = record(stack, "operator", measurement(serial, acir_mohm=48.1))
    evidence.step("api", "first test", **r1)
    evidence.step("api", "retest, new key", **r2)
    rows = measurement_rows(admin, serial)
    assert r2["status"] == 200 and r2["body"]["outcome"] == "recorded"
    assert len(rows) == 2 and rows[0]["id"] != rows[1]["id"]


def test_traveler_path_measurement_before_rework_is_not_a_retest(stack, admin, evidence):
    """The illustrated traveler, end to end through the API: fail, hold, rework, late upload, retest, lift, release."""
    serial = new_pack(admin)
    evidence.fact("serial", serial)
    t0 = datetime.now(timezone.utc) - timedelta(minutes=10)

    r = record(stack, "operator", measurement(serial, acir_mohm=71.3, measured_at=t0))
    evidence.step("api", "voltage_acir_test", **r)
    assert r["body"]["result"] == "fail"

    late = measurement(serial, acir_mohm=69.8, measured_at=t0 + timedelta(minutes=1))  # taken, not yet uploaded

    r = stack.api("POST", "/rest/v1/rpc/open_hold", "operator",
                  {"p_serial": serial, "p_reason": "ACIR above limit (fictional)", "p_workstation": "WS-TEST-02"})
    evidence.step("api", "quality_hold", **r)
    hold_id = r["body"]["hold_id"]

    r = stack.api("POST", "/rest/v1/rpc/complete_rework", "operator",
                  {"p_serial": serial, "p_note": "Tab re-welded (fictional)", "p_workstation": "WS-WELD-01"})
    evidence.step("api", "rework", **r)
    assert r["body"]["cycle"] == 2

    r = record(stack, "operator", late)
    evidence.step("api", "late_upload", **r)
    assert r["status"] == 200 and r["body"]["cycle"] == 1 and r["body"]["counts_for_release"] is False
    assert pack_state(admin, serial)["release_eligible"] is False

    r = record(stack, "operator", measurement(serial, cycle=2, acir_mohm=48.6, measured_at=t0 + timedelta(minutes=2)))
    evidence.step("api", "old_measurement_claims_retest", **r)
    assert r["status"] == 422, "a measurement taken before the rework must not count as the retest"

    r = record(stack, "operator", measurement(serial, cycle=2, acir_mohm=48.6))
    evidence.step("api", "retest", **r)
    assert r["body"]["outcome"] == "recorded" and r["body"]["counts_for_release"] is True
    assert pack_state(admin, serial)["release_eligible"] is False, "the hold is still open"

    r = stack.api("POST", "/rest/v1/rpc/lift_hold", "quality",
                  {"p_hold_id": hold_id, "p_note": "Retest within limits (fictional)", "p_workstation": "WS-QA-01"})
    evidence.step("api", "hold_lifted", **r)
    assert pack_state(admin, serial)["release_eligible"] is True

    r = stack.api("POST", "/rest/v1/rpc/release_pack", "quality", {"p_serial": serial, "p_workstation": "WS-QA-01"})
    evidence.step("api", "release", **r)
    state = pack_state(admin, serial)
    evidence.step("database", "checked", state=state, rows=measurement_rows(admin, serial))
    assert r["status"] == 200 and state["status"] == "released"
