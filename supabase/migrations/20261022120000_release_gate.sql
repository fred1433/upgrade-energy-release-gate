-- Upgrade Energy release gate: an ILLUSTRATIVE shop-floor schema with fictional data.
-- It is not Upgrade Energy's schema. Names, limits and serials are invented for the demo.
--
-- Roles
--   anon, authenticated, service_role : Supabase API roles. They read; they never write tables directly.
--   mes_rpc_owner    : owns the narrow SECURITY DEFINER functions (the only business writers).
--   mes_audit_writer : owns the audit trigger function (the only writer of audit_log).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mes_rpc_owner') then
    create role mes_rpc_owner nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'mes_audit_writer') then
    create role mes_audit_writer nologin noinherit;
  end if;
end $$;

-- postgres must be able to hand objects to these owners.
grant mes_rpc_owner to postgres;
grant mes_audit_writer to postgres;

create schema mes_private;
revoke all on schema mes_private from public;
grant usage on schema mes_private to authenticated, mes_rpc_owner, mes_audit_writer;
grant usage on schema public to mes_rpc_owner, mes_audit_writer;
-- ALTER ... OWNER TO needs CREATE on the schema for the new owner; taken back at the end of this file.
grant create on schema public, mes_private to mes_rpc_owner, mes_audit_writer;

-- ---------------------------------------------------------------- tables

create table public.workstations (
  id    text primary key,
  label text not null
);

-- Held server side. No API role can read or change it.
create table mes_private.staff (
  user_id      uuid primary key,
  display_name text not null,
  shop_role    text not null check (shop_role in ('operator', 'quality'))
);

create table mes_private.staff_workstations (
  user_id        uuid not null references mes_private.staff (user_id),
  workstation_id text not null references public.workstations (id),
  primary key (user_id, workstation_id)
);

-- Fictional limits for the demo pack.
create table public.test_limits (
  model         text primary key,
  voltage_min_v numeric(6,3) not null,
  voltage_max_v numeric(6,3) not null,
  acir_max_mohm numeric(6,2) not null
);

create table public.packs (
  serial           text primary key,
  model            text not null references public.test_limits (model),
  status           text not null default 'in_process'
                   check (status in ('in_process', 'on_hold', 'released', 'shipped')),
  release_eligible boolean not null default false,
  cycle            integer not null default 1 check (cycle >= 1),  -- 1 + number of completed reworks
  cycle_started_at timestamptz not null default now()
);

create table public.measurements (
  id             bigint generated always as identity primary key,
  serial         text not null references public.packs (serial),
  cycle          integer not null,
  workstation_id text not null references public.workstations (id),
  voltage_v      numeric(6,3) not null,
  acir_mohm      numeric(6,2) not null,
  result         text not null check (result in ('pass', 'fail')),
  measured_at    timestamptz not null,               -- workstation clock
  recorded_at    timestamptz not null default now(), -- server clock
  recorded_by    uuid not null,
  operation_key  uuid not null,                      -- generated and stored by the workstation before sending
  payload_sha256 text not null,
  constraint measurements_operation_key_key unique (operation_key)
);

create table public.holds (
  id         bigint generated always as identity primary key,
  serial     text not null references public.packs (serial),
  reason     text not null,
  status     text not null default 'open' check (status in ('open', 'lifted')),
  opened_by  uuid not null,
  opened_at  timestamptz not null default now(),
  lifted_by  uuid,
  lifted_at  timestamptz,
  lift_note  text
);
create index holds_open_by_serial on public.holds (serial) where status = 'open';

create table public.audit_log (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),  -- server time of the business transaction
  actor          uuid,                                -- from the verified JWT, never from the request body
  request_role   text,                                -- role claim of the JWT (authenticated, service_role, ...)
  db_role        text not null,                       -- effective database role of the request
  workstation_id text,                                -- checked against the caller's assigned stations
  operation_key  uuid,
  table_name     text not null,
  row_key        text not null,
  action         text not null,
  before         jsonb,
  after          jsonb,
  txid           bigint not null default txid_current()
);

-- ---------------------------------------------------------------- privileges
-- Supabase grants ALL on new public tables to anon, authenticated and service_role by default.
-- Take it all back, then grant read only.

revoke all on all tables    in schema public from anon, authenticated, service_role;
revoke all on all sequences in schema public from anon, authenticated, service_role;
revoke all on all tables    in schema mes_private from public, anon, authenticated, service_role;

