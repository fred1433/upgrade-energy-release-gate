-- Fictional seed. Staff ids are fixed so tests can mint matching JWTs.
insert into public.workstations (id, label) values
  ('WS-WELD-01', 'Tab welding bench (fictional)'),
  ('WS-TEST-02', 'Voltage and ACIR test bench (fictional)'),
  ('WS-QA-01',   'Quality bench (fictional)');

insert into mes_private.staff (user_id, display_name, shop_role) values
  ('00000000-0000-4000-a000-000000000001', 'Operator A (fictional)', 'operator'),
  ('00000000-0000-4000-a000-000000000002', 'Quality B (fictional)',  'quality'),
  ('00000000-0000-4000-a000-000000000003', 'Operator C (fictional)', 'operator');

insert into mes_private.staff_workstations (user_id, workstation_id) values
  ('00000000-0000-4000-a000-000000000001', 'WS-WELD-01'),
  ('00000000-0000-4000-a000-000000000001', 'WS-TEST-02'),
  ('00000000-0000-4000-a000-000000000002', 'WS-QA-01'),
  ('00000000-0000-4000-a000-000000000002', 'WS-TEST-02'),
  ('00000000-0000-4000-a000-000000000003', 'WS-WELD-01');

-- Fictional limits, not Upgrade Energy's.
insert into public.test_limits (model, voltage_min_v, voltage_max_v, acir_max_mohm) values
  ('RED V4 6S1P 5Ah (demo)', 21.000, 25.200, 60.00);

insert into public.packs (serial, model) values
  ('DEMO-6S1P-0417', 'RED V4 6S1P 5Ah (demo)');
