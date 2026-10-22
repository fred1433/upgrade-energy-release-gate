-- Family 3 and 4 groundwork: who holds which right. Pure catalog inspection, run as ADMIN (postgres).
begin;
select plan(11);

select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'RLS is enabled on every public table');

select is(
  (select array_agg(format('%s:%s:%s', g.grantee, g.table_name, g.privilege_type) order by format('%s:%s:%s', g.grantee, g.table_name, g.privilege_type))
     from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.grantee in ('anon', 'authenticated', 'service_role')
      and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  null,
  'no API role (anon, authenticated, service_role) may INSERT, UPDATE, DELETE or TRUNCATE a public table');

select is(
  (select array_agg(format('%s:%s', g.table_name, g.column_name) order by format('%s:%s', g.table_name, g.column_name))
     from information_schema.column_privileges g
    where g.table_schema = 'public'
      and g.grantee in ('anon', 'authenticated', 'service_role')
      and g.privilege_type in ('INSERT', 'UPDATE')),
  null,
  'no column-level INSERT or UPDATE right either (a table grant would cover every column anyway)');

select is(
  (select array_agg(format('%s:%s', g.table_name, g.privilege_type) order by format('%s:%s', g.table_name, g.privilege_type))
     from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.grantee = 'anon'),
  null,
  'anon holds no right on any public table');

select is(
  (select array_agg(format('%s:%s:%s', g.grantee, g.table_name, g.privilege_type) order by format('%s:%s:%s', g.grantee, g.table_name, g.privilege_type))
     from information_schema.role_table_grants g
    where g.table_schema = 'mes_private' and g.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')),
  null,
  'staff roles and station assignments (mes_private) are invisible to every API role');

select is(
  (select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'mes_private'::regnamespace)
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  null,
  'anon cannot execute any function of ours');

select is(
  (select array_agg(p.proname::text order by p.proname::text) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  array['complete_rework', 'lift_hold', 'open_hold', 'record_measurement', 'release_pack'],
  'authenticated can execute exactly the five shop RPCs');

select is(
  (select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'mes_private'::regnamespace)
      and p.prosecdef
      and not coalesce(p.proconfig @> array['search_path=""'], false)),
  null,
  'every SECURITY DEFINER function pins an empty search_path');

select is(
  (select array_agg(format('%s owned by %s', p.oid::regprocedure, p.proowner::regrole) order by format('%s owned by %s', p.oid::regprocedure, p.proowner::regrole)) from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'mes_private'::regnamespace)
      and p.prosecdef
      and p.proowner::regrole::text not in ('mes_rpc_owner', 'mes_audit_writer')),
  null,
  'SECURITY DEFINER functions are owned by the two limited owner roles, not by postgres');

select is(
  (select array_agg(r.rolname::text order by r.rolname::text) from pg_roles r
    where r.rolname in ('mes_rpc_owner', 'mes_audit_writer')
      and (r.rolsuper or r.rolbypassrls or r.rolcanlogin or r.rolcreaterole or r.rolcreatedb)),
  null,
  'the owner roles cannot log in, bypass RLS, or create roles or databases');

select is(
  (select array_agg(format('%s:%s', r, n) order by format('%s:%s', r, n))
     from unnest(array['mes_rpc_owner', 'mes_audit_writer']) r,
          unnest(array['public', 'mes_private']) n
    where has_schema_privilege(r, n, 'CREATE')),
  null,
  'the owner roles cannot create objects in public or mes_private');

select * from finish();
rollback;