grant select on public.workstations, public.test_limits, public.packs,
                public.measurements, public.holds, public.audit_log
  to authenticated, service_role;

grant select, insert, update on public.packs, public.measurements, public.holds to mes_rpc_owner;
grant select on public.workstations, public.test_limits to mes_rpc_owner;
grant select on mes_private.staff, mes_private.staff_workstations to mes_rpc_owner;

grant insert on public.audit_log to mes_audit_writer;
grant select on mes_private.staff_workstations to mes_audit_writer;

-- ---------------------------------------------------------------- helpers

-- Same source as auth.uid(): the verified JWT claims that PostgREST puts in the transaction.
create function mes_private.caller_id() returns uuid
language sql stable set search_path = ''
as $$
  select nullif(coalesce(
           nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
           (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
         ), '')::uuid
$$;

create function mes_private.request_role() returns text
language sql stable set search_path = ''
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;

create function mes_private.caller_shop_role() returns text
language sql stable security definer set search_path = ''
as $$
  select s.shop_role from mes_private.staff s where s.user_id = mes_private.caller_id()
$$;
alter function mes_private.caller_shop_role() owner to mes_rpc_owner;

-- Identity, staff membership and workstation assignment, checked on every write.
create function mes_private.require_station(p_workstation text) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid  uuid := mes_private.caller_id();
  v_role text;
begin
  if v_uid is null then
    raise exception 'Sign-in required.' using errcode = 'PT401';
  end if;
  select s.shop_role into v_role from mes_private.staff s where s.user_id = v_uid;
  if v_role is null then
    raise exception 'This account is not on the shop staff list.' using errcode = 'PT403';
  end if;
  if not exists (select 1 from mes_private.staff_workstations sw
                  where sw.user_id = v_uid and sw.workstation_id = p_workstation) then
    raise exception 'Workstation % is not assigned to this account.', p_workstation using errcode = 'PT403';
  end if;
  perform pg_catalog.set_config('mes.workstation', p_workstation, true);
  perform pg_catalog.set_config('mes.operation_key', '', true);
  return v_role;
end
$$;
alter function mes_private.require_station(text) owner to mes_rpc_owner;

-- Eligible = a passing test in the CURRENT cycle and no open hold. Caller holds the pack row lock.
create function mes_private.refresh_eligibility(p_serial text) returns void
language sql volatile set search_path = ''
as $$
  update public.packs p
     set release_eligible = e.eligible
    from (select pk.serial,
                 exists (select 1 from public.measurements m
                          where m.serial = pk.serial and m.cycle = pk.cycle and m.result = 'pass')
                 and not exists (select 1 from public.holds h
                                  where h.serial = pk.serial and h.status = 'open') as eligible
            from public.packs pk where pk.serial = p_serial) e
   where p.serial = e.serial
     and p.status in ('in_process', 'on_hold')
     and p.release_eligible is distinct from e.eligible
$$;
alter function mes_private.refresh_eligibility(text) owner to mes_rpc_owner;

-- ---------------------------------------------------------------- RLS

alter table public.workstations enable row level security;
alter table public.test_limits  enable row level security;
alter table public.packs        enable row level security;
alter table public.measurements enable row level security;
alter table public.holds        enable row level security;
alter table public.audit_log    enable row level security;

create policy staff_read on public.workstations for select to authenticated
  using ((select mes_private.caller_shop_role()) is not null);
create policy staff_read on public.test_limits for select to authenticated
  using ((select mes_private.caller_shop_role()) is not null);
create policy staff_read on public.packs for select to authenticated
  using ((select mes_private.caller_shop_role()) is not null);
create policy staff_read on public.measurements for select to authenticated
  using ((select mes_private.caller_shop_role()) is not null);
create policy staff_read on public.holds for select to authenticated
  using ((select mes_private.caller_shop_role()) is not null);
create policy quality_reads_audit on public.audit_log for select to authenticated
  using ((select mes_private.caller_shop_role()) = 'quality');

create policy rpc_owner_writes on public.packs        for all to mes_rpc_owner using (true) with check (true);
create policy rpc_owner_writes on public.measurements for all to mes_rpc_owner using (true) with check (true);
create policy rpc_owner_writes on public.holds        for all to mes_rpc_owner using (true) with check (true);
create policy rpc_owner_reads  on public.workstations for select to mes_rpc_owner using (true);
create policy rpc_owner_reads  on public.test_limits  for select to mes_rpc_owner using (true);
create policy audit_writer_appends on public.audit_log for insert to mes_audit_writer with check (true);

-- ---------------------------------------------------------------- audit trigger

create function mes_private.write_audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor   uuid := mes_private.caller_id();
  v_station text := nullif(pg_catalog.current_setting('mes.workstation', true), '');
  v_key     uuid := nullif(pg_catalog.current_setting('mes.operation_key', true), '')::uuid;
  v_before  jsonb;
  v_after   jsonb;
begin
  if v_actor is not null and v_station is not null and not exists (
       select 1 from mes_private.staff_workstations sw
        where sw.user_id = v_actor and sw.workstation_id = v_station) then
    raise exception 'Workstation % is not assigned to the caller.', v_station using errcode = 'PT403';
  end if;
  if tg_op in ('UPDATE', 'DELETE') then v_before := pg_catalog.to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_after  := pg_catalog.to_jsonb(new); end if;
  insert into public.audit_log
         (actor, request_role, db_role, workstation_id, operation_key,
          table_name, row_key, action, before, after)
  values (v_actor, mes_private.request_role(), coalesce(nullif(pg_catalog.current_setting('role'), 'none'), session_user), v_station, v_key,
          tg_table_name, coalesce(v_after, v_before) ->> tg_argv[0], pg_catalog.lower(tg_op), v_before, v_after);
  return null;
end
$$;
alter function mes_private.write_audit() owner to mes_audit_writer;
grant execute on function mes_private.caller_id(), mes_private.request_role() to mes_audit_writer;

create trigger audit_packs after insert or delete on public.packs
  for each row execute function mes_private.write_audit('serial');
create trigger audit_packs_update after update on public.packs
  for each row when (old.* is distinct from new.*) execute function mes_private.write_audit('serial');
create trigger audit_measurements after insert or update or delete on public.measurements
  for each row execute function mes_private.write_audit('id');
create trigger audit_holds after insert or update or delete on public.holds
  for each row execute function mes_private.write_audit('id');

create function mes_private.audit_is_append_only() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only.';
end
$$;
create trigger audit_no_update_delete before update or delete on public.audit_log
  for each row execute function mes_private.audit_is_append_only();
create trigger audit_no_truncate before truncate on public.audit_log
  for each statement execute function mes_private.audit_is_append_only();

-- ---------------------------------------------------------------- business RPCs

-- One battery test, one recorded result.
--   new key                        -> recorded
--   same key, same content         -> the original result, outcome 'replayed'
--   same key, different content    -> 409, nothing changes
--   two deliveries at once         -> the unique constraint arbitrates; one row
--   real retest                    -> new key, recorded
-- measured_at is text so that an instant without a time zone can be refused instead of being read in
-- the session's zone. The fingerprint uses a normalized form (UTC epoch, fixed numeric scales), so a
-- resend matches whatever time zone the session or the client uses.
create function public.record_measurement(
  p_operation_key uuid,
  p_serial        text,
  p_cycle         integer,
  p_workstation   text,
  p_voltage_v     numeric,
  p_acir_mohm     numeric,
  p_measured_at   text
) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_pack     public.packs;
  v_limits   public.test_limits;
  v_existing public.measurements;
  v_hash     text;
  v_result   text;
  v_id       bigint;
  v_at       timestamptz;
  v_measured timestamptz;
begin
  perform mes_private.require_station(p_workstation);
  perform pg_catalog.set_config('mes.operation_key', p_operation_key::text, true);

  if p_measured_at is null or p_measured_at !~ '([Zz]|[+-][0-9]{2}(:?[0-9]{2})?)$' then
    raise exception 'measured_at must carry a time zone, for example 2026-10-22T16:00:00Z.' using errcode = 'PT422';
  end if;
  v_measured := p_measured_at::timestamptz;

  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.concat_ws('|',
              p_serial, p_cycle::text, p_workstation,
              round(p_voltage_v, 3)::text, round(p_acir_mohm, 2)::text,
              extract(epoch from v_measured)::text), 'UTF8')), 'hex');

  -- No lock yet: concurrent deliveries of one key are arbitrated by the unique constraint below.
  select p.* into v_pack from public.packs p where p.serial = p_serial;
  if not found then
    raise exception 'Pack % does not exist.', p_serial using errcode = 'PT404';
  end if;

  -- A key already seen: answer from the record, whatever the pack looks like now.
  select m.* into v_existing from public.measurements m where m.operation_key = p_operation_key;
  if found then
    if v_existing.payload_sha256 <> v_hash then
      raise exception 'Operation key % was already used for a different measurement.', p_operation_key
        using errcode = 'PT409', detail = pg_catalog.format('measurement_id=%s', v_existing.id);
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'replayed', 'measurement_id', v_existing.id,
             'recorded_at', v_existing.recorded_at, 'result', v_existing.result, 'cycle', v_existing.cycle);
  end if;

  if v_pack.status = 'shipped' then
    raise exception 'Pack % has shipped.', p_serial using errcode = 'PT409';
  end if;
  if p_cycle < 1 or p_cycle > v_pack.cycle then
    raise exception 'Pack % is in cycle %; a measurement cannot claim cycle %.', p_serial, v_pack.cycle, p_cycle
      using errcode = 'PT422';
  end if;
  -- Shop rule: a measurement belongs to the cycle the station scanned when it took it; the station stores
  -- that cycle with the measurement in its outbox, so a late upload keeps its cycle and a measurement taken
  -- before the rework never counts as the retest. Station clocks are recorded, never used to decide.

  select l.* into v_limits from public.test_limits l where l.model = v_pack.model;
  v_result := case when p_voltage_v between v_limits.voltage_min_v and v_limits.voltage_max_v
                    and p_acir_mohm <= v_limits.acir_max_mohm then 'pass' else 'fail' end;

  insert into public.measurements
         (serial, cycle, workstation_id, voltage_v, acir_mohm, result,
          measured_at, recorded_by, operation_key, payload_sha256)
  values (p_serial, p_cycle, p_workstation, p_voltage_v, p_acir_mohm, v_result,
          v_measured, mes_private.caller_id(), p_operation_key, v_hash)
  on conflict (operation_key) do nothing
  returning id, recorded_at into v_id, v_at;

  if v_id is null then
    -- Lost the race on the unique constraint: answer from the winner's row.
    select m.* into v_existing from public.measurements m where m.operation_key = p_operation_key;
    if v_existing.payload_sha256 <> v_hash then
      raise exception 'Operation key % was already used for a different measurement.', p_operation_key
        using errcode = 'PT409';
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'replayed', 'measurement_id', v_existing.id,
             'recorded_at', v_existing.recorded_at, 'result', v_existing.result, 'cycle', v_existing.cycle);
  end if;

  -- Lock the pack and reload it: a rework may have committed since the first, unlocked read.
  -- Eligibility is refreshed in later statements, and the answer describes the pack as locked here.
  select p.* into v_pack from public.packs p where p.serial = p_serial for update;
  perform mes_private.refresh_eligibility(p_serial);
  return pg_catalog.jsonb_build_object('outcome', 'recorded', 'measurement_id', v_id, 'recorded_at', v_at,
           'result', v_result, 'cycle', p_cycle, 'counts_for_release', p_cycle = v_pack.cycle);
