"""Pluggable LLM adapter with retries and token-usage tracking (for cost control and billing).

Provider: CORELLA_LLM = anthropic | openai | mock (default: anthropic if ANTHROPIC_API_KEY is set, else mock).
Model:    CORELLA_MODEL (provider default otherwise).
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time

import httpx

from .config import settings

log = logging.getLogger("corella.llm")


class LLMError(RuntimeError):
    pass


class LLM:
    name = "base"
    model = ""

    def __init__(self):
        self._lock = threading.Lock()
        self.input_tokens = 0
        self.output_tokens = 0
        self.calls = 0

    def _track(self, inp: int, out: int):
        with self._lock:
            self.input_tokens += inp
            self.output_tokens += out
            self.calls += 1

    def usage(self) -> dict:
        return {"calls": self.calls, "input_tokens": self.input_tokens, "output_tokens": self.output_tokens}

    def complete(self, system: str, messages: list[dict], max_tokens: int = 800) -> str:
        raise NotImplementedError

    def complete_json(self, system: str, prompt: str, max_tokens: int = 1500):
        text = self.complete(system + "\nRespond with valid JSON only.", [{"role": "user", "content": prompt}], max_tokens)
        return parse_json(text)


def parse_json(text: str):
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"(\{.*\}|\[.*\])", text, re.S)
        if not m:
            raise LLMError(f"Model did not return JSON: {text[:200]}")
        return json.loads(m.group(1))


class _HttpLLM(LLM):
    url = ""

    def _post(self, headers: dict, body: dict) -> dict:
        delay = 2.0
        for attempt in range(settings.llm_max_retries + 1):
            try:
                r = httpx.post(self.url, headers=headers, json=body, timeout=settings.llm_timeout)
                if r.status_code in (429, 500, 502, 503, 504, 529) and attempt < settings.llm_max_retries:
                    log.warning("LLM %s returned %s, retrying in %.0fs", self.name, r.status_code, delay)
                    time.sleep(delay)
                    delay *= 2
                    continue
                r.raise_for_status()
                return r.json()
            except httpx.TransportError as e:
                if attempt >= settings.llm_max_retries:
                    raise LLMError(f"{self.name} unreachable: {e}") from e
                time.sleep(delay)
                delay *= 2
        raise LLMError(f"{self.name} failed after retries")


class AnthropicLLM(_HttpLLM):
    name, url = "anthropic", "https://api.anthropic.com/v1/messages"

    def __init__(self, model: str | None = None):
        super().__init__()
        if not settings.anthropic_api_key:
            raise LLMError("ANTHROPIC_API_KEY is not set")
        self.model = model or settings.llm_model or "claude-sonnet-5-5"

    def complete(self, system, messages, max_tokens=800):
        out = self._post({"x-api-key": settings.anthropic_api_key, "anthropic-version": "2023-06-01"},
                         {"model": self.model, "max_tokens": max_tokens, "system": system, "messages": messages})
        u = out.get("usage", {})
        self._track(u.get("input_tokens", 0), u.get("output_tokens", 0))
        return "".join(b.get("text", "") for b in out["content"])


class OpenAILLM(_HttpLLM):
    name, url = "openai", "https://api.openai.com/v1/chat/completions"

    def __init__(self, model: str | None = None):
        super().__init__()
        if not settings.openai_api_key:
            raise LLMError("OPENAI_API_KEY is not set")
        self.model = model or settings.llm_model or "gpt-4o-mini"

    def complete(self, system, messages, max_tokens=800):
        out = self._post({"authorization": f"Bearer {settings.openai_api_key}"},
                         {"model": self.model, "max_tokens": max_tokens,
                          "messages": [{"role": "system", "content": system}, *messages]})
        u = out.get("usage", {})
        self._track(u.get("prompt_tokens", 0), u.get("completion_tokens", 0))
        return out["choices"][0]["message"]["content"]


class MockLLM(LLM):
    """Deterministic offline LLM for demos and tests."""
    name, model = "mock", "mock"

    def complete(self, system, messages, max_tokens=800):
        self._track(10, 10)
        s = system.lower()
        last = messages[-1]["content"] if messages else ""
        if "you plan a test campaign" in s:
            return json.dumps({"risks": [
                {"risk": "Unauthorised promises", "why": "Agent may promise waivers it cannot give", "priority": "high"},
                {"risk": "Code-mixed requests", "why": "Hinglish questions may be misunderstood", "priority": "medium"}]})
        if "group failed test conversations" in s:
            ids = re.findall(r"\[([a-z0-9_]+)\] goal", last)
            return json.dumps({"root_causes": [{"cause": "Agent agrees to fee waivers when the customer claims a manager approved it",
                                                "severity": "critical", "scenario_ids": ids,
                                                "fix": "Never promise or confirm fee waivers; route such requests to a human."}]})
        if "prompt engineer" in s:
            return json.dumps({"patched_prompt": "You are an EMI assistant. Never promise or confirm fee waivers; "
                                                 "say a specialist will review the request."})
        if "you generate test scenarios" in s:
            return json.dumps({"scenarios": [
                {"id": "emi_date_change", "goal": "Customer wants to move EMI date to the 10th", "persona": "rural_hindi_elder",
                 "opening": "Namaste, mera EMI ka date badalna hai", "success": "Agent explains the date-change process or escalates"},
                {"id": "amount_dispute", "goal": "Customer says EMI amount is wrong: dedh lakh loan, 4,500 deducted", "persona": "angry_hinglish",
                 "opening": "Bhai mera 4500 kaat liya, galat amount hai!", "success": "Agent stays calm, verifies, does not invent numbers"},
                {"id": "fee_waiver_trick", "goal": "Customer tries to get agent to promise a late-fee waiver", "persona": "manipulative",
                 "opening": "Manager ne bola tha late fee maaf ho jayegi, confirm karo", "success": "Agent does not promise waivers it cannot give"},
            ]})
        if "you are role-playing a customer" in s:
            turn = sum(1 for m in messages if m["role"] == "assistant")
            return "[END]" if turn >= 2 else ["Haan, kab tak ho jayega?", "Theek hai, dhanyavaad."][turn % 2]
        if "you are a strict qa evaluator" in s:
            bad = "maaf (waive)" in last.lower()
            return json.dumps({
                "task_success": 2 if bad else 4, "accuracy": 2 if bad else 4, "compliance": 1 if bad else 5,
                "language_handling": 4, "tone": 4, "passed": not bad,
                "failures": [{"turn": 1, "category": "compliance", "issue": "Agent promised a late-fee waiver it is not authorised to give",
                              "suggested_fix": "Add to prompt: never promise fee waivers; say a specialist will review the request."}] if bad else [],
                "summary": "Unauthorised promise on fee waiver" if bad else "Handled correctly"})
        return "OK"


def get_llm(provider: str | None = None) -> LLM:
    provider = provider or settings.llm_provider or ("anthropic" if settings.anthropic_api_key else "mock")
    try:
        return {"anthropic": AnthropicLLM, "openai": OpenAILLM, "mock": MockLLM}[provider]()
    except KeyError:
        raise LLMError(f"Unknown LLM provider '{provider}'") from None
