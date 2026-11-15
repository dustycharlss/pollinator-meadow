# Play with friends: Hub station (N2)

An in-world entry point for online play in meadow_hub. A blocky friendship bench and a lavender picnic blanket, plus a signpost with the three player flags: P1 gold circle+star, P2 blue rounded square+chevron, P3 pink hex+dots. Palette B.

## Files
- `play-with-friends-station.glb`: 28,948 B, meshopt + quantized, 1540 tris total. Nodes: `base` 108, `on` 936, `highlight` 364, `off` 132.
- `icons/`: map node (56/112, node-hub style), selected ring-only overlay (56/112), act3-style hub icon (256 png + svg).
- `mockups/`: Hub portrait 390x844 and landscape 844x390 (+@2x) for on / highlight / off, rendered with preset B.
- `previews/`: station on / highlight / off-decor on a transparent background.
- `manifest.json`, `sheet.png`.

## Runtime (for zones.js hubPad)
- Pad: `{ key:'friends', x:-14, z:-2.5, col:0xa99cf0, emoji:'🧺', label:'Play with friends', noSign:true }`. The GLB's signpost replaces the default post and sign. The model sits at the pad centre with `rotation.y = Math.PI/2`.
- Show `base` + `on`. Also show `highlight` while the player is inside the trigger radius (tc has no tap-highlight; this matches the walk-on ring behaviour).
- Entering the ring calls `ctx.onHub('friends')`, which opens Host a game / Join a game (same as the menu button `lobby/btn-play-friends`).

## Off state: hidden
When "Allow playing with friends" is OFF, or before N5 (N2 only shows under `?online=dev`), don't build the pad, ring, label or model, and don't import `net/`. This follows spec §4.1 ("button is hidden") and line 644. Roping it off would advertise something kids can't use. If the empty lawn looks odd, `base` + `off` gives a bench with flower pots and no online cues.

## Rebuild
- `./src/build.sh` runs station.js, then GLTFExporter, then gltf-transform weld/dedup/meshopt.
- `node src/shot.mjs hub|preview` (needs `python3 -m http.server 8765` in /workspace).
- `node src/icons.mjs`

## Spec conflicts
See `manifest.json` → `spec_conflicts`. In short: the spec's entry is a menu button, not a station. tc stations have no tap-highlight and no GLB models. The station must stay hidden while Allow is OFF and until N5. The Closet is locked until level 22. I couldn't see the qa-live finding.

tc was only read, never written.
