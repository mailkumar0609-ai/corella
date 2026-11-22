"""All configuration comes from environment variables (12-factor). See .env.example."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


@dataclass
class Settings:
    env: str = field(default_factory=lambda: _env("CORELLA_ENV", "development"))
    database_url: str = field(default_factory=lambda: _env("DATABASE_URL", "sqlite:///./corella.db"))
    db_schema: str = field(default_factory=lambda: _env("CORELLA_DB_SCHEMA", "corella"))
    llm_provider: str = field(default_factory=lambda: _env("CORELLA_LLM"))
    llm_model: str = field(default_factory=lambda: _env("CORELLA_MODEL"))
    # Cheaper model for the simulated customer (most of the token volume); judging stays on CORELLA_MODEL
    sim_model: str = field(default_factory=lambda: _env("CORELLA_SIM_MODEL"))
    anthropic_api_key: str = field(default_factory=lambda: _env("ANTHROPIC_API_KEY"))
    openai_api_key: str = field(default_factory=lambda: _env("OPENAI_API_KEY"))
    llm_timeout: float = field(default_factory=lambda: float(_env("CORELLA_LLM_TIMEOUT", "120")))
    llm_max_retries: int = field(default_factory=lambda: int(_env("CORELLA_LLM_RETRIES", "3")))
    # Run the background worker inside the API process (cheapest hosting: one service). Use a separate
    # `corella worker` service instead once volume grows.
    embedded_worker: bool = field(default_factory=lambda: _env("CORELLA_EMBEDDED_WORKER", "false").lower() == "true")
    worker_poll_seconds: float = field(default_factory=lambda: float(_env("CORELLA_WORKER_POLL", "2")))
    # Blocks tests against private/internal addresses (SSRF protection). Disable only for local development.
    allow_private_targets: bool = field(default_factory=lambda: _env("CORELLA_ALLOW_PRIVATE_TARGETS", "false").lower() == "true")
    max_scenarios_per_run: int = field(default_factory=lambda: int(_env("CORELLA_MAX_SCENARIOS", "200")))
    # Encrypts customers' agent credentials and prompts at rest. Any long random string; never change it once set.
    encryption_key: str = field(default_factory=lambda: _env("CORELLA_ENCRYPTION_KEY"))
    # Voice testing (Sarvam AI speech for Indian languages). Without a key, voice runs use an offline mock.
    sarvam_api_key: str = field(default_factory=lambda: _env("SARVAM_API_KEY"))
    voice_provider: str = field(default_factory=lambda: _env("CORELLA_VOICE"))
    sarvam_tts_model: str = field(default_factory=lambda: _env("SARVAM_TTS_MODEL", "bulbul:v3"))
    sarvam_stt_model: str = field(default_factory=lambda: _env("SARVAM_STT_MODEL", "saaras:v4"))
    supabase_url: str = field(default_factory=lambda: _env("SUPABASE_URL").rstrip("/"))
    supabase_anon_key: str = field(default_factory=lambda: _env("SUPABASE_ANON_KEY"))
    razorpay_key_id: str = field(default_factory=lambda: _env("RAZORPAY_KEY_ID"))
    razorpay_key_secret: str = field(default_factory=lambda: _env("RAZORPAY_KEY_SECRET"))
    razorpay_webhook_secret: str = field(default_factory=lambda: _env("RAZORPAY_WEBHOOK_SECRET"))
    # Razorpay plan ids (create these once in the Razorpay dashboard), e.g. RAZORPAY_PLAN_GROWTH=plan_xxx
    razorpay_plans: dict = field(default_factory=lambda: {p: _env(f"RAZORPAY_PLAN_{p.upper()}") for p in ("starter", "growth")})
    app_url: str = field(default_factory=lambda: _env("CORELLA_APP_URL", "http://localhost:3000"))
    cors_origins: list[str] = field(default_factory=lambda: [o for o in _env("CORELLA_CORS_ORIGINS", "").split(",") if o])


settings = Settings()

# Plans. price_inr is the monthly list price (GST extra); enterprise is quoted per customer.
PLANS = {
    "trial": {"monthly_conversations": 100, "max_agents": 1, "price_inr": 0, "regression": False, "webhooks": False},
    "starter": {"monthly_conversations": 1_000, "max_agents": 1, "price_inr": 4_999, "regression": True, "webhooks": False},
    "growth": {"monthly_conversations": 10_000, "max_agents": 5, "price_inr": 24_999, "regression": True, "webhooks": True},
    "enterprise": {"monthly_conversations": 1_000_000, "max_agents": 1_000, "price_inr": None, "regression": True, "webhooks": True},
}
