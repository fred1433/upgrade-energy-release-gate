"""Family 3: who can lift a hold, through the real API. Request, response, what a client would show,
and the real row state are all recorded."""
import pytest

from tests.support import new_pack

ADMIN_ROW = "select status, lifted_by::text from public.holds where id = %s"


@pytest.fixture
def held(stack, admin):
    serial = new_pack(admin)
    r = stack.api("POST", "/rest/v1/rpc/open_hold", "operator",
                  {"p_serial": serial, "p_reason": "ACIR above limit (fictional)", "p_workstation": "WS-TEST-02"})
    assert r["status"] == 200, r
    return r["body"]["hold_id"]


def ui_that_only_checks_the_error(resp):
    """What a screen shows if it only looks at `error`, as supabase-js callers often do."""
    if resp["status"] >= 400:
        return f"Refused: {resp['body'].get('message')}"
    return "Hold lifted"


def row(admin, hold_id):
    status, lifted_by = admin.execute(ADMIN_ROW, [hold_id]).fetchone()
    return {"status": status, "lifted_by": lifted_by}


def lift(stack, who, hold_id, station):
    return stack.api("POST", "/rest/v1/rpc/lift_hold", who,
                     {"p_hold_id": hold_id, "p_note": "Retest within limits (fictional)", "p_workstation": station})


def test_anon_is_refused(stack, admin, evidence, held):
    r = lift(stack, "anon", held, "WS-QA-01")
    evidence.step("api", "response", **r, client=ui_that_only_checks_the_error(r), row=row(admin, held))
    assert r["status"] == 401 and r["body"]["code"] == "42501"
    assert row(admin, held)["status"] == "open"


def test_operator_is_refused_with_explicit_result(stack, admin, evidence, held):
    r = lift(stack, "operator", held, "WS-TEST-02")
    evidence.step("api", "response", **r, client=ui_that_only_checks_the_error(r), row=row(admin, held))
    assert r["status"] == 403 and r["body"]["code"] == "PT403"
    assert r["body"]["message"] == "Only quality can lift a hold. This account is operator."
    assert row(admin, held)["status"] == "open"


def test_quality_lifts_the_hold(stack, admin, evidence, held):
    r = lift(stack, "quality", held, "WS-QA-01")
    evidence.step("api", "response", **r, client=ui_that_only_checks_the_error(r), row=row(admin, held))
    assert r["status"] == 200, f"quality must be able to lift a hold: HTTP {r['status']} {r['body']}"
    assert row(admin, held) == {"status": "lifted", "lifted_by": "00000000-0000-4000-a000-000000000002"}


def test_direct_write_is_refused(stack, admin, evidence, held):
    for who in ("operator", "quality"):
        for prefer in ("return=minimal", "return=representation"):
            r = stack.api("PATCH", f"/rest/v1/holds?id=eq.{held}", who, {"status": "lifted"}, prefer=prefer)
            now = row(admin, held)
            shown = ui_that_only_checks_the_error(r)
            evidence.step("api", "direct_write", **r, client=shown, row=now)
            assert r["status"] in (401, 403), (
                f"{who} direct write answered HTTP {r['status']} without an error; hold row is now "
                f"'{now['status']}'; a screen that only checks the error shows '{shown}'")
            assert r["body"]["code"] == "42501"
            assert now["status"] == "open"
