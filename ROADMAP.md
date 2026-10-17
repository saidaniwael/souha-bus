# SouSou Bus — Gameplay Roadmap

Goal: make boarding taps and special travelers exciting, fair and "one more level" addictive.
Source: the gameplay review (boarding loop + specials). Status is updated as work lands.

Legend: ✅ done · 🚧 in progress · ⏳ next · 💤 later

---

## Phase 1 — Fair, rare, readable specials  ✅

Problem: ~1 special per second, alive 0.6 s, half of them faded (wrong country), tiny rewards → noise, not events.

- ✅ Specials come on a timer: first one 3 s into the level, then one every **6–10 s**
- ✅ Always tappable: a special fits **any** bus that can board (shows its own icon instead of a flag)
- ✅ Telegraph: rising 3-note shimmer + pop-in at the **front** of the crowd, with a white countdown ring
- ✅ Fair window: **1.6 s** at level 1 → 1.1 s by level 16 (1.0 s floor)
- ✅ Catch rate measured with the test bot (450–600 ms reaction): **50–80%**, mostly 64–75% ✔ target

## Phase 2 — Specials with real verbs + Rush meter  ✅

| Special | Effect |
|---|---|
| ⚡ **Rush hour** | 5 s: every waiting traveler follows the bus that can board, spawns double, fares ×2, golden screen glow, faster music |
| 🧲 **Magnet** | Boards every matching traveler on screen in one rising chain (skips groups that won't fit) |
| 🎫 **Golden ticket** | The bus shows a "×3" chip and glows gold; its fares are tripled when it leaves |
| 🎁 **Mystery gift** | Random: 100–1,000 coins on the bus (mostly small), or a Magnet / Golden ticket / Rush hour |
| 😊 **Smile** | Mood +25 (only offered when mood < 90) |
| ⭐ **VIP** | Combo ×2, with a "COMBO ×2!" shout |

- ✅ **Rush meter** (⚡ bar under the combo badge): +1.3 per boarded seat, +12 per perfect fit, +8 per special;
  glows when ≥75%; full → Rush hour. Measured: **1–4 Rush hours per level**
- ✅ During Rush hour the crowd re-targets to whichever bus can board (a full bus hands over to the next)
- ✅ Translations (EN / FR / AR) for all new texts; How to play tip updated

## Phase 3 — Feel the reward now  ✅

- ✅ Per-tap payout: coins fly from each boarded traveler into its bus immediately
- ✅ Perfect fit = signature skill shot: the group pays ×2 plus 5 fares, bus tag flashes gold, coin burst from the bus, cash sting, Rush +12
- ✅ Clarity: wrong-country travelers are smaller (82%), grey and faint; right ones pop
- ✅ Rhythm: spawn pace swings surge → lull every 9 s (waves)
- ✅ "Leaving soon": a traveler's tag pulses red in its last 0.9 s (colour only, no body movement)

## Phase 4 — Reasons to come back  ✅

- ✅ **Daily goals**: 3 per day (picked from the date) out of: catch specials, trigger Rush hours, perfect fits,
  reach a combo, send full buses, win levels. Each goal done → the next level starts with **⚡ +50** on the
  Rush meter (two goals = Rush hour right after GO). No coins (money only comes from claiming buses)
- ✅ **Sticker album**: each of the 6 specials in each of the 6 countries (36 stickers); "New sticker!" toast
- ✅ Home: "🎯 0/3 · 📖 3/36" pill next to Best combo opens one sheet with goals + album (fits without scrolling)
- ✅ Tuning pass with bots (see below)

## Next ideas  💤

- 💤 Album rewards (complete a row → a permanent cosmetic, e.g. a golden bus skin)
- 💤 Weekly event level with a special rule (e.g. "only groups", "double specials")
- 💤 Goal targets that scale with the player's level

---

## Measurements (test bots, fixed clock)

| Level | Player | Result | Specials caught | Rush hours |
|---|---|---|---|---|
| 1 | fast (280 ms, 450 ms reaction) | win, 3★, 0:31 left | 3/4 (75%) | 1 |
| 4 | casual (450 ms, 600 ms reaction) | win, 3★ | 3/4 (75%) | 1 |
| 10 | casual | win, 3★, 0:44 left | 4/6 (67%) | 2 |
| 13 | casual | time's up at 87% | 7/11 (64%) | 4 |
| 16 | quick (350 ms, 500 ms reaction) | win, 3★ | 5/7 (71%) | 2 |

Difficulty still climbs (a casual player now loses level 13 on time at 87% instead of on mistakes at 14%).

## Changelog

- **Phases 1–4** — rare/fair specials with new effects, Rush meter + Rush hour, per-tap coins, perfect-fit moment,
  clarity and waves, leaving-soon pulse, daily goals, sticker album. Also fixed: How to play could open over the
  countdown on a first-ever level; traveler tags now refresh when their destination changes.
- **Audio fix** — sound could stay silent after switching tabs/apps on mobile. A possibly stale audio context
  (always on iOS, or when time stops moving elsewhere) is now rebuilt inside the next tap; music restarts.
- **How to play** — new "Specials" tab: each special traveler with its icon and effect, plus the Rush meter rule (EN/FR/AR).
- **Audio warning fix** — on touch screens the sound engine was created on `pointerdown`, which browsers don't count
  as a gesture ("AudioContext was not allowed to start"). Audio now only starts/resumes during real gestures (`touchend`/click).
- **Look** — Rush hour glow is purple (gold/red read like a warning). Daily goals use a trophy icon, opened from a new
  icon-only trophy button next to the music button (red dot when a goal is newly done); the pill under Best combo is gone.
  Header sized to fit logo + trophy + music + coins (up to 6 digits) on 320–430 px screens.
- **Logo** — the home header uses `dist/sousoubus-logo.svg` (inlined so it can fall back to the Nunito font on phones without Arial Black).
- **Bus look** — buses are painted the UI's vivid orange (#ff9600 on screen; the paint skips the filmic tone mapping that
  washed it out) and carry the SOU/BUS logo in white on both sides and the front. The home logo is the same orange.
