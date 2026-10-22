"""Family 1, the focal case: one battery test, one recorded result, whatever the network does."""
import psycopg

from tests.support import OPERATOR, LossyProxy, measurement_rows, new_pack
from workstation.station import HttpTransport, Station, TransportError


def make_station(stack, base_url, tmp_path, evidence):
    return Station(
        workstation_id="WS-TEST-02",
        outbox_path=str(tmp_path / "outbox.sqlite"),
        transport=HttpTransport(base_url, stack.anon_key, stack.token("operator")),
        on_event=lambda kind, data: evidence.step("station", kind, **data),
    )


def test_lost_reply_is_recorded_once(stack, admin, evidence, tmp_path):
    serial = new_pack(admin)
    proxy = LossyProxy(stack.api_url)
    station = make_station(stack, proxy.url, tmp_path, evidence)
    evidence.fact("serial", serial)

    key = station.capture(serial, cycle=1, voltage_v=22.86, acir_mohm=48.6)

    proxy.plan.append("drop_reply")
    first = station.flush()
    evidence.step("network", "reply_lost", **proxy.log[-1])

    rows = measurement_rows(admin, serial)
    evidence.step("database", "checked", rows=rows, note="ADMIN inspection after the lost reply")
    assert first[0]["state"] == "pending", "the station must keep the entry when it cannot know the outcome"
    assert len(rows) == 1, "the server had committed the first send before the reply was lost"
    first_id = rows[0]["id"]

    second = station.flush()
    rows = measurement_rows(admin, serial)
    evidence.step("database", "checked", rows=rows, note="ADMIN inspection after the resend")
    evidence.fact("rows_after_resend", len(rows))
    evidence.fact("outbox", station.entry(key))
    proxy.close()

    assert len(rows) == 1, f"one battery test, {len(rows)} measurement rows"
    assert second[0]["state"] == "acknowledged"
    assert second[0]["body"]["outcome"] == "replayed"
    assert second[0]["body"]["measurement_id"] == first_id


class CutBeforeCommit:
    """First attempt over a direct database connection that is cut after the function ran, before COMMIT."""

    name = "direct database connection"

    def __init__(self, stack, admin, evidence):
        self.stack, self.admin, self.evidence = stack, admin, evidence

    def send(self, p):
        conn = self.stack.user_conn(OPERATOR)
        result = conn.execute(
            "select public.record_measurement(%s::uuid, %s, %s, %s, %s::numeric, %s::numeric, %s::timestamptz)",
            [p["p_operation_key"], p["p_serial"], p["p_cycle"], p["p_workstation"],
             p["p_voltage_v"], p["p_acir_mohm"], p["p_measured_at"]]).fetchone()[0]
        self.evidence.step("database", "ran_uncommitted", result=result)
        self.admin.execute("select pg_terminate_backend(%s)", [conn.info.backend_pid])
        self.evidence.step("network", "connection_cut", note="server side of the connection terminated before COMMIT")
        try:
            conn.commit()
        except psycopg.OperationalError as exc:
            raise TransportError(f"OperationalError: {str(exc).strip().splitlines()[0]}") from exc
        finally:
            conn.close()
        raise AssertionError("commit should not succeed on a terminated connection")


def test_rolled_back_attempt_is_resent_once(stack, admin, evidence, tmp_path):
    serial = new_pack(admin)
    station = make_station(stack, stack.api_url, tmp_path, evidence)
    key = station.capture(serial, cycle=1, voltage_v=22.86, acir_mohm=48.6)

    first = station.flush(CutBeforeCommit(stack, admin, evidence))
    rows = measurement_rows(admin, serial)
    evidence.step("database", "checked", rows=rows, note="ADMIN inspection after the cut")
    assert first[0]["state"] == "pending"
    assert rows == [], "the cut transaction rolled back: nothing recorded"

    second = station.flush()
    rows = measurement_rows(admin, serial)
    evidence.step("database", "checked", rows=rows, note="ADMIN inspection after the resend")
    evidence.fact("outbox", station.entry(key))

    assert len(rows) == 1, f"one battery test, {len(rows)} measurement rows"
    assert second[0]["body"]["outcome"] == "recorded"
