"""Validation for remote file URLs before the server fetches them.

Material records can contain a stored file URL. Fetching an arbitrary URL
server-side is an SSRF risk, so only http(s) URLs on public hosts are allowed.
"""

import ipaddress
import os
import socket
from urllib.parse import urlparse

_DEFAULT_ALLOWED_HOSTS = {
    "res.cloudinary.com",
    "storage.googleapis.com",
    "firebasestorage.googleapis.com",
}


def _allowed_hosts():
    configured = os.getenv("MATERIAL_FETCH_ALLOWED_HOSTS", "").strip()
    extra = {h.strip().lower() for h in configured.split(",") if h.strip()}
    return _DEFAULT_ALLOWED_HOSTS | extra


def _is_private_address(hostname):
    try:
        addresses = socket.getaddrinfo(hostname, None)
    except OSError:
        return True
    if not addresses:
        return True
    for family in addresses:
        raw_ip = family[4][0]
        try:
            ip = ipaddress.ip_address(raw_ip)
        except ValueError:
            return True
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return True
    return False


def validate_remote_file_url(url):
    """Returns ``(url, None)`` when safe to fetch, or ``(None, reason)``."""
    parsed = urlparse((url or "").strip())
    if parsed.scheme.lower() not in ("http", "https"):
        return None, "unsupported-scheme"
    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return None, "missing-host"
    if hostname in _allowed_hosts():
        return url, None
    if hostname in ("localhost",) or hostname.endswith(".localhost"):
        return None, "private-host"
    try:
        literal = ipaddress.ip_address(hostname)
    except ValueError:
        literal = None
    if literal is not None:
        if (
            literal.is_private
            or literal.is_loopback
            or literal.is_link_local
            or literal.is_multicast
            or literal.is_reserved
            or literal.is_unspecified
        ):
            return None, "private-host"
        return url, None
    if _is_private_address(hostname):
        return None, "private-host"
    return url, None
