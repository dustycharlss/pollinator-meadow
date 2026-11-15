# Online co-op SFX — credits

Folder: `/workspace/assets-incoming/online/sfx/`

Soft, cute, kid-friendly one-shots for Pollinator Meadow online co-op. All 20 stems are original synthesised pastel UI cues, licensed CC0 1.0. Seventeen came from the first online-sfx pass; `emote-ok`, `emote-wait-for-me` and `emote-follow-me` were added so the live emote bar can follow `online-coop.md` §4. Nothing here is CC-BY, NC, SA, ND, or GPL, and nothing needs an in-game credit line.

Each stem is short and mono, silence-trimmed, loudness-matched to about −20 LUFS (ffmpeg `apad=pad_dur=1,ebur128=peak=true`, the same method as `act3/sfx-ui`), with true peak at or below −3 dBTP, limiter only (no heavy soft clip). The limiter is the project UI chain: oversampled `alimiter` (`limit=0.56`, attack 0.5 ms, release 50 ms), except `join-request-knock`, which used a tighter ceiling (`limit=0.45`) so the AAC encode would stay under −3 dBTP.

Encoding follows `/workspace/assets-incoming/optimized/audio-README.md` for one-shots (no loop padding):

- **Primary:** Opus-in-Ogg `.ogg`, 96 kbps VBR (`libopus`, `-application audio`, compression level 10), 48 kHz, mono. Last granule set to pre-skip + playable samples so a compliant decode is exact.
- **Fallback:** AAC-LC 96 kbps (`-profile:a aac_low -aac_coder twoloop`) at the 44.1 kHz master rate, `.m4a` with `+faststart` and a correct `iTunSMPB` (priming, end padding, original sample count).

These clips do not duplicate the 17 files in `/workspace/assets-incoming/act3/sfx/` or the 18 in `act3/sfx-ui/`. No already-mapped project-pollinator UI sound was reused (including `p2-join-chime`, `p2-leave`, `swap-character`, `cant-afford`, `tab-tap`, `error-bonk`, `gentle-bonk-poof`, `visitor-doorbell`, `invite-chime`, `helper-arrive-whistle`, and Kenney `error_*` / `question_001` / `toggle_003` / `confirmation_*`). Kenney packs were copied into a work folder and inspected only; nothing was moved out of the project tree.

`/workspace/tc`, `game/`, `/workspace/reef`, `/workspace/project-pollinator`, and Squid/Fern files were not written.

## Files

LUFS and true peak are given for both encodes (Opus / AAC). KB is file size / 1024.

