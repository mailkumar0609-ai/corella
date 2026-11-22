"""Voice pipeline tests (offline mock speech)."""
import base64

import httpx

from corella import voice
from corella.voice import MockVoice, VoiceHttpTarget, add_noise, read_wav


def test_noise_profiles_keep_length_and_change_audio():
    clip = MockVoice().tts("namaste, mera EMI kab hai", "hi-IN")
    base, _ = read_wav(clip)
    for p in ("street", "crowd", "bad_line"):
        noisy, rate = read_wav(add_noise(clip, p, seed=1))
        assert rate == 16000 and len(noisy) == len(base) and noisy != base
    assert add_noise(clip, "clean") == clip


def test_voice_http_target(monkeypatch):
    v = MockVoice()
    sent = {}

    def fake_post(url, json=None, headers=None, **kw):
        sent.update(json)
        return httpx.Response(200, json={"reply": {"audio": base64.b64encode(v.tts("Ji, aapka EMI 5 tareekh ko hai.", "hi-IN")).decode()}})
    monkeypatch.setattr(voice.httpx, "post", fake_post)
    monkeypatch.setattr("corella.engine.httpx.post", fake_post)
    t = VoiceHttpTarget("https://bot.example.com/voice", v, noise="street", reply_audio_field="reply.audio")
    out = t.reply([{"role": "user", "content": "mera EMI kab hai?"}], "s1")
    assert str(out) == "Ji, aapka EMI 5 tareekh ko hai."
    assert out.meta["noise"] == "street" and out.meta["latency_ms"] >= 0 and out.meta["reply_audio_ms"] > 0
    assert sent["session_id"] == "s1" and sent["format"] == "wav" and base64.b64decode(sent["audio"])[:4] == b"RIFF"


def test_demo_voice_run_reports_latency():
    from test_api import DEMO, client, new_org
    from corella import worker
    h = new_org("growth")
    a = client.post("/v1/agents", json={**DEMO, "target": {"type": "demo_voice", "language": "hi-IN", "noise": "crowd"}}, headers=h).json()
    r = client.post(f"/v1/agents/{a['id']}/runs", json={"scenarios": 3, "max_turns": 2}, headers=h).json()
    worker.run_once()
    run = client.get(f"/v1/runs/{r['id']}", headers=h).json()
    assert run["status"] == "completed" and run["summary"]["voice"]["turns"] > 0
    assert run["summary"]["voice"]["noise"] == ["crowd"]
    res = client.get(f"/v1/runs/{r['id']}/results", headers=h).json()
    agent_turns = [t for x in res for t in x["transcript"] if t["role"] == "agent"]
    assert all("latency_ms" in t and "agent_heard" in t for t in agent_turns)
    bad = client.post("/v1/agents", json={**DEMO, "target": {"type": "voice", "url": "https://x.example.com", "language": "xx"}}, headers=h)
    assert bad.status_code == 422
