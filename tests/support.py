"""Test plumbing: local Supabase endpoints, identities, admin inspection, barriers, a lossy proxy.

Identities
  - API calls carry a JWT minted with the LOCAL stack's JWT secret (read at runtime from
    `supabase status`, never stored): anon, operator, quality, service_role.
  - Direct connections use `SET ROLE authenticated` plus `request.jwt.claims`, which is what
    PostgREST does for every request.
  - `admin` is the postgres role. It is used only for fixtures and for inspecting the real state
    of rows, never to exercise a rule.
"""
from __future__ import annotations

import json
import os
import socket
import subprocess
import threading
import time
import uuid
from concurrent.futures import Future
from urllib.parse import urlparse

import httpx
import jwt
import psycopg

OPERATOR = "00000000-0000-4000-a000-000000000001"
QUALITY = "00000000-0000-4000-a000-000000000002"
MODEL = "RED V4 6S1P 5Ah (demo)"


def stack_env() -> dict[str, str]:
    workdir = os.environ.get("SUPABASE_WORKDIR")
    cmd = ["supabase", "status", "-o", "json"] + (["--workdir", workdir] if workdir else [])
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    start = out.index("{")
    return json.loads(out[start: out.rindex("}") + 1])


class Stack:
    def __init__(self):
        env = stack_env()
        self.api_url = env["API_URL"]
        self.db_url = env["DB_URL"]
        self.anon_key = env["ANON_KEY"]
        self.service_key = env["SERVICE_ROLE_KEY"]
        self._secret = env["JWT_SECRET"]

    def token(self, who: str) -> str:
        if who == "anon":
            return self.anon_key
        if who == "service_role":
            return self.service_key
        sub = {"operator": OPERATOR, "quality": QUALITY}[who]
        return jwt.encode({"sub": sub, "role": "authenticated", "aud": "authenticated",
                           "exp": int(time.time()) + 3600}, self._secret, algorithm="HS256")

    def api(self, method: str, path: str, who: str, body=None, prefer: str | None = None,
            base: str | None = None) -> dict:
        """One real HTTP call. Returns what was asked and what came back (no token in the record)."""
        headers = {"apikey": self.anon_key, "Authorization": f"Bearer {self.token(who)}", "Connection": "close"}
        if prefer:
            headers["Prefer"] = prefer
        r = httpx.request(method, (base or self.api_url) + path, json=body, headers=headers, timeout=10)
        try:
            payload = r.json() if r.content else None
        except ValueError:
            payload = r.text
        return {"request": {"method": method, "path": path, "as": who, "body": body,
                            **({"prefer": prefer} if prefer else {})},
                "status": r.status_code, "body": payload}

    def admin(self) -> psycopg.Connection:
        return psycopg.connect(self.db_url, autocommit=True)

    def user_conn(self, sub: str) -> psycopg.Connection:
        c = psycopg.connect(self.db_url)
        c.execute("set role authenticated")
        c.execute("select set_config('request.jwt.claims', %s, false)",
                  [json.dumps({"sub": sub, "role": "authenticated"})])
        c.commit()
        return c


def new_pack(admin: psycopg.Connection, prefix: str = "DEMO-6S1P") -> str:
    serial = f"{prefix}-{uuid.uuid4().hex[:6].upper()}"
    admin.execute("insert into public.packs (serial, model) values (%s, %s)", [serial, MODEL])
    return serial


def pack_state(admin, serial) -> dict:
    status, eligible, cycle = admin.execute(
        "select status, release_eligible, cycle from public.packs where serial = %s", [serial]).fetchone()
    open_holds = admin.execute(
        "select count(*) from public.holds where serial = %s and status = 'open'", [serial]).fetchone()[0]
    return {"status": status, "release_eligible": eligible, "cycle": cycle, "open_holds": open_holds}


def measurement_rows(admin, serial) -> list[dict]:
    cur = admin.execute(
        "select id, operation_key::text, cycle, voltage_v::text, acir_mohm::text, result from public.measurements "
        "where serial = %s order by id", [serial])
    cols = [d.name for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def backend_pid(conn) -> int:
    return conn.info.backend_pid


def wait_blocked_or_done(admin, pid: int, fut: Future, timeout: float = 15.0) -> str:
    """Barrier: return once the other connection is waiting on a lock, or has already finished."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if fut.done():
            return "finished without waiting"
        row = admin.execute("select wait_event_type, wait_event from pg_stat_activity where pid = %s",
                            [pid]).fetchone()
        if row and row[0] == "Lock":
            return f"waiting on a lock ({row[1]})"
        time.sleep(0.005)
    raise TimeoutError("connection neither blocked nor finished")


def run_in_thread(fn) -> Future:
    fut: Future = Future()

    def target():
        try:
            fut.set_result(fn())
        except BaseException as exc:  # noqa: BLE001
            fut.set_exception(exc)

    threading.Thread(target=target, daemon=True).start()
    return fut


class LossyProxy:
    """A TCP proxy in front of the API gateway that can drop one reply on purpose.

    'drop_reply': the request reaches the server and the server answers, but the station never
    receives the answer (Wi-Fi drop, cable pulled, process restarted). Deterministic, no timing.
    """

    def __init__(self, upstream_url: str):
        u = urlparse(upstream_url)
        self.upstream = (u.hostname, u.port or 80)
        self.plan: list[str] = []
        self.log: list[dict] = []
        self.sock = socket.socket()
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(16)
        self.url = f"http://127.0.0.1:{self.sock.getsockname()[1]}"
        threading.Thread(target=self._serve, daemon=True).start()

    def _serve(self):
        while True:
            try:
                client, _ = self.sock.accept()
            except OSError:
                return
            threading.Thread(target=self._handle, args=(client,), daemon=True).start()

    @staticmethod
    def _read_message(sock) -> tuple[bytes, bytes]:
        data = b""
        while b"\r\n\r\n" not in data:
            chunk = sock.recv(65536)
            if not chunk:
                return data, b""
            data += chunk
        head, rest = data.split(b"\r\n\r\n", 1)
        length = 0
        chunked = False
        for line in head.split(b"\r\n")[1:]:
            k, _, v = line.partition(b":")
            if k.strip().lower() == b"content-length":
                length = int(v.strip())
            if k.strip().lower() == b"transfer-encoding" and b"chunked" in v.lower():
                chunked = True
        if chunked:
            while not rest.endswith(b"0\r\n\r\n"):
                chunk = sock.recv(65536)
                if not chunk:
                    break
                rest += chunk
        else:
            while len(rest) < length:
                chunk = sock.recv(65536)
                if not chunk:
                    break
                rest += chunk
        return head, rest

    def _handle(self, client):
        with client:
            head, body = self._read_message(client)
            if not head:
                return
            lines = head.split(b"\r\n")
            fwd = [lines[0]] + [l for l in lines[1:] if not l.lower().startswith(b"connection:")] + [b"Connection: close"]
            with socket.create_connection(self.upstream) as up:
                up.sendall(b"\r\n".join(fwd) + b"\r\n\r\n" + body)
                rhead, rbody = self._read_message(up)
            action = self.plan.pop(0) if self.plan else "forward"
            self.log.append({"action": action, "request": lines[0].decode(),
                             "server_status": rhead.split(b"\r\n", 1)[0].decode()})
            if action == "drop_reply":
                client.shutdown(socket.SHUT_RDWR)
                return
            client.sendall(rhead + b"\r\n\r\n" + rbody)

    def close(self):
        self.sock.close()
