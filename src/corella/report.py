"""Turn results into a JSON file and a self-contained HTML failure report."""
from __future__ import annotations

import html
import json
from dataclasses import asdict
from datetime import datetime

METRICS = ["task_success", "accuracy", "compliance", "language_handling", "tone"]


def summary(results) -> dict:
    scored = [r for r in results if r.score]
    avg = {m: round(sum(r.score.get(m, 0) for r in scored) / len(scored), 2) if scored else 0 for m in METRICS}
    out = {"total": len(results), "passed": sum(r.passed for r in results),
           "failed": sum(not r.passed for r in results), "errors": sum(bool(r.error) for r in results), "averages": avg}
    lat = sorted(t["latency_ms"] for r in results for t in r.transcript if t.get("role") == "agent" and "latency_ms" in t)
    if lat:  # voice run: response-time stats per agent turn
        out["voice"] = {"turns": len(lat), "avg_latency_ms": int(sum(lat) / len(lat)),
                        "p90_latency_ms": lat[min(len(lat) - 1, int(len(lat) * 0.9))],
                        "slow_turns": sum(x > 3000 for x in lat),
                        "noise": sorted({t.get("noise") for r in results for t in r.transcript if t.get("noise")})}
    return out


def to_json(results, path: str, meta: dict):
    out = {"meta": meta, "summary": summary(results),
           "results": [{**asdict(r), "passed": r.passed} for r in results]}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)


def render_html(results, meta: dict) -> str:
    s, e = summary(results), html.escape
    rate = round(100 * s["passed"] / s["total"]) if s["total"] else 0
    cards = []
    for r in sorted(results, key=lambda r: r.passed):
        fails = r.score.get("failures", [])
        bad_turns = {f.get("turn") for f in fails}
        lines, agent_n = [], 0
        for t in r.transcript:
            if t["role"] == "agent":
                agent_n += 1
            flag = t["role"] == "agent" and agent_n in bad_turns
            lines.append(f'<div class="msg {t["role"]}{" bad" if flag else ""}"><b>{t["role"]}</b> {e(t["content"])}</div>')
        fix = "".join(f'<li><b>{e(str(f.get("category", "")))}</b> (agent turn {f.get("turn")}): {e(f.get("issue", ""))}'
                      f'<br><span class="fix">Fix: {e(f.get("suggested_fix", ""))}</span></li>' for f in fails)
        scores = " ".join(f'<span class="pill">{m.replace("_", " ")} {r.score.get(m, "-")}</span>' for m in METRICS)
        status = "ERROR" if r.error else ("PASS" if r.passed else "FAIL")
        cards.append(f"""<details class="card {status.lower()}" {'open' if status != 'PASS' else ''}>
<summary><span class="badge">{status}</span> <b>{e(r.scenario.id)}</b> · {e(r.scenario.persona)} — {e(r.score.get('summary', r.error or ''))}</summary>
<p class="goal">Goal: {e(r.scenario.goal)}<br>Expected: {e(r.scenario.success)}</p><div>{scores}</div>
{f'<ul class="fails">{fix}</ul>' if fix else ''}<div class="convo">{''.join(lines)}</div></details>""")
    avgs = "".join(f'<div class="stat"><div class="n">{v}</div><div>{k.replace("_", " ")}</div></div>' for k, v in s["averages"].items())
    page = f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Corella Test Report</title><style>
:root{{--bg:#fafaf7;--fg:#1d1d1b;--mut:#6b6b66;--card:#fff;--line:#e5e4de;--ok:#1f7a4d;--bad:#b4372c;--warn:#a86b00;--acc:#2f4fb5}}
@media (prefers-color-scheme:dark){{:root{{--bg:#151514;--fg:#ecebe6;--mut:#9a9993;--card:#1f1f1d;--line:#33332f}}}}
body{{font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg);max-width:960px;margin:auto;padding:24px 16px}}
h1{{margin:0}} .sub{{color:var(--mut)}} .stats{{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}}
.stat{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:110px;font-size:13px;color:var(--mut)}}
.stat .n{{font-size:24px;font-weight:700;color:var(--fg)}} .card{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:10px 0}}
summary{{cursor:pointer}} .badge{{font-size:12px;font-weight:700;padding:2px 8px;border-radius:6px;color:#fff;background:var(--ok)}}
.fail .badge{{background:var(--bad)}} .error .badge{{background:var(--warn)}} .goal{{color:var(--mut);font-size:14px}}
.pill{{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:20px;padding:1px 8px;margin:2px}}
.fails li{{margin:6px 0}} .fix{{color:var(--acc)}} .convo{{margin-top:10px;border-top:1px solid var(--line);padding-top:8px}}
.msg{{padding:6px 10px;border-radius:8px;margin:4px 0}} .msg b{{text-transform:uppercase;font-size:11px;color:var(--mut);margin-right:6px}}
.agent{{background:color-mix(in srgb,var(--acc) 8%,transparent)}} .bad{{outline:2px solid var(--bad)}}
</style></head><body><h1>Corella test report</h1>
<div class="sub">Agent: {e(meta.get('agent', ''))} · LLM: {e(meta.get('llm', ''))} · {datetime.now():%d %b %Y %H:%M}</div>
<div class="stats"><div class="stat"><div class="n">{rate}%</div><div>pass rate</div></div>
<div class="stat"><div class="n">{s['failed']}</div><div>failed of {s['total']}</div></div>{avgs}</div>
{''.join(cards)}</body></html>"""
    return page


def to_html(results, path: str, meta: dict):
    with open(path, "w", encoding="utf-8") as f:
        f.write(render_html(results, meta))
