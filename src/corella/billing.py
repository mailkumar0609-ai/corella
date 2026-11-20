"""Razorpay subscriptions (India-first; add Stripe for international customers later).

Flow: dashboard calls POST /v1/billing/checkout -> we create a Razorpay subscription carrying the org id
in its notes -> the browser opens Razorpay Checkout -> Razorpay calls POST /webhooks/razorpay -> we verify
the signature and set the organization's plan. The webhook is the only thing that ever upgrades a plan.
"""
from __future__ import annotations

import hashlib
import hmac
import logging

import httpx
from sqlalchemy.orm import Session

from .config import PLANS, settings
from .models import Organization

log = logging.getLogger("corella.billing")
API = "https://api.razorpay.com/v1"


class BillingError(Exception):
    pass


def configured() -> bool:
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


def create_subscription(org: Organization, plan: str, email: str | None) -> dict:
    if not configured():
        raise BillingError("Billing is not configured")
    plan_id = settings.razorpay_plans.get(plan)
    if not plan_id:
        raise BillingError(f"Plan '{plan}' cannot be bought online")
    r = httpx.post(f"{API}/subscriptions", auth=(settings.razorpay_key_id, settings.razorpay_key_secret), timeout=20,
                   json={"plan_id": plan_id, "total_count": 120, "customer_notify": 1,
                         "notes": {"org_id": org.id, "plan": plan, "email": email or ""}})
    if r.status_code >= 300:
        log.error("razorpay create subscription failed: %s %s", r.status_code, r.text[:300])
        raise BillingError("Could not start checkout, please try again")
    sub = r.json()
    return {"subscription_id": sub["id"], "key_id": settings.razorpay_key_id, "short_url": sub.get("short_url")}


def verify_signature(raw_body: bytes, signature: str) -> bool:
    if not settings.razorpay_webhook_secret or not signature:
        return False
    expected = hmac.new(settings.razorpay_webhook_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


ACTIVE = {"subscription.activated", "subscription.charged", "subscription.resumed"}
INACTIVE = {"subscription.cancelled", "subscription.halted", "subscription.completed", "subscription.paused"}


def handle_event(db: Session, event: dict) -> str:
    """Apply a verified Razorpay event. Idempotent: replaying an event gives the same result."""
    name = event.get("event", "")
    sub = event.get("payload", {}).get("subscription", {}).get("entity", {})
    notes = sub.get("notes") or {}
    org = db.get(Organization, notes.get("org_id", ""))
    if not org:
        return "ignored: unknown organization"
    if name in ACTIVE and notes.get("plan") in PLANS:
        org.plan, org.subscription_status, org.razorpay_subscription_id = notes["plan"], "active", sub.get("id")
    elif name in INACTIVE and org.razorpay_subscription_id == sub.get("id"):
        org.plan, org.subscription_status = "trial", sub.get("status", "cancelled")
    else:
        return f"ignored: {name}"
    db.commit()
    log.info("org %s -> plan %s (%s)", org.id, org.plan, name)
    return "ok"


def cancel_subscription(org: Organization) -> None:
    if not (configured() and org.razorpay_subscription_id):
        raise BillingError("No active subscription")
    r = httpx.post(f"{API}/subscriptions/{org.razorpay_subscription_id}/cancel", timeout=20,
                   auth=(settings.razorpay_key_id, settings.razorpay_key_secret), json={"cancel_at_cycle_end": 1})
    if r.status_code >= 300:
        raise BillingError("Could not cancel, please contact support")
