"""What a restore must bring back besides rows: rights, policies, functions, triggers, roles."""
SCHEMAS = ("public", "mes_private")
ROLES = ("anon", "authenticated", "service_role", "mes_rpc_owner", "mes_audit_writer", "PUBLIC")
TABLES = ("public.workstations", "public.test_limits", "public.packs", "public.measurements",
          "public.holds", "public.audit_log", "mes_private.staff", "mes_private.staff_workstations")


def _rows(conn, sql, params=None):
    return [list(r) for r in conn.execute(sql, params).fetchall()]


def manifest(conn) -> dict:
    m = {}
    m["table_grants"] = sorted(f"{g}:{s}.{t}:{p}" for g, s, t, p in conn.execute(
        "select grantee, table_schema, table_name, privilege_type from information_schema.role_table_grants "
        "where table_schema = any(%s) and grantee = any(%s)", [list(SCHEMAS), list(ROLES)]).fetchall())
    m["column_grants"] = sorted(f"{g}:{s}.{t}.{c}:{p}" for g, s, t, c, p in conn.execute(
        "select grantee, table_schema, table_name, column_name, privilege_type from information_schema.column_privileges "
        "where table_schema = any(%s) and grantee = any(%s)", [list(SCHEMAS), list(ROLES)]).fetchall())
    m["schema_acl"] = _rows(conn, "select nspname, nspowner::regrole::text, coalesce(array(select a::text from unnest(nspacl) a order by 1)::text, '') from pg_namespace "
                                  "where nspname = any(%s) order by nspname", [list(SCHEMAS)])
    m["functions"] = _rows(conn,
        "select p.oid::regprocedure::text, p.proowner::regrole::text, p.prosecdef, coalesce(p.proconfig::text, ''), "
        "coalesce(array(select a::text from unnest(p.proacl) a order by 1)::text, ''), md5(p.prosrc) from pg_proc p where p.pronamespace::regnamespace::text = any(%s) "
        "order by 1", [list(SCHEMAS)])
    m["execute_rights"] = sorted(f"{r}:{f}" for r, f in conn.execute(
        "select r, p.oid::regprocedure::text from pg_proc p, unnest(array['anon','authenticated','service_role']) r "
        "where p.pronamespace::regnamespace::text = any(%s) and has_function_privilege(r, p.oid, 'EXECUTE')",
        [list(SCHEMAS)]).fetchall())
    m["policies"] = _rows(conn,
        "select schemaname, tablename, policyname, permissive, roles::text, cmd, coalesce(qual, ''), "
        "coalesce(with_check, '') from pg_policies where schemaname = any(%s) order by 1, 2, 3", [list(SCHEMAS)])
    m["rls"] = _rows(conn, "select c.oid::regclass::text, c.relrowsecurity, c.relforcerowsecurity, c.relowner::regrole::text "
                           "from pg_class c where c.relnamespace::regnamespace::text = any(%s) and c.relkind = 'r' "
                           "order by 1", [list(SCHEMAS)])
    m["triggers"] = _rows(conn, "select tgrelid::regclass::text, tgname, tgenabled::text, tgfoid::regproc::text "
                                "from pg_trigger t join pg_class c on c.oid = t.tgrelid "
                                "where not t.tgisinternal and c.relnamespace::regnamespace::text = any(%s) order by 1, 2",
                          [list(SCHEMAS)])
    m["constraints"] = _rows(conn, "select conrelid::regclass::text, conname, contype::text from pg_constraint "
                                   "where connamespace::regnamespace::text = any(%s) order by 1, 2", [list(SCHEMAS)])
    m["roles"] = _rows(conn, "select rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls "
                             "from pg_roles where rolname in ('mes_rpc_owner', 'mes_audit_writer') order by 1")
    m["memberships"] = sorted(f"{a}>{b}" for a, b in conn.execute(
        "select r.rolname, m.rolname from pg_auth_members am join pg_roles r on r.oid = am.roleid "
        "join pg_roles m on m.oid = am.member where r.rolname in ('mes_rpc_owner', 'mes_audit_writer')").fetchall())
    m["default_acl"] = sorted(f"{r}:{n}:{t}:{a}" for r, n, t, a in conn.execute(
        "select defaclrole::regrole::text, coalesce(defaclnamespace::regnamespace::text, '*'), defaclobjtype::text, "
        "array(select a::text from unnest(defaclacl) a order by 1)::text from pg_default_acl where defaclrole = 'postgres'::regrole").fetchall())
    m["rows"] = {}
    for t in TABLES:
        count, digest = conn.execute(
            f"select count(*), coalesce(md5(string_agg(x::text, '|' order by x::text)), '') from {t} x").fetchone()
        m["rows"][t] = {"count": count, "md5": digest}
    m["system_identifier"] = str(conn.execute("select system_identifier from pg_control_system()").fetchone()[0])
    m["server_version"] = conn.execute("show server_version").fetchone()[0]
    return m


def diff(source: dict, restored: dict, keys) -> list[str]:
    out = []
    for k in keys:
        a, b = source[k], restored[k]
        if isinstance(a, list):
            sa = {str(x) for x in a}
            sb = {str(x) for x in b}
            out += [f"{k}: lost {x}" for x in sorted(sa - sb)]
            out += [f"{k}: gained {x}" for x in sorted(sb - sa)]
        elif a != b:
            out.append(f"{k}: {a} != {b}")
    return out
