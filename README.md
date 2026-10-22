# Upgrade Energy release gate (illustrative)

One illustrative battery-pack traveler on a local Supabase stack, five checks, replayable evidence.

**Scope, said first.** Fictional data. This is not Upgrade Energy's schema or code, and it was built
with no access to their systems. The pack model name comes from their public catalog; every serial,
limit, person and workstation here is invented.

## Run it

Requirements: Docker, Supabase CLI 2.120.0, uv 0.9.x, `psql`.

```bash
./scripts/prove.sh
```

That starts the local stack (`supabase start`, no hosted project), resets the database from
`supabase/migrations`, then runs, in order:

1. `supabase test db`: pgTAP, rights, policies, functions and SQL invariants (`supabase/tests/`).
2. `pytest`: real API responses, two-connection races and connection cuts (`tests/`).
3. `scripts/restore_drill.py`: backup, restore into a fresh second local stack, inspection, API checks.
4. `scripts/prove_variants.py`: each deliberately broken variant (`variants/`) is applied to a fresh
   database and must be caught by the assertion that guards that rule.

Outputs land in `evidence/` (git-ignored). CI runs the same script on every push and keeps
`evidence/` as an artifact of the run.

## The traveler

| Step | Status here |
|---|---|
| Cell matching | illustrated only |
| Tab welding | illustrated only |
| Weld inspection | illustrated only |
| Voltage and ACIR test | tested (`record_measurement`) |
| Quality hold | tested (`open_hold`) |
| Rework | tested (`complete_rework`, opens a new test cycle) |
| Retest | tested (new operation key, current cycle) |
| Hold lifted by quality | tested (`lift_hold`) |
| Release eligibility | tested (`release_pack`) |

The whole tested path runs through the API in
`tests/test_contract.py::test_traveler_path_measurement_before_rework_is_not_a_retest`.

## The five checks

| # | Rule | Where it is tested | Broken on purpose | Caught by |
|---|---|---|---|---|
| 1 | One battery test, one recorded result. The station stores key and measurement before sending; the server answers a resend from the record. | `tests/test_one_measurement.py`, `tests/test_contract.py`, `supabase/tests/04_measurement_contract.sql` | `v1_retry_writes_twice` (plain insert), `v1b_upsert_overwrites` | `test_lost_reply_is_recorded_once`: "one battery test, 2 measurement rows"; `test_same_key_different_content_is_rejected` |
| 2 | Hold against release. Both functions lock the pack row, then read holds in a later statement. | `tests/test_hold_release_race.py` | `v2a_release_without_lock`, `v2b_hold_leaves_eligibility` | "pack released while a hold is open"; "hold opened after release left the pack shippable" |
| 3 | Only quality lifts a hold. No table write right; one narrow `SECURITY DEFINER` RPC. | `supabase/tests/01_privileges.sql`, `02_lift_hold.sql`, `tests/test_lift_hold_api.py` | `v3_column_revoke`, `v3b_policy_filters_silently`, `v3c_refuse_everyone` | `test_direct_write_is_refused`, `test_quality_lifts_the_hold` |
| 4 | The audit log. Written by trigger in the business transaction; no app role may insert, update, delete or truncate it. | `supabase/tests/03_audit.sql`, `tests/test_service_role.py` | `v4_default_grants_on_audit` | `03_audit.sql` test 5: "service_role cannot INSERT into audit_log" |
| 5 | Database restore drill. Fresh stack, rights and rows inspected before any migration, then allowed, forbidden and replayed operations. | `scripts/restore_drill.py`, `tests_restore/` | `v5_restore_reapplies_default_grants` | `test_restored_grants_match_source` |

### 1. One battery test, one recorded result

`workstation/station.py` writes the operation key and the full measurement to a local SQLite outbox
before the first send. Anything that does not come back with an answer stays pending and is resent
with the same key and payload. Server contract (`record_measurement`):

- new key: recorded;
- same key, same content: the original result (`outcome: replayed`, same id, same server time);
- same key, different content: HTTP 409, nothing changes;
- two deliveries at once: the unique constraint on `operation_key` arbitrates (`on conflict do nothing`,
  never an upsert), the loser answers from the winner's row;
- a real retest: a new key, recorded.

Cuts are deterministic. A small TCP proxy (`tests/support.py`, `LossyProxy`) lets the request reach
the server, reads the server's answer and drops it before the station sees it. For the rollback case,
the database connection carrying the first attempt is terminated after the function ran and before
`COMMIT`. In both cases the outcome in the database is checked independently (ADMIN query) before
the resend.

Shop rule: a measurement belongs to the cycle the station scanned. A late upload from before the
rework stays in its cycle and does not count for release; a measurement taken before the rework that
claims the new cycle is refused (HTTP 422). The measurement, its key and its audit rows commit together.

### 2. Hold against release

