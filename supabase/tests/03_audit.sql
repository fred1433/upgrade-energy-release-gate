-- Family 4: the audit log. Writes only by trigger, inside the business transaction.
begin;
select plan(14);

insert into public.packs (serial, model) values ('TAP-AUDIT-0001', 'RED V4 6S1P 5Ah (demo)');

-- authenticated (operator)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
select throws_ok($$ insert into public.audit_log (db_role, table_name, row_key, action) values ('x', 'packs', 'TAP-AUDIT-0001', 'insert') $$,
  '42501', null, 'authenticated cannot INSERT into audit_log');
select throws_ok($$ update public.audit_log set action = 'x' $$, '42501', null, 'authenticated cannot UPDATE audit_log');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'authenticated cannot DELETE from audit_log');
select throws_ok($$ truncate public.audit_log $$, '42501', null, 'authenticated cannot TRUNCATE audit_log');
reset role;

-- service_role: bypasses RLS, but not privileges
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok($$ insert into public.audit_log (db_role, table_name, row_key, action) values ('x', 'packs', 'TAP-AUDIT-0001', 'insert') $$,
  '42501', null, 'service_role cannot INSERT into audit_log');
select throws_ok($$ update public.audit_log set action = 'x' $$, '42501', null, 'service_role cannot UPDATE audit_log');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'service_role cannot DELETE from audit_log');
select throws_ok($$ truncate public.audit_log $$, '42501', null, 'service_role cannot TRUNCATE audit_log');
reset role;

-- A business change writes its audit rows in the same transaction.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
select public.record_measurement('7a1d0e6e-0000-4000-8000-00000000a001', 'TAP-AUDIT-0001', 1, 'WS-TEST-02', 22.861, 48.60, now());
reset role;

select results_eq(
  $$ select actor::text, request_role, db_role, workstation_id, operation_key::text, action, (after ->> 'acir_mohm'), at = now()
       from public.audit_log where table_name = 'measurements' and operation_key = '7a1d0e6e-0000-4000-8000-00000000a001' $$,
  $$ values ('00000000-0000-4000-a000-000000000001', 'authenticated', 'authenticated', 'WS-TEST-02',
             '7a1d0e6e-0000-4000-8000-00000000a001', 'insert', '48.60', true) $$,
  'ADMIN: one audit row with actor from the JWT, workstation, operation key, values and server time');
select is(
  (select before ->> 'release_eligible' || '>' || (after ->> 'release_eligible') from public.audit_log
    where table_name = 'packs' and row_key = 'TAP-AUDIT-0001' and action = 'update'),
  'false>true',
  'ADMIN: the pack change keeps its before and after values');

-- A refused call leaves no audit row.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.release_pack('TAP-AUDIT-0001', 'WS-TEST-02') $$, 'PT403', null,
  'operator release refused');
reset role;
select is((select count(*)::int from public.audit_log where row_key = 'TAP-AUDIT-0001' and table_name = 'packs' and after ->> 'status' = 'released'),
  0, 'ADMIN: the refusal is not a durable audit event');

-- A change that rolls back leaves no audit row.
savepoint before_hold;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
select public.open_hold('TAP-AUDIT-0001', 'will be rolled back', 'WS-TEST-02');
rollback to savepoint before_hold;
select is((select count(*)::int from public.audit_log where table_name = 'holds' and after ->> 'serial' = 'TAP-AUDIT-0001'),
  0, 'ADMIN: a rolled-back hold leaves no audit trace');

-- Honest limit: the table owner keeps its power.
select lives_ok($$ alter table public.audit_log disable trigger audit_no_update_delete;
                   delete from public.audit_log where row_key = 'TAP-AUDIT-0001' $$,
  'ADMIN: the table owner can still disable the append-only trigger and delete (documented limit, no hash chain)');

select * from finish();
rollback;
