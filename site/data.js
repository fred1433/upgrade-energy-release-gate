window.EVIDENCE = {
 "commit": "d44a24fd343d2f25f50d75362f0db01c521c77e2",
 "commit_short": "d44a24f",
 "run_url": "https://github.com/fred1433/upgrade-energy-release-gate/actions/runs/39792056183",
 "run_number": "4",
 "repo": "https://github.com/fred1433/upgrade-energy-release-gate",
 "finished_at": "2026-10-22T14:06:08Z",
 "versions": {
  "commit": "d44a24fd343d2f25f50d75362f0db01c521c77e2",
  "supabase_cli": "2.120.0",
  "postgres": "17.11",
  "python": "3.12.3",
  "finished_at": "2026-10-22T14:06:08Z"
 },
 "counts": {
  "pytest": 20,
  "pytest_failed": 0,
  "pgtap": 46,
  "pgtap_ok": 46,
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
     "t": 71.3,
     "value": "22.860 V, 48.60 mΩ",
     "detail": "key 1e457833…, stored in the outbox first",
     "shared": "22.860 V, 48.60 mΩ",
     "shared_detail": "key and measurement stored in the outbox first"
    },
    {
     "t": 89.6,
     "value": "measurement 22 recorded",
     "detail": "server answered HTTP 200 OK",
     "shared": "measurement recorded",
     "shared_detail": "server answered HTTP 200 OK; one row, checked independently"
    },
    {
     "t": 89.6,
     "value": "no answer at the bench",
     "detail": "Server disconnected without sending a response. Entry kept as pending.",
     "shared": "no answer at the bench",
     "shared_detail": "Server disconnected without sending a response. Entry kept as pending."
    },
    {
     "t": 90.5,
     "value": "same key, same payload",
     "detail": "attempt 2",
     "shared": "same key, same payload",
     "shared_detail": "attempt 2"
    },
    {
     "t": 122.0,
     "value": "replayed, measurement 22",
     "detail": "HTTP 200"
    }
   ],
   "rows": [
    {
     "id": 22,
     "key": "1e457833",
     "acir": "48.60",
     "v": "22.860"
    }
   ],
   "serial": "DEMO-6S1P-7ABF70"
  },
  "broken": {
   "outcome": "failed",
   "failure": "one battery test, 2 measurement rows\nassert 2 == 1\n +  where 2 = len([{'acir_mohm': '48.60', 'cycle': 1, 'id': 1, 'operation_key': '473011a8-72ed-42f4-a1d1-c0f5996b937b', ...}, {'acir_mohm': '48.60', 'cycle': 1, 'id': 2, 'operation_key': '473011a8-72ed-42f4-a1d1-c0f5996b937b', ...}])",
   "beats": [
    {
     "t": 7.1,
     "value": "22.860 V, 48.60 mΩ",
     "detail": "key 473011a8…, stored in the outbox first",
     "shared": "22.860 V, 48.60 mΩ",
     "shared_detail": "key and measurement stored in the outbox first"
    },
    {
     "t": 61.5,
     "value": "measurement 1 recorded",
     "detail": "server answered HTTP 200 OK",
     "shared": "measurement recorded",
     "shared_detail": "server answered HTTP 200 OK; one row, checked independently"
    },
    {
     "t": 61.5,
     "value": "no answer at the bench",
     "detail": "Server disconnected without sending a response. Entry kept as pending.",
     "shared": "no answer at the bench",
     "shared_detail": "Server disconnected without sending a response. Entry kept as pending."
    },
    {
     "t": 62.3,
     "value": "same key, same payload",
     "detail": "attempt 2",
     "shared": "same key, same payload",
     "shared_detail": "attempt 2"
    },
    {
     "t": 80.9,
     "value": "recorded, measurement 2",
     "detail": "HTTP 200"
    }
   ],
   "rows": [
    {
     "id": 1,
     "key": "473011a8",
     "acir": "48.60",
     "v": "22.860"
    },
    {
     "id": 2,
     "key": "473011a8",
     "acir": "48.60",
     "v": "22.860"
    }
   ],
   "serial": "DEMO-6S1P-829F4E"
  },
  "test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/tests/test_one_measurement.py#L17",
  "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/variants/v1_retry_writes_twice.sql",
  "function": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/supabase/migrations/20261022120000_release_gate.sql#L292",
  "station": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/workstation/station.py#L107",
  "proxy": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/tests/support.py#L138"
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
      "t": 56.2
     },
     {
      "who": "Quality",
      "value": "starts the release",
      "detail": "waiting on a lock (transactionid)",
      "t": 63.5
     },
     {
      "who": "Operator",
      "value": "hold commits",
      "detail": "COMMIT",
      "t": 265.7
     },
     {
      "who": "Quality",
      "value": "release refused",
      "detail": "Pack DEMO-6S1P-FD6048 has an open quality hold.",
      "t": 266.7
     }
    ],
    "state": {
     "status": "on_hold",
     "release_eligible": false,
     "cycle": 1,
     "open_holds": 1
    },
    "serial": "DEMO-6S1P-FD6048"
   },
   "broken": {
    "outcome": "failed",
    "failure": "pack released while a hold is open: {'status': 'released', 'release_eligible': False, 'cycle': 1, 'open_holds': 1}\nassert not ('released' == 'released'\n  \n    released and 1 > 0)",
    "beats": [
     {
      "who": "Operator",
      "value": "opens a hold",
      "detail": "not committed yet",
      "t": 78.5
     },
     {
      "who": "Quality",
      "value": "already read the holds: none",
      "detail": "then waits only at its UPDATE (waiting on a lock (transactionid))",
      "t": 85.8
     },
     {
      "who": "Operator",
      "value": "hold commits",
      "detail": "COMMIT",
      "t": 86.2
     },
     {
      "who": "Quality",
      "value": "release goes through",
      "detail": "released",
      "t": 87.7
     }
    ],
    "state": {
     "status": "released",
     "release_eligible": false,
     "cycle": 1,
     "open_holds": 1
    },
    "serial": "DEMO-6S1P-EEA242"
   },
   "test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/tests/test_hold_release_race.py#L18",
   "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/variants/v2a_release_without_lock.sql",
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
      "t": 38.3
     },
     {
      "who": "Operator",
      "value": "opens a hold",
      "detail": "waiting on a lock (transactionid)",
      "t": 45.7
     },
     {
      "who": "Quality",
      "value": "release commits",
      "detail": "COMMIT",
      "t": 46.1
     },
     {
      "who": "Operator",
      "value": "hold opened",
      "detail": "hold_opened",
      "t": 48.5
     }
    ],
    "state": {
     "status": "on_hold",
     "release_eligible": false,
     "cycle": 1,
     "open_holds": 1
    },
    "serial": "DEMO-6S1P-0404BA"
   },
   "broken": {
    "outcome": "failed",
    "failure": "hold opened after release left the pack shippable: {'status': 'released', 'release_eligible': True, 'cycle': 1, 'open_holds': 1}\nassert ('released' == 'on_hold'\n  \n  - on_hold\n  + released)",
    "beats": [
     {
      "who": "Quality",
      "value": "releases the pack",
      "detail": "not committed yet",
      "t": 122.1
     },
     {
      "who": "Operator",
      "value": "opens a hold",
      "detail": "waiting on a lock (transactionid)",
      "t": 129.4
     },
     {
      "who": "Quality",
      "value": "release commits",
      "detail": "COMMIT",
      "t": 129.8
     },
     {
      "who": "Operator",
      "value": "hold opened",
      "detail": "hold_opened",
      "t": 130.9
     }
    ],
    "state": {
     "status": "released",
     "release_eligible": true,
     "cycle": 1,
     "open_holds": 1
    },
    "serial": "DEMO-6S1P-E4D239"
   },
   "test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/tests/test_hold_release_race.py#L43",
   "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/variants/v2b_hold_leaves_eligibility.sql",
   "variant_label": "the hold leaves the pack row untouched"
  },
  "function": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/supabase/migrations/20261022120000_release_gate.sql#L411"
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
  "tests": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/tests/test_lift_hold_api.py#L43",
  "direct_test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/tests/test_lift_hold_api.py#L58",
  "pgtap": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/supabase/tests/02_lift_hold.sql",
  "function": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/supabase/migrations/20261022120000_release_gate.sql#L461",
  "variant_silent": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/variants/v3b_policy_filters_silently.sql",
  "variant_column": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/variants/v3_column_revoke.sql",
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
  "pgtap": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/supabase/tests/03_audit.sql",
  "trigger": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/supabase/migrations/20261022120000_release_gate.sql#L232",
  "variant": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/variants/v4_default_grants_on_audit.sql",
  "variant_line": "# Failed test 5: \"service_role cannot INSERT into audit_log\"",
  "service_role_test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/tests/test_service_role.py#L5"
 },
 "restore": {
  "rows": {
   "public.workstations": 3,
   "public.test_limits": 1,
   "public.packs": 421,
   "public.measurements": 418,
   "public.holds": 56,
   "public.audit_log": 1275,
   "mes_private.staff": 3,
   "mes_private.staff_workstations": 5
  },
  "dump_bytes": {
   "roles.sql": 536,
   "schema.sql": 30552,
   "data.sql": 764385
  },
  "seconds": {
   "backup": 3.05,
   "fresh_stack_start": 23.05,
   "restore": 0.13,
   "checks": 1.26
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
  "script": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/scripts/restore_drill.py",
  "tests": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/tests_restore/test_restore_drill.py",
  "fix": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/drill/restore_default_acl.sql",
  "variant_line": "E       AssertionError: rights changed by the restore (584 differences), e.g. table_grants: gained authenticated:public.holds:UPDATE; table_grants: gained service_role:public.audit_log:INSERT; table_grants: gained anon:public.audit_log:DELETE"
 },
 "traveler_test": "https://github.com/fred1433/upgrade-energy-release-gate/blob/d44a24fd343d2f25f50d75362f0db01c521c77e2/tests/test_contract.py#L128",
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
