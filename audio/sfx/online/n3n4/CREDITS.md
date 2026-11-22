# Online SFX (N3 / N4) — credits

Folder: `/workspace/assets-incoming/online/sfx-n3n4/`

Soft, kid-friendly one-shots and two short pending loops for Pollinator Meadow online co-op, covering the N3 ready-wait / level-start states and the N4 drop, reconnect, and host-ended states. All 12 stems are original synthesised pastel UI cues in G major (soft piano, celesta, flute, marimba-like), licensed **CC0 1.0**. Nothing here is CC-BY, NC, SA, ND, or GPL, and nothing needs an in-game credit line. No third-party sample or soundfont was used.

v1 has no host migration; there is no host-migration cue in this folder.

Each stem is mono, loudness-matched to about −20 LUFS (ffmpeg `apad=pad_dur=1,ebur128=peak=true`, the same short-line method as `online/sfx` and `act3/sfx-ui`), with true peak at or below −3 dBTP, limiter only. Encoding follows the project one-shot / loop-safe path: Opus-in-Ogg 48 kHz 96 kbps (pre-skip 312, granule = pre-skip + *N*) and AAC-LC 44.1 kHz 96 kbps with `iTunSMPB`.

These clips do not replace or overwrite `/workspace/assets-incoming/online/sfx/` (including that folder’s `connection-lost` and `reconnected`) or the Act 3 / UI packs. No already-mapped project-pollinator UI sound was reused.

`/workspace/tc`, `game/`, `/workspace/reef`, and Squid/Fern files were not written.

## Files

LUFS and true peak are given for both encodes (Opus / AAC). KB is file size / 1024.

| stem | duration | loop | Opus .ogg | AAC .m4a | LUFS (ogg / m4a) | true peak (ogg / m4a) | license | source |
|---|---:|---|---:|---:|---|---|---|---|
| `ready-tick` | 0.270 s | no | 5.2 KB | 5.1 KB | −20.5 / −20.5 | −6.8 / −5.4 dBTP | CC0 1.0 (original) | Soft G5 marimba/celesta pluck |
| `ready-tick-p1` | 0.270 s | no | 5.2 KB | 5.1 KB | −20.5 / −20.5 | −6.8 / −5.4 dBTP | CC0 1.0 (original) | P1 variant, same as `ready-tick` |
| `ready-tick-p2` | 0.270 s | no | 5.5 KB | 5.0 KB | −20.0 / −20.0 | −5.8 / −4.8 dBTP | CC0 1.0 (original) | P2 variant, B5 pluck |
| `ready-tick-p3` | 0.270 s | no | 5.6 KB | 5.0 KB | −20.0 / −20.1 | −5.7 / −5.7 dBTP | CC0 1.0 (original) | P3 variant, D6 pluck |
| `all-ready-chime` | 1.350 s | no | 21.5 KB | 18.5 KB | −20.0 / −20.0 | −5.0 / −5.1 dBTP | CC0 1.0 (original) | Rising G–B–D–G piano + celesta |
| `friend-loading-loop` | 3.000 s | yes | 43.7 KB | 38.2 KB | −20.2 / −20.0 | −4.9 / −3.7 dBTP | CC0 1.0 (original) | Soft G–D–B–D pending sway |
| `connection-lost` | 0.900 s | no | 15.0 KB | 12.8 KB | −20.1 / −20.1 | −5.0 / −3.3 dBTP | CC0 1.0 (original) | Gentle B4–G4 descent (not an alarm) |
| `reconnecting-loop` | 2.500 s | yes | 37.8 KB | 32.3 KB | −20.3 / −20.4 | −5.0 / −3.7 dBTP | CC0 1.0 (original) | Hopeful D–G–A pending figure |
| `reconnected-chime` | 0.900 s | no | 14.5 KB | 13.2 KB | −20.0 / −20.0 | −5.6 / −5.7 dBTP | CC0 1.0 (original) | Resolving D4–G4–B4 up-chime |
| `friend-free-toast` | 0.316 s | no | 5.9 KB | 5.7 KB | −20.4 / −20.2 | −7.5 / −3.1 dBTP | CC0 1.0 (original) | Soft D5–G5 toast blip |
| `game-ended` | 1.050 s | no | 15.1 KB | 14.5 KB | −20.3 / −20.3 | −5.0 / −5.0 dBTP | CC0 1.0 (original) | Gentle, final G-major close |
| `ping-warning` | 0.176 s | no | 3.7 KB | 4.1 KB | −22.0 / −20.7 | −8.5 / −3.8 dBTP | CC0 1.0 (original) | Subtle A4 blip; quieter so repeated AAC stays ≤ −3 dBTP |

Optional credit line (all stems): original CC0 1.0 composition, 2026. Formal mark: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
