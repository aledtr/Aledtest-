# 🚜 Hyundai Mow Master — Black Range Lawn Mowing Game

A complete, polished, browser-based arcade lawn-mowing game built around the
**Hyundai "Black Range"** of lawnmowers. Pick a machine from the line-up, drive
it across overgrown gardens, cut the grass to the target percentage before you
run out of fuel/battery or time, grab coins and power-ups, chain combos for big
scores, dodge the wildlife, earn cash, and unlock faster, wider machines —
all while chasing the top of the leaderboard.

No build step, no dependencies, no binary assets — pure HTML5 Canvas + vanilla
JavaScript, with all sound synthesised at runtime via the Web Audio API.

![menu](docs/menu.png)

## ▶ Play it

Open it through a tiny local web server (the game loads its scripts as separate
files):

```bash
npx http-server -p 8080 -c-1
#   then visit  http://localhost:8080
```

Or simply double-click `index.html`.

## 🎮 How to play

- **Move:** `W` `A` `S` `D` or the **Arrow keys** (on-screen pad on touch devices).
- **Cut:** drive over uncut grass — wider decks cut more per pass and leave that
  satisfying striped finish.
- **Combo:** keep cutting continuously to build a **multiplier up to x5** — the
  higher the combo, the more points every blade of grass and every coin is worth.
  Stop cutting, bump an obstacle, or get spooked by wildlife and it resets.
- **Coins (£):** scattered across each lawn — drive over them for bonus cash and
  points, and to chase the 3rd star.
- **Power-ups:** grab the floating crates — ⚡ **Turbo** (speed boost),
  ↔ **Wide Cut** (bigger deck), ⛽ **Fuel** (top-up), £ **Cash**.
- **Energy:** petrol mowers burn fuel and cordless mowers drain a battery
  (the corded starter runs off the mains — unlimited). Drive onto a glowing
  **refuel pad** (⛽ / ⚡) to top up.
- **Avoid:** trees, ponds, hedges, rocks, gnomes, sheds — **and the wildlife**.
  Loose **dogs** 🐕 and **geese** 🪿 roam the bigger lawns; bump anything and you
  stall, lose your combo and forfeit your tidiness bonus.
- **Stars ⭐:** earn up to **3 stars** per lawn — one for finishing, one for a
  clean bump-free run, one for collecting most of the coins.
- **Earn & upgrade:** bank £ per lawn (plus bonuses), then spend it in the
  **Garage** on better Hyundai machines.
- **Records 🏆:** every win is scored; beat the board to enter your initials on
  the **leaderboard**, and track your per-lawn stars, best scores and best times.

`P` / `Esc` pauses · 🔊 toggles sound · progress, wallet, unlocks, stars and
scores all save to `localStorage`.

![gameplay](docs/gameplay.png)
*Riverside Park — coins, an x3.6 combo, two roaming geese, ponds and rocks.*

![records](docs/records.png)
*The Records screen — leaderboard plus per-lawn stars, best scores and times.*

## 🏁 The Hyundai Black Range roster (8 machines)

| Model | Class | Cut | Notes |
|-------|-------|-----|-------|
| **HYM3200E** | Corded Electric | 32cm | Free starter — unlimited mains power, narrow deck |
| **HYM430SP** | Petrol · Self-Propelled | 43cm | Balanced workhorse |
| **HYM40Li420** | 40V Cordless | 42cm | Quiet, brisk, no refuel pads needed |
| **HYM480SPE** | Petrol · Electric Start | 48cm | All-rounder, push-button ignition |
| **HYM510SPE** | Petrol · Electric Start | 51cm | Wide cut, big tank |
| **HYM80Li460** | 80V Pro Cordless | 46cm | Fast, strong, quiet |
| **HYR1300 Rider** | Ride-On Tractor | 76cm | Demolishes big lawns |
| **HYR2400 V-Twin** | Pro Ride-On · Flagship | 92cm | The ultimate machine — twin-blade, monster tank |

## 🗺️ Career levels (8 gardens)

Eight increasingly demanding gardens — *The Back Garden*, *Cottage Lawn*,
*The Orchard*, *Manor Grounds*, *Riverside Park*, *The Estate Gardens*,
*Maze Hedges* and *The Grand Final* — with rising target percentages, tighter
time limits, more coins, more obstacles, and more roaming wildlife.

## 🗂️ Project structure

```
index.html        markup + screens (menu / garage / records / game / overlays)
css/style.css     all styling
js/audio.js       Web Audio engine — engine drone + UI/event SFX (no audio files)
js/mowers.js      the Hyundai Black Range roster + stats
js/levels.js      career garden definitions (obstacles, coins, hazards, refuel)
js/game.js        screen routing, save state, garage/shop, records, gameplay loop
```

## 🛠️ Tech

Vanilla JS + Canvas 2D. The mower engine sound and every effect are synthesised
at runtime with the Web Audio API, so the whole game ships as a handful of text
files with **zero binary assets** (bar the README screenshot). Verified
end-to-end with a headless Playwright suite covering load, garage purchases,
records/leaderboard, coins, combos, scoring, stars, the high-score entry flow
and full level progression.

---

*Fan-made tribute. "Hyundai" and the model names referenced are trademarks of
their respective owners and are used here descriptively for a non-commercial
fan game.*
