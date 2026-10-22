-- Run after schema.sql: the owners keep no CREATE right, exactly as the migration leaves them.
revoke create on schema public, mes_private from mes_rpc_owner, mes_audit_writer;
