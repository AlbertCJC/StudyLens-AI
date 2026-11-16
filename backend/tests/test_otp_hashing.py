"""OTP storage is hashed at rest (P2-19)."""

from services.auth_service import _hash_otp, _verify_otp


def test_otp_is_hashed_at_rest():
    code = "123456"
    hashed = _hash_otp(code)
    assert hashed != code
    assert len(hashed) == 64  # SHA-256 hex digest
    # Same code produces same hash (deterministic).
    assert _hash_otp(code) == hashed
    # Different code produces different hash.
    assert _hash_otp("654321") != hashed


def test_otp_verification_uses_compare_digest():
    code = "123456"
    hashed = _hash_otp(code)
    assert _verify_otp(code, hashed)
    assert not _verify_otp("000000", hashed)
    assert not _verify_otp(code, "")


def test_otp_verification_accepts_legacy_plaintext():
    # Legacy plaintext stored values still verify once (backward compat).
    assert _verify_otp("123456", "123456")
    assert not _verify_otp("000000", "123456")
