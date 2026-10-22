-- Run after roles.sql and before schema.sql. Found by the first drill:
--  1. `supabase db dump --role-only` creates our owner roles but does not carry the membership
--     postgres needs to hand them objects ("must be able to SET ROLE mes_rpc_owner").
--  2. ALTER ... OWNER TO also needs CREATE on the schema for the new owner; the migration takes it back,
--     so the dump has none. Granted here for the restore, taken back in restore_postlude.sql.
grant mes_rpc_owner, mes_audit_writer to postgres;
create schema if not exists mes_private;
grant create on schema public, mes_private to mes_rpc_owner, mes_audit_writer;