Rule: before shipment, opening a hold withdraws eligibility and puts the pack on hold, in the same
transaction, even if the pack was already released. `open_hold` and `release_pack` both take
`SELECT ... FOR UPDATE` on the pack, then read the holds in a following statement, which in
READ COMMITTED gets a fresh snapshot and sees a hold committed while it waited. The tests force both
orders with two real connections and a barrier that waits until the second connection is observed
waiting on a lock (`pg_stat_activity`), not with sleeps:

- hold first: the release is refused (`PT409`);
- release first: the hold lands and the pack ends on hold, not eligible.

### 3. Who can lift a hold

`holds` has no UPDATE right for any API role: a table-level grant would cover every column, and a
column-level REVOKE does not cancel it (`v3_column_revoke` shows the operator lifting a hold anyway).
`lift_hold` checks identity, the server-side shop role (`mes_private.staff`, invisible to API roles)
and the hold state. As a `SECURITY DEFINER` function it is owned by `mes_rpc_owner` (no login, no
BYPASSRLS, no CREATE), pins `search_path = ''`, qualifies every name, and only `authenticated` may
execute it. Expected: anon refused (401), operator refused with an explicit message (403), quality
succeeds (200), direct write refused (403, `42501`). A fix that refuses everyone fails the suite.

The "0 rows" story (`v3b_policy_filters_silently`): with an UPDATE grant and an RLS policy whose
`USING` clause lets only quality update, an operator's PATCH returns HTTP 204 with no error and
changes nothing. The database protected the row; a screen that only checks `error` says
"Hold lifted". The test records the request, the response, what that screen would show and the real
row state. This is how RLS is specified, not a Supabase defect; the design here makes refusals explicit.

### 4. The audit log

`audit_log` is written only by the trigger function `mes_private.write_audit` (owned by
`mes_audit_writer`), inside the business transaction. INSERT, UPDATE, DELETE and TRUNCATE are refused
to anon, authenticated and service_role (`service_role` is not a superuser: it bypasses RLS, not
privileges or triggers). Each row keeps the actor from the verified JWT, the request role, the
effective database role, the workstation (checked against the caller's assigned stations), the
operation key, before and after values, and server time. A change that rolls back leaves no audit
row, and a refused call is not a durable audit event. The table owner can still disable the
append-only trigger and delete; that is tested and stated, and there is no hash chain.

### 5. Database restore drill

`scripts/restore_drill.py` writes a fictional dataset through the RPCs, records a catalog manifest
(table, column, schema and function rights, default privileges, policies, RLS flags, triggers,
constraints, roles, memberships, row counts and checksums), dumps roles, schema and data separately
with `supabase db dump`, starts a second local stack from `drill/` (own volumes and ports, no
migrations, no seed), restores into it in one transaction, inspects it before anything else touches
it, then through the restored API: quality lifts a pre-backup hold, an operator is refused, and a
measurement recorded before the backup is resent and answered as `replayed` with its original id.
The restored instance is identified by its `system_identifier`, and the source row for the same hold
is checked to be unchanged.

What the first drill run found, kept in `drill/`:

- `supabase db dump --role-only` created the owner roles but not the membership `postgres` needs to
  hand them objects, and `ALTER ... OWNER TO` also needs the new owner to hold CREATE on the schema
  (`restore_prelude.sql`, taken back in `restore_postlude.sql`).
- pg_dump writes each object's grants relative to PostgreSQL's built-in defaults, while the fresh
  instance applies its own default privileges at CREATE time. Restored as is, every table and function
  came back with ALL granted to anon, authenticated and service_role on top of the dumped grants:
  rows identical, rights not (`restore_default_acl.sql`; `v5` is the restore without it).

Dataset size, versions and durations are written to `evidence/restore/drill.json`. They describe
this demo dataset on this machine or CI runner, not a recovery time for any production system.
Storage objects, Auth and project configuration, Edge Functions and secrets are not covered.

## Identities used by the tests

- API calls carry a JWT minted with the local stack's JWT secret, read at runtime from
  `supabase status` (the CLI's default local values; nothing is stored in this repository):
  anon, operator, quality, service_role.
- Direct connections run `SET ROLE authenticated` with `request.jwt.claims`, as PostgREST does.
- `postgres` is used for fixtures and for inspecting real row state only; such steps are labelled
  ADMIN. It is not used to exercise any rule.

## service_role

`service_role` bypasses RLS but not privileges or triggers, and the audit log records the effective
identity of each change (`tests/test_service_role.py`). Which identity each real workstation uses is
something to inspect on a real system, not something assumed here.

## Named assumptions

- Workstations call the API as the signed-in person (`authenticated`), not with a service key.
- Staff roles and station assignments live server side.
- Release needs a passing voltage and ACIR test in the current cycle and no open hold.
- Isolation level is PostgreSQL's default, READ COMMITTED.
- A test recorded after release does not reopen the pack; reopening goes through a hold.
- Limits (21.0 to 25.2 V, ACIR at most 60 mOhm) are invented for the demo.

## How it was written

With Claude Code. The invariants and the expected outcomes of each test were written first; rights,
transaction boundaries, retry behavior and test expectations were reviewed against them, and each
test was shown to fail on a broken variant before being trusted.
