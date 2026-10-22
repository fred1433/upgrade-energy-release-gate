-- BROKEN ON PURPOSE. Family 1.
-- A natural first version: insert whatever arrives. No unique key, no replay.
-- Expected: test_lost_reply_is_recorded_once fails with "one battery test, 2 measurement rows".
alter table public.measurements drop constraint measurements_operation_key_key;

create or replace function public.record_measurement(
  p_operation_key uuid, p_serial text, p_cycle integer, p_workstation text,
  p_voltage_v numeric, p_acir_mohm numeric, p_measured_at text
) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_limits public.test_limits;
  v_result text;
  v_id bigint;
  v_at timestamptz;
begin
  perform mes_private.require_station(p_workstation);
  select l.* into v_limits from public.test_limits l join public.packs p on p.model = l.model where p.serial = p_serial;
  v_result := case when p_voltage_v between v_limits.voltage_min_v and v_limits.voltage_max_v
                    and p_acir_mohm <= v_limits.acir_max_mohm then 'pass' else 'fail' end;
  insert into public.measurements (serial, cycle, workstation_id, voltage_v, acir_mohm, result,
                                   measured_at, recorded_by, operation_key, payload_sha256)
  values (p_serial, p_cycle, p_workstation, p_voltage_v, p_acir_mohm, v_result,
          p_measured_at::timestamptz, mes_private.caller_id(), p_operation_key, '')
  returning id, recorded_at into v_id, v_at;
  return pg_catalog.jsonb_build_object('outcome', 'recorded', 'measurement_id', v_id, 'recorded_at', v_at,
           'result', v_result, 'cycle', p_cycle);
end
$$;
