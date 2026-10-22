from datetime import datetime, timezone
import uuid


def measurement(serial, cycle=1, voltage_v=22.86, acir_mohm=48.6, key=None, measured_at=None, station="WS-TEST-02"):
    return {
        "p_operation_key": key or str(uuid.uuid4()),
        "p_serial": serial,
        "p_cycle": cycle,
        "p_workstation": station,
        "p_voltage_v": voltage_v,
        "p_acir_mohm": acir_mohm,
        "p_measured_at": (measured_at or datetime.now(timezone.utc)).isoformat(),
    }


def record(stack, who, body):
    return stack.api("POST", "/rest/v1/rpc/record_measurement", who, body)


def call_sql(conn, sql, params):
    """Run one RPC on a direct connection and COMMIT. Returns the result or the SQL error."""
    try:
        value = conn.execute(sql, params).fetchone()[0]
        conn.commit()
        return {"ok": True, "result": value}
    except Exception as exc:  # psycopg.Error
        conn.rollback()
        diag = getattr(exc, "diag", None)
        return {"ok": False, "sqlstate": getattr(exc, "sqlstate", None),
                "message": diag.message_primary if diag else str(exc)}
