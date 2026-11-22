#!/usr/bin/env bash
# Corella CI check: run tests against your agent and fail the build if quality drops.
# Usage (GitHub Actions, GitLab, Jenkins…):  curl -fsSL https://corella.live/ci.sh | bash
#
# Required env:  CORELLA_API_KEY   API key from corella.live → Settings
#                CORELLA_AGENT_ID  the agent to test (agt_...)
# Optional env:  CORELLA_BASELINE_RUN   re-run this run's exact scenarios and fail on any newly broken one
#                                       (regression mode, paid plans). Without it a fresh test is generated.
#                CORELLA_SCENARIOS      fresh-test size (default 20)
#                CORELLA_MIN_PASS_RATE  minimum pass rate in % (default 80)
#                CORELLA_TIMEOUT        seconds to wait (default 1800)
#                CORELLA_API            default https://api.corella.live
set -euo pipefail

API="${CORELLA_API:-https://api.corella.live}"
: "${CORELLA_API_KEY:?Set CORELLA_API_KEY (corella.live → Settings → API keys)}"
MIN="${CORELLA_MIN_PASS_RATE:-80}"
TIMEOUT="${CORELLA_TIMEOUT:-1800}"
command -v jq >/dev/null || { echo "corella: jq is required"; exit 2; }

call() {  # call METHOD PATH [JSON]
  local out code
  out=$(curl -sS -X "$1" "$API$2" -H "authorization: Bearer $CORELLA_API_KEY" -H "content-type: application/json" \
        ${3:+-d "$3"} -w $'\n%{http_code}') || { echo "corella: network error calling $2" >&2; exit 2; }
  code=${out##*$'\n'}; out=${out%$'\n'*}
  if [ "$code" -ge 400 ]; then echo "corella: $1 $2 failed ($code): $(echo "$out" | jq -r '.detail // .' 2>/dev/null || echo "$out")" >&2; exit 2; fi
  printf '%s' "$out"
}

label="CI ${GITHUB_REPOSITORY:-}${GITHUB_SHA:+ @ ${GITHUB_SHA:0:7}}"
if [ -n "${CORELLA_BASELINE_RUN:-}" ]; then
  run=$(call POST "/v1/runs/$CORELLA_BASELINE_RUN/rerun?label=$(jq -rn --arg s "$label" '$s|@uri')")
  echo "corella: regression test, replaying run $CORELLA_BASELINE_RUN"
else
  : "${CORELLA_AGENT_ID:?Set CORELLA_AGENT_ID (or CORELLA_BASELINE_RUN)}"
  body=$(jq -n --argjson n "${CORELLA_SCENARIOS:-20}" --arg l "$label" '{mode:"standard", scenarios:$n, label:$l}')
  run=$(call POST "/v1/agents/$CORELLA_AGENT_ID/runs" "$body")
  echo "corella: testing agent $CORELLA_AGENT_ID with ${CORELLA_SCENARIOS:-20} conversations"
fi
id=$(echo "$run" | jq -r .id)
echo "corella: run $id queued"

start=$(date +%s)
while :; do
  run=$(call GET "/v1/runs/$id"); status=$(echo "$run" | jq -r .status)
  case "$status" in completed|failed) break ;; esac
  if [ $(( $(date +%s) - start )) -gt "$TIMEOUT" ]; then echo "corella: timed out after ${TIMEOUT}s (run $id still $status)"; exit 2; fi
  sleep "${CORELLA_POLL:-10}"
done
[ "$status" = failed ] && { echo "corella: run failed: $(echo "$run" | jq -r .error)"; exit 2; }

total=$(echo "$run" | jq -r .summary.total); passed=$(echo "$run" | jq -r .summary.passed)
rate=$(( total > 0 ? passed * 100 / total : 0 ))
link=$(call POST "/v1/runs/$id/share" | jq -r .share_url)
regressed=""
if [ -n "$(echo "$run" | jq -r '.baseline_run_id // empty')" ]; then
  regressed=$(call GET "/v1/runs/$id/compare" | jq -r '.regressed | join(", ")')
fi

ok=1; reasons=()
[ "$rate" -lt "$MIN" ] && { ok=0; reasons+=("pass rate ${rate}% is below ${MIN}%"); }
[ -n "$regressed" ] && { ok=0; reasons+=("newly broken: $regressed"); }

echo "Corella: $passed/$total conversations passed (${rate}%). Report: $link"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  { echo "### Corella agent test: $([ $ok = 1 ] && echo 'passed ✅' || echo 'failed ❌')"
    echo "$passed of $total conversations passed (**${rate}%**, minimum ${MIN}%)."
    [ -n "$regressed" ] && echo "Newly broken: $regressed"
    echo "[Open the full report]($link)"; } >> "$GITHUB_STEP_SUMMARY"
fi
if [ $ok = 0 ]; then printf 'corella: FAILED: %s\n' "${reasons[@]}"; exit 1; fi
echo "corella: PASSED"
