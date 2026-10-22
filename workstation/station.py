"""A minimal test-bench workstation client (illustrative).

The station writes the operation key AND the measurement to a local SQLite outbox
before anything leaves the machine. A send that fails or loses its reply stays
pending and is resent later with the same key and the same payload. The server
decides what that resend means (see record_measurement in the migration).
"""
from __future__ import annotations

import json
import sqlite3
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Protocol

import httpx


class TransportError(Exception):
    """The station cannot tell whether the server recorded the measurement."""


class Transport(Protocol):
    name: str

    def send(self, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]: ...


class HttpTransport:
    """POST /rest/v1/rpc/record_measurement through the API gateway."""

    name = "api"

    def __init__(self, base_url: str, apikey: str, token: str, timeout: float = 10.0):
        self.url = base_url.rstrip("/") + "/rest/v1/rpc/record_measurement"
        self.headers = {"apikey": apikey, "Authorization": f"Bearer {token}", "Connection": "close"}
        self.timeout = timeout

    def send(self, payload):
        try:
            r = httpx.post(self.url, json=payload, headers=self.headers, timeout=self.timeout)
        except httpx.TransportError as exc:  # connection reset, reply lost, timeout
            raise TransportError(f"{type(exc).__name__}: {exc}") from exc
        try:
            body = r.json()
        except ValueError:
            body = {"raw": r.text}
        return r.status_code, body


@dataclass
class Station:
    workstation_id: str
    outbox_path: str
    transport: Transport
    on_event: Callable[[str, dict[str, Any]], None] = field(default=lambda kind, data: None)

    def __post_init__(self):
        self.db = sqlite3.connect(self.outbox_path, isolation_level=None)
        self.db.execute("pragma journal_mode = wal")
        self.db.execute("pragma synchronous = full")
        self.db.execute(
            """create table if not exists outbox (
                 operation_key text primary key,
                 payload       text not null,
                 status        text not null default 'pending',  -- pending | acknowledged | conflict | rejected
                 attempts      integer not null default 0,
                 last_error    text,
                 server_reply  text,
                 created_at    real not null)"""
        )

    # 1. capture: key and measurement are durable before the first send
    def capture(self, serial: str, cycle: int, voltage_v: float, acir_mohm: float,
                measured_at: datetime | None = None) -> str:
        key = str(uuid.uuid4())
        payload = {
            "p_operation_key": key,
            "p_serial": serial,
            "p_cycle": cycle,
            "p_workstation": self.workstation_id,
            "p_voltage_v": voltage_v,
            "p_acir_mohm": acir_mohm,
            "p_measured_at": (measured_at or datetime.now(timezone.utc)).isoformat(),
        }
        self.db.execute("begin immediate")
        self.db.execute("insert into outbox (operation_key, payload, created_at) values (?, ?, ?)",
                        (key, json.dumps(payload, sort_keys=True), time.time()))
        self.db.execute("commit")
        self.on_event("captured", {"operation_key": key, "payload": payload})
        return key

    # 2. flush: send every pending entry, keep it pending unless the server answered
    def flush(self, transport: Transport | None = None) -> list[dict[str, Any]]:
        transport = transport or self.transport
        results = []
        rows = self.db.execute(
            "select operation_key, payload, attempts from outbox where status = 'pending' order by created_at").fetchall()
        for key, payload_json, attempts in rows:
            payload = json.loads(payload_json)
            self.on_event("sent", {"operation_key": key, "attempt": attempts + 1, "transport": transport.name})
            try:
                status, body = transport.send(payload)
            except TransportError as exc:
                self.db.execute("update outbox set attempts = attempts + 1, last_error = ? where operation_key = ?",
                                (str(exc), key))
                self.on_event("no_reply", {"operation_key": key, "error": str(exc), "kept": "pending"})
                results.append({"operation_key": key, "state": "pending", "error": str(exc)})
                continue
            if status == 200:
                state = "acknowledged"
            elif status == 409:
                state = "conflict"       # same key, different content: a person must look
            elif 400 <= status < 500:
                state = "rejected"       # refused by a rule or a right: a person must look
            else:
                state = "pending"        # server error: try again later, same key
            self.db.execute(
                "update outbox set attempts = attempts + 1, status = ?, server_reply = ? where operation_key = ?",
                (state, json.dumps(body), key))
            self.on_event("reply", {"operation_key": key, "http_status": status, "body": body, "state": state})
            results.append({"operation_key": key, "state": state, "http_status": status, "body": body})
        return results

    def entry(self, key: str) -> dict[str, Any]:
        row = self.db.execute(
            "select status, attempts, last_error, server_reply, payload from outbox where operation_key = ?",
            (key,)).fetchone()
        status, attempts, last_error, reply, payload = row
        return {"status": status, "attempts": attempts, "last_error": last_error,
                "server_reply": json.loads(reply) if reply else None, "payload": json.loads(payload)}
