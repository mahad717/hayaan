#!/usr/bin/env bash
# Task 132: prod-side verification — run the same interactive CDP search
# checks (scripts/task132-search-check.mjs) against https://hayaan.co.
# NOTE: 2026-10-30 this FAILED 5/11 because the CF Workers Builds job for
# commit 3df4bec never ran (prod still the old deployment) — re-run after
# the owner retries the build on the CF dashboard; expect ALL PASS.
set -u
cd "$(dirname "$0")/.."
BASE="https://hayaan.co" \
DEBUG_PORT="${DEBUG_PORT:-9361}" \
SHOT_PREFIX="download/task132-search-prod" \
node scripts/task132-search-check.mjs
