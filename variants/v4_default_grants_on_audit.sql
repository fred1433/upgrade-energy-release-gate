-- BROKEN ON PURPOSE. Family 4.
-- The audit table keeps the privileges Supabase grants by default on new public tables.
-- RLS still stops authenticated, but service_role bypasses RLS and can now forge or erase audit rows.
-- Expected: supabase/tests/03_audit.sql fails "service_role cannot INSERT into audit_log".
grant all on public.audit_log to anon, authenticated, service_role;
