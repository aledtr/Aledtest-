/* ============================================================
   game.js — Hyundai Mow Master main controller
   Handles: screen routing, save state, garage/shop, records,
   and the canvas gameplay loop (movement, mowing, coins,
   power-ups, hazards, combos, scoring, collisions, energy).
   ============================================================ */
(function () {
  "use strict";

  const CELL = 30;            // px per grass cell
  const SAVE_KEY = "hyundai_mow_master_save_v2";
  const COIN_VALUE = 5;       // £ per coin
  const MAX_COMBO = 5;        // multiplier cap
  const LB_SIZE = 10;         // leaderboard length

  /* ---------------- Persistent state ---------------- */
  const defaultState = () => ({
    wallet: 0,
    owned: ["hym3200e"],
    selected: "hym3200e",
    levelReached: 0,
    bestTimes: {},
    levelStars: {},
    levelScores: {},
    leaderboard: [],
    muted: false
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
    menu:    $("#screen-menu"),
    howto:   $("#screen-howto"),
    garage:  $("#screen-garage"),
    records: $("#screen-records"),
    game:    $("#screen-game")
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
  function starStr(n) {
    let out = "";
    for (let i = 0; i < 3; i++) out += i < n ? "★" : "☆";
    return out;
  }

  function refreshWallets() {
    $("#menu-wallet").textContent = fmtMoney(state.wallet);
    $("#garage-wallet").textContent = fmtMoney(state.wallet);
  }

  /* ---------------- sound toggle ---------------- */
  const soundBtn = $("#sound-toggle");
  function applyMute() {
    Sound.setEnabled(!state.muted);
    soundBtn.textContent = state.muted ? "🔇" : "🔊";
    soundBtn.classList.toggle("muted", state.muted);
  }
  soundBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    Sound.resume();
    applyMute();
    saveState();
    if (!state.muted) Sound.ui();
  });

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
        <div class="mower-foot"></div>`;
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
     RECORDS / LEADERBOARD
     ============================================================ */
  function renderRecords() {
    const lb = $("#leaderboard");
    lb.innerHTML = "";
    if (!state.leaderboard.length) {
      lb.innerHTML = `<li class="empty">No scores yet — go mow!</li>`;
    } else {
      state.leaderboard.slice(0, LB_SIZE).forEach(e => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="lb-name">${e.name}</span>
          <span class="lb-lvl">${LEVELS[e.level] ? LEVELS[e.level].name : "Lvl " + (e.level+1)}</span>
          <span class="lb-score">${e.score.toLocaleString("en-GB")}</span>`;
        lb.appendChild(li);
      });
    }

    const lr = $("#level-records");
    lr.innerHTML = "";
    LEVELS.forEach((L, i) => {
      const unlocked = i <= state.levelReached;
      const stars = state.levelStars[i] || 0;
      const best = state.levelScores[i];
      const time = state.bestTimes[i];
      const row = document.createElement("div");
      row.className = "lr-row" + (unlocked ? "" : " lr-locked");
      row.innerHTML = `
        <span class="stars">${[0,1,2].map(s => `<span class="${s<stars?'on':''}">${s<stars?'★':'☆'}</span>`).join("")}</span>
        <span class="lr-name">${unlocked ? L.name : "🔒 Locked"}</span>
        <span class="lr-time">${best != null ? best.toLocaleString("en-GB") + " pts" : "—"}</span>
        <span class="lr-time">${time != null ? fmtTime(time) : "—"}</span>`;
      lr.appendChild(row);
    });
  }

  function qualifiesForLeaderboard(score) {
    if (score <= 0) return false;
    if (state.leaderboard.length < LB_SIZE) return true;
    return score > state.leaderboard[state.leaderboard.length - 1].score;
  }
  function insertLeaderboard(name, score, level) {
    state.leaderboard.push({ name, score, level });
    state.leaderboard.sort((a, b) => b.score - a.score);
    state.leaderboard = state.leaderboard.slice(0, LB_SIZE);
    saveState();
  }

  /* ============================================================
     GAMEPLAY
     ============================================================ */
  const canvas = $("#game-canvas");
  const ctx = canvas.getContext("2d");

  const G = {
    running: false, paused: false,
    levelIndex: 0, level: null, mower: null,
    grid: null, mowable: 0, cut: 0,
    energy: 100, energyMax: 100,
    reward: 0, runCash: 0,
    time: 0, bumpCooldown: 0, bumps: 0,
    score: 0, combo: 1, comboTimer: 0,
    coins: [], coinsCollected: 0,
    powerups: [], powerupTimer: 0,
    turboTimer: 0, wideTimer: 0,
    hazards: [], hazardCooldown: 0,
    popups: [], shake: 0,
    player: { x: 0, y: 0, vx: 0, vy: 0, angle: 0 },
    input: { up: false, down: false, left: false, right: false },
    lastTs: 0, rafId: 0
  };

  function cellBlocked(x, y) {
    const L = G.level;
    if (x < 0 || y < 0 || x >= L.cols || y >= L.rows) return true;
    return G.grid[y * L.cols + x] === 2;
  }

  function startLevel(index) {
    const level = LEVELS[index];
    if (!level) return;
    G.levelIndex = index;
    G.level = level;
    G.mower = MOWERS.byId(state.selected);

    canvas.width = level.cols * CELL;
    canvas.height = level.rows * CELL;

    G.grid = new Uint8Array(level.cols * level.rows);
    const idx = (x, y) => y * level.cols + x;
    level.obstacles.forEach(o => {
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++)
          if (x >= 0 && y >= 0 && x < level.cols && y < level.rows) G.grid[idx(x, y)] = 2;
    });

    G.mowable = 0;
    for (let i = 0; i < G.grid.length; i++) if (G.grid[i] === 0) G.mowable++;
    G.cut = 0;

    G.player.x = (level.start.x + 0.5) * CELL;
    G.player.y = (level.start.y + 0.5) * CELL;
    G.player.vx = G.player.vy = 0;
    G.player.angle = 0;

    G.energyMax = G.mower.energy;
    G.energy = G.energyMax;
    G.time = 0;
    G.bumps = 0;
    G.bumpCooldown = 0;
    G.reward = level.reward;
    G.runCash = 0;
    G.score = 0;
    G.combo = 1; G.comboTimer = 0;
    G.coinsCollected = 0;
    G.turboTimer = 0; G.wideTimer = 0;
    G.powerups = []; G.powerupTimer = 8;
    G.popups = []; G.shake = 0;

    // scatter coins on free grass away from the spawn
    G.coins = [];
    const want = level.coins || 0;
    let guard = 0;
    while (G.coins.length < want && guard++ < 2000) {
      const cx = 1 + Math.floor(Math.random() * (level.cols - 2));
      const cy = 1 + Math.floor(Math.random() * (level.rows - 2));
      if (G.grid[idx(cx, cy)] !== 0) continue;
      if (Math.abs(cx - level.start.x) + Math.abs(cy - level.start.y) < 3) continue;
      if (G.coins.some(c => c.cx === cx && c.cy === cy)) continue;
      G.coins.push({ cx, cy, x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL, t: Math.random() * 6 });
    }

    // hazards
    G.hazards = (level.hazards || []).map(h => ({
      type: h.type,
      x: (h.x + 0.5) * CELL, y: (h.y + 0.5) * CELL,
      vx: (Math.random() < 0.5 ? -1 : 1) * (h.type === "dog" ? 70 : 50),
      vy: (Math.random() < 0.5 ? -1 : 1) * (h.type === "dog" ? 70 : 50),
      wob: Math.random() * 6
    }));
    G.hazardCooldown = 0;

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

  function computeStars(coinRatio, energyLeft) {
    let stars = 1;
    if (G.bumps === 0) stars++;
    if (coinRatio >= 0.7) stars++;
    return Math.min(3, stars);
  }

  function endRun(won) {
    G.running = false;
    cancelAnimationFrame(G.rafId);
    Sound.stopEngine();

    const pct = Math.round((G.cut / G.mowable) * 100);
    const L = G.level;

    if (won) {
      const corded = G.mower.electric && G.mower.corded;
      const coinRatio = L.coins ? G.coinsCollected / L.coins : 1;
      const energyLeft = corded ? 1 : G.energy / G.energyMax;
      const stars = computeStars(coinRatio, energyLeft);

      // bonuses
      const cleanBonus = G.bumps === 0 ? 1000 : 0;
      const starBonus = stars * 500;
      const timeBonus = L.timeLimit ? Math.round(Math.max(0, L.timeLimit - G.time) * 5) : Math.round(Math.max(0, 200 - G.time) * 3);
      const finalScore = Math.round(G.score + cleanBonus + starBonus + timeBonus);

      // payout
      const tidyCash = G.bumps === 0 ? Math.round(G.reward * 0.25) : 0;
      const payout = G.reward + tidyCash + G.runCash;
      state.wallet += payout;

      if (G.levelIndex + 1 > state.levelReached) state.levelReached = G.levelIndex + 1;
      state.levelStars[G.levelIndex] = Math.max(state.levelStars[G.levelIndex] || 0, stars);
      state.levelScores[G.levelIndex] = Math.max(state.levelScores[G.levelIndex] || 0, finalScore);
      const bt = state.bestTimes[G.levelIndex];
      if (bt == null || G.time < bt) state.bestTimes[G.levelIndex] = Math.floor(G.time);
      saveState();

      Sound.win();
      [0,1,2].forEach(i => { if (i < stars) setTimeout(() => Sound.star(), 500 + i * 220); });

      const hasNext = G.levelIndex + 1 < LEVELS.length;
      const nextButtons = hasNext
        ? [
            { label: "Next Lawn ▶", primary: true, action: () => startLevel(G.levelIndex + 1) },
            { label: "Replay", action: () => startLevel(G.levelIndex) },
            { label: "Garage", action: () => openGarage() },
            { label: "Menu", action: () => goMenu() }
          ]
        : [
            { label: "🏆 Career Complete! Replay", primary: true, action: () => startLevel(0) },
            { label: "Records", action: () => openRecords() },
            { label: "Menu", action: () => goMenu() }
          ];

      const stats = [
        ["Coins", `${G.coinsCollected}/${L.coins || 0}`],
        ["Tidy bonus", G.bumps === 0 ? fmtMoney(tidyCash) + " ✨" : "—"],
        ["Time", fmtTime(G.time)],
        ["Total paid", fmtMoney(payout)],
        ["Score", finalScore.toLocaleString("en-GB")]
      ];

      if (qualifiesForLeaderboard(finalScore)) {
        showOverlay({
          title: "Lawn Complete!", cls: "win", stars,
          body: `${L.name} — tidied to ${pct}%. New high score!`,
          stats,
          hsEntry: { score: finalScore, level: G.levelIndex, onSubmit: () => { renderRecords(); }, buttons: nextButtons }
        });
      } else {
        showOverlay({ title: "Lawn Complete!", cls: "win", stars, body: `${L.name} — tidied to ${pct}%.`, stats, buttons: nextButtons });
      }
    } else {
      Sound.lose();
      const corded = G.mower.electric && G.mower.corded;
      const reason = (G.energy <= 0 && !corded)
        ? (G.mower.electric ? "Battery flat" : "Out of fuel")
        : "Out of time";
      showOverlay({
        title: "Job Unfinished", cls: "lose",
        body: `${reason}. You mowed ${pct}% (needed ${L.target}%).`,
        stats: [["Mowed", pct + "%"], ["Target", L.target + "%"], ["Score so far", Math.round(G.score).toLocaleString("en-GB")], ["Wallet", fmtMoney(state.wallet)]],
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
    if (dt > 0.05) dt = 0.05;
    if (!G.paused) { update(dt); render(); }
    G.rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    const m = G.mower, p = G.player, L = G.level;

    let dx = (G.input.right ? 1 : 0) - (G.input.left ? 1 : 0);
    let dy = (G.input.down ? 1 : 0) - (G.input.up ? 1 : 0);
    const moving = dx !== 0 || dy !== 0;

    const speedMul = G.turboTimer > 0 ? 1.4 : 1;
    if (moving) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const target = m.speed * speedMul;
      p.vx += (dx * target - p.vx) * Math.min(1, m.turn * 60 * dt);
      p.vy += (dy * target - p.vy) * Math.min(1, m.turn * 60 * dt);
      p.angle = Math.atan2(p.vy, p.vx);
    } else {
      p.vx *= Math.max(0, 1 - 8 * dt);
      p.vy *= Math.max(0, 1 - 8 * dt);
    }

    const speedNow = Math.hypot(p.vx, p.vy);
    Sound.setThrottle(Math.min(1, speedNow / (m.speed * speedMul)));

    let nx = p.x + p.vx * dt;
    let ny = p.y + p.vy * dt;
    const halfW = (m.cutWidth * CELL) / 2 * 0.5 + 6;
    const blockedAt = (px, py) => cellBlocked(Math.floor(px / CELL), Math.floor(py / CELL));

    let bumped = false;
    if (!blockedAt(nx + Math.sign(p.vx) * halfW, p.y)) p.x = nx;
    else { if (Math.abs(p.vx) > 40) bumped = true; p.vx = 0; }
    if (!blockedAt(p.x, ny + Math.sign(p.vy) * halfW)) p.y = ny;
    else { if (Math.abs(p.vy) > 40) bumped = true; p.vy = 0; }

    p.x = Math.max(halfW, Math.min(L.cols * CELL - halfW, p.x));
    p.y = Math.max(halfW, Math.min(L.rows * CELL - halfW, p.y));

    G.bumpCooldown = Math.max(0, G.bumpCooldown - dt);
    if (bumped && G.bumpCooldown <= 0) {
      Sound.bump();
      G.bumps++;
      G.combo = 1; G.comboTimer = 0;
      G.shake = 8;
      G.bumpCooldown = 0.4;
    }

    // timers
    if (G.turboTimer > 0) G.turboTimer -= dt;
    if (G.wideTimer > 0) G.wideTimer -= dt;
    G.shake = Math.max(0, G.shake - 22 * dt);

    // ---- mow ----
    const cutW = m.cutWidth + (G.wideTimer > 0 ? 2 : 0);
    if (speedNow > 5) {
      const half = Math.floor(cutW / 2);
      const pcx = Math.floor(p.x / CELL), pcy = Math.floor(p.y / CELL);
      let cutCount = 0;
      for (let oy = -half; oy <= half; oy++) {
        for (let ox = -half; ox <= half; ox++) {
          const gx = pcx + ox, gy = pcy + oy;
          if (gx < 0 || gy < 0 || gx >= L.cols || gy >= L.rows) continue;
          const i = gy * L.cols + gx;
          if (G.grid[i] === 0) { G.grid[i] = 1; G.cut++; cutCount++; }
        }
      }
      if (cutCount) {
        // build combo & score
        G.comboTimer = 0.7;
        G.combo = Math.min(MAX_COMBO, G.combo + cutCount * 0.06);
        G.score += cutCount * 10 * G.combo;
        if (Math.random() < 0.25) Sound.cut();
      }
      if (!(m.electric && m.corded)) {
        G.energy -= m.drain * dt * (0.6 + 0.4 * (speedNow / m.speed));
      }
    }

    // combo decay
    if (G.comboTimer > 0) G.comboTimer -= dt;
    else if (G.combo > 1) G.combo = Math.max(1, G.combo - dt * 1.5);

    // ---- coins ----
    for (const c of G.coins) {
      if (c.collected) continue;
      c.t += dt;
      if (Math.hypot(p.x - c.x, p.y - c.y) < CELL * 0.7) {
        c.collected = true;
        G.coinsCollected++;
        G.runCash += COIN_VALUE;
        G.score += Math.round(80 * G.combo);
        addPopup(c.x, c.y, "+" + fmtMoney(COIN_VALUE), "#ffcf2b");
        Sound.coin();
      }
    }

    // ---- power-ups ----
    G.powerupTimer -= dt;
    if (G.powerupTimer <= 0 && G.powerups.length < 2) {
      spawnPowerup();
      G.powerupTimer = 12 + Math.random() * 8;
    }
    for (let i = G.powerups.length - 1; i >= 0; i--) {
      const pu = G.powerups[i];
      pu.life -= dt; pu.t += dt;
      if (pu.life <= 0) { G.powerups.splice(i, 1); continue; }
      if (Math.hypot(p.x - pu.x, p.y - pu.y) < CELL * 0.8) {
        applyPowerup(pu);
        G.powerups.splice(i, 1);
      }
    }

    // ---- hazards ----
    G.hazardCooldown = Math.max(0, G.hazardCooldown - dt);
    for (const h of G.hazards) {
      h.wob += dt * 4;
      let hx = h.x + h.vx * dt;
      let hy = h.y + h.vy * dt;
      if (cellBlocked(Math.floor(hx / CELL), Math.floor(h.y / CELL)) || hx < CELL*0.6 || hx > L.cols*CELL - CELL*0.6) h.vx *= -1;
      else h.x = hx;
      if (cellBlocked(Math.floor(h.x / CELL), Math.floor(hy / CELL)) || hy < CELL*0.6 || hy > L.rows*CELL - CELL*0.6) h.vy *= -1;
      else h.y = hy;
      // occasional direction jitter
      if (Math.random() < 0.01) { h.vx += (Math.random()-0.5)*30; h.vy += (Math.random()-0.5)*30; }
      if (G.hazardCooldown <= 0 && Math.hypot(p.x - h.x, p.y - h.y) < CELL * 0.85) {
        // collision: stall + break combo
        p.vx = -p.vx * 0.4; p.vy = -p.vy * 0.4;
        G.combo = 1; G.comboTimer = 0;
        G.bumps++; G.shake = 10;
        G.hazardCooldown = 0.8;
        addPopup(p.x, p.y - 10, h.type === "dog" ? "Woof!" : "Honk!", "#ff6b6b");
        Sound.bark();
      }
    }

    // refuel pads
    if (!(m.electric && m.corded) && L.refuel) {
      const pcx = Math.floor(p.x / CELL), pcy = Math.floor(p.y / CELL);
      for (const r of L.refuel) {
        if (pcx === r.x && pcy === r.y && G.energy < G.energyMax) {
          G.energy = Math.min(G.energyMax, G.energy + G.energyMax * 0.6 * dt);
          if (Math.random() < 0.04) Sound.refuel();
        }
      }
    }

    // popups
    for (let i = G.popups.length - 1; i >= 0; i--) {
      const pp = G.popups[i];
      pp.life -= dt; pp.y -= 24 * dt;
      if (pp.life <= 0) G.popups.splice(i, 1);
    }

    // time & fail states
    G.time += dt;
    if (!(m.electric && m.corded) && G.energy <= 0) { G.energy = 0; endRun(false); return; }
    if (L.timeLimit > 0 && G.time >= L.timeLimit) { endRun(false); return; }

    const pct = (G.cut / G.mowable) * 100;
    if (pct >= L.target) { endRun(true); return; }

    updateHUD();
  }

  function spawnPowerup() {
    const L = G.level;
    const types = ["turbo", "widecut", "cash", (G.mower.electric && G.mower.corded) ? "cash" : "jerry"];
    const type = types[Math.floor(Math.random() * types.length)];
    let guard = 0;
    while (guard++ < 200) {
      const cx = 1 + Math.floor(Math.random() * (L.cols - 2));
      const cy = 1 + Math.floor(Math.random() * (L.rows - 2));
      if (G.grid[cy * L.cols + cx] === 2) continue;
      G.powerups.push({ type, x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL, life: 11, t: 0 });
      return;
    }
  }

  function applyPowerup(pu) {
    Sound.power();
    switch (pu.type) {
      case "turbo":   G.turboTimer = 6; addPopup(pu.x, pu.y, "TURBO!", "#ff8a00"); break;
      case "widecut": G.wideTimer = 6;  addPopup(pu.x, pu.y, "WIDE CUT!", "#8fd14f"); break;
      case "jerry":
        G.energy = Math.min(G.energyMax, G.energy + G.energyMax * 0.35);
        addPopup(pu.x, pu.y, "+FUEL", "#4ad07a"); break;
      case "cash":
        G.runCash += 20; G.score += 200;
        addPopup(pu.x, pu.y, "+£20", "#ffcf2b"); break;
    }
  }

  function addPopup(x, y, text, color) {
    G.popups.push({ x, y, text, color, life: 0.9 });
    if (G.popups.length > 30) G.popups.shift();
  }

  function updateHUD() {
    const pct = Math.round((G.cut / G.mowable) * 100);
    $("#hud-progress").textContent = pct + "%";
    $("#hud-score").textContent = Math.round(G.score).toLocaleString("en-GB");

    const corded = G.mower.electric && G.mower.corded;
    const ePct = corded ? 100 : Math.round((G.energy / G.energyMax) * 100);
    const bar = $("#hud-energy-bar");
    bar.style.width = ePct + "%";
    bar.style.background = ePct < 20 ? "linear-gradient(90deg,#e44,#ff8a00)" : "linear-gradient(90deg,#4ad07a,#ffcf2b)";
    $("#hud-energy-text").textContent = corded ? "MAINS" : ePct + "%";

    $("#hud-time").textContent = G.level.timeLimit > 0 ? fmtTime(G.level.timeLimit - G.time) : fmtTime(G.time);
    $("#hud-money").textContent = (state.wallet + G.runCash).toLocaleString("en-GB");

    // combo
    const comboEl = $("#hud-combo");
    const cx = G.combo;
    comboEl.classList.toggle("active", cx > 1.05);
    comboEl.querySelector(".combo-x").textContent = "x" + cx.toFixed(1);
    $("#combo-fill").style.width = Math.round(((cx - 1) / (MAX_COMBO - 1)) * 100) + "%";
  }

  /* ---------------- rendering ---------------- */
  function render() {
    const L = G.level;
    ctx.save();
    if (G.shake > 0.2) ctx.translate((Math.random()-0.5)*G.shake, (Math.random()-0.5)*G.shake);

    for (let y = 0; y < L.rows; y++) {
      for (let x = 0; x < L.cols; x++) {
        const v = G.grid[y * L.cols + x];
        if (v === 2) continue;
        const px = x * CELL, py = y * CELL;
        if (v === 1) ctx.fillStyle = (x % 2 === 0) ? "#5fb968" : "#56ad5e";
        else ctx.fillStyle = (x % 2 === 0) ? "#2c8a3f" : "#288039";
        ctx.fillRect(px, py, CELL, CELL);
        if (v === 0) {
          ctx.fillStyle = "rgba(20,80,30,0.5)";
          ctx.fillRect(px + 4, py + 6, 2, 8);
          ctx.fillRect(px + 12, py + 10, 2, 9);
          ctx.fillRect(px + 21, py + 5, 2, 8);
        }
      }
    }

    if (L.refuel) L.refuel.forEach(r => drawRefuel(r.x * CELL, r.y * CELL));
    G.coins.forEach(drawCoin);
    G.powerups.forEach(drawPowerup);
    L.obstacles.forEach(drawObstacle);
    G.hazards.forEach(drawHazard);
    drawMower();
    drawClips();
    drawPopups();

    if (!(G.mower.electric && G.mower.corded) && G.energy / G.energyMax < 0.18) {
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(performance.now() / 120);
      ctx.fillStyle = "#e44";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawCoin(c) {
    if (c.collected) return;
    const bob = Math.sin(c.t * 3) * 2;
    const sx = Math.abs(Math.cos(c.t * 2)); // spin
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.fillStyle = "#caa400";
    ctx.beginPath(); ctx.ellipse(0, 0, 7 * (0.4 + 0.6*sx), 7, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath(); ctx.ellipse(0, 0, 5 * (0.4 + 0.6*sx), 5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#caa400"; ctx.font = "bold 8px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    if (sx > 0.5) ctx.fillText("£", 0, 1);
    ctx.restore();
  }

  function drawPowerup(pu) {
    const bob = Math.sin(pu.t * 4) * 3;
    const fade = pu.life < 3 ? (0.4 + 0.6 * Math.abs(Math.sin(pu.t * 8))) : 1;
    const icon = { turbo: "⚡", widecut: "↔", jerry: "⛽", cash: "£" }[pu.type];
    const col = { turbo: "#ff8a00", widecut: "#8fd14f", jerry: "#4ad07a", cash: "#ffcf2b" }[pu.type];
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(pu.x, pu.y + bob);
    ctx.fillStyle = "rgba(0,0,0,.55)";
    roundRect(-13, -13, 26, 26, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    roundRect(-13, -13, 26, 26, 7); ctx.stroke();
    ctx.fillStyle = col; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(icon, 0, 1);
    ctx.restore();
  }

  function drawHazard(h) {
    ctx.save();
    ctx.translate(h.x, h.y);
    const facing = h.vx < 0 ? -1 : 1;
    ctx.scale(facing, 1);
    const step = Math.sin(h.wob) * 2;
    if (h.type === "dog") {
      ctx.fillStyle = "#8a5a2b";
      roundRect(-11, -6 + step*0.2, 22, 12, 5); ctx.fill();      // body
      ctx.fillStyle = "#724a22";
      roundRect(7, -10, 11, 10, 4); ctx.fill();                  // head
      ctx.fillStyle = "#4a2f15";
      ctx.fillRect(16, -10, 3, 5);                               // ear
      ctx.fillStyle = "#222";
      ctx.fillRect(-12, -14, 3, 8);                              // tail
      ctx.fillStyle = "#3a2410";
      ctx.fillRect(-8, 5 + step, 3, 5); ctx.fillRect(5, 5 - step, 3, 5);
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(15, -6, 1.4, 0, 7); ctx.fill();
    } else { // goose
      ctx.fillStyle = "#f4f4f4";
      roundRect(-10, -5 + step*0.2, 18, 11, 5); ctx.fill();      // body
      ctx.fillStyle = "#fff";
      roundRect(6, -14, 6, 12, 3); ctx.fill();                  // neck
      ctx.beginPath(); ctx.arc(9, -14, 5, 0, 7); ctx.fill();    // head
      ctx.fillStyle = "#ff9f1c"; ctx.beginPath(); ctx.moveTo(13,-15); ctx.lineTo(19,-13); ctx.lineTo(13,-11); ctx.fill(); // beak
      ctx.fillStyle = "#ff9f1c"; ctx.fillRect(-6, 5+step, 2, 5); ctx.fillRect(2, 5-step, 2, 5);
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(10, -15, 1.2, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawPopups() {
    ctx.save();
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    for (const pp of G.popups) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pp.life * 1.4));
      ctx.fillStyle = "#000"; ctx.fillText(pp.text, pp.x + 1, pp.y + 1);
      ctx.fillStyle = pp.color; ctx.fillText(pp.text, pp.x, pp.y);
    }
    ctx.restore();
  }

  function drawRefuel(px, py) {
    ctx.save();
    ctx.fillStyle = "rgba(255,207,43,0.18)";
    ctx.fillRect(px, py, CELL, CELL);
    ctx.strokeStyle = "#ffcf2b"; ctx.setLineDash([4, 3]);
    ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4); ctx.setLineDash([]);
    ctx.fillStyle = "#ffcf2b"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(G.mower.electric ? "⚡" : "⛽", px + CELL / 2, py + CELL / 2 + 1);
    ctx.restore();
  }

  function drawObstacle(o) {
    const px = o.x * CELL, py = o.y * CELL, w = o.w * CELL, h = o.h * CELL;
    ctx.save();
    switch (o.type) {
      case "tree":
        ctx.fillStyle = "#3a2a1a"; ctx.fillRect(px + w/2 - 5, py + h - 14, 10, 16);
        ctx.fillStyle = "#1f6b2a"; ctx.beginPath(); ctx.arc(px + w/2, py + h/2, Math.min(w,h)/2 + 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#2a8038"; ctx.beginPath(); ctx.arc(px + w/2 - 6, py + h/2 - 4, Math.min(w,h)/3, 0, Math.PI*2); ctx.fill();
        break;
      case "pond":
        ctx.fillStyle = "#2f6fae"; roundRect(px+2, py+2, w-4, h-4, 14); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(px+8, py+8, w*0.4, h*0.25, 8); ctx.fill();
        break;
      case "bed":
        ctx.fillStyle = "#1f6b2a"; roundRect(px+1, py+1, w-2, h-2, 8); ctx.fill(); // hedge green
        ctx.fillStyle = "#2a8038";
        for (let yy = py+4; yy < py+h-4; yy += 7)
          for (let xx = px+4; xx < px+w-4; xx += 7) { ctx.beginPath(); ctx.arc(xx, yy, 3, 0, 7); ctx.fill(); }
        // a few flowers on top
        const cols = ["#e85d75","#ffd23f","#9b5de5","#f15bb5"];
        for (let i = 0; i < (o.w*o.h*0.5); i++) {
          ctx.fillStyle = cols[i % cols.length];
          ctx.beginPath(); ctx.arc(px + 6 + Math.random()*(w-12), py + 6 + Math.random()*(h-12), 2.6, 0, Math.PI*2); ctx.fill();
        }
        break;
      case "rock":
        ctx.fillStyle = "#7a7a7e"; ctx.beginPath();
        ctx.moveTo(px+3, py+h-3); ctx.lineTo(px+w*0.2, py+4); ctx.lineTo(px+w*0.7, py+2); ctx.lineTo(px+w-3, py+h-4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#9a9a9e"; ctx.beginPath();
        ctx.moveTo(px+w*0.2, py+4); ctx.lineTo(px+w*0.55, py+6); ctx.lineTo(px+w*0.35, py+h*0.5); ctx.closePath(); ctx.fill();
        break;
      case "shed":
        ctx.fillStyle = "#6b4a2e"; ctx.fillRect(px+2, py+h*0.35, w-4, h*0.65-2);
        ctx.fillStyle = "#8a3b2e"; ctx.beginPath();
        ctx.moveTo(px, py+h*0.4); ctx.lineTo(px+w/2, py+2); ctx.lineTo(px+w, py+h*0.4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#3a2a1a"; ctx.fillRect(px+w/2-7, py+h*0.6, 14, h*0.4-4);
        break;
      case "gnome":
        ctx.fillStyle = "#c0392b"; ctx.beginPath();
        ctx.moveTo(px+w*0.5, py+2); ctx.lineTo(px+w*0.8, py+h*0.5); ctx.lineTo(px+w*0.2, py+h*0.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#f0c9a0"; ctx.beginPath(); ctx.arc(px+w*0.5, py+h*0.58, w*0.18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ddd"; ctx.beginPath(); ctx.arc(px+w*0.5, py+h*0.72, w*0.16, 0, Math.PI); ctx.fill();
        ctx.fillStyle = "#2e7d32"; ctx.fillRect(px+w*0.35, py+h*0.72, w*0.3, h*0.25);
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
    ctx.rotate(p.angle + Math.PI / 2);

    const wide = G.wideTimer > 0;
    const bw = (m.cutWidth + (wide ? 2 : 0)) * CELL * 0.78;
    const bl = CELL * 1.4;

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    roundRect(-bw/2 + 3, -bl/2 + 5, bw, bl, 7); ctx.fill();

    if (G.turboTimer > 0) {
      ctx.strokeStyle = "rgba(255,138,0," + (0.4 + 0.3*Math.sin(performance.now()/60)) + ")";
      ctx.lineWidth = 3; roundRect(-bw/2 - 3, -bl/2 - 3, bw + 6, bl + 6, 9); ctx.stroke();
    }

    ctx.fillStyle = wide ? "#8fd14f" : m.accent;
    roundRect(-bw/2, -bl/2, bw, 8, 4); ctx.fill();

    ctx.fillStyle = m.color;
    roundRect(-bw/2 + 3, -bl/2 + 6, bw - 6, bl - 6, 6); ctx.fill();
    ctx.strokeStyle = m.accent; ctx.lineWidth = 2;
    roundRect(-bw/2 + 3, -bl/2 + 6, bw - 6, bl - 6, 6); ctx.stroke();

    ctx.fillStyle = "#2a2a2a";
    roundRect(-bw*0.18, -bl*0.18, bw*0.36, bl*0.36, 4); ctx.fill();
    ctx.fillStyle = m.accent; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI*2); ctx.fill();

    if (m.rider) { ctx.fillStyle = "#333"; roundRect(-bw*0.16, bl*0.18, bw*0.32, bl*0.28, 4); ctx.fill(); }
    else {
      ctx.strokeStyle = "#888"; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(-bw*0.28, bl*0.5); ctx.lineTo(-bw*0.18, bl*0.78);
      ctx.lineTo(bw*0.18, bl*0.78); ctx.lineTo(bw*0.28, bl*0.5); ctx.stroke();
    }

    ctx.fillStyle = "#111";
    [[-bw/2+5,-bl/2+8],[bw/2-5,-bl/2+8],[-bw/2+6,bl/2-8],[bw/2-6,bl/2-8]].forEach(([wx,wy])=>{
      roundRect(wx-4, wy-6, 8, 12, 3); ctx.fill();
    });
    ctx.restore();

    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 40 && Math.random() < 0.6) spawnClip(p.x, p.y, p.angle);
  }

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
    ctx.save(); ctx.fillStyle = "#9be29b";
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
  function showOverlay({ title, body, cls, stats, buttons, stars, hsEntry }) {
    const ov = $("#overlay");
    $("#overlay-title").textContent = title;
    $("#overlay-title").className = cls || "";

    const card = $("#overlay-card");
    // remove any previous star/hs blocks
    card.querySelectorAll(".overlay-stars, .hs-entry").forEach(e => e.remove());

    if (stars != null) {
      const sd = document.createElement("div");
      sd.className = "overlay-stars";
      sd.innerHTML = [0,1,2].map(i => `<span class="${i<stars?'on':''}">${i<stars?'★':'☆'}</span>`).join("");
      $("#overlay-title").after(sd);
    }

    $("#overlay-body").textContent = body || "";
    $("#overlay-stats").innerHTML = (stats || []).map(([k, v]) =>
      `<div class="row"><span>${k}</span><b>${v}</b></div>`).join("");

    const btnEl = $("#overlay-buttons");
    btnEl.innerHTML = "";

    if (hsEntry) {
      const wrap = document.createElement("div");
      wrap.className = "hs-entry";
      wrap.innerHTML = `<p>🏆 New high score — enter your initials</p>
        <div class="hs-initials">
          <input maxlength="1" data-i="0" />
          <input maxlength="1" data-i="1" />
          <input maxlength="1" data-i="2" />
        </div>`;
      $("#overlay-stats").after(wrap);
      const inputs = [...wrap.querySelectorAll("input")];
      inputs.forEach((inp, i) => {
        inp.addEventListener("input", () => {
          inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (inp.value && inputs[i+1]) inputs[i+1].focus();
        });
      });
      setTimeout(() => inputs[0].focus(), 50);

      const submit = document.createElement("button");
      submit.className = "btn btn-primary";
      submit.textContent = "Save Score";
      submit.onclick = () => {
        const name = inputs.map(x => x.value || "_").join("").slice(0, 3) || "AAA";
        insertLeaderboard(name, hsEntry.score, hsEntry.level);
        Sound.buy();
        wrap.remove();
        // swap to the normal continuation buttons
        renderButtons(hsEntry.buttons);
        if (hsEntry.onSubmit) hsEntry.onSubmit();
      };
      btnEl.appendChild(submit);
    } else {
      renderButtons(buttons);
    }

    ov.classList.add("active");

    function renderButtons(list) {
      btnEl.innerHTML = "";
      (list || []).forEach(b => {
        const el = document.createElement("button");
        el.className = "btn " + (b.primary ? "btn-primary" : "");
        el.textContent = b.label;
        el.onclick = () => { Sound.ui(); b.action(); };
        btnEl.appendChild(el);
      });
    }
  }
  function hideOverlay() { $("#overlay").classList.remove("active"); }

  function togglePause() {
    if (!G.running) return;
    G.paused = !G.paused;
    if (G.paused) {
      Sound.setThrottle(0);
      showOverlay({
        title: "Paused", body: "Take a breather.",
        stats: [["Lawn", G.level.name], ["Mower", G.mower.name], ["Score", Math.round(G.score).toLocaleString("en-GB")]],
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
    G.running = false; cancelAnimationFrame(G.rafId);
    Sound.stopEngine(); hideOverlay(); refreshWallets(); show("menu");
  }
  function openGarage() { Sound.ui(); renderGarage(); hideOverlay(); show("garage"); }
  function openRecords() { Sound.ui(); renderRecords(); hideOverlay(); show("records"); }

  function startCareer() {
    Sound.resume();
    const idx = Math.min(state.levelReached, LEVELS.length - 1);
    startLevel(idx);
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    Sound.resume();
    switch (a) {
      case "play":      Sound.ui(); startCareer(); break;
      case "garage":    openGarage(); break;
      case "records":   openRecords(); break;
      case "howto":     Sound.ui(); show("howto"); break;
      case "back-menu": Sound.ui(); goMenu(); break;
      case "pause":     togglePause(); break;
      case "reset":
        if (confirm("Reset all progress, money, unlocks and scores?")) {
          const muted = state.muted;
          state = defaultState(); state.muted = muted;
          saveState(); refreshWallets(); renderGarage(); Sound.deny();
        }
        break;
    }
  });

  const keyMap = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right"
  };
  window.addEventListener("keydown", (e) => {
    // don't hijack typing into the high-score inputs
    if (e.target && e.target.tagName === "INPUT") return;
    if (e.key === "Escape" || e.key === "p" || e.key === "P") { togglePause(); return; }
    const dir = keyMap[e.key];
    if (dir) { G.input[dir] = true; e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => {
    const dir = keyMap[e.key];
    if (dir) { G.input[dir] = false; e.preventDefault(); }
  });

  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) document.body.classList.add("touch");
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

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && G.running && !G.paused) togglePause();
  });

  /* ---------------- boot ---------------- */
  applyMute();
  refreshWallets();
  show("menu");
})();
