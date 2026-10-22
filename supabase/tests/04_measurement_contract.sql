-- Family 1, SQL layer: the five-case contract run sequentially. Concurrency and cuts are in tests/ (Python).
begin;
select plan(11);

insert into public.packs (serial, model) values ('TAP-MEAS-0001', 'RED V4 6S1P 5Ah (demo)');

select ok(exists (select 1 from pg_constraint where conname = 'measurements_operation_key_key' and contype = 'u'),
  'ADMIN: operation_key is arbitrated by a unique constraint');
select ok((select prosrc from pg_proc where proname = 'record_measurement') !~* 'do\s+update',
  'ADMIN: record_measurement never upserts over an existing row');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}', true);

select is(public.record_measurement('5b1d0e6e-0000-4000-8000-0000000000c1', 'TAP-MEAS-0001', 1, 'WS-TEST-02', 22.861, 48.60, '2026-10-22 09:00:00+00') ->> 'outcome',
  'recorded', 'new key: recorded');
select is(public.record_measurement('5b1d0e6e-0000-4000-8000-0000000000c1', 'TAP-MEAS-0001', 1, 'WS-TEST-02', 22.861, 48.60, '2026-10-22 09:00:00+00') ->> 'outcome',
  'replayed', 'same key, same content: the original result comes back');
select throws_ok($$ select public.record_measurement('5b1d0e6e-0000-4000-8000-0000000000c1', 'TAP-MEAS-0001', 1, 'WS-TEST-02', 22.861, 51.20, '2026-10-22 09:00:00+00') $$,
  'PT409', 'Operation key 5b1d0e6e-0000-4000-8000-0000000000c1 was already used for a different measurement.',
  'same key, different content: conflict');
select is(public.record_measurement('5b1d0e6e-0000-4000-8000-0000000000c2', 'TAP-MEAS-0001', 1, 'WS-TEST-02', 22.874, 48.10, '2026-10-22 09:05:00+00') ->> 'outcome',
  'recorded', 'real retest, new key: recorded');
select throws_ok($$ select public.record_measurement('5b1d0e6e-0000-4000-8000-0000000000c3', 'TAP-MEAS-0001', 2, 'WS-TEST-02', 22.874, 48.10, now()::text) $$,
  'PT422', null, 'a measurement cannot claim a cycle the pack has not reached');
select throws_ok($$ select public.record_measurement('5b1d0e6e-0000-4000-8000-0000000000c4', 'TAP-MEAS-0001', 1, 'WS-TEST-02', 22.874, 48.10, '2026-10-22 09:10:00') $$,
  'PT422', 'measured_at must carry a time zone, for example 2026-10-22T16:00:00Z.',
  'an instant without a time zone is refused, not read in the session zone');
set local timezone = 'America/Los_Angeles';
select is(public.record_measurement('5b1d0e6e-0000-4000-8000-0000000000c1', 'TAP-MEAS-0001', 1, 'WS-TEST-02', 22.86100, 48.6, '2026-10-22 02:00:00-07') ->> 'outcome',
  'replayed', 'same instant and values written another way, in another session time zone: still the original result');
reset timezone;
reset role;

select is((select count(*)::int from public.measurements where serial = 'TAP-MEAS-0001'), 2,
  'ADMIN: two tests, two rows');
select is((select acir_mohm from public.measurements where operation_key = '5b1d0e6e-0000-4000-8000-0000000000c1'), 48.60::numeric(6,2),
  'ADMIN: the conflicting resend did not overwrite the first value');

select * from finish();
rollback;