| stem | duration | Opus .ogg | AAC .m4a | LUFS (ogg / m4a) | true peak (ogg / m4a) | license | source |
|---|---:|---:|---:|---|---|---|---|
| `room-created` | 1.230 s | 18.4 KB | 17.1 KB | -20.0 / -19.9 | -8.0 / -7.0 dBTP | CC0 1.0 (original) | Original warm F4–A4–C5 pastel arpeggio |
| `join-request-knock` | 0.500 s | 7.3 KB | 8.1 KB | -20.2 / -20.2 | -6.7 / -6.8 dBTP | CC0 1.0 (original) | Original soft rounded double wood knock |
| `host-approves` | 1.060 s | 16.6 KB | 15.0 KB | -20.0 / -20.0 | -6.5 / -6.4 dBTP | CC0 1.0 (original) | Original warm A4–E5 “yes, come in” chime |
| `joined` | 1.260 s | 19.9 KB | 17.4 KB | -20.0 / -20.0 | -6.9 / -6.9 dBTP | CC0 1.0 (original) | Original fuller F4–C5–E5 arrival chime |
| `pin-tap` | 0.140 s | 3.2 KB | 4.0 KB | -20.1 / -20.1 | -5.0 / -5.0 dBTP | CC0 1.0 (original) | Original short soft tile tick |
| `pin-wrong` | 0.730 s | 11.6 KB | 11.1 KB | -19.9 / -20.0 | -6.5 / -6.5 dBTP | CC0 1.0 (original) | Original muted descending A5–F♯5 “not quite” |
| `locked-out` | 1.480 s | 18.9 KB | 20.0 KB | -20.0 / -19.9 | -8.1 / -7.3 dBTP | CC0 1.0 (original) | Original calm muted E4–C4 “take a little break” |
| `connection-lost` | 1.200 s | 16.8 KB | 16.6 KB | -20.0 / -20.0 | -7.4 / -7.4 dBTP | CC0 1.0 (original) | Original muted G4–D4 drop (not an alarm) |
| `reconnected` | 1.280 s | 19.3 KB | 17.6 KB | -20.0 / -20.0 | -6.6 / -6.7 dBTP | CC0 1.0 (original) | Original hopeful D4–A4–D5 return |
| `emote-wave` | 0.543 s | 9.6 KB | 8.8 KB | -20.1 / -20.2 | -5.0 / -5.1 dBTP | CC0 1.0 (original) | Original short swoosh plus G5 bell |
| `emote-ok` | 0.550 s | 9.2 KB | 8.9 KB | -20.0 / -19.9 | -5.3 / -5.0 dBTP | CC0 1.0 (original) | Original short compact C5–E5 “yep” nod |
| `emote-help` | 0.640 s | 11.3 KB | 9.9 KB | -20.0 / -20.0 | -5.9 / -5.9 dBTP | CC0 1.0 (original) | Original soft G5–C6 question rise |
| `emote-over-here` | 0.500 s | 9.1 KB | 8.0 KB | -20.1 / -20.0 | -5.0 / -5.0 dBTP | CC0 1.0 (original) | Original two quick A5 attention pings |
| `emote-wait-for-me` | 0.920 s | 14.8 KB | 13.3 KB | -20.0 / -19.9 | -9.5 / -3.8 dBTP | CC0 1.0 (original) | Original two spaced soft D5 “hold on” bells |
| `emote-follow-me` | 0.760 s | 12.4 KB | 11.4 KB | -20.0 / -20.0 | -6.6 / -6.6 dBTP | CC0 1.0 (original) | Original G4–B4–D5 stepping “come with me” walk |
| `emote-yay` | 0.800 s | 13.9 KB | 11.8 KB | -20.0 / -20.0 | -5.3 / -5.4 dBTP | CC0 1.0 (original) | Original short C5–E5–G5–C6 flourish (not a fanfare) |
| `emote-thanks` | 0.760 s | 12.9 KB | 11.4 KB | -20.0 / -20.0 | -5.8 / -5.6 dBTP | CC0 1.0 (original) | Original warm E5–G5 bow |
| `emote-heart` | 0.740 s | 12.7 KB | 10.7 KB | -20.0 / -20.0 | -5.3 / -5.3 dBTP | CC0 1.0 (original) | Unused spare. Original warm F5 bloom plus a tiny sparkle |
| `emote-laugh` | 0.460 s | 9.0 KB | 7.4 KB | -20.0 / -19.9 | -9.1 / -9.3 dBTP | CC0 1.0 (original) | Unused spare. Original three tonal bubble pops (E6–G6–C7), no voice |
| `emote-oops` | 0.440 s | 7.4 KB | 7.1 KB | -20.3 / -20.2 | -5.0 / -3.5 dBTP | CC0 1.0 (original) | Unused spare. Original muted G4 bonk plus a tiny downward slide |

## Per-file notes and credit lines

All 17 share:

- License: CC0 1.0 (original)
- Source: original synthesised pastel UI one-shot (no third-party sample)
- Credit line: original CC0 1.0 (credit optional)
- Author: original (Pollinator incoming pack)
- Source URL: none

### room-created

- Use: Host creates a room; the code is ready to share
- 1.230 s · 18.4 KB ogg / 17.1 KB m4a · -20.0 / -19.9 LUFS · TP -8.0 / -7.0 dBTP · mono
- Distinct from `p2-join-chime` (C5–G5), `joined` (F4–C5–E5), and mapped invite / confirmation cues.

### join-request-knock

- Use: Join-request prompt for the host (gentle knock)
- 0.500 s · 7.3 KB ogg / 8.1 KB m4a · -20.2 / -20.2 LUFS · TP -6.7 / -6.8 dBTP · mono
- Two soft, slightly rounded knocks, mid-focused and not boomy, so it does not feel ominous. Fresh versus mapped `visitor-doorbell` and Kenney wood impacts. A tighter limiter ceiling was used so the AAC encode stayed under −3 dBTP.

