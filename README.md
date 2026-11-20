# Corella

**Automated testing for Indian-language voice and chat AI agents.** Corella plays simulated Indian customers (Hindi, Hinglish, regional accents; angry, confused, manipulative), talks to a customer's agent, scores every conversation, and shows exactly which turn failed and how to fix the prompt.

Website: corella.live · Version 0.2 (chat testing SaaS backend). Proprietary, see LICENSE.

## Architecture

```
 Dashboard / customer code ──HTTPS──► API (FastAPI) ──► Postgres ◄── Worker(s)
                                      API keys,           agents,      generate scenarios →
                                      plan limits         runs,        simulate → score → store
                                                          results          │
                                                                           └──► customer's agent (HTTPS)
                                                                           └──► LLM provider (Claude / OpenAI)
```

| Module | Role |
| --- | --- |
| `engine.py` | Scenario generation, customer simulation, scoring |
| `personas.py` | Built-in Indian customer personas |
| `llm.py` | Pluggable LLM (Claude, OpenAI, offline mock) with retries and token tracking |
| `api.py` | Public REST API v1, multi-tenant, API-key auth |
| `services.py` | Business logic: orgs, keys, quotas, run execution |
| `worker.py` | Background job runner (Postgres row locking, safe to scale out) |
| `models.py` | Database schema |
| `security.py` | Hashed API keys, SSRF protection for customer URLs |
| `report.py` | HTML failure report and JSON export |

## Commercial features in place

- **Multi-tenant:** every row belongs to an organization; cross-tenant access returns 404.
- **API keys:** `crl_live_…`, shown once, stored only as SHA-256 hashes, revocable.
- **Plans and quotas:** trial / starter / growth / enterprise (`config.py`), enforced on agents and monthly conversations (HTTP 402 when exceeded). Quota is reserved when a run is queued.
- **Usage metering:** every run stores LLM calls and tokens, for cost tracking and billing.
- **Security:** customer agent URLs must be public HTTPS (blocks internal-network attacks); stored agent credentials are never returned by the API.
- **Reliability:** LLM retries with backoff, per-scenario error isolation, graceful worker shutdown, multiple workers.
- **Ops:** Docker image, docker-compose stack, CI on GitHub Actions, environment-based config.

## Run locally

```bash
pip install -e ".[dev]"
pytest -q                                   # 14 tests, offline

# Quick local test without the server
corella run examples/demo.json --llm mock

# Full stack on your machine (SQLite)
export CORELLA_LLM=mock                     # or set ANTHROPIC_API_KEY
corella admin create-org "Test Co" --plan growth     # prints an API key
uvicorn corella.api:app --reload            # terminal 1, docs at http://localhost:8000/docs
corella worker                              # terminal 2
```

Production-like stack with Postgres: `cp .env.example .env`, fill it in, then `docker compose up --build`.

## API (v1)

All requests: `Authorization: Bearer crl_live_...`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/me` | Org, plan limits, usage this month |
| POST | `/v1/agents` | Register an agent (`target.type`: `http`, `prompt` or `demo`) |
| GET | `/v1/agents` | List agents |
| POST | `/v1/agents/{id}/runs` | Queue a test run (`scenarios`: a number to generate, or a list) |
| GET | `/v1/runs`, `/v1/runs/{id}` | Run status and summary |
| GET | `/v1/runs/{id}/results?failed_only=true` | Transcripts, scores, failures, fixes |
| GET | `/v1/runs/{id}/report` | Shareable HTML report |

HTTP agents receive `POST {"messages": [{"role": "user"|"assistant", "content": "..."}]}`; set `reply_field` to the reply's JSON path (e.g. `choices.0.message.content`).

## Before taking paying customers

- Encrypt stored agent credentials (`agents.target.headers`) with a KMS-managed key.
- Add Alembic migrations (tables are currently created on startup).
- Rate limiting at the edge, error tracking (e.g. Sentry), daily database backups.
- Terms of service, privacy policy and a data processing agreement (customer conversations may contain personal data; DPDP Act 2023 applies in India).

## Roadmap

1. Web dashboard (sign-up, agents, runs, reports) and Razorpay/Stripe billing
2. Voice testing: synthetic Indian voices, accents and noise over telephony
3. Regression runs on every prompt change (CI integration, webhooks)
4. Production call monitoring and the trust certificate
