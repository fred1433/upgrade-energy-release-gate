window.EVIDENCE = {
 "commit": "localtest",
 "commit_short": "localte",
 "run_url": "https://example.invalid",
 "run_number": "0",
 "repo": "https://github.com/fred1433/upgrade-energy-release-gate",
 "finished_at": "2026-10-22T13:10:42Z",
 "versions": {
  "commit": "HEAD",
  "supabase_cli": "2.120.0",
  "postgres": "17.11",
  "python": "3.12.13",
  "finished_at": "2026-10-22T13:10:42Z"
 },
 "counts": {
  "pytest": 16,
  "pytest_failed": 0,
  "pgtap": 44,
  "pgtap_ok": 44,
  "variants": 9,
  "variants_caught": 9,
  "restore": 7,
  "restore_passed": 7
 },
 "lost_reply": {
  "current": {
   "outcome": "passed",
   "failure": null,
   "beats": [
    {
     "t": 12.2,
     "value": "22.860 V, 48.60 mΩ",
     "detail": "key 05794792…, stored in the outbox first"
    },
    {
     "t": 57.0,
     "value": "measurement 19 recorded",
     "detail": "server answered HTTP 200 OK"
    },
    {
     "t": 57.0,
     "value": "no answer at the bench",
     "detail": "Server disconnected without sending a response. Entry kept as pending."
    },
    {
     "t": 60.3,
     "value": "same key, same payload",
     "detail": "attempt 2"
    },
    {
     "t": 72.1,
     "value": "replayed, measurement 19",
     "detail": "HTTP 200"
    }
   ],
   "rows": [
    {
     "id": 19,
     "key": "05794792",
     "acir": "48.60",
     "v": "22.860"
    }
   ],
   "serial": "DEMO-6S1P-3B4245"
  },
  "broken": {
   "outcome": "failed",
   "failure": "one battery test, 2 measurement rows\nassert 2 == 1\n +  where 2 = len([{'acir_mohm': '48.60', 'cycle': 1, 'id': 1, 'operation_key': '7e4ef3ee-8d4a-45ef-a290-a8e57c02d1a2', ...}, {'acir_mohm': '48.60', 'cycle': 1, 'id': 2, 'operation_key': '7e4ef3ee-8d4a-45ef-a290-a8e57c02d1a2', ...}])",
   "beats": [
    {
     "t": 11.9,
     "value": "22.860 V, 48.60 mΩ",
     "detail": "key 7e4ef3ee…, stored in the outbox first"
    },
    {
     "t": 115.8,
     "value": "measurement 1 recorded",
     "detail": "server answered HTTP 200 OK"
    },
    {
     "t": 115.8,
     "value": "no answer at the bench",
     "detail": "Server disconnected without sending a response. Entry kept as pending."
    },
    {
     "t": 117.9,
     "value": "same key, same payload",
     "detail": "attempt 2"
    },
    {
     "t": 131.6,
     "value": "recorded, measurement 2",
     "detail": "HTTP 200"
    }
   ],
   "rows": [
    {
     "id": 1,
     "key": "7e4ef3ee",
     "acir": "48.60",
     "v": "22.860"
    },
    {
     "id": 2,
     "key": "7e4ef3ee",
     "acir": "48.60",
     "v": "22.860"
    }
   ],
   "serial": "DEMO-6S1P-25F1E3"
  },
  "test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/tests/test_one_measurement.py#L17",
  "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/variants/v1_retry_writes_twice.sql",
  "function": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/supabase/migrations/20261022120000_release_gate.sql#L289",
  "station": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/workstation/station.py#L96",
  "proxy": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/tests/support.py#L138"
 },
 "race": {
  "hold": {
   "current": {
    "outcome": "passed",
    "failure": null,
    "beats": [
     {
      "who": "Operator",
      "value": "opens a hold",
      "detail": "not committed yet",
      "t": 131.0
     },
     {
      "who": "Quality",
      "value": "starts the release",
      "detail": "waiting on a lock (transactionid)",
      "t": 163.4
     },
     {
      "who": "Operator",
      "value": "hold commits",
      "detail": "COMMIT",
      "t": 175.5
     },
     {
      "who": "Quality",
      "value": "release refused",
      "detail": "Pack DEMO-6S1P-169605 has an open quality hold.",
      "t": 187.4
     }
    ],
    "state": {
     "status": "on_hold",
     "release_eligible": false,
     "cycle": 1,
     "open_holds": 1
    }
   },
   "broken": {
    "outcome": "failed",
    "failure": "pack released while a hold is open: {'status': 'released', 'release_eligible': False, 'cycle': 1, 'open_holds': 1}\nassert not ('released' == 'released'\n  \n    released and 1 > 0)",
    "beats": [
     {
      "who": "Operator",
      "value": "opens a hold",
      "detail": "not committed yet",
      "t": 500.8
     },
     {
      "who": "Quality",
      "value": "starts the release",
      "detail": "waiting on a lock (transactionid)",
      "t": 531.0
     },
     {
      "who": "Operator",
      "value": "hold commits",
      "detail": "COMMIT",
      "t": 538.9
     },
     {
      "who": "Quality",
      "value": "release goes through",
      "detail": "released",
      "t": 538.9
     }
    ],
    "state": {
     "status": "released",
     "release_eligible": false,
     "cycle": 1,
     "open_holds": 1
    }
   },
   "test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/tests/test_hold_release_race.py#L18",
   "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/variants/v2a_release_without_lock.sql",
   "variant_label": "release reads the holds without locking the pack"
  },
  "release": {
   "current": {
    "outcome": "passed",
    "failure": null,
    "beats": [
     {
      "who": "Quality",
      "value": "releases the pack",
      "detail": "not committed yet",
      "t": 78.6
     },
     {
      "who": "Operator",
      "value": "opens a hold",
      "detail": "waiting on a lock (transactionid)",
      "t": 197.8
     },
     {
      "who": "Quality",
      "value": "release commits",
      "detail": "COMMIT",
      "t": 206.6
     },
     {
      "who": "Operator",
      "value": "hold opened",
      "detail": "hold_opened",
      "t": 213.6
     }
    ],
    "state": {
     "status": "on_hold",
     "release_eligible": false,
     "cycle": 1,
     "open_holds": 1
    }
   },
   "broken": {
    "outcome": "failed",
    "failure": "hold opened after release left the pack shippable: {'status': 'released', 'release_eligible': True, 'cycle': 1, 'open_holds': 1}\nassert ('released' == 'on_hold'\n  \n  - on_hold\n  + released)",
    "beats": [
     {
      "who": "Quality",
      "value": "releases the pack",
      "detail": "not committed yet",
      "t": 101.9
     },
     {
      "who": "Operator",
      "value": "opens a hold",
      "detail": "waiting on a lock (transactionid)",
      "t": 114.4
     },
     {
      "who": "Quality",
      "value": "release commits",
      "detail": "COMMIT",
      "t": 117.5
     },
     {
      "who": "Operator",
      "value": "hold opened",
      "detail": "hold_opened",
      "t": 119.7
     }
    ],
    "state": {
     "status": "released",
     "release_eligible": true,
     "cycle": 1,
     "open_holds": 1
    }
   },
   "test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/tests/test_hold_release_race.py#L42",
   "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/variants/v2b_hold_leaves_eligibility.sql",
   "variant_label": "the hold leaves the pack row untouched"
  },
  "function": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/supabase/migrations/20261022120000_release_gate.sql#L404"
 },
 "lift": {
  "test_anon_is_refused": {
   "status": 401,
   "message": "permission denied for function lift_hold",
   "row": "open",
   "outcome": "passed"
  },
  "test_operator_is_refused_with_explicit_result": {
   "status": 403,
   "message": "Only quality can lift a hold. This account is operator.",
   "row": "open",
   "outcome": "passed"
  },
  "test_quality_lifts_the_hold": {
   "status": 200,
   "message": null,
   "row": "lifted",
   "outcome": "passed"
  },
  "direct_write": [
   {
    "as": "operator",
    "status": 403,
    "prefer": "return=minimal"
   },
   {
    "as": "operator",
    "status": 403,
    "prefer": "return=representation"
   },
   {
    "as": "quality",
    "status": 403,
    "prefer": "return=minimal"
   },
   {
    "as": "quality",
    "status": 403,
    "prefer": "return=representation"
   }
  ],
  "silent": {
   "request": "PATCH /rest/v1/holds?id=eq.1",
   "body": {
    "status": "lifted"
   },
   "as": "operator",
   "prefer": "return=minimal",
   "status": 204,
   "response_body": null,
   "client": "Hold lifted",
   "row": "open",
   "failure": "operator direct write answered HTTP 204 without an error; hold row is now 'open'; a screen that only checks the error shows 'Hold lifted'\nassert 204 in (401, 403)"
  },
  "column_revoke": {
   "status": 204,
   "row": "lifted",
   "failure": "operator direct write answered HTTP 204 without an error; hold row is now 'lifted'; a screen that only checks the error shows 'Hold lifted'\nassert 204 in (401, 403)"
  },
  "tests": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/tests/test_lift_hold_api.py#L43",
  "direct_test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/tests/test_lift_hold_api.py#L58",
  "pgtap": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/supabase/tests/02_lift_hold.sql",
  "function": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/supabase/migrations/20261022120000_release_gate.sql#L454",
  "variant_silent": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/variants/v3b_policy_filters_silently.sql",
  "variant_column": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/variants/v3_column_revoke.sql",
  "variant_everyone": "E       AssertionError: quality must be able to lift a hold: HTTP 403 {'code': 'PT403', 'details': None, 'hint': None, 'message': 'Holds cannot be lifted from the API.'}"
 },
 "audit": {
  "tap": [
   "ok 1 - authenticated cannot INSERT into audit_log",
   "ok 2 - authenticated cannot UPDATE audit_log",
   "ok 3 - authenticated cannot DELETE from audit_log",
   "ok 4 - authenticated cannot TRUNCATE audit_log",
   "ok 5 - service_role cannot INSERT into audit_log",
   "ok 6 - service_role cannot UPDATE audit_log",
   "ok 7 - service_role cannot DELETE from audit_log",
   "ok 8 - service_role cannot TRUNCATE audit_log",
   "ok 9 - ADMIN: one audit row with actor from the JWT, workstation, operation key, values and server time",
   "ok 10 - ADMIN: the pack change keeps its before and after values",
   "ok 11 - operator release refused",
   "ok 12 - ADMIN: the refusal is not a durable audit event",
   "ok 13 - ADMIN: a rolled-back hold leaves no audit trace",
   "ok 14 - ADMIN: the table owner can still disable the append-only trigger and delete (documented limit, no hash chain)"
  ],
  "pgtap": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/supabase/tests/03_audit.sql",
  "trigger": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/supabase/migrations/20261022120000_release_gate.sql#L232",
  "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/variants/v4_default_grants_on_audit.sql",
  "variant_line": "# Failed test 5: \"service_role cannot INSERT into audit_log\"",
  "service_role_test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/tests/test_service_role.py#L5"
 },
 "restore": {
  "rows": {
   "public.workstations": 3,
   "public.test_limits": 1,
   "public.packs": 417,
   "public.measurements": 414,
   "public.holds": 55,
   "public.audit_log": 1262,
   "mes_private.staff": 3,
   "mes_private.staff_workstations": 5
  },
  "dump_bytes": {
   "roles.sql": 536,
   "schema.sql": 30404,
   "data.sql": 756785
  },
  "seconds": {
   "backup": 11.03,
   "fresh_stack_start": 33.26,
   "restore": 1.14,
   "checks": 5.11
  },
  "versions": {
   "postgres": "17.11",
   "supabase_cli": "2.120.0"
  },
  "not_covered": [
   "Storage objects",
   "Auth and project configuration",
   "Edge Functions",
   "secrets"
  ],
  "script": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/scripts/restore_drill.py",
  "tests": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/tests_restore/test_restore_drill.py",
  "fix": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/drill/restore_default_acl.sql",
  "variant_line": "E       AssertionError: rights changed by the restore (584 differences), e.g. table_grants: gained authenticated:public.holds:UPDATE; table_grants: gained service_role:public.audit_log:INSERT; table_grants: gained anon:public.audit_log:DELETE"
 },
 "traveler_test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/localtest/tests/test_contract.py#L88",
 "variants": [
  {
   "name": "v1_retry_writes_twice",
   "family": 1,
   "line": "E       AssertionError: one battery test, 2 measurement rows",
   "detected": true
  },
  {
   "name": "v1b_upsert_overwrites",
   "family": 1,
   "line": "E       AssertionError: same key with different content was accepted: HTTP 200, stored ACIR now 51.20",
   "detected": true
  },
  {
   "name": "v2a_release_without_lock",
   "family": 2,
   "line": ">       assert not (state[\"status\"] == \"released\" and state[\"open_holds\"] > 0), f\"pack released while a hold is open: {state}\"",
   "detected": true
  },
  {
   "name": "v2b_hold_leaves_eligibility",
   "family": 2,
   "line": "f\"hold opened after release left the pack shippable: {state}\")",
   "detected": true
  },
  {
   "name": "v3_column_revoke",
   "family": 3,
   "line": "E               AssertionError: operator direct write answered HTTP 204 without an error; hold row is now 'lifted'; a screen that only checks the error shows 'Hold lifted'",
   "detected": true
  },
  {
   "name": "v3b_policy_filters_silently",
   "family": 3,
   "line": "E               AssertionError: operator direct write answered HTTP 204 without an error; hold row is now 'open'; a screen that only checks the error shows 'Hold lifted'",
   "detected": true
  },
  {
   "name": "v3c_refuse_everyone",
   "family": 3,
   "line": "E       AssertionError: quality must be able to lift a hold: HTTP 403 {'code': 'PT403', 'details': None, 'hint': None, 'message': 'Holds cannot be lifted from the API.'}",
   "detected": true
  },
  {
   "name": "v4_default_grants_on_audit",
   "family": 4,
   "line": "# Failed test 5: \"service_role cannot INSERT into audit_log\"",
   "detected": true
  },
  {
   "name": "v5_restore_reapplies_default_grants",
   "family": 5,
   "line": "E       AssertionError: rights changed by the restore (584 differences), e.g. table_grants: gained authenticated:public.holds:UPDATE; table_grants: gained service_role:public.audit_log:INSERT; table_grants: gained anon:public.audit_log:DELETE",
   "detected": true
  }
 ]
};
