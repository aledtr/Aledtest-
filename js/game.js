/* ============================================================
   game.js — Hyundai Mow Master main controller
   Handles: screen routing, save state, garage/shop, and the
   canvas gameplay loop (movement, mowing, collisions, energy).
   ============================================================ */
(function () {
  "use strict";

  const CELL = 30;            // px per grass cell
  const SAVE_KEY = "hyundai_mow_master_save_v1";

  /* ---------------- Persistent state ---------------- */
  const defaultState = () => ({
    wallet: 0,
    owned: ["hym3200e"],     // starter mower owned
    selected: "hym3200e",
    levelReached: 0,         // highest level index unlocked
    bestTimes: {}
  });

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (_) {}
    return defaultState();
  }
  function saveState() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  /* ---------------- DOM helpers ---------------- */
  const $ = (sel) => document.querySelector(sel);
  const screens = {
    menu:   $("#screen-menu"),
    howto:  $("#screen-howto"),
    garage: $("#screen-garage"),
    game:   $("#screen-game")
  };
  function show(name) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function fmtMoney(n) { return "£" + Math.round(n).toLocaleString("en-GB"); }
  function fmtTime(s) {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function refreshWallets() {
    $("#menu-wallet").textContent = fmtMoney(state.wallet);
    $("#garage-wallet").textContent = fmtMoney(state.wallet);
  }

  /* ============================================================
     GARAGE
     ============================================================ */
  function renderGarage() {
    const grid = $("#mower-grid");
    grid.innerHTML = "";
    MOWERS.forEach(m => {
      const owned = state.owned.includes(m.id);
      const selected = state.selected === m.id;
      const bars = MOWERS.bars(m);

      const card = document.createElement("div");
      card.className = "mower-card" + (selected ? " selected" : "") + (owned ? "" : " locked");

      card.innerHTML = `
        <div class="mower-thumb">${mowerThumbSVG(m)}</div>
        <div>
          <div class="mower-class">${m.class}</div>
          <div class="mower-name">${m.name}</div>
        </div>
        <div class="mower-desc">${m.desc}</div>
        ${statRow("Speed", bars.speed)}
        ${statRow("Cut", bars.width)}
        ${statRow("Runtime", bars.runtime)}
        ${statRow("Handling", bars.handling)}
        <div class="mower-foot"></div>
      `;
      const foot = card.querySelector(".mower-foot");

      if (!owned) {
        const buy = document.createElement("button");
        const affordable = state.wallet >= m.price;
        buy.className = "btn " + (affordable ? "btn-primary" : "");
        buy.disabled = !affordable;
        buy.innerHTML = `Buy · <span class="price-tag">${fmtMoney(m.price)}</span>`;
        buy.onclick = () => buyMower(m);
        foot.appendChild(buy);
      } else if (selected) {
        const tag = document.createElement("button");
        tag.className = "btn"; tag.disabled = true; tag.textContent = "✓ Selected";
        foot.appendChild(tag);
      } else {
        const sel = document.createElement("button");
        sel.className = "btn btn-primary"; sel.textContent = "Select";
        sel.onclick = () => { Sound.ui(); state.selected = m.id; saveState(); renderGarage(); };
        foot.appendChild(sel);
      }
      grid.appendChild(card);
    });
    refreshWallets();
  }

  function statRow(name, v) {
    return `<div class="stat-row"><span class="stat-name">${name}</span>
      <span class="stat-track"><span class="stat-bar" style="width:${Math.round(v*100)}%"></span></span></div>`;
  }

  function buyMower(m) {
    if (state.wallet < m.price) { Sound.deny(); return; }
    state.wallet -= m.price;
    state.owned.push(m.id);
    state.selected = m.id;
    Sound.buy();
    saveState();
    renderGarage();
  }

  // little top-down mower icon for cards
  function mowerThumbSVG(m) {
    return `<svg viewBox="0 0 120 92" width="100%" height="100%">
      <rect width="120" height="92" fill="#000"/>
      <g transform="translate(60,46)">
        <rect x="${-m.cutWidth*5-6}" y="-20" width="${m.cutWidth*10+12}" height="40" rx="6" fill="${m.color}" stroke="${m.accent}" stroke-width="2"/>
        <rect x="${-m.cutWidth*5-2}" y="14" width="${m.cutWidth*10+4}" height="6" rx="3" fill="${m.accent}"/>
        <circle cx="${-m.cutWidth*5}" cy="-20" r="6" fill="#222" stroke="#444"/>
        <circle cx="${m.cutWidth*5}" cy="-20" r="6" fill="#222" stroke="#444"/>
        <circle cx="${-m.cutWidth*5}" cy="20" r="7" fill="#222" stroke="#444"/>
        <circle cx="${m.cutWidth*5}" cy="20" r="7" fill="#222" stroke="#444"/>
        ${m.rider ? '<rect x="-7" y="-8" width="14" height="16" rx="3" fill="#333"/>' : ''}
        <circle cx="0" cy="-2" r="4" fill="${m.accent}"/>
      </g>
    </svg>`;
  }

  /* ============================================================
     GAMEPLAY
     ============================================================ */
  const canvas = $("#game-canvas");
  const ctx = canvas.getContext("2d");

  const G = {
    running: false,
    paused: false,
    levelIndex: 0,
    level: null,
    mower: null,
    grid: null,         // Uint8Array: 0 uncut, 1 cut, 2 blocked(obstacle/path)
    mowable: 0,
    cut: 0,
    energy: 100,
    energyMax: 100,
    money: 0,           // money earned this run (level reward)
    time: 0,
    bumpCooldown: 0,
    clean: true,        // tidiness bonus (no obstacle hits)
    player: { x: 0, y: 0, vx: 0, vy: 0, angle: 0 },
    input: { up: false, down: false, left: false, right: false },
    lastTs: 0,
    rafId: 0
  };

  function startLevel(index) {
    const level = LEVELS[index];
    if (!level) return;
    G.levelIndex = index;
    G.level = level;
    G.mower = MOWERS.byId(state.selected);

    // size canvas to grid
    canvas.width = level.cols * CELL;
    canvas.height = level.rows * CELL;

    // build grid
    G.grid = new Uint8Array(level.cols * level.rows); // 0 = grass
    const idx = (x, y) => y * level.cols + x;

    // mark obstacles as blocked (2)
    level.obstacles.forEach(o => {
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++)
          if (x >= 0 && y >= 0 && x < level.cols && y < level.rows) G.grid[idx(x, y)] = 2;
    });

    // count mowable cells
    G.mowable = 0;
    for (let i = 0; i < G.grid.length; i++) if (G.grid[i] === 0) G.mowable++;
    G.cut = 0;

    // mower spawn (centre of start cell)
    G.player.x = (level.start.x + 0.5) * CELL;
    G.player.y = (level.start.y + 0.5) * CELL;
    G.player.vx = G.player.vy = 0;
    G.player.angle = 0;

    // energy
    G.energyMax = G.mower.energy;
    G.energy = G.energyMax;
    G.time = 0;
    G.clean = true;
    G.bumpCooldown = 0;
    G.money = level.reward;

    G.paused = false;
    G.running = true;

    $("#hud-mower-name").textContent = G.mower.name;
    $("#hud-level").textContent = (index + 1);
    $("#hud-target").textContent = level.target + "%";
    updateHUD();

    show("game");
    hideOverlay();

    Sound.resume();
    Sound.startEngine(G.mower.electric);

    G.lastTs = performance.now();
    cancelAnimationFrame(G.rafId);
    G.rafId = requestAnimationFrame(loop);
  }

  function endRun(won) {
    G.running = false;
    cancelAnimationFrame(G.rafId);
    Sound.stopEngine();

    const pct = Math.round((G.cut / G.mowable) * 100);

    if (won) {
      Sound.win();
      // tidiness + time bonus
      let bonus = 0;
      if (G.clean) bonus += Math.round(G.money * 0.25);
      let payout = G.money + bonus;
      state.wallet += payout;
      if (G.levelIndex + 1 > state.levelReached) state.levelReached = G.levelIndex + 1;

      const best = state.bestTimes[G.levelIndex];
      if (best == null || G.time < best) state.bestTimes[G.levelIndex] = Math.floor(G.time);
      saveState();

      const hasNext = G.levelIndex + 1 < LEVELS.length;
      showOverlay({
        title: "Lawn Complete!",
        cls: "win",
        body: `${G.level.name} — tidied to ${pct}%.`,
        stats: [
          ["Job pay", fmtMoney(G.money)],
          ["Tidiness bonus", G.clean ? fmtMoney(bonus) + " ✨" : "—"],
          ["Time", fmtTime(G.time)],
          ["Total paid", fmtMoney(payout)],
          ["Wallet", fmtMoney(state.wallet)]
        ],
        buttons: hasNext
          ? [
              { label: "Next Lawn ▶", primary: true, action: () => startLevel(G.levelIndex + 1) },
              { label: "Garage", action: () => { openGarage(); } },
              { label: "Menu", action: () => goMenu() }
            ]
          : [
              { label: "🏆 You finished the Estate! Replay", primary: true, action: () => startLevel(0) },
              { label: "Garage", action: () => openGarage() },
              { label: "Menu", action: () => goMenu() }
            ]
      });
    } else {
      Sound.lose();
      const reason = G.energy <= 0 && !(G.mower.electric && G.mower.corded)
        ? (G.mower.electric ? "Battery flat" : "Out of fuel")
        : "Out of time";
      showOverlay({
        title: "Job Unfinished",
        cls: "lose",
        body: `${reason}. You only mowed ${pct}% (needed ${G.level.target}%).`,
        stats: [
          ["Mowed", pct + "%"],
          ["Target", G.level.target + "%"],
          ["Wallet", fmtMoney(state.wallet)]
        ],
        buttons: [
          { label: "Retry", primary: true, action: () => startLevel(G.levelIndex) },
          { label: "Garage", action: () => openGarage() },
          { label: "Menu", action: () => goMenu() }
        ]
      });
    }
  }

  /* ---------------- main loop ---------------- */
  function loop(ts) {
    if (!G.running) return;
    let dt = (ts - G.lastTs) / 1000;
    G.lastTs = ts;
    if (dt > 0.05) dt = 0.05; // clamp big frame gaps
    if (!G.paused) {
      update(dt);
      render();
    }
    G.rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    const m = G.mower, p = G.player, L = G.level;

    // desired direction from input
    let dx = (G.input.right ? 1 : 0) - (G.input.left ? 1 : 0);
    let dy = (G.input.down ? 1 : 0) - (G.input.up ? 1 : 0);
    const moving = dx !== 0 || dy !== 0;

    if (moving) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      // accelerate toward target velocity
      const target = m.speed;
      p.vx += (dx * target - p.vx) * Math.min(1, m.turn * 60 * dt);
      p.vy += (dy * target - p.vy) * Math.min(1, m.turn * 60 * dt);
      p.angle = Math.atan2(p.vy, p.vx);
    } else {
      // friction
      p.vx *= Math.max(0, 1 - 8 * dt);
      p.vy *= Math.max(0, 1 - 8 * dt);
    }

    const speedNow = Math.hypot(p.vx, p.vy);
    Sound.setThrottle(Math.min(1, speedNow / m.speed));

    // proposed move with obstacle collision (axis-separated)
    let nx = p.x + p.vx * dt;
    let ny = p.y + p.vy * dt;

    const halfW = (m.cutWidth * CELL) / 2 * 0.5 + 6; // body half-size
    const blockedAt = (px, py) => {
      const cx = Math.floor(px / CELL), cy = Math.floor(py / CELL);
      if (cx < 0 || cy < 0 || cx >= L.cols || cy >= L.rows) return true;
      return G.grid[cy * L.cols + cx] === 2;
    };

    let bumped = false;
    // X axis
    if (!blockedAt(nx + Math.sign(p.vx) * halfW, p.y)) {
      p.x = nx;
    } else { if (Math.abs(p.vx) > 40) bumped = true; p.vx = 0; }
    // Y axis
    if (!blockedAt(p.x, ny + Math.sign(p.vy) * halfW)) {
      p.y = ny;
    } else { if (Math.abs(p.vy) > 40) bumped = true; p.vy = 0; }

    // clamp to field
    p.x = Math.max(halfW, Math.min(L.cols * CELL - halfW, p.x));
    p.y = Math.max(halfW, Math.min(L.rows * CELL - halfW, p.y));

    // bump handling
    G.bumpCooldown = Math.max(0, G.bumpCooldown - dt);
    if (bumped && G.bumpCooldown <= 0) {
      Sound.bump();
      G.clean = false;
      G.bumpCooldown = 0.4;
    }

    // ---- mow the grass under the deck ----
    if (speedNow > 5) {
      const half = Math.floor(m.cutWidth / 2);
      const pcx = Math.floor(p.x / CELL);
      const pcy = Math.floor(p.y / CELL);
      let cutSomething = false;
      for (let oy = -half; oy <= half; oy++) {
        for (let ox = -half; ox <= half; ox++) {
          const gx = pcx + ox, gy = pcy + oy;
          if (gx < 0 || gy < 0 || gx >= L.cols || gy >= L.rows) continue;
          const i = gy * L.cols + gx;
          if (G.grid[i] === 0) {
            G.grid[i] = 1;
            G.cut++;
            cutSomething = true;
          }
        }
      }
      if (cutSomething && Math.random() < 0.3) Sound.cut();

      // burn energy while actually driving (petrol/battery)
      if (!(m.electric && m.corded)) {
        G.energy -= m.drain * dt * (0.6 + 0.4 * (speedNow / m.speed));
      }
    }

    // refuel pads
    if (!(m.electric && m.corded) && L.refuel) {
      const pcx = Math.floor(p.x / CELL), pcy = Math.floor(p.y / CELL);
      for (const r of L.refuel) {
        if (pcx === r.x && pcy === r.y) {
          if (G.energy < G.energyMax) {
            G.energy = Math.min(G.energyMax, G.energy + G.energyMax * 0.6 * dt);
            if (Math.random() < 0.04) Sound.refuel();
          }
        }
      }
    }

    // time & energy fail states
    G.time += dt;
    if (!(m.electric && m.corded) && G.energy <= 0) { G.energy = 0; endRun(false); return; }
    if (L.timeLimit > 0 && G.time >= L.timeLimit) { endRun(false); return; }

    // win check
    const pct = (G.cut / G.mowable) * 100;
    if (pct >= L.target) { endRun(true); return; }

    updateHUD();
  }

  function updateHUD() {
    const pct = Math.round((G.cut / G.mowable) * 100);
    $("#hud-progress").textContent = pct + "%";
    const ePct = (G.mower.electric && G.mower.corded)
      ? 100
      : Math.round((G.energy / G.energyMax) * 100);
    const bar = $("#hud-energy-bar");
    bar.style.width = ePct + "%";
    bar.style.background = ePct < 20
      ? "linear-gradient(90deg,#e44,#ff8a00)"
      : "linear-gradient(90deg,#4ad07a,#ffcf2b)";
    $("#hud-energy-text").textContent = (G.mower.electric && G.mower.corded) ? "MAINS" : ePct + "%";
    $("#hud-time").textContent = G.level.timeLimit > 0
      ? fmtTime(G.level.timeLimit - G.time)
      : fmtTime(G.time);
    $("#hud-money").textContent = state.wallet.toLocaleString("en-GB");
  }

  /* ---------------- rendering ---------------- */
  function render() {
    const L = G.level;
    // base (uncut) grass with mowing stripes
    for (let y = 0; y < L.rows; y++) {
      for (let x = 0; x < L.cols; x++) {
        const v = G.grid[y * L.cols + x];
        if (v === 2) continue; // obstacle drawn later
        const px = x * CELL, py = y * CELL;
        if (v === 1) {
          // cut: lighter, striped lawn look
          ctx.fillStyle = (x % 2 === 0) ? "#5fb968" : "#56ad5e";
        } else {
          // uncut: darker, slightly tufty
          ctx.fillStyle = (x % 2 === 0) ? "#2c8a3f" : "#288039";
        }
        ctx.fillRect(px, py, CELL, CELL);
        if (v === 0) {
          // tufts of uncut grass
          ctx.fillStyle = "rgba(20,80,30,0.5)";
          ctx.fillRect(px + 4, py + 6, 2, 8);
          ctx.fillRect(px + 12, py + 10, 2, 9);
          ctx.fillRect(px + 21, py + 5, 2, 8);
        }
      }
    }

    // refuel pads
    if (L.refuel) {
      L.refuel.forEach(r => drawRefuel(r.x * CELL, r.y * CELL));
    }

    // obstacles
    L.obstacles.forEach(o => drawObstacle(o));

    // mower
    drawMower();

    // low-energy vignette
    if (!(G.mower.electric && G.mower.corded) && G.energy / G.energyMax < 0.18) {
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(performance.now() / 120);
      ctx.fillStyle = "#e44";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  function drawRefuel(px, py) {
    ctx.save();
    ctx.fillStyle = "rgba(255,207,43,0.18)";
    ctx.fillRect(px, py, CELL, CELL);
    ctx.strokeStyle = "#ffcf2b";
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffcf2b";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(G.mower.electric ? "⚡" : "⛽", px + CELL / 2, py + CELL / 2 + 1);
    ctx.restore();
  }

  function drawObstacle(o) {
    const px = o.x * CELL, py = o.y * CELL, w = o.w * CELL, h = o.h * CELL;
    ctx.save();
    switch (o.type) {
      case "tree":
        ctx.fillStyle = "#3a2a1a";
        ctx.fillRect(px + w/2 - 5, py + h - 14, 10, 16);
        ctx.fillStyle = "#1f6b2a";
        ctx.beginPath(); ctx.arc(px + w/2, py + h/2, Math.min(w,h)/2 + 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#2a8038";
        ctx.beginPath(); ctx.arc(px + w/2 - 6, py + h/2 - 4, Math.min(w,h)/3, 0, Math.PI*2); ctx.fill();
        break;
      case "pond":
        ctx.fillStyle = "#2f6fae";
        roundRect(px+2, py+2, w-4, h-4, 14); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        roundRect(px+8, py+8, w*0.4, h*0.25, 8); ctx.fill();
        break;
      case "bed":
        ctx.fillStyle = "#5a3a22";
        roundRect(px+2, py+2, w-4, h-4, 8); ctx.fill();
        const cols = ["#e85d75","#ffd23f","#9b5de5","#f15bb5"];
        for (let i = 0; i < (o.w*o.h*1.4); i++) {
          ctx.fillStyle = cols[i % cols.length];
          const fx = px + 8 + Math.random()*(w-16);
          const fy = py + 8 + Math.random()*(h-16);
          ctx.beginPath(); ctx.arc(fx, fy, 3.4, 0, Math.PI*2); ctx.fill();
        }
        break;
      case "shed":
        ctx.fillStyle = "#6b4a2e";
        ctx.fillRect(px+2, py+h*0.35, w-4, h*0.65-2);
        ctx.fillStyle = "#8a3b2e";
        ctx.beginPath();
        ctx.moveTo(px, py+h*0.4); ctx.lineTo(px+w/2, py+2); ctx.lineTo(px+w, py+h*0.4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#3a2a1a";
        ctx.fillRect(px+w/2-7, py+h*0.6, 14, h*0.4-4);
        break;
      case "gnome":
        ctx.fillStyle = "#c0392b"; // hat
        ctx.beginPath();
        ctx.moveTo(px+w*0.5, py+2); ctx.lineTo(px+w*0.8, py+h*0.5); ctx.lineTo(px+w*0.2, py+h*0.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#f0c9a0"; // face
        ctx.beginPath(); ctx.arc(px+w*0.5, py+h*0.58, w*0.18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ddd"; // beard
        ctx.beginPath(); ctx.arc(px+w*0.5, py+h*0.72, w*0.16, 0, Math.PI); ctx.fill();
        ctx.fillStyle = "#2e7d32"; // body
        ctx.fillRect(px+w*0.35, py+h*0.72, w*0.3, h*0.25);
        break;
      default:
        ctx.fillStyle = "#444"; ctx.fillRect(px, py, w, h);
    }
    ctx.restore();
  }

  function drawMower() {
    const m = G.mower, p = G.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2); // sprite faces "up" by default

    const bw = m.cutWidth * CELL * 0.78;
    const bl = CELL * 1.4;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    roundRect(-bw/2 + 3, -bl/2 + 5, bw, bl, 7); ctx.fill();

    // cutting deck (wide front)
    ctx.fillStyle = m.accent;
    roundRect(-bw/2, -bl/2, bw, 8, 4); ctx.fill();

    // body
    ctx.fillStyle = m.color;
    roundRect(-bw/2 + 3, -bl/2 + 6, bw - 6, bl - 6, 6); ctx.fill();
    ctx.strokeStyle = m.accent; ctx.lineWidth = 2;
    roundRect(-bw/2 + 3, -bl/2 + 6, bw - 6, bl - 6, 6); ctx.stroke();

    // engine / battery block
    ctx.fillStyle = "#2a2a2a";
    roundRect(-bw*0.18, -bl*0.18, bw*0.36, bl*0.36, 4); ctx.fill();
    ctx.fillStyle = m.accent;
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI*2); ctx.fill();

    // handle (push mowers) or seat (rider)
    if (m.rider) {
      ctx.fillStyle = "#333";
      roundRect(-bw*0.16, bl*0.18, bw*0.32, bl*0.28, 4); ctx.fill();
    } else {
      ctx.strokeStyle = "#888"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-bw*0.28, bl*0.5);
      ctx.lineTo(-bw*0.18, bl*0.78);
      ctx.lineTo(bw*0.18, bl*0.78);
      ctx.lineTo(bw*0.28, bl*0.5);
      ctx.stroke();
    }

    // wheels
    ctx.fillStyle = "#111";
    [[-bw/2+5,-bl/2+8],[bw/2-5,-bl/2+8],[-bw/2+6,bl/2-8],[bw/2-6,bl/2-8]].forEach(([wx,wy])=>{
      roundRect(wx-4, wy-6, 8, 12, 3); ctx.fill();
    });

    ctx.restore();

    // grass-clipping particles when moving fast
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 40 && Math.random() < 0.6) spawnClip(p.x, p.y, p.angle);
    drawClips();
  }

  // simple particle pool for clippings
  const clips = [];
  function spawnClip(x, y, ang) {
    const back = ang + Math.PI;
    clips.push({
      x: x + Math.cos(back)*14, y: y + Math.sin(back)*14,
      vx: Math.cos(back + (Math.random()-0.5)) * (30+Math.random()*40),
      vy: Math.sin(back + (Math.random()-0.5)) * (30+Math.random()*40),
      life: 0.5 + Math.random()*0.3
    });
    if (clips.length > 80) clips.shift();
  }
  function drawClips() {
    ctx.save();
    ctx.fillStyle = "#9be29b";
    for (let i = clips.length - 1; i >= 0; i--) {
      const c = clips[i];
      c.life -= 0.016;
      if (c.life <= 0) { clips.splice(i, 1); continue; }
      c.x += c.vx * 0.016; c.y += c.vy * 0.016;
      ctx.globalAlpha = Math.max(0, c.life);
      ctx.fillRect(c.x, c.y, 3, 3);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }

  /* ---------------- overlay ---------------- */
  function showOverlay({ title, body, cls, stats, buttons }) {
    const ov = $("#overlay");
    $("#overlay-title").textContent = title;
    $("#overlay-title").className = cls || "";
    $("#overlay-body").textContent = body || "";
    const statsEl = $("#overlay-stats");
    statsEl.innerHTML = (stats || []).map(([k, v]) =>
      `<div class="row"><span>${k}</span><b>${v}</b></div>`).join("");
    const btnEl = $("#overlay-buttons");
    btnEl.innerHTML = "";
    (buttons || []).forEach(b => {
      const el = document.createElement("button");
      el.className = "btn " + (b.primary ? "btn-primary" : "");
      el.textContent = b.label;
      el.onclick = () => { Sound.ui(); b.action(); };
      btnEl.appendChild(el);
    });
    ov.classList.add("active");
  }
  function hideOverlay() { $("#overlay").classList.remove("active"); }

  function togglePause() {
    if (!G.running) return;
    G.paused = !G.paused;
    if (G.paused) {
      Sound.setThrottle(0);
      showOverlay({
        title: "Paused",
        body: "Take a breather.",
        stats: [["Lawn", G.level.name], ["Mower", G.mower.name]],
        buttons: [
          { label: "Resume", primary: true, action: () => { G.paused = false; hideOverlay(); G.lastTs = performance.now(); } },
          { label: "Restart Lawn", action: () => startLevel(G.levelIndex) },
          { label: "Quit to Menu", action: () => goMenu() }
        ]
      });
    } else { hideOverlay(); G.lastTs = performance.now(); }
  }

  /* ============================================================
     NAVIGATION + INPUT
     ============================================================ */
  function goMenu() {
    G.running = false;
    cancelAnimationFrame(G.rafId);
    Sound.stopEngine();
    hideOverlay();
    refreshWallets();
    show("menu");
  }
  function openGarage() { Sound.ui(); renderGarage(); hideOverlay(); show("garage"); }

  function startCareer() {
    Sound.resume();
    // resume at the next unbeaten level, capped to available
    const idx = Math.min(state.levelReached, LEVELS.length - 1);
    startLevel(idx);
  }

  // top-level click routing via data-action
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    Sound.resume();
    switch (a) {
      case "play":      Sound.ui(); startCareer(); break;
      case "garage":    openGarage(); break;
      case "howto":     Sound.ui(); show("howto"); break;
      case "back-menu": Sound.ui(); goMenu(); break;
      case "pause":     togglePause(); break;
      case "reset":
        if (confirm("Reset all progress, money and unlocked mowers?")) {
          state = defaultState(); saveState(); refreshWallets(); renderGarage();
          Sound.deny();
        }
        break;
    }
  });

  // keyboard
  const keyMap = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
    W: "up", S: "down", A: "left", D: "right"
  };
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "p" || e.key === "P") { togglePause(); return; }
    const dir = keyMap[e.key];
    if (dir) { G.input[dir] = true; e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => {
    const dir = keyMap[e.key];
    if (dir) { G.input[dir] = false; e.preventDefault(); }
  });

  // touch controls
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add("touch");
  }
  document.querySelectorAll(".tbtn").forEach(b => {
    const dir = b.getAttribute("data-dir");
    const on  = (e) => { e.preventDefault(); G.input[dir] = true; Sound.resume(); };
    const off = (e) => { e.preventDefault(); G.input[dir] = false; };
    b.addEventListener("touchstart", on, { passive: false });
    b.addEventListener("touchend", off,  { passive: false });
    b.addEventListener("mousedown", on);
    b.addEventListener("mouseup", off);
    b.addEventListener("mouseleave", off);
  });

  // pause if the tab loses focus mid-game
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && G.running && !G.paused) togglePause();
  });

  /* ---------------- boot ---------------- */
  refreshWallets();
  show("menu");
})();