### host-approves

- Use: Host approves a joiner
- 1.060 s · 16.6 KB ogg / 15.0 KB m4a · -20.0 / -20.0 LUFS · TP -6.5 / -6.4 dBTP · mono
- Warm A4–E5 “yes, come in”. Distinct from `p2-join-chime` and from `joined`.

### joined

- Use: Joiner enters the room
- 1.260 s · 19.9 KB ogg / 17.4 KB m4a · -20.0 / -20.0 LUFS · TP -6.9 / -6.9 dBTP · mono
- Fuller arrival than `host-approves`, ending on E5 rather than `room-created`’s C5.

### pin-tap

- Use: Picture-PIN tile press
- 0.140 s · 3.2 KB ogg / 4.0 KB m4a · -20.1 / -20.1 LUFS · TP -5.0 / -5.0 dBTP · mono
- Short soft tile tick, distinct from `tab-tap` (Kenney `toggle_003`).

### pin-wrong

- Use: Wrong PIN (soft “not quite”)
- 0.730 s · 11.6 KB ogg / 11.1 KB m4a · -19.9 / -20.0 LUFS · TP -6.5 / -6.5 dBTP · mono
- Muted descending minor third. Kenney `error_*` buzzers and `cant-afford` (`question_001`) were not reused.

### locked-out

- Use: Calm PIN lockout (“Take a little break”)
- 1.480 s · 18.9 KB ogg / 20.0 KB m4a · -20.0 / -19.9 LUFS · TP -8.1 / -7.3 dBTP · mono
- Lower, slower, and muted. Not a lock slam or fail sting. Slightly longer so the calm decay can finish.

### connection-lost

- Use: Drop / connection lost
- 1.200 s · 16.8 KB ogg / 16.6 KB m4a · -20.0 / -20.0 LUFS · TP -7.4 / -7.4 dBTP · mono
- Muted G4–D4 drop, lower than `p2-leave` (E5–B4). Gentle goodbye, not an alarm.

### reconnected

- Use: Rejoin within the grace window
- 1.280 s · 19.3 KB ogg / 17.6 KB m4a · -20.0 / -20.0 LUFS · TP -6.6 / -6.7 dBTP · mono
- Hopeful D4–A4–D5 return, distinct from `joined` and `host-approves`.

### emote-wave

- Use: 👋 Hi! emote pop (`online-coop.md` §4)
- 0.543 s · 9.6 KB ogg / 8.8 KB m4a · -20.1 / -20.2 LUFS · TP -5.0 / -5.1 dBTP · mono
- Short airy swoosh plus a friendly G5 bell. Mapped whooshes were not reused.

### emote-ok

- Use: 👍 OK! emote pop (`online-coop.md` §4)
- 0.550 s · 9.2 KB ogg / 8.9 KB m4a · -20.0 / -19.9 LUFS · TP -5.3 / -5.0 dBTP · mono
- Short compact C5–E5 “yep” nod, slightly rounded, no sparkle. Distinct from `emote-thanks` (E5–G5, longer and warmer), `emote-yay` (four-note flourish), `emote-help` (G5–C6 question rise), and `host-approves` (A4–E5, about 1 s).

### emote-heart

- Use: unused spare (not in the §4 emote bar)
- 0.740 s · 12.7 KB ogg / 10.7 KB m4a · -20.0 / -20.0 LUFS · TP -5.3 / -5.3 dBTP · mono
- Warm F5 bloom with a tiny high sparkle. Distinct from star pops and sparkles.

### emote-laugh

- Use: unused spare (not in the §4 emote bar)
- 0.460 s · 9.0 KB ogg / 7.4 KB m4a · -20.0 / -19.9 LUFS · TP -9.1 / -9.3 dBTP · mono
- Three short tonal bubble pops (E6–G6–C7) with a slight pitch scoop. No human voice and no vocal formants.

### emote-help

