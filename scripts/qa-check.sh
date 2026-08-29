#!/usr/bin/env bash
# Turtle Guard QA gate. Runs all three checks, never stops early, exits non-zero if any fail.
# Raw output for the qa-tester agent to parse lands in qa-out/.
cd "$(dirname "$0")/.." || exit 2
mkdir -p qa-out
fail=0

echo "── typecheck ─────────────────────────────"
npx tsc --noEmit > qa-out/typecheck.txt 2>&1 \
  && echo "PASS" || { echo "FAIL"; tail -30 qa-out/typecheck.txt; fail=1; }

echo "── unit tests ────────────────────────────"
npx vitest run --reporter=json --outputFile=qa-out/vitest.json --reporter=dot > qa-out/vitest.txt 2>&1 \
  && echo "PASS" || { echo "FAIL"; grep -E "✕|×|FAIL|AssertionError|Error:" qa-out/vitest.txt | head -40; fail=1; }

echo "── production build ──────────────────────"
npx vite build > qa-out/build.txt 2>&1 \
  && echo "PASS" || { echo "FAIL"; tail -30 qa-out/build.txt; fail=1; }

echo "──────────────────────────────────────────"
[ $fail -eq 0 ] && echo "QA GATE: PASS" || echo "QA GATE: FAIL"
exit $fail
