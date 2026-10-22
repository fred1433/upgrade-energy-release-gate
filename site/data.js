window.EVIDENCE = {
 "commit": "e4954c89e8647c27bbbe7f2c9576d16fcc062606",
 "commit_short": "e4954c8",
 "run_url": "https://github.com/fred1433/upgrade-energy-release-gate/actions/runs/39785942036",
 "run_number": "2",
 "repo": "https://github.com/fred1433/upgrade-energy-release-gate",
 "finished_at": "2026-10-22T13:25:24Z",
 "versions": {
  "commit": "e4954c89e8647c27bbbe7f2c9576d16fcc062606",
  "supabase_cli": "2.120.0",
  "postgres": "17.11",
  "python": "3.12.3",
  "finished_at": "2026-10-22T13:25:24Z"
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
     "t": 8.1,
     "value": "22.860 V, 48.60 mΩ",
     "detail": "key f1978a77…, stored in the outbox first"
    },
    {
     "t": 29.8,
     "value": "measurement 19 recorded",
     "detail": "server answered HTTP 200 OK"
    },
    {
     "t": 29.8,
     "value": "no answer at the bench",
     "detail": "Server disconnected without sending a response. Entry kept as pending."
    },
    {
     "t": 30.7,
     "value": "same key, same payload",
     "detail": "attempt 2"
    },
    {
     "t": 58.3,
     "value": "replayed, measurement 19",
     "detail": "HTTP 200"
    }
   ],
   "rows": [
    {
     "id": 19,
     "key": "f1978a77",
     "acir": "48.60",
     "v": "22.860"
    }
   ],
   "serial": "DEMO-6S1P-BFE655"
  },
  "broken": {
   "outcome": "failed",
   "failure": "one battery test, 2 measurement rows\nassert 2 == 1\n +  where 2 = len([{'acir_mohm': '48.60', 'cycle': 1, 'id': 1, 'operation_key': '4d379796-448e-44ec-8aaa-d7c564dcc8fa', ...}, {'acir_mohm': '48.60', 'cycle': 1, 'id': 2, 'operation_key': '4d379796-448e-44ec-8aaa-d7c564dcc8fa', ...}])",
   "beats": [
    {
     "t": 7.7,
     "value": "22.860 V, 48.60 mΩ",
     "detail": "key 4d379796…, stored in the outbox first"
    },
    {
     "t": 74.2,
     "value": "measurement 1 recorded",
     "detail": "server answered HTTP 200 OK"
    },
    {
     "t": 74.2,
     "value": "no answer at the bench",
     "detail": "Server disconnected without sending a response. Entry kept as pending."
    },
    {
     "t": 75.2,
     "value": "same key, same payload",
     "detail": "attempt 2"
    },
    {
     "t": 97.2,
     "value": "recorded, measurement 2",
     "detail": "HTTP 200"
    }
   ],
   "rows": [
    {
     "id": 1,
     "key": "4d379796",
     "acir": "48.60",
     "v": "22.860"
    },
    {
     "id": 2,
     "key": "4d379796",
     "acir": "48.60",
     "v": "22.860"
    }
   ],
   "serial": "DEMO-6S1P-CA1FC9"
  },
  "test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/tests/test_one_measurement.py#L17",
  "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/variants/v1_retry_writes_twice.sql",
  "function": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/supabase/migrations/20261022120000_release_gate.sql#L289",
  "station": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/workstation/station.py#L96",
  "proxy": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/tests/support.py#L138"
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
      "t": 44.0
     },
     {
      "who": "Quality",
      "value": "starts the release",
      "detail": "waiting on a lock (transactionid)",
      "t": 52.0
     },
     {
      "who": "Operator",
      "value": "hold commits",
      "detail": "COMMIT",
      "t": 52.3
     },
     {
      "who": "Quality",
      "value": "release refused",
      "detail": "Pack DEMO-6S1P-3FD504 has an open quality hold.",
      "t": 53.1
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
      "t": 91.0
     },
     {
      "who": "Quality",
      "value": "starts the release",
      "detail": "waiting on a lock (transactionid)",
      "t": 98.7
     },
     {
      "who": "Operator",
      "value": "hold commits",
      "detail": "COMMIT",
      "t": 99.0
     },
     {
      "who": "Quality",
      "value": "release goes through",
      "detail": "released",
      "t": 100.7
     }
    ],
    "state": {
     "status": "released",
     "release_eligible": false,
     "cycle": 1,
     "open_holds": 1
    }
   },
   "test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/tests/test_hold_release_race.py#L18",
   "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/variants/v2a_release_without_lock.sql",
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
      "t": 44.1
     },
     {
      "who": "Operator",
      "value": "opens a hold",
      "detail": "waiting on a lock (transactionid)",
      "t": 51.6
     },
     {
      "who": "Quality",
      "value": "release commits",
      "detail": "COMMIT",
      "t": 52.0
     },
     {
      "who": "Operator",
      "value": "hold opened",
      "detail": "hold_opened",
      "t": 54.8
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
      "t": 107.6
     },
     {
      "who": "Operator",
      "value": "opens a hold",
      "detail": "waiting on a lock (transactionid)",
      "t": 115.3
     },
     {
      "who": "Quality",
      "value": "release commits",
      "detail": "COMMIT",
      "t": 115.6
     },
     {
      "who": "Operator",
      "value": "hold opened",
      "detail": "hold_opened",
      "t": 117.0
     }
    ],
    "state": {
     "status": "released",
     "release_eligible": true,
     "cycle": 1,
     "open_holds": 1
    }
   },
   "test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/tests/test_hold_release_race.py#L42",
   "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/variants/v2b_hold_leaves_eligibility.sql",
   "variant_label": "the hold leaves the pack row untouched"
  },
  "function": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/supabase/migrations/20261022120000_release_gate.sql#L404"
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
  "tests": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/tests/test_lift_hold_api.py#L43",
  "direct_test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/tests/test_lift_hold_api.py#L58",
  "pgtap": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/supabase/tests/02_lift_hold.sql",
  "function": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/supabase/migrations/20261022120000_release_gate.sql#L454",
  "variant_silent": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/variants/v3b_policy_filters_silently.sql",
  "variant_column": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/variants/v3_column_revoke.sql",
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
  "pgtap": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/supabase/tests/03_audit.sql",
  "trigger": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/supabase/migrations/20261022120000_release_gate.sql#L232",
  "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/variants/v4_default_grants_on_audit.sql",
  "variant_line": "# Failed test 5: \"service_role cannot INSERT into audit_log\"",
  "service_role_test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/tests/test_service_role.py#L5"
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
   "data.sql": 756791
  },
  "seconds": {
   "backup": 3.19,
   "fresh_stack_start": 23.01,
   "restore": 0.16,
   "checks": 1.39
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
  "script": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/scripts/restore_drill.py",
  "tests": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/tests_restore/test_restore_drill.py",
  "fix": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/drill/restore_default_acl.sql",
  "variant_line": "E       AssertionError: rights changed by the restore (584 differences), e.g. table_grants: gained authenticated:public.holds:UPDATE; table_grants: gained service_role:public.audit_log:INSERT; table_grants: gained anon:public.audit_log:DELETE"
 },
 "traveler_test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/e4954c89e8647c27bbbe7f2c9576d16fcc062606/tests/test_contract.py#L88",
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
   "line": "E       AssertionError: pack released while a hold is open: {'status': 'released', 'release_eligible': False, 'cycle': 1, 'open_holds': 1}",
   "detected": true
  },
  {
   "name": "v2b_hold_leaves_eligibility",
   "family": 2,
   "line": "E       AssertionError: hold opened after release left the pack shippable: {'status': 'released', 'release_eligible': True, 'cycle': 1, 'open_holds': 1}",
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
