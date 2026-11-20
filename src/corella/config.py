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
    llm_provider: str = field(default_factory=lambda: _env("CORELLA_LLM"))
    llm_model: str = field(default_factory=lambda: _env("CORELLA_MODEL"))
    anthropic_api_key: str = field(default_factory=lambda: _env("ANTHROPIC_API_KEY"))
    openai_api_key: str = field(default_factory=lambda: _env("OPENAI_API_KEY"))
    llm_timeout: float = field(default_factory=lambda: float(_env("CORELLA_LLM_TIMEOUT", "120")))
    llm_max_retries: int = field(default_factory=lambda: int(_env("CORELLA_LLM_RETRIES", "3")))
    worker_poll_seconds: float = field(default_factory=lambda: float(_env("CORELLA_WORKER_POLL", "2")))
    # Blocks tests against private/internal addresses (SSRF protection). Disable only for local development.
    allow_private_targets: bool = field(default_factory=lambda: _env("CORELLA_ALLOW_PRIVATE_TARGETS", "false").lower() == "true")
    max_scenarios_per_run: int = field(default_factory=lambda: int(_env("CORELLA_MAX_SCENARIOS", "200")))
    cors_origins: list[str] = field(default_factory=lambda: [o for o in _env("CORELLA_CORS_ORIGINS", "").split(",") if o])


settings = Settings()

# Plans: monthly simulated-conversation quota. Prices live in billing, not here.
PLANS = {
    "trial": {"monthly_conversations": 100, "max_agents": 1},
    "starter": {"monthly_conversations": 1_000, "max_agents": 1},
    "growth": {"monthly_conversations": 10_000, "max_agents": 5},
    "enterprise": {"monthly_conversations": 1_000_000, "max_agents": 1_000},
}
