"""Security headers (P2-15)."""


def test_security_headers_present(client):
    """Security headers are present on API responses."""
    resp = client.get("/api/health")
    headers = resp.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert headers.get("Permissions-Policy") == "camera=(), microphone=(), geolocation=()"
    csp = headers.get("Content-Security-Policy")
    assert csp is not None
    assert "default-src 'self'" in csp
    assert "script-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp


def test_hsts_not_present_without_https(client):
    """HSTS is not set on non-secure (non-production) requests."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert "Strict-Transport-Security" not in resp.headers