end
$$;

-- Before shipment, opening a hold withdraws eligibility and puts the pack on hold, in the same transaction.
create function public.open_hold(p_serial text, p_reason text, p_workstation text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_pack public.packs;
  v_id   bigint;
begin
  perform mes_private.require_station(p_workstation);
  select p.* into v_pack from public.packs p where p.serial = p_serial for update;
  if not found then
    raise exception 'Pack % does not exist.', p_serial using errcode = 'PT404';
  end if;
  if v_pack.status = 'shipped' then
    raise exception 'Pack % has shipped; open a return instead.', p_serial using errcode = 'PT409';
  end if;
  insert into public.holds (serial, reason, opened_by)
  values (p_serial, p_reason, mes_private.caller_id())
  returning id into v_id;
  update public.packs set status = 'on_hold', release_eligible = false where serial = p_serial;
  return pg_catalog.jsonb_build_object('outcome', 'hold_opened', 'hold_id', v_id, 'serial', p_serial);
end
$$;

-- Release for shipment. Statement 1 locks the pack; statement 2 reads the holds with a fresh
-- READ COMMITTED snapshot, so a hold committed while we waited for the lock is seen.
create function public.release_pack(p_serial text, p_workstation text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_role text;
  v_pack public.packs;
begin
  v_role := mes_private.require_station(p_workstation);
  if v_role <> 'quality' then
    raise exception 'Only quality can release a pack. This account is %.', v_role using errcode = 'PT403';
  end if;
  select p.* into v_pack from public.packs p where p.serial = p_serial for update;
  if not found then
    raise exception 'Pack % does not exist.', p_serial using errcode = 'PT404';
  end if;
  if exists (select 1 from public.holds h where h.serial = p_serial and h.status = 'open') then
    raise exception 'Pack % has an open quality hold.', p_serial using errcode = 'PT409';
  end if;
  if v_pack.status <> 'in_process' or not v_pack.release_eligible then
    raise exception 'Pack % is not eligible for release (status %, cycle %).', p_serial, v_pack.status, v_pack.cycle
      using errcode = 'PT409';
  end if;
  update public.packs set status = 'released' where serial = p_serial;
  return pg_catalog.jsonb_build_object('outcome', 'released', 'serial', p_serial);
end
$$;

-- Rework under hold opens a new test cycle. Earlier measurements stay attached to their cycle.
create function public.complete_rework(p_serial text, p_note text, p_workstation text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_pack public.packs;
begin
  perform mes_private.require_station(p_workstation);
  select p.* into v_pack from public.packs p where p.serial = p_serial for update;
  if not found then
    raise exception 'Pack % does not exist.', p_serial using errcode = 'PT404';
  end if;
  if v_pack.status <> 'on_hold' then
    raise exception 'Rework is done under a hold; pack % is %.', p_serial, v_pack.status using errcode = 'PT409';
  end if;
  update public.packs
     set cycle = cycle + 1, cycle_started_at = pg_catalog.clock_timestamp(), release_eligible = false
   where serial = p_serial;
  return pg_catalog.jsonb_build_object('outcome', 'rework_completed', 'serial', p_serial, 'cycle', v_pack.cycle + 1);
end
$$;

-- Only quality lifts a hold. Refusals are explicit errors, never a silent "0 rows".
create function public.lift_hold(p_hold_id bigint, p_note text, p_workstation text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_role text;
  v_hold public.holds;
begin
  v_role := mes_private.require_station(p_workstation);
  if v_role <> 'quality' then
    raise exception 'Only quality can lift a hold. This account is %.', v_role using errcode = 'PT403';
  end if;
  select h.* into v_hold from public.holds h where h.id = p_hold_id;
  if not found then
    raise exception 'Hold % does not exist.', p_hold_id using errcode = 'PT404';
  end if;
  perform 1 from public.packs p where p.serial = v_hold.serial for update;
  select h.* into v_hold from public.holds h where h.id = p_hold_id for update;
  if v_hold.status <> 'open' then
    raise exception 'Hold % is already %.', p_hold_id, v_hold.status using errcode = 'PT409';
  end if;
  if coalesce(pg_catalog.btrim(p_note), '') = '' then
    raise exception 'A note is required to lift a hold.' using errcode = 'PT422';
  end if;
  update public.holds
     set status = 'lifted', lifted_by = mes_private.caller_id(), lifted_at = now(), lift_note = p_note
   where id = p_hold_id;
  if not exists (select 1 from public.holds h where h.serial = v_hold.serial and h.status = 'open') then
    update public.packs set status = 'in_process' where serial = v_hold.serial and status = 'on_hold';
  end if;
  perform mes_private.refresh_eligibility(v_hold.serial);
  return pg_catalog.jsonb_build_object('outcome', 'hold_lifted', 'hold_id', p_hold_id, 'serial', v_hold.serial);
end
$$;

-- ---------------------------------------------------------------- function ownership and EXECUTE

alter function public.record_measurement(uuid, text, integer, text, numeric, numeric, text) owner to mes_rpc_owner;
alter function public.open_hold(text, text, text) owner to mes_rpc_owner;
alter function public.release_pack(text, text) owner to mes_rpc_owner;
alter function public.complete_rework(text, text, text) owner to mes_rpc_owner;
alter function public.lift_hold(bigint, text, text) owner to mes_rpc_owner;

revoke all on all functions in schema public from public, anon, authenticated, service_role;
revoke all on all functions in schema mes_private from public, anon, authenticated, service_role;

grant execute on function
  public.record_measurement(uuid, text, integer, text, numeric, numeric, text),
  public.open_hold(text, text, text),
  public.release_pack(text, text),
  public.complete_rework(text, text, text),
  public.lift_hold(bigint, text, text)
  to authenticated;

grant execute on function mes_private.caller_id(), mes_private.caller_shop_role() to authenticated;
grant execute on function mes_private.caller_id(), mes_private.request_role(),
                          mes_private.require_station(text), mes_private.refresh_eligibility(text)
  to mes_rpc_owner;

-- The owners keep no CREATE right: they own these functions and nothing else.
revoke create on schema public, mes_private from mes_rpc_owner, mes_audit_writer;
