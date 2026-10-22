"""Family 2: a hold and a release at the same moment, both orders forced with two real connections."""
from tests.helpers import call_sql, measurement, record
from tests.support import OPERATOR, QUALITY, new_pack, pack_state, run_in_thread, wait_blocked_or_done

OPEN_HOLD = "select public.open_hold(%s, %s, 'WS-TEST-02')"
RELEASE = "select public.release_pack(%s, 'WS-QA-01')"
REASON = "Weld coloration out of range (fictional)"


def eligible_pack(stack, admin):
    serial = new_pack(admin)
    r = record(stack, "operator", measurement(serial))
    assert r["body"]["outcome"] == "recorded"
    assert pack_state(admin, serial)["release_eligible"] is True
    return serial


def test_hold_first_then_release_is_refused(stack, admin, evidence):
    serial = eligible_pack(stack, admin)
    h, r = stack.user_conn(OPERATOR), stack.user_conn(QUALITY)
    try:
        res = h.execute(OPEN_HOLD, [serial, REASON]).fetchone()[0]
        evidence.step("operator connection", "open_hold ran, not committed", result=res)
        fut = run_in_thread(lambda: call_sql(r, RELEASE, [serial]))
        barrier = wait_blocked_or_done(admin, r.info.backend_pid, fut)
        evidence.step("quality connection", f"release_pack started: {barrier}")
        h.commit()
        evidence.step("operator connection", "COMMIT")
        out = fut.result(timeout=15)
        evidence.step("quality connection", "returned", **out)
    finally:
        h.close()
        r.close()
    state = pack_state(admin, serial)
    evidence.step("database", "checked", state=state)
    evidence.fact("final_state", state)
    assert not (state["status"] == "released" and state["open_holds"] > 0), f"pack released while a hold is open: {state}"
    assert out["ok"] is False and out["sqlstate"] == "PT409"
    assert state["status"] == "on_hold" and state["release_eligible"] is False


def test_release_first_then_hold_withdraws_eligibility(stack, admin, evidence):
    serial = eligible_pack(stack, admin)
    r, h = stack.user_conn(QUALITY), stack.user_conn(OPERATOR)
    try:
        res = r.execute(RELEASE, [serial]).fetchone()[0]
        evidence.step("quality connection", "release_pack ran, not committed", result=res)
        fut = run_in_thread(lambda: call_sql(h, OPEN_HOLD, [serial, REASON]))
        barrier = wait_blocked_or_done(admin, h.info.backend_pid, fut)
        evidence.step("operator connection", f"open_hold started: {barrier}")
        r.commit()
        evidence.step("quality connection", "COMMIT")
        out = fut.result(timeout=15)
        evidence.step("operator connection", "returned", **out)
    finally:
        r.close()
        h.close()
    state = pack_state(admin, serial)
    evidence.step("database", "checked", state=state)
    evidence.fact("final_state", state)
    assert out["ok"] is True, f"the hold must be accepted before shipment: {out}"
    assert state["status"] == "on_hold" and state["release_eligible"] is False, (
        f"hold opened after release left the pack shippable: {state}")