- Use: ❓ Help? emote pop (`online-coop.md` §4)
- 0.640 s · 11.3 KB ogg / 9.9 KB m4a · -20.0 / -20.0 LUFS · TP -5.9 / -5.9 dBTP · mono
- Soft G5–C6 question rise, distinct from `cant-afford`.

### emote-over-here

- Use: 👉 Over here! emote pop (and the ping ring) (`online-coop.md` §4)
- 0.500 s · 9.1 KB ogg / 8.0 KB m4a · -20.1 / -20.0 LUFS · TP -5.0 / -5.0 dBTP · mono
- Two quick A5 attention pings.

### emote-wait-for-me

- Use: ⏳ Wait for me! emote pop (`online-coop.md` §4)
- 0.920 s · 14.8 KB ogg / 13.3 KB m4a · -20.0 / -19.9 LUFS · TP -9.5 / -3.8 dBTP · mono
- Two spaced soft D5 bells with a longer decay, a gentle “hold on”. Wider spacing and a lower register than `emote-over-here`. Distinct from `locked-out` (E4–C4, a calm lockout) and from `pin-wrong` (a muted “not quite”). The AAC true peak is a little closer to the ceiling than the Opus encode, still at or below −3 dBTP.

### emote-follow-me

- Use: 🐾 Follow me! emote pop (`online-coop.md` §4)
- 0.760 s · 12.4 KB ogg / 11.4 KB m4a · -20.0 / -20.0 LUFS · TP -6.6 / -6.6 dBTP · mono
- Three stepping G4–B4–D5 bells in an even “paw-step” walk, a soft lead forward. Distinct from `emote-yay` (a brighter C5–E5–G5–C6 flourish with sparkle), `emote-over-here` (stay-here pings), and `emote-wave` (a hello swoosh).

### emote-yay

- Use: 🎉 Yay! emote pop (`online-coop.md` §4)
- 0.800 s · 13.9 KB ogg / 11.8 KB m4a · -20.0 / -20.0 LUFS · TP -5.3 / -5.4 dBTP · mono
- Short C5–E5–G5–C6 flourish, much smaller than `all-stars-fanfare` or mapped win jingles.

### emote-thanks

- Use: 🙏 Thanks! emote pop (`online-coop.md` §4)
- 0.760 s · 12.9 KB ogg / 11.4 KB m4a · -20.0 / -20.0 LUFS · TP -5.8 / -5.6 dBTP · mono
- Warm E5–G5 bow.

### emote-oops

- Use: unused spare (not in the §4 emote bar)
- 0.440 s · 7.4 KB ogg / 7.1 KB m4a · -20.3 / -20.2 LUFS · TP -5.0 / -3.5 dBTP · mono
- Muted mid bonk plus a tiny downward slide. Fresh versus `gentle-bonk-poof`, `error-bonk`, and `cant-afford`. The AAC true peak is the closest to the ceiling in this set, still at or below −3 dBTP.

## Processing

- Masters: mono 44.1 kHz, silence trim, short fades, limiter-only oversampled `alimiter` as above.
- Target about −20 LUFS integrated (with 1 s pad so short cues measure the same way as `act3/sfx-ui`), true peak ≤ −3 dBTP on both encodes.
- `/workspace/tc`, `game/`, `/workspace/reef`, and `/workspace/project-pollinator` were not edited. Sources were synthesised in a work folder; Kenney zips were copied, never moved.

## Gaps

- The live §4 emote set is complete: Hi! (`emote-wave`), OK!, Help?, Over here!, Wait for me!, Follow me!, Yay! and Thanks!. All stems, including the three unused spares, are original CC0 1.0.
- `emote-heart`, `emote-laugh` and `emote-oops` remain in the folder as unused spares from an earlier brief. They are not mapped to the live emote bar.
- Real CC0 door-knock recordings on Freesound were considered (for example HunteR4708 “Knock on the door 2”, https://freesound.org/people/HunteR4708/sounds/256512/, and SamuelGremaud “DOOR KNOCKING”, https://freesound.org/people/SamuelGremaud/sounds/426736/) but not used: a real knock can feel anxious, and an original soft rounded double-knock stays in the pastel UI family, is clearly CC0, and is easier to keep under the true-peak ceiling.
- No project-mapped sound was reused.
