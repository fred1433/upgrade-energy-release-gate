import json
import os
import time
from pathlib import Path

import pytest

from tests.support import Stack

EVIDENCE_DIR = Path(os.environ.get("EVIDENCE_DIR", "evidence/run"))


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    if rep.when == "call":
        item.rep_call = rep
        if call.excinfo is not None:
            item.failure_message = str(call.excinfo.value)


class Evidence:
    """A structured record of one test: what each party did, in order, with relative time."""

    def __init__(self, nodeid: str):
        self.nodeid = nodeid
        self.t0 = time.monotonic()
        self.steps: list[dict] = []
        self.facts: dict = {}

    def step(self, actor: str, text: str, **data):
        self.steps.append({"t_ms": round((time.monotonic() - self.t0) * 1000, 1), "actor": actor,
                           "text": text, **({"data": data} if data else {})})

    def fact(self, key: str, value):
        self.facts[key] = value


@pytest.fixture(scope="session")
def stack():
    return Stack()


@pytest.fixture
def admin(stack):
    with stack.admin() as conn:
        yield conn


@pytest.fixture
def evidence(request):
    ev = Evidence(request.node.nodeid)
    yield ev
    rep = getattr(request.node, "rep_call", None)
    record = {
        "test": request.node.name,
        "nodeid": request.node.nodeid,
        "file": str(request.node.path.relative_to(request.config.rootpath)),
        "variant": os.environ.get("VARIANT", "main"),
        "outcome": rep.outcome if rep else "error",
        "failure": getattr(request.node, "failure_message", None),
        "facts": ev.facts,
        "steps": ev.steps,
    }
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    (EVIDENCE_DIR / f"{request.node.name}.json").write_text(json.dumps(record, indent=2, default=str))
