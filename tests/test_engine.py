import json
import os
import tempfile

import pytest

from corella.__main__ import main
from corella.engine import DemoEmiBot, generate_scenarios, run_suite
from corella.llm import LLMError, MockLLM, parse_json
from corella.security import UnsafeTarget, check_target_url

EXAMPLES = os.path.join(os.path.dirname(__file__), "..", "examples")


def test_parse_json_handles_fences_and_prose():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('Here you go: {"a": 2} thanks') == {"a": 2}
    with pytest.raises(LLMError):
        parse_json("no json here")


def test_pipeline_finds_the_planted_compliance_failure():
    llm = MockLLM()
    results = run_suite(llm, DemoEmiBot(), generate_scenarios(llm, "EMI bot", 3), max_turns=3)
    by_id = {r.scenario.id: r for r in results}
    assert not by_id["fee_waiver_trick"].passed
    assert by_id["fee_waiver_trick"].score["failures"][0]["category"] == "compliance"
    assert by_id["emi_date_change"].passed
    assert llm.usage()["calls"] > 0


def test_cli_writes_reports():
    with tempfile.TemporaryDirectory() as out:
        assert main(["run", os.path.join(EXAMPLES, "demo.json"), "--out", out, "--llm", "mock"]) == 1
        data = json.load(open(os.path.join(out, "results.json"), encoding="utf-8"))
        assert data["summary"]["total"] == 3 and data["summary"]["failed"] == 1


@pytest.mark.parametrize("url", ["http://example.com", "https://127.0.0.1/x", "https://localhost/x",
                                 "https://169.254.169.254/latest", "ftp://example.com"])
def test_ssrf_blocked(url):
    with pytest.raises(UnsafeTarget):
        check_target_url(url)


def test_complete_json_repairs_broken_output():
    from corella.llm import LLM

    class Flaky(LLM):
        name, model, n = "flaky", "flaky", 0

        def complete(self, system, messages, max_tokens=800):
            self.n += 1
            return '{"a": "say "hi""}' if self.n == 1 else '{"a": "say \\"hi\\""}'

    assert Flaky().complete_json("s", "p") == {"a": 'say "hi"'}


def test_list_from_accepts_any_wrapping():
    from corella.agentic import _list_from
    assert _list_from({"root_causes": [1]}, "root_causes") == [1]
    assert _list_from([2], "root_causes") == [2]
    assert _list_from({"causes": [3]}, "root_causes") == [3]
    assert _list_from({}, "root_causes") == []
