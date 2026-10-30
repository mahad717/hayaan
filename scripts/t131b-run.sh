#!/usr/bin/env bash
# Task 131 (continuation): contextual backlinks inside blog posts.
# 1) Androva (https://androva.ai/) as a contextual link in the how-it-works
#    "tools we like" paragraph — footer link REMOVED (owner redirection).
# 2) germanshepherd-pet.com author page, anchor "German Shepherd owner",
#    in the supplements guide (KarmaLinks brief, exact anchor + URL).
# Asserts run against a local production-mode server (SQLite fallback path —
# both target posts serve from SEO_POSTS code, identical to prod).
set -u
cd "$(dirname "$0")/.."
PORT=3121
BASE="http://localhost:$PORT"
LOG=/tmp/t131b-server.log
FAIL=0

say() { printf '%s\n' "$*"; }
chk() { # chk <name> <expected 0|N> <actual count>
  local name="$1" exp="$2" act="$3"
  if [ "$act" = "$exp" ]; then say "PASS: $name ($act)"; else say "FAIL: $name — expected $exp got $act"; FAIL=1; fi
}

say "== build =="
bun x next build || { say "FAIL: build"; exit 1; }

# EADDRINUSE guard: fail loudly if something already owns the port.
if curl -s -m 2 -o /dev/null "$BASE"; then
  say "FAIL: port $PORT already serving — stale server?"; exit 1
fi

say "== start prod server on :$PORT =="
NODE_ENV=production setsid bun x next start -p "$PORT" >"$LOG" 2>&1 &
SRV=$!
for i in $(seq 1 45); do
  if curl -s -m 2 -o /dev/null "$BASE"; then break; fi
  sleep 1
done
if ! curl -s -m 3 -o /dev/null "$BASE"; then say "FAIL: server never came up"; cat "$LOG" | tail -20; kill -- -"$SRV" 2>/dev/null; exit 1; fi
if grep -q "EADDRINUSE" "$LOG"; then say "FAIL: EADDRINUSE in fresh server log"; kill -- -"$SRV" 2>/dev/null; exit 1; fi

HIW="$BASE/blog/online-shopping-in-somalia-how-it-works"
SUP="$BASE/blog/buying-health-supplements-online-in-somalia"
HIW_HTML=$(curl -sS -m 20 "$HIW"); HIW_CODE=$?
SUP_HTML=$(curl -sS -m 20 "$SUP"); SUP_CODE=$?
HOME_HTML=$(curl -sS -m 20 "$BASE/"); HOME_CODE=$?

chk "how-it-works HTTP 200" 200 "$([ "$HIW_CODE" = 0 ] && echo 200 || echo $HIW_CODE)"
chk "supplements  HTTP 200" 200 "$([ "$SUP_CODE" = 0 ] && echo 200 || echo $SUP_CODE)"
chk "home         HTTP 200" 200 "$([ "$HOME_CODE" = 0 ] && echo 200 || echo $HOME_CODE)"

# Androva contextual link in how-it-works content
chk "how-it-works: androva.ai href count == 1 (contextual only)" 1 "$(printf '%s' "$HIW_HTML" | grep -o 'href="https://androva\.ai/"' | wc -l)"
chk "how-it-works: anchor text 'Androva' present" 1 "$(printf '%s' "$HIW_HTML" | grep -o '>Androva</a>' | wc -l)"
chk "how-it-works: 'seven-person team' context present" 1 "$(printf '%s' "$HIW_HTML" | grep -c 'seven-person team')"
chk "how-it-works: KarmaLinks precedent link intact" 1 "$(printf '%s' "$HIW_HTML" | grep -o 'href="https://karmalinks\.io/?verificationId=' | wc -l)"

# German Shepherd link in supplements
chk "supplements: germanshepherd author href count == 1" 1 "$(printf '%s' "$SUP_HTML" | grep -o 'href="https://germanshepherd-pet\.com/author/doggyshepherd/"' | wc -l)"
chk "supplements: anchor text 'German Shepherd owner'" 1 "$(printf '%s' "$SUP_HTML" | grep -o '>German Shepherd owner</a>' | wc -l)"

# dofollow: rendered links must NOT carry nofollow/sponsored
chk "how-it-works: androva <a> rel has NO nofollow" 0 "$(printf '%s' "$HIW_HTML" | grep -o '<a[^>]*androva[^>]*>' | grep -c 'nofollow\|sponsored')"
chk "supplements: gs-pet <a> rel has NO nofollow" 0 "$(printf '%s' "$SUP_HTML" | grep -o '<a[^>]*germanshepherd-pet[^>]*>' | grep -c 'nofollow\|sponsored')"

# footer link removed sitewide
chk "home: 'Marketing partner' absent" 0 "$(printf '%s' "$HOME_HTML" | grep -c 'Marketing partner')"
chk "home: androva.ai absent entirely" 0 "$(printf '%s' "$HOME_HTML" | grep -c 'androva\.ai')"
chk "how-it-works: 'Marketing partner' absent (footer reverted)" 0 "$(printf '%s' "$HIW_HTML" | grep -c 'Marketing partner')"
chk "supplements: 'Marketing partner' absent" 0 "$(printf '%s' "$SUP_HTML" | grep -c 'Marketing partner')"

kill -- -"$SRV" 2>/dev/null
if [ "$FAIL" = 0 ]; then say "VERDICT: ALL PASS"; else say "VERDICT: FAIL"; exit 1; fi
