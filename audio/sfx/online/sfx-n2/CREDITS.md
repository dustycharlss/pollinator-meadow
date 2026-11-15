# Online SFX (N2 lobby UI) — credits

Folder: `/workspace/assets-incoming/online/sfx-n2/`

Soft, kid-friendly lobby cues for Pollinator Meadow online co-op N2 (Play with friends, Host / Join, PIN-tap variants, character pick, Copied! pop, room-start whoosh, Leave game, Asking the host loop, host said not now, Room is full, Online play is turned off). All 14 new stems are original synthesised pastel UI cues in G major at 72 BPM (soft piano, celesta, flute, marimba-like, plus a band-limited whoosh), licensed **CC0 1.0**. Nothing here is CC-BY, NC, SA, ND, or GPL, and nothing needs an in-game credit line. No third-party sample or soundfont was used.

The hook map also reuses three already-shipped CC0 stems from `online/sfx/` (`pin-tap`, `pin-wrong`, `joined`). Those files were not copied or re-encoded; their credits stay in `online/sfx/CREDITS.md`.

## Files

LUFS and true peak are given for both encodes (Opus / AAC), measured with `apad=pad_dur=1,ebur128=peak=true`. KB is file size / 1024.

| stem | duration | Opus .ogg | AAC .m4a | LUFS (ogg / m4a) | true peak (ogg / m4a) | license | source |
|---|---:|---:|---:|---|---|---|---|
| `play-friends-tap` | 0.340 s | 6.2 KB | 6.0 KB | −20.3 / −20.3 | −6.3 / −6.3 dBTP | CC0 1.0 (original) | Original soft G5 title-button tap |
| `choice-host` | 0.320 s | 5.9 KB | 6.0 KB | −20.4 / −20.3 | −6.3 / −6.2 dBTP | CC0 1.0 (original) | Original warm G select |
| `choice-join` | 0.320 s | 5.9 KB | 5.9 KB | −20.2 / −20.2 | −6.3 / −6.1 dBTP | CC0 1.0 (original) | Original brighter B select |
| `pin-tap-b` | 0.180 s | 4.0 KB | 4.0 KB | −20.3 / −20.3 | −6.9 / −5.2 dBTP | CC0 1.0 (original) | Original G5 PIN-tile tick (variant of `online/sfx/pin-tap`) |
| `pin-tap-c` | 0.180 s | 3.9 KB | 4.1 KB | −20.2 / −20.2 | −7.9 / −7.4 dBTP | CC0 1.0 (original) | Original A5 PIN-tile tick |
| `pin-tap-d` | 0.180 s | 4.1 KB | 3.9 KB | −20.1 / −20.2 | −6.8 / −6.9 dBTP | CC0 1.0 (original) | Original D6 PIN-tile tick |
| `character-pick` | 0.520 s | 8.8 KB | 8.4 KB | −20.3 / −20.3 | −5.0 / −5.0 dBTP | CC0 1.0 (original) | Original G–B class-card confirm |
| `copied-pop` | 0.230 s | 4.6 KB | 4.6 KB | −20.3 / −20.1 | −6.3 / −5.2 dBTP | CC0 1.0 (original) | Original tiny Copied! toast pop |
| `room-start-whoosh` | 0.899 s | 13.3 KB | 13.0 KB | −20.2 / −20.2 | −5.1 / −4.9 dBTP | CC0 1.0 (original) | Original soft whoosh plus quiet G–B–D lift |
| `leave-game` | 0.720 s | 11.5 KB | 10.9 KB | −20.2 / −20.2 | −5.0 / −4.3 dBTP | CC0 1.0 (original) | Original warm G–B leave confirm (stays on tonic) |
| `asking-host-loop` | 3.333 s (loop) | 47.9 KB | 42.2 KB | −20.3 / −20.3 | −4.9 / −4.1 dBTP | CC0 1.0 (original) | Original low G–D waiting pulse, seamless |
| `host-said-not-now` | 0.780 s | 12.6 KB | 11.6 KB | −20.0 / −19.9 | −5.1 / −5.0 dBTP | CC0 1.0 (original) | Original kind G–A–G neighbour, no fail sting |
| `room-full` | 0.780 s | 12.8 KB | 11.4 KB | −20.3 / −20.3 | −7.8 / −7.5 dBTP | CC0 1.0 (original) | Original level G-major dyad (softer than sfx-n6/room-full) |
| `online-play-off` | 0.700 s | 11.5 KB | 10.8 KB | −20.0 / −20.0 | −5.1 / −4.8 dBTP | CC0 1.0 (original) | Original calm two-pulse “online is off” notice |


## Credit line (optional)

Online N2 lobby UI sounds: original CC0 1.0 (credit optional).

Optional formal mark: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

`/workspace/tc`, `game/`, `/workspace/reef`, and `/workspace/project-pollinator` were not written. Helpers were imported from `online/sfx-n3n4/src/compose_n3n4_sfx.py` without editing that folder.
