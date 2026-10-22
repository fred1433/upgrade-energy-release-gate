-- Run after restore_prelude.sql and before schema.sql. Found by the first drill:
-- pg_dump writes each object's grants relative to PostgreSQL's built-in defaults, while a fresh Supabase
-- instance applies its own default privileges at CREATE time (ALL on new public tables, functions and
-- sequences to anon, authenticated and service_role). Restored as is, every table and function came back
-- with those grants on top of the dumped ones: rows identical, rights not.
-- schema.sql sets these same default privileges again at its end, so the instance ends as the source.
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
