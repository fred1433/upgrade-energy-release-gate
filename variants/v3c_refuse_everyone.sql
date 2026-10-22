-- BROKEN ON PURPOSE. Family 3.
-- The "safe" fix that refuses everyone, quality included.
-- Expected: test_quality_lifts_the_hold fails with "quality must be able to lift a hold".
create or replace function public.lift_hold(p_hold_id bigint, p_note text, p_workstation text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform mes_private.require_station(p_workstation);
  raise exception 'Holds cannot be lifted from the API.' using errcode = 'PT403';
end
$$;
