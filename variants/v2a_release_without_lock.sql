-- BROKEN ON PURPOSE. Family 2.
-- Check, then act: release_pack reads the holds without first locking the pack row.
-- A hold committed while the release waits is never seen.
-- Expected: test_hold_first_then_release_is_refused fails with "pack released while a hold is open".
create or replace function public.release_pack(p_serial text, p_workstation text) returns jsonb
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
  select p.* into v_pack from public.packs p where p.serial = p_serial;  -- no FOR UPDATE
  if exists (select 1 from public.holds h where h.serial = p_serial and h.status = 'open') then
    raise exception 'Pack % has an open quality hold.', p_serial using errcode = 'PT409';
  end if;
  if v_pack.status <> 'in_process' or not v_pack.release_eligible then
    raise exception 'Pack % is not eligible for release.', p_serial using errcode = 'PT409';
  end if;
  update public.packs set status = 'released' where serial = p_serial;
  return pg_catalog.jsonb_build_object('outcome', 'released', 'serial', p_serial);
end
$$;
