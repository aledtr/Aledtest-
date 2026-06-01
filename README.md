# 🚜 Hyundai Mow Master — Black Range Lawn Mowing Game

A complete, browser-based arcade lawn-mowing game built around the **Hyundai
"Black Range"** of lawnmowers. Pick a machine from the line-up, drive it across
overgrown gardens, cut the grass to the target percentage before you run out of
fuel/battery or time, earn cash, and unlock faster, wider, longer-lasting mowers.

No build step, no dependencies — pure HTML5 Canvas + vanilla JavaScript.

![menu](docs/menu.png)

## ▶ Play it

Because the game loads its scripts as separate files, open it through a tiny
local web server (opening `index.html` via `file://` works in most browsers too):

```bash
# any static server works — for example:
npx http-server -p 8080 -c-1
#   then visit  http://localhost:8080
```

Or simply double-click `index.html`.

## 🎮 How to play

- **Move:** `W` `A` `S` `D` or the **Arrow keys** (on-screen pad on touch devices).
- **Cut:** drive over uncut grass — wider decks cut more per pass and leave that
  satisfying striped finish.
- **Energy:** petrol mowers burn fuel and cordless mowers drain a battery
  (the corded starter mower runs off the mains — unlimited). Drive onto a
  glowing **refuel pad** (⛽ / ⚡) to top up.
- **Avoid:** trees, ponds, flowerbeds, gnomes and sheds. Clipping an obstacle
  stalls you and costs your **tidiness bonus**.
- **Earn & upgrade:** finish a lawn to bank £ (plus a 25% bonus for a clean,
  bump-free job), then spend it in the **Garage** on better Hyundai machines.

`P` / `Esc` pauses. Progress, wallet and unlocks are saved to `localStorage`.

## 🏁 The Hyundai Black Range roster

| Model | Class | Cut | Notes |
|-------|-------|-----|-------|
| **HYM3200E** | Corded Electric | 32cm | Free starter — unlimited mains power, narrow deck |
| **HYM430SP** | Petrol · Self-Propelled | 43cm | Balanced workhorse |
| **HYM40Li420** | 40V Cordless | 42cm | Quiet, brisk, no refuel pads needed |
| **HYM510SPE** | Petrol · Electric Start | 51cm | Wide cut, big tank |
| **HYM80Li460** | 80V Pro Cordless | 46cm | Fast, strong, quiet |
| **HYR1300 Rider** | Ride-On Tractor | 76cm | Flagship — demolishes big lawns |

## 🗺️ Career levels

Five increasingly demanding gardens — *The Back Garden*, *Cottage Lawn*,
*The Orchard*, *Manor Grounds* and *The Estate Final* — with rising target
percentages, tighter time limits, and more obstacles.

## 🗂️ Project structure

```
index.html        markup + screens (menu / garage / game / overlays)
css/style.css     all styling
js/audio.js       Web Audio engine — engine drone + UI/event sounds (no audio files)
js/mowers.js      the Hyundai Black Range roster + stats
js/levels.js      career garden definitions
js/game.js        screen routing, save state, garage/shop, gameplay loop
```

## 🛠️ Tech

Vanilla JS + Canvas 2D. The mower engine sound and all effects are synthesised
at runtime with the Web Audio API, so the whole game ships as a handful of text
files with **zero binary assets**.

---

*Fan-made tribute. "Hyundai" and the model names referenced are trademarks of
their respective owners and are used here descriptively for a non-commercial
fan game.*
