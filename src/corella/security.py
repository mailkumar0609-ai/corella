"""API keys and outbound-request safety."""
from __future__ import annotations

import hashlib
import ipaddress
import secrets
import socket
from urllib.parse import urlparse

KEY_PREFIX = "crl_live_"


def generate_api_key() -> tuple[str, str, str]:
    """Returns (raw_key, display_prefix, sha256_hash). Show raw_key to the user once; store only the hash."""
    raw = KEY_PREFIX + secrets.token_urlsafe(32)
    return raw, raw[:16], hash_key(raw)


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class UnsafeTarget(ValueError):
    pass


def check_target_url(url: str, allow_private: bool = False) -> None:
    """Blocks SSRF: customers must not be able to make our servers call internal/private addresses."""
    p = urlparse(url)
    if p.scheme not in ("https", "http"):
        raise UnsafeTarget("Target URL must use http or https")
    if not p.hostname:
        raise UnsafeTarget("Target URL has no host")
    if allow_private:
        return
    if p.scheme != "https":
        raise UnsafeTarget("Target URL must use https")
    try:
        addrs = {i[4][0] for i in socket.getaddrinfo(p.hostname, p.port or 443)}
    except socket.gaierror as e:
        raise UnsafeTarget(f"Cannot resolve host {p.hostname}") from e
    for a in addrs:
        ip = ipaddress.ip_address(a)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            raise UnsafeTarget("Target URL points to a private or internal address")
