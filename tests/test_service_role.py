"""service_role bypasses RLS, not privileges or triggers; the effective identity of a request is recorded."""
from tests.support import QUALITY, new_pack


def test_service_role_bypasses_rls_but_not_privileges(stack, admin, evidence):
    serial = new_pack(admin)
    r = stack.api("POST", "/rest/v1/rpc/open_hold", "operator",
                  {"p_serial": serial, "p_reason": "Visual check (fictional)", "p_workstation": "WS-TEST-02"})
    hold_id = r["body"]["hold_id"]

    calls = {
        "operator reads audit_log": stack.api("GET", "/rest/v1/audit_log?select=id&limit=1", "operator"),
        "service_role reads audit_log": stack.api("GET", "/rest/v1/audit_log?select=id&limit=1", "service_role"),
        "service_role patches a hold": stack.api("PATCH", f"/rest/v1/holds?id=eq.{hold_id}", "service_role",
                                                 {"status": "lifted"}),
        "service_role deletes audit rows": stack.api("DELETE", "/rest/v1/audit_log?id=gt.0", "service_role"),
        "service_role calls lift_hold": stack.api("POST", "/rest/v1/rpc/lift_hold", "service_role",
                                                  {"p_hold_id": hold_id, "p_note": "x", "p_workstation": "WS-QA-01"}),
    }
    for label, resp in calls.items():
        evidence.step("api", label, **resp)

    assert calls["operator reads audit_log"]["body"] == [], "RLS: only quality reads the audit log"
    assert len(calls["service_role reads audit_log"]["body"]) == 1, "service_role bypasses RLS on reads"
    for label in ("service_role patches a hold", "service_role deletes audit rows", "service_role calls lift_hold"):
        assert calls[label]["status"] in (401, 403) and calls[label]["body"]["code"] == "42501", (
            f"{label}: expected a privilege refusal, got HTTP {calls[label]['status']}")
    assert admin.execute("select status from public.holds where id = %s", [hold_id]).fetchone()[0] == "open"


def test_effective_identity_is_recorded(stack, admin, evidence):
    serial = new_pack(admin)
    hold_id = stack.api("POST", "/rest/v1/rpc/open_hold", "operator",
                        {"p_serial": serial, "p_reason": "Visual check (fictional)",
                         "p_workstation": "WS-TEST-02"})["body"]["hold_id"]
    stack.api("POST", "/rest/v1/rpc/lift_hold", "quality",
              {"p_hold_id": hold_id, "p_note": "Checked (fictional)", "p_workstation": "WS-QA-01"})
    cur = admin.execute(
        "select actor::text, request_role, db_role, workstation_id, action, before ->> 'status', after ->> 'status' "
        "from public.audit_log where table_name = 'holds' and row_key = %s order by id", [str(hold_id)])
    rows = cur.fetchall()
    evidence.step("database", "audit rows for the hold", rows=rows)
    assert rows[-1] == (QUALITY, "authenticated", "authenticated", "WS-QA-01", "update", "open", "lifted")