- **Logo** — the home header now uses `dist/sousoubus-logo-outlined.svg` (orange set to #ff9600), exactly as tall as the header buttons (46 / 44 / 42 px by screen width).
- **Station tabs** — redesigned like the home buttons: the current station is a filled blue 3D card, others white 3D cards,
  gold when money waits; bigger flags, bold names, a clear bus-count / claim-time chip; names fit with 5–6 stations.
  The red "leaving soon" pulse now starts 0.65 s before a traveler leaves (was 0.9 s) so fewer tags are red at once.
- **Scene** — the waving flag on its pole and the flags on bus roofs are gone; scene colours unchanged (a fully white
  scene was tried and reverted).
- **Cities** — stations are now Tunis, Paris, Amsterdam, Brussels, Istanbul, Madrid, Rome (unlocked in that order, 7th at
  level 16); new NL/BE flags; names in EN/FR/AR; with 7 stations the tabs show flags only. Album = 6 specials × 7 cities.
- **Travelers** — redesigned: chunky low-poly people with a rounded body in their destination's colour, five skin tones,
  hair or a cap, dot eyes, dark trousers, and often a colourful suitcase (all shared geometry, cheap for big crowds).
- **Combo banner removed** — when a combo ends, the combo badge pops, shows "+coins" under it and its coins fly to the buses.
- **Travelers as icons (performance)** — the 3D people are gone: each traveler is a "User Full Body" icon in its
  destination's colour (two icons for a group, with the count badge), a small flag badge only when it can board the
  selected bus, and a soft ground shadow. Boarding: the icon hops in an arc into the bus door (the bus still dips);
  leaving: it pops away. Traveler tags are measured only when they appear or the screen changes (not every frame).
- **Traveler patience** — every traveler icon is the same dark colour; groups use the "User Friendship Group" icon.
  Patience shows inside the icon: it empties from the top like the mood face and turns orange, then red, just before
  the traveler leaves (replaces the thin bar and the red tag border).
- **Circular traveler tags** — travelers and specials are round tags (flag badge top-left, group count top-right).
- **Won't fit** — a group that doesn't fit the selected bus is a filled red circle with a white (still draining) icon.
- **Special countdown** — a special's white outline is its timer: a ring that empties clockwise until it disappears (the small bar is gone).
- **Specials look** — no glow rays or halo and no timer bar: a solid coloured circle with its icon and the white countdown ring.
