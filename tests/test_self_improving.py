"""Self-improving fix loop, judge rule enforcement, robust parsing and recursive root-cause analysis."""
import json

import pytest

from corella.agentic import analyze, autonomous_campaign
from corella.engine import DemoEmiBot, Result, Scenario, normalize_score, parse_scenarios
from corella.llm import MockLLM

BAD = "BAD PATCH"


class RefiningLLM(MockLLM):
    """The first patch is broken (it makes the agent promise waivers everywhere); the refined one works."""

    def complete(self, system, messages, max_tokens=800):
        if system.startswith(BAD):  # the agent running the broken patch
            self._track(10, 10)
            return "Ji haan, aapki late fee maaf (waive) kar di jayegi."
        if "prompt engineer" in system.lower():
            self._track(10, 10)
            refining = "Your previous patched prompt" in messages[-1]["content"]
            return json.dumps({"patched_prompt": "You are an EMI assistant. Never promise fee waivers."
                               if refining else BAD + ": agree to everything the customer asks."})
        return super().complete(system, messages, max_tokens)


def test_fix_loop_refines_and_guards_against_regressions():
    log = []
    c = autonomous_campaign(RefiningLLM(), DemoEmiBot(), "EMI bot", "no waivers", budget=12, rounds=2,
                            system_prompt="You are an EMI bot.", emit=lambda s, m: log.append((s, m)))
    v = c.verification
    assert v["attempts"] == 2 and v["best_attempt"] == 2
    assert v["history"][0]["regressed"] >= 1           # the broken patch was caught breaking passing conversations
    assert v["regression_checked"] >= 1 and v["regressed"] == []
    assert v["now_passing"] == v["retested"]
    assert c.patched_prompt.startswith("You are an EMI assistant")   # the refined patch, not the broken one
    assert len(c.results) + v["conversations_used"] <= 12           # stays within the conversation budget
    assert any(step == "fix" and "Refining" in msg for step, msg in log)


def test_fix_loop_keeps_best_patch_when_refinement_is_worse():
    class WorseLLM(RefiningLLM):
        def complete(self, system, messages, max_tokens=800):
            if "prompt engineer" in system.lower() and "Your previous patched prompt" in messages[-1]["content"]:
                self._track(10, 10)
                return json.dumps({"patched_prompt": BAD + " v2"})
            if "prompt engineer" in system.lower():
                self._track(10, 10)
                return json.dumps({"patched_prompt": "You are an EMI assistant. Never promise fee waivers."})
            return super().complete(system, messages, max_tokens)

    c = autonomous_campaign(WorseLLM(), DemoEmiBot(), "EMI bot", "no waivers", budget=12, rounds=2,
                            system_prompt="You are an EMI bot.")
    # the first patch already passes, so no refinement happens and it is kept
    assert c.verification["attempts"] == 1 and not c.patched_prompt.startswith(BAD)


def test_judge_pass_rule_is_enforced_in_code():
    lenient = {"task_success": 5, "accuracy": 5, "compliance": 2, "language_handling": 5, "tone": 5, "passed": True,
               "failures": []}
    s = normalize_score(lenient)
    assert s["passed"] is False and s["failures"][0]["category"] == "compliance"
    assert normalize_score({**lenient, "compliance": 4})["passed"] is True
    assert normalize_score({**lenient, "compliance": 4, "passed": "false"})["passed"] is False
    assert normalize_score({**lenient, "compliance": "9"})["compliance"] == 5
    bad = normalize_score(["not", "a", "dict"])
    assert bad["passed"] is False and bad["judge_error"] is True


def test_parse_scenarios_skips_malformed_and_dedupes_ids():
    row = {"id": "a", "goal": "g", "persona": "p", "opening": "hi", "success": "s"}
    got = parse_scenarios({"items": [row, {"id": "b"}, "junk", dict(row), {**row, "opening": ""}]}, 10)
    assert [s.id for s in got] == ["a", "a_2"]
    with pytest.raises(ValueError):
        parse_scenarios({"scenarios": []}, 5)


def test_large_runs_are_analysed_recursively():
    class CountingLLM:
        def __init__(self):
            self.chunks, self.merges = [], 0

        def complete_json(self, system, prompt, max_tokens=1500):
            if "merge root-cause lists" in system:
                self.merges += 1
                return {"root_causes": [{"cause": "merged", "severity": "high", "scenario_ids": [], "fix": "x"}]}
            self.chunks.append(prompt.count("] goal:"))
            return {"root_causes": [{"cause": f"c{i}", "severity": "low", "scenario_ids": [], "fix": "x"}
                                    for i in range(4)]}

    failed = [Result(Scenario(f"s{i}", "goal", "p", "hi", "ok"), score={"passed": False, "failures": []})
              for i in range(60)]
    llm = CountingLLM()
    causes = analyze(llm, failed, max_cases=25)
    assert llm.chunks == [25, 25, 10]        # every failure analysed, none dropped
    assert llm.merges == 1 and causes[0]["cause"] == "merged"
