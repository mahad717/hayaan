#!/usr/bin/env bash
# Task 135: prod-side verification of the share buttons against
# https://hayaan.co — real PDP (samsung-galaxy-a18) and a real published
# blog post (the prod catalog has posts; local seed may not).
set -u
cd "$(dirname "$0")/.."
BASE="https://hayaan.co" \
PDP_SLUG="samsung-galaxy-a18" \
BLOG_SLUG="${BLOG_SLUG:-iphone-price-in-somalia}" \
DEBUG_PORT="${DEBUG_PORT:-9375}" \
SHOT_PREFIX="download/task135-share-prod" \
node scripts/task135-share-check.mjs
