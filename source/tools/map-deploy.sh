#!/bin/bash
# Map-screen deploy: flock → fetch/rebase → build → local smoke+l17 → copy bundle → commit → push → verify → log → live smoke
set -u
WT=/workspace/tc-wt-map; T=/workspace/fern-reports/tests; LOG=/tmp/map-deploy.log
KNOWN="ART-12 HUB-R02 L02-C01 ART-09 TG-R11 L08-R06 L16-R05 GATE-02 ART-04"
newfails() { python3 - "$1" "$KNOWN" <<'PY'
import json,sys,glob,os
f=sorted(glob.glob(f"/workspace/fern-reports/tests/results/{sys.argv[1]}-*.json"),key=os.path.getmtime)[-1]
d=json.load(open(f));c=d.get('checks') or d.get('results') or []
known=set(sys.argv[2].split())
fails=[r['id'] for r in c if r.get('status')=='fail']
print(f, 'fails:', ' '.join(fails) or '-', '| new:', ' '.join(x for x in fails if x not in known) or '-')
sys.exit(1 if [x for x in fails if x not in known] else 0)
PY
}
exec 9>/workspace/tc-deploy.lock
echo "$(date) waiting for lock"; flock 9; echo "$(date) got lock"
cd $WT || exit 1
git fetch -q origin && git rebase origin/main || { git rebase --abort; echo "REBASE CONFLICT"; exit 2; }
cd source && npx vite build >/tmp/map-vite.log 2>&1 || { echo BUILD FAIL; exit 3; }
cd $WT && cp source/dist/index.html index.html && cp -n source/dist/assets/* assets/
B=$(grep -o 'index-[A-Za-z0-9_-]*\.js' index.html | head -1); echo "bundle $B"
pkill -f "http.server 8956" ; (cd $WT && setsid nohup python3 -m http.server 8956 >/tmp/map-8956.log 2>&1 &); sleep 2
cd $T && node smoke.mjs --url=http://localhost:8956/ >/tmp/map-smoke-local.log 2>&1; newfails smoke || { echo "LOCAL SMOKE NEW FAILS — not deploying"; exit 4; }
node l17.mjs --url=http://localhost:8956/ >/tmp/map-l17-local.log 2>&1; newfails l17 || { echo "LOCAL L17 NEW FAILS — not deploying"; exit 4; }
pkill -f "http.server 8956"
cd $WT && git add index.html $(git ls-files --others --exclude-standard assets/) && git commit -q -m "Map screen deploy: bundle $B" && git push -q origin HEAD:main || { echo PUSH FAIL; exit 5; }
C=$(git rev-parse --short HEAD); echo "pushed $C"
# verify.sh logic, run against this worktree (a2work/verify.sh reads /workspace/tc's index.html and pushes its main)
ok=0
for try in 1 2; do
  for i in $(seq 1 40); do
    curl -s "https://dustycharlss.github.io/pollinator-meadow/?cb=$RANDOM$RANDOM" | grep -q "$B" && { ok=1; break 2; }; sleep 10
  done
  [ $try = 1 ] && { echo "pages stalled → empty commit"; git commit -q --allow-empty -m "retrigger pages" && git push -q origin HEAD:main; }
done
[ $ok = 1 ] && echo "LIVE OK $(git rev-parse --short HEAD) $B" || { echo "LIVE MISMATCH $B"; exit 6; }
cat >> /workspace/act3-deploys.log <<L

## $(TZ=America/Chicago date '+%Y-%m-%d %H:%M %Z') · Map screen (Noodle, branch map-screen) · commit $C · bundle $B
  - One shared map component (source/src/map-screen.js/.css) for Act 1, Act 2, Act 3 and the Meadow overview, Squid's final ui-map art (thin outlines, star row under tiles) + 30 data-driven thumbs (ui/map/thumbs/index.json)
  - Hub map button + Trail Board → Meadow overview; Crew/Skins + Play/Timed note moved to Hub HUD; Act 3 shows only built levels (no 'Coming soon'); Play always on screen with Timed toggle
  - Tests: Fern smoke + l17 local (no new fails vs baseline), all.mjs local pre-rebase; live smoke below
L
flock -u 9
cd $T && node smoke.mjs >/tmp/map-smoke-live.log 2>&1; newfails smoke; echo "DONE live smoke"
