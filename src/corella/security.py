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


# ---------- encryption of customer secrets at rest ----------
# Agent targets can hold the customer's auth headers and confidential system prompt. These fields are stored as one
# Fernet token (AES-128-CBC + HMAC-SHA256) keyed from CORELLA_ENCRYPTION_KEY (any long random string).
SECRET_FIELDS = ("headers", "system_prompt")


def _fernet():
    import base64

    from cryptography.fernet import Fernet

    from .config import settings
    if not settings.encryption_key:
        return None
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(settings.encryption_key.encode()).digest()))


def encrypt_target(spec: dict) -> dict:
    """Return a copy of the target spec with secret fields replaced by an encrypted `sealed` token."""
    import json
    import logging
    f = _fernet()
    secret = {k: spec[k] for k in SECRET_FIELDS if spec.get(k)}
    if not secret:
        return dict(spec)
    if f is None:
        from .config import settings
        if settings.env == "production":
            raise RuntimeError("CORELLA_ENCRYPTION_KEY must be set to store agent credentials")
        logging.getLogger("corella.security").warning("CORELLA_ENCRYPTION_KEY not set: storing agent secrets unencrypted")
        return dict(spec)
    out = {k: v for k, v in spec.items() if k not in SECRET_FIELDS}
    out["sealed"] = f.encrypt(json.dumps(secret).encode()).decode()
    return out


def decrypt_target(spec: dict) -> dict:
    """Inverse of encrypt_target. Plain (legacy or unencrypted) specs pass through unchanged."""
    import json
    if "sealed" not in spec:
        return dict(spec)
    f = _fernet()
    if f is None:
        raise RuntimeError("CORELLA_ENCRYPTION_KEY is not set, so stored agent credentials cannot be decrypted")
    out = {k: v for k, v in spec.items() if k != "sealed"}
    out.update(json.loads(f.decrypt(spec["sealed"].encode())))
    return out
