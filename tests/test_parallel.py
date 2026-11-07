"""parallel_job: several statements at once, per-statement errors handed to `post`,
and a dependent second stage polled under its own token.

    python -m pytest tests -q
"""
from __future__ import annotations

import sys
import types
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import react_bridge as rb  # noqa: E402


class FakeSt:
    def __init__(self):
        self.session_state: dict = {}

    def html(self, *_a, **_k):
        pass

    def text_input(self, *_a, **_k):
        pass


@pytest.fixture
def st(monkeypatch):
    fake = FakeSt()
    monkeypatch.setattr(rb, "st", fake)
    monkeypatch.setattr(rb, "_FAST_WAIT", 0.05)
    return fake


class Session:
    """Statements finish when `done` holds their query id; `fail` makes one raise."""

    def __init__(self):
        self.calls: list[tuple[str, object]] = []
        self.done: set[str] = set()
        self.fail: set[str] = set()

    def sql(self, text, params=None):
        self.calls.append((text, params))
        qid = f"q{len(self.calls)}"
        return types.SimpleNamespace(collect_nowait=lambda: types.SimpleNamespace(query_id=qid))

    def create_async_job(self, qid):
        def result(_kind):
            if qid in self.fail:
                raise RuntimeError(f"boom {qid}")
            return pd.DataFrame({"QID": [qid]})
        return types.SimpleNamespace(is_done=lambda: qid in self.done, result=result)


def ids(frames):
    return [f if isinstance(f, str) else (f"ERR {f}" if isinstance(f, Exception) else f.iloc[0, 0]) for f in frames]


def test_all_statements_start_at_once_and_values_are_bound(st):
    s = Session()
    r = rb.parallel_job(s, [("SELECT ?", ["a"]), ("SELECT ?", ["b"]), ("SELECT ?", ["c"])], ids, key="k")
    assert [c for c in s.calls] == [("SELECT ?", ["a"]), ("SELECT ?", ["b"]), ("SELECT ?", ["c"])]
    assert r["pending"] and r["total"] == 3 and r["done"] == 0


def test_pending_reports_progress_and_poll_finishes(st):
    s = Session()
    r = rb.parallel_job(s, [("A", []), ("B", [])], ids)
    s.done = {"q1"}
    p = rb.poll_job({"token": r["token"]})
    assert p["pending"] and p["done"] == 1 and p["total"] == 2
    s.done = {"q1", "q2"}
    assert rb.poll_job({"token": r["token"]}) == ["q1", "q2"]
    assert len(s.calls) == 2, "polling must not re-submit the statements"


def test_a_failing_statement_reaches_post_instead_of_raising(st):
    s = Session()
    s.done, s.fail = {"q1", "q2"}, {"q2"}
    r = rb.parallel_job(s, [("A", []), ("B", [])], ids)
    assert rb.poll_job({"token": r["token"]}) == ["q1", "ERR boom q2"]


def test_a_submitting_run_answers_pending_without_waiting(st):
    # One step per run: a run that also waited and fetched could outlast the browser's retry.
    s = Session()
    s.done = {"q1", "q2"}
    r = rb.parallel_job(s, [("A", []), ("B", [])], ids)
    assert r["pending"] and r["done"] == 0 and r["total"] == 2


def test_a_dependent_second_stage_is_polled_under_its_own_token(st):
    s = Session()

    def stage1(frames):
        return rb.parallel_job(s, [("SECOND", [f.iloc[0, 0]]) for f in frames], ids, key="stage2")

    first = rb.parallel_job(s, [("FIRST", [])], stage1, key="stage1")
    s.done = {"q1"}
    second = rb.poll_job({"token": first["token"]})
    assert second["pending"] and second["token"] != first["token"]
    assert s.calls[-1] == ("SECOND", ["q1"])
    s.done = {"q1", "q2"}
    assert rb.poll_job({"token": second["token"]}) == ["q2"]


def test_query_job_still_runs_a_single_statement(st):
    s = Session()
    s.done = {"q1"}
    assert rb.query_job(s, "SELECT ?", [1]) == [{"QID": "q1"}]


def test_a_poll_checks_each_unfinished_statement_once(st):
    # A long poll greys the page and the browser re-sends: polls must stay short.
    s = Session()
    checks: list[str] = []
    real = s.create_async_job

    def counted(qid):
        job = real(qid)
        return types.SimpleNamespace(is_done=lambda: (checks.append(qid), job.is_done())[1], result=job.result)
    s.create_async_job = counted
    r = rb.parallel_job(s, [("A", []), ("B", []), ("C", [])], ids)
    assert checks == [], "the submitting run should not check status"
    s.done = {"q1"}
    checks.clear()
    rb.poll_job({"token": r["token"]})
    assert sorted(checks) == ["q1", "q2", "q3"]
    checks.clear()
    rb.poll_job({"token": r["token"]})
    assert sorted(checks) == ["q2", "q3"], "a statement already seen done was checked again"
