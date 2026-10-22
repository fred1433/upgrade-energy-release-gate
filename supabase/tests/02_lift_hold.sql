-- Family 3: who can lift a hold. Each check runs under an application identity
-- (SET LOCAL ROLE + JWT claims, as PostgREST does). Fixture setup is ADMIN.
begin;
select plan(10);

-- ADMIN fixture: one pack with one open hold.
insert into public.packs (serial, model) values ('TAP-LIFT-0001', 'RED V4 6S1P 5Ah (demo)');
insert into public.holds (serial, reason, opened_by)
values ('TAP-LIFT-0001', 'ACIR above limit (fictional)', '00000000-0000-4000-a000-000000000001');
update public.packs set status = 'on_hold' where serial = 'TAP-LIFT-0001';
create temp table fx as select id as hold_id from public.holds where serial = 'TAP-LIFT-0001';
grant select on fx to anon, authenticated;

-- anon
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  format($$ select public.lift_hold(%s, 'note', 'WS-QA-01') $$, (select hold_id from fx)),
  '42501', 'permission denied for function lift_hold',
  'anon: refused, cannot even execute the RPC');
reset role;

-- operator
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
select throws_ok(
  format($$ select public.lift_hold(%s, 'looks fine to me', 'WS-TEST-02') $$, (select hold_id from fx)),
  'PT403', 'Only quality can lift a hold. This account is operator.',
  'operator: refused with an explicit result');
select throws_ok(
  format($$ update public.holds set status = 'lifted' where id = %s $$, (select hold_id from fx)),
  '42501', 'permission denied for table holds',
  'operator: direct write on holds refused by privilege, not filtered to 0 rows');
select throws_ok(
  $$ update mes_private.staff set shop_role = 'quality' where user_id = '00000000-0000-4000-a000-000000000001' $$,
  '42501', null,
  'operator: cannot promote itself, staff roles live server side');
select throws_ok(
  format($$ select public.open_hold('TAP-LIFT-0001', 'second look', 'WS-QA-01') $$),
  'PT403', 'Workstation WS-QA-01 is not assigned to this account.',
  'operator: a workstation not assigned to the caller is refused');
reset role;

-- quality
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}', true);
select throws_ok(
  format($$ update public.holds set status = 'lifted' where id = %s $$, (select hold_id from fx)),
  '42501', 'permission denied for table holds',
  'quality: direct write refused too, the RPC is the only path');
select lives_ok(
  format($$ select public.lift_hold(%s, 'Tab re-welded, retest passed (fictional)', 'WS-QA-01') $$, (select hold_id from fx)),
  'quality: lifts the hold through the RPC');
reset role;

-- ADMIN inspection of the real row state.
select is((select status from public.holds where id = (select hold_id from fx)), 'lifted',
  'ADMIN: the hold row is lifted');
select is((select lifted_by::text from public.holds where id = (select hold_id from fx)),
  '00000000-0000-4000-a000-000000000002',
  'ADMIN: lifted_by comes from the JWT, not from the request');
select is((select status from public.packs where serial = 'TAP-LIFT-0001'), 'in_process',
  'ADMIN: with no other open hold the pack goes back in process');

select * from finish();
rollback;
