#!/usr/bin/env python3
"""Turn a CI evidence bundle into site/data.js for the demo page. Every value shown on the page
comes from these recorded runs; the labels around them are written here.

Usage: uv run python scripts/build_page_data.py <evidence_dir> <commit_sha> <run_url> <run_number>
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EV, SHA, RUN_URL, RUN_NO = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
REPO = "https://github.com/fred1433/upgrade-energy-release-gate"


def load(p):
    return json.loads((EV / p).read_text())


def line_of(path, pattern):
    for i, l in enumerate((ROOT / path).read_text().splitlines(), 1):
        if re.search(pattern, l):
            return i
    raise SystemExit(f"{pattern} not found in {path}")


def src(path, pattern=None):
    anchor = f"#L{line_of(path, pattern)}" if pattern else ""
    return f"{REPO}/blob/{SHA}/{path}{anchor}"


def test_link(nodeid):
    path, name = nodeid.split("::")
    return src(path, rf"def {name}\(")


def steps(rec, actor=None, text=None):
    return [s for s in rec["steps"] if (actor is None or s["actor"] == actor) and (text is None or s["text"].startswith(text))]


def short(key):
    return key.split("-")[0]


# ---------------------------------------------------------------- scenario 1: lost reply
def lost_reply(rec):
    cap = steps(rec, "station", "captured")[0]["data"]
    p = cap["payload"]
    lost = steps(rec, "network", "reply_lost")[0]["data"]
    no_reply = steps(rec, "station", "no_reply")[0]["data"]
    checks = steps(rec, "database", "checked")
    first_rows = checks[0]["data"]["rows"]
    second = steps(rec, "station", "reply")[0]["data"]
    final_rows = checks[-1]["data"]["rows"]
    t = {s["text"] + str(i): s["t_ms"] for i, s in enumerate(rec["steps"])}
    return {
        "outcome": rec["outcome"],
        "failure": rec["failure"],
        "beats": [
            {"t": steps(rec, "station", "sent")[0]["t_ms"],
             "value": f"{float(p['p_voltage_v']):.3f} V, {float(p['p_acir_mohm']):.2f} mΩ",
             "detail": f"key {short(cap['operation_key'])}…, stored in the outbox first",
             "shared": f"{float(p['p_voltage_v']):.3f} V, {float(p['p_acir_mohm']):.2f} mΩ",
             "shared_detail": "key and measurement stored in the outbox first"},
            {"t": steps(rec, "network", "reply_lost")[0]["t_ms"],
             "value": f"measurement {first_rows[0]['id']} recorded",
             "detail": f"server answered {lost['server_status'].replace('HTTP/1.1 ', 'HTTP ')}",
             "shared": "measurement recorded",
             "shared_detail": f"server answered {lost['server_status'].replace('HTTP/1.1 ', 'HTTP ')}; one row, checked independently"},
            {"t": steps(rec, "station", "no_reply")[0]["t_ms"],
             "value": "no answer at the bench",
             "detail": f"{no_reply['error'].split(':', 1)[1].strip()} Entry kept as pending.",
             "shared": "no answer at the bench",
             "shared_detail": f"{no_reply['error'].split(':', 1)[1].strip()} Entry kept as pending."},
            {"t": steps(rec, "station", "sent")[1]["t_ms"],
             "value": "same key, same payload",
             "detail": f"attempt {steps(rec, 'station', 'sent')[1]['data']['attempt']}",
             "shared": "same key, same payload",
             "shared_detail": f"attempt {steps(rec, 'station', 'sent')[1]['data']['attempt']}"},
            {"t": steps(rec, "station", "reply")[0]["t_ms"],
             "value": f"{second['body'].get('outcome')}, measurement {second['body'].get('measurement_id')}",
             "detail": f"HTTP {second['http_status']}"},
        ],
        "rows": [{"id": r["id"], "key": short(r["operation_key"]), "acir": r["acir_mohm"], "v": r["voltage_v"]}
                 for r in final_rows],
        "serial": rec["facts"].get("serial"),
    }


# ---------------------------------------------------------------- scenario 2: hold against release
def race(rec, first, variant=None):
    s = rec["steps"]
    returned = [x for x in s if x["text"] == "returned"][0]["data"]
    started = [x for x in s if "started:" in x["text"]][0]
    state = rec["facts"]["final_state"]
    if first == "hold":
        beats = [
            {"who": "Operator", "value": "opens a hold", "detail": "not committed yet"},
            {"who": "Quality", "value": "starts the release", "detail": started["text"].split(": ", 1)[1]},
            {"who": "Operator", "value": "hold commits", "detail": "COMMIT"},
            {"who": "Quality", "value": ("release refused" if not returned["ok"] else "release goes through"),
             "detail": returned.get("message") or returned.get("result", {}).get("outcome")},
        ]
    else:
        beats = [
            {"who": "Quality", "value": "releases the pack", "detail": "not committed yet"},
            {"who": "Operator", "value": "opens a hold", "detail": started["text"].split(": ", 1)[1]},
            {"who": "Quality", "value": "release commits", "detail": "COMMIT"},
            {"who": "Operator", "value": ("hold opened" if returned["ok"] else "hold refused"),
             "detail": returned.get("message") or "hold_opened"},
        ]
    if variant == "v2a_release_without_lock":
        # Without FOR UPDATE, release_pack reads the holds first (none committed yet) and only then
        # blocks, at its UPDATE of the pack row. The recorded wait is that UPDATE.
        beats[1]["value"] = "already read the holds: none"
        beats[1]["detail"] = "then waits only at its UPDATE (" + beats[1]["detail"] + ")"
    for b, x in zip(beats, [x for x in s if x["actor"] != "database"]):
        b["t"] = x["t_ms"]
    return {"outcome": rec["outcome"], "failure": rec["failure"], "beats": beats, "state": state,
            "serial": rec["facts"].get("serial")}


# ---------------------------------------------------------------- family 3
def lift_calls():
    out = {}
    for name in ("test_anon_is_refused", "test_operator_is_refused_with_explicit_result", "test_quality_lifts_the_hold"):
        r = load(f"run/{name}.json")
        d = r["steps"][0]["data"]
        out[name] = {"status": d["status"], "message": (d["body"] or {}).get("message") if isinstance(d["body"], dict) else None,
                     "row": d["row"]["status"], "outcome": r["outcome"]}
    dw = load("run/test_direct_write_is_refused.json")["steps"]
    out["direct_write"] = [{"as": x["data"]["request"]["as"], "status": x["data"]["status"],
                            "prefer": x["data"]["request"].get("prefer")} for x in dw]
    story = load("variants/v3b_policy_filters_silently/test_direct_write_is_refused.json")
    st = story["steps"][0]["data"]
    out["silent"] = {"request": f"{st['request']['method']} {st['request']['path']}",
                     "body": st["request"]["body"], "as": st["request"]["as"], "prefer": st["request"].get("prefer"),
                     "status": st["status"], "response_body": st["body"], "client": st["client"],
                     "row": st["row"]["status"], "failure": story["failure"]}
    col = load("variants/v3_column_revoke/test_direct_write_is_refused.json")
    out["column_revoke"] = {"status": col["steps"][0]["data"]["status"], "row": col["steps"][0]["data"]["row"]["status"],
                            "failure": col["failure"]}
    return out


def tap(name):
    lines = (EV / f"run/pgtap/{name}.tap").read_text().splitlines()
    return [l for l in lines if l.startswith(("ok", "not ok"))]


def main():
    variants = {v["name"]: v for v in load("variants/summary.json")}
    junit = ET.parse(EV / "run/junit.xml").getroot()
    suite = junit if junit.tag == "testsuite" else junit.find("testsuite")
    pgtap_total = sum(len(tap(f.stem)) for f in (EV / "run/pgtap").glob("*.tap"))
    pgtap_ok = sum(1 for f in (EV / "run/pgtap").glob("*.tap") for l in tap(f.stem) if l.startswith("ok"))
    versions = dict(l.split("=", 1) for l in (EV / "run/versions.txt").read_text().splitlines() if "=" in l)
    drill = load("restore/drill.json")
    restore_tests = sorted((EV / "restore/tests").glob("*.json"))

    data = {
        "commit": SHA, "commit_short": SHA[:7], "run_url": RUN_URL, "run_number": RUN_NO, "repo": REPO,
        "finished_at": versions.get("finished_at"),
        "versions": versions,
        "counts": {"pytest": int(suite.get("tests")), "pytest_failed": int(suite.get("failures")) + int(suite.get("errors")),
                   "pgtap": pgtap_total, "pgtap_ok": pgtap_ok,
                   "variants": len(variants), "variants_caught": sum(v["detected"] for v in variants.values()),
                   "restore": len(restore_tests),
                   "restore_passed": sum(load(f"restore/tests/{p.name}")["outcome"] == "passed" for p in restore_tests)},
        "lost_reply": {
            "current": lost_reply(load("run/test_lost_reply_is_recorded_once.json")),
            "broken": lost_reply(load("variants/v1_retry_writes_twice/test_lost_reply_is_recorded_once.json")),
            "test": test_link("tests/test_one_measurement.py::test_lost_reply_is_recorded_once"),
            "variant": src("variants/v1_retry_writes_twice.sql"),
            "function": src("supabase/migrations/20261022120000_release_gate.sql", r"create function public\.record_measurement"),
            "station": src("workstation/station.py", r"def flush"),
            "proxy": src("tests/support.py", r"class LossyProxy"),
        },
        "race": {
            "hold": {"current": race(load("run/test_hold_first_then_release_is_refused.json"), "hold"),
                     "broken": race(load("variants/v2a_release_without_lock/test_hold_first_then_release_is_refused.json"), "hold", "v2a_release_without_lock"),
                     "test": test_link("tests/test_hold_release_race.py::test_hold_first_then_release_is_refused"),
                     "variant": src("variants/v2a_release_without_lock.sql"),
                     "variant_label": "release reads the holds without locking the pack"},
            "release": {"current": race(load("run/test_release_first_then_hold_withdraws_eligibility.json"), "release"),
                        "broken": race(load("variants/v2b_hold_leaves_eligibility/test_release_first_then_hold_withdraws_eligibility.json"), "release"),
                        "test": test_link("tests/test_hold_release_race.py::test_release_first_then_hold_withdraws_eligibility"),
                        "variant": src("variants/v2b_hold_leaves_eligibility.sql"),
                        "variant_label": "the hold leaves the pack row untouched"},
            "function": src("supabase/migrations/20261022120000_release_gate.sql", r"create function public\.release_pack"),
        },
        "lift": {**lift_calls(),
                 "tests": test_link("tests/test_lift_hold_api.py::test_operator_is_refused_with_explicit_result"),
                 "direct_test": test_link("tests/test_lift_hold_api.py::test_direct_write_is_refused"),
                 "pgtap": src("supabase/tests/02_lift_hold.sql"),
                 "function": src("supabase/migrations/20261022120000_release_gate.sql", r"create function public\.lift_hold"),
                 "variant_silent": src("variants/v3b_policy_filters_silently.sql"),
                 "variant_column": src("variants/v3_column_revoke.sql"),
                 "variant_everyone": variants["v3c_refuse_everyone"]["failing_line"]},
        "audit": {"tap": tap("03_audit"), "pgtap": src("supabase/tests/03_audit.sql"),
                  "trigger": src("supabase/migrations/20261022120000_release_gate.sql", r"create function mes_private\.write_audit"),
                  "variant": src("variants/v4_default_grants_on_audit.sql"),
                  "variant_line": variants["v4_default_grants_on_audit"]["failing_line"],
                  "service_role_test": test_link("tests/test_service_role.py::test_service_role_bypasses_rls_but_not_privileges")},
        "restore": {"rows": drill["dataset_rows"], "dump_bytes": drill["dump_bytes"], "seconds": drill["seconds"],
                    "versions": drill["versions"], "not_covered": drill["not_covered"],
                    "script": src("scripts/restore_drill.py"), "tests": src("tests_restore/test_restore_drill.py"),
                    "fix": src("drill/restore_default_acl.sql"),
                    "variant_line": variants["v5_restore_reapplies_default_grants"]["failing_line"]},
        "traveler_test": test_link("tests/test_contract.py::test_traveler_path_measurement_before_rework_is_not_a_retest"),
        "variants": [{"name": v["name"], "family": v["family"], "line": v["failing_line"], "detected": v["detected"]}
                     for v in variants.values()],
    }
    (ROOT / "site" / "data.js").write_text("window.EVIDENCE = " + json.dumps(data, indent=1, ensure_ascii=False) + ";\n")
    print("site/data.js written:", data["counts"])


if __name__ == "__main__":
    main()
