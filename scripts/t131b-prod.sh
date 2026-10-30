#!/usr/bin/env bash
# Task 131 (continuation): prod verification of contextual backlinks.
# Same asserts as t131b-run.sh but against https://hayaan.co (post-deploy).
# Two-pass rule: on any first-pass failure, wait 10s and retry once (prod
# has a history of transient 503s on DB-backed routes).
set -u
BASE="https://hayaan.co"
FAIL=0
say() { printf '%s\n' "$*"; }

fetch() { # fetch <url> -> html on stdout, retries once on empty/5xx
  local url="$1" h="" i=""
  for i in 1 2 3; do
    h=$(curl -sS -m 30 -w '\n%{http_code}' "$url" 2>/dev/null | tail -1)
    if [ "$h" = "200" ]; then curl -sS -m 30 "$url" 2>/dev/null && return 0; fi
    sleep 10
  done
  return 1
}

chk() {
  local name="$1" exp="$2" act="$3"
  if [ "$act" = "$exp" ]; then say "PASS: $name ($act)"; else say "FAIL: $name — expected $exp got $act"; FAIL=1; fi
}

HIW_HTML=$(fetch "$BASE/blog/online-shopping-in-somalia-how-it-works") || { say "FAIL: how-it-works unreachable"; exit 1; }
SUP_HTML=$(fetch "$BASE/blog/buying-health-supplements-online-in-somalia") || { say "FAIL: supplements unreachable"; exit 1; }
HOME_HTML=$(fetch "$BASE/") || { say "FAIL: home unreachable"; exit 1; }

chk "prod how-it-works: androva.ai href count == 1" 1 "$(printf '%s' "$HIW_HTML" | grep -o 'href="https://androva\.ai/"' | wc -l)"
chk "prod how-it-works: anchor 'Androva'" 1 "$(printf '%s' "$HIW_HTML" | grep -o '>Androva</a>' | wc -l)"
chk "prod how-it-works: 'seven-person team' context" 1 "$(printf '%s' "$HIW_HTML" | grep -c 'seven-person team')"
chk "prod how-it-works: KarmaLinks precedent intact" 1 "$(printf '%s' "$HIW_HTML" | grep -o 'href="https://karmalinks\.io/?verificationId=' | wc -l)"
chk "prod how-it-works: androva <a> has NO nofollow" 0 "$(printf '%s' "$HIW_HTML" | grep -o '<a[^>]*androva[^>]*>' | grep -c 'nofollow\|sponsored')"
chk "prod how-it-works: 'Marketing partner' absent" 0 "$(printf '%s' "$HIW_HTML" | grep -c 'Marketing partner')"

chk "prod supplements: germanshepherd href == 1" 1 "$(printf '%s' "$SUP_HTML" | grep -o 'href="https://germanshepherd-pet\.com/author/doggyshepherd/"' | wc -l)"
chk "prod supplements: anchor 'German Shepherd owner'" 1 "$(printf '%s' "$SUP_HTML" | grep -o '>German Shepherd owner</a>' | wc -l)"
chk "prod supplements: gs <a> has NO nofollow" 0 "$(printf '%s' "$SUP_HTML" | grep -o '<a[^>]*germanshepherd-pet[^>]*>' | grep -c 'nofollow\|sponsored')"
chk "prod supplements: 'Marketing partner' absent" 0 "$(printf '%s' "$SUP_HTML" | grep -c 'Marketing partner')"

chk "prod home: 'Marketing partner' absent" 0 "$(printf '%s' "$HOME_HTML" | grep -c 'Marketing partner')"
chk "prod home: androva.ai absent" 0 "$(printf '%s' "$HOME_HTML" | grep -c 'androva\.ai')"

if [ "$FAIL" = 0 ]; then say "PROD VERDICT: ALL PASS"; else say "PROD VERDICT: FAIL"; exit 1; fi
