"""In-memory rate limiter behavior (P1-06)."""

import time

import lib.rate_limit as rl


class _FakeTime:
    def __init__(self, value=0.0):
        self.value = value

    def __call__(self):
        return self.value


def _install(ft):
    rl._RATE_HITS.clear()
    rl.time.monotonic = ft


def _restore():
    rl.time.monotonic = time.monotonic
    rl._RATE_HITS.clear()


def test_enforces_limit_then_resets_after_window():
    ft = _FakeTime()
    _install(ft)
    try:
        assert rl._rate_limit_exceeded("login:user", 3) is False
        ft.value = 1.0
        assert rl._rate_limit_exceeded("login:user", 3) is False
        ft.value = 2.0
        assert rl._rate_limit_exceeded("login:user", 3) is False
        # 4th hit within the 60s window exceeds the limit of 3.
        ft.value = 3.0
        assert rl._rate_limit_exceeded("login:user", 3) is True
        used, remaining, reset = rl._rate_limit_status("login:user", 3)
        assert used == 3
        assert remaining == 0
        assert reset > 0
        # Once the window slides past, the bucket empties and the caller is
        # allowed again.
        ft.value = 61.0
        assert rl._rate_limit_exceeded("login:user", 3) is False
    finally:
        _restore()


def test_keys_are_independent():
    ft = _FakeTime()
    _install(ft)
    try:
        assert rl._rate_limit_exceeded("a", 1) is False
        assert rl._rate_limit_exceeded("a", 1) is True
        # A different key is not affected by "a" being rate limited.
        assert rl._rate_limit_exceeded("b", 1) is False
    finally:
        _restore()


def test_status_returns_zero_when_no_hits():
    ft = _FakeTime()
    _install(ft)
    try:
        used, remaining, reset = rl._rate_limit_status("fresh", 5)
        assert used == 0
        assert remaining == 5
        assert reset == 0.0
    finally:
        _restore()
