#!/usr/bin/env bash
# Task 134: prod-side verification of the two quick wins (F5 rail + F6 sticky
# bar) against https://hayaan.co. Uses a real long PDP (samsung-galaxy-a18):
# the mobile pass asserts the full show/hide cycle incl. the WhatsApp lift
# (the float renders on prod, where the number IS configured).
set -u
cd "$(dirname "$0")/.."
BASE="https://hayaan.co" \
PDP_SLUG="samsung-galaxy-a18" \
DEBUG_PORT="${DEBUG_PORT:-9365}" \
SHOT_PREFIX="download/task134-pdp-prod" \
node scripts/task134-pdp-check.mjs
