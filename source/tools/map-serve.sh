#!/bin/bash
# Local test build of the map-screen worktree: builds to /tmp/mapbuild and serves it with the worktree's art on :8955
set -e
WT=/workspace/tc-wt-map
cd $WT/source && npx vite build --outDir /tmp/mapbuild --emptyOutDir >/tmp/mapbuild.log 2>&1
mkdir -p /tmp/mapserve && find /tmp/mapserve -mindepth 1 -delete
for f in $WT/*; do b=$(basename $f); [ "$b" = index.html ] || [ "$b" = assets ] || [ "$b" = source ] || ln -s $f /tmp/mapserve/$b; done
mkdir -p /tmp/mapserve/assets && cp -r /tmp/mapbuild/assets/* /tmp/mapserve/assets/ && cp /tmp/mapbuild/index.html /tmp/mapserve/
for f in $WT/assets/*; do [ -e /tmp/mapserve/assets/$(basename $f) ] || ln -s $f /tmp/mapserve/assets/; done
if ! curl -s -o /dev/null localhost:8955/; then (cd /tmp/mapserve && setsid nohup python3 -m http.server 8955 >/tmp/mapserve.log 2>&1 &); sleep 1; fi
echo served; grep -o 'index-[^"]*\.js' /tmp/mapserve/index.html
