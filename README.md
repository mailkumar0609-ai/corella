# Corella

**Automated testing for Indian-language voice and chat AI agents.** Corella plays simulated Indian customers (Hindi, Hinglish, regional accents; angry, confused, manipulative), talks to a customer's agent, scores every conversation, and shows exactly which turn failed and how to fix the prompt.

Website: corella.live · Version 0.4 (agentic testing SaaS: autonomous testing agent, API, dashboard, billing). Proprietary, see LICENSE.

## The autonomous testing agent (`agentic.py`)

Corella is itself an agentic AI system. In autonomous mode (`"mode": "autonomous"`), it runs a loop instead of a fixed script:

1. **Plan:** reads the agent's description and rules and ranks the risks to attack.
2. **Attack:** adaptive simulated customers that change tactic when the agent resists (rephrase, switch language, pressure, claimed authority).
3. **Learn:** clusters every failure into root causes in the agent's instructions. Large runs are analysed recursively (in batches, then merged), so no failure is dropped.
4. **Explore:** writes new, harder scenarios aimed at those weak spots, round after round, within the conversation budget.
5. **Fix:** writes a patched system prompt addressing every root cause.
6. **Verify and refine:** if Corella has the prompt, it replays the failures against the patch *and* a sample of conversations that already passed (regression guard). If anything still fails or broke, it refines the patch with that evidence and replays again (`fix_attempts`, default 2), then keeps the best patch: one that fixes the most failures without breaking what worked. All of this stays inside the run's conversation budget.

Each step is logged to `runs.events`, which the dashboard shows live.

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
| `agentic.py` | Autonomous testing agent: plan, attack, learn, explore, fix, verify |
| `engine.py` | Scenario generation, adaptive customer simulation, scoring |
| `personas.py` | Built-in Indian customer personas |
| `llm.py` | Pluggable LLM (Claude, OpenAI, offline mock) with retries and token tracking |
| `api.py` | Public REST API v1, multi-tenant, API-key auth |
| `services.py` | Business logic: orgs, keys, quotas, run execution |
| `worker.py` | Background job runner (Postgres row locking, safe to scale out) |
| `models.py` | Database schema |
| `security.py` | Hashed API keys, SSRF protection for customer URLs |
| `report.py` | HTML failure report and JSON export |

## Repository layout

- `src/corella/`: Python API, worker and test engine
- `web/`: Next.js dashboard and the corella.live landing page (deploy on Vercel)
- `tests/`: backend tests (offline, mock LLM)

## Commercial features in place

- **Self-serve sign-up:** Google or email magic link (Supabase Auth), free trial workspace created on first sign-in.
- **Dashboard:** overview with usage, agents, test runs with transcripts, failing turns and suggested fixes, shareable reports.
- **Billing:** Razorpay subscriptions (UPI, cards, netbanking); plans change only through verified Razorpay webhooks. Cancel at period end.
- **Regression testing:** re-run a finished run's exact scenarios after a prompt change and see what broke or got fixed (paid plans).
- **CI and integrations:** API keys managed in the dashboard; signed run-finished webhooks with regression results (Growth).

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
pytest -q                                   # offline, mock LLM

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
| POST | `/v1/runs/{id}/rerun` | Regression re-run of the same scenarios |
| GET | `/v1/runs/{id}/compare` | What regressed / got fixed vs the baseline |
| GET/POST/DELETE | `/v1/api-keys` | Manage API keys |
| PUT | `/v1/settings/webhook` | Run-finished webhook (signed with HMAC-SHA256) |
| POST | `/v1/billing/checkout`, `/v1/billing/cancel` | Razorpay subscription |

HTTP agents receive `POST {"messages": [{"role": "user"|"assistant", "content": "..."}]}`; set `reply_field` to the reply's JSON path (e.g. `choices.0.message.content`).

## Before taking paying customers

- Encrypt stored agent credentials (`agents.target.headers`) with a KMS-managed key.
- Add Alembic migrations (tables are currently created on startup).
- Rate limiting at the edge, error tracking (e.g. Sentry), daily database backups.
- Replace the placeholder Terms and Privacy pages (web/app/terms, web/app/privacy) with lawyer-drafted text: terms of service, privacy policy and a data processing agreement (customer conversations may contain personal data; DPDP Act 2023 applies in India).

## Dashboard (web/)

```bash
cd web && cp .env.example .env.local   # Supabase URL + anon key, API URL
npm install && npm run dev             # http://localhost:3000
```

## Roadmap

1. Stripe billing for international customers; team invites
2. Voice testing: synthetic Indian voices, accents and noise over telephony
3. Regression runs on every prompt change (CI integration, webhooks)
4. Production call monitoring and the trust certificate
