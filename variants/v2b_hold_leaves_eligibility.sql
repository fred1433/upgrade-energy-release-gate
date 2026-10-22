-- BROKEN ON PURPOSE. Family 2.
-- The hold is recorded, but the pack row is neither locked nor changed: eligibility survives the hold.
-- Expected: test_release_first_then_hold_withdraws_eligibility fails with "hold opened after release left the pack shippable".
create or replace function public.open_hold(p_serial text, p_reason text, p_workstation text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform mes_private.require_station(p_workstation);
  insert into public.holds (serial, reason, opened_by)
  values (p_serial, p_reason, mes_private.caller_id())
  returning id into v_id;
  return pg_catalog.jsonb_build_object('outcome', 'hold_opened', 'hold_id', v_id, 'serial', p_serial);
end
$$;
