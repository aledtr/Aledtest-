/* ============================================================
   game.js — Hyundai Mow Master main controller
   Handles: screen routing, save state, garage/shop, records,
   and the canvas gameplay loop. Each machine's real spec drives
   its difficulty — most notably the CORDED cable-reach mechanic.
   ============================================================ */
(function () {
  "use strict";

  const CELL = 30;
  const SAVE_KEY = "hyundai_mow_master_save_v3";
  const COIN_VALUE = 5;
  const MAX_COMBO = 5;
  const LB_SIZE = 10;

  /* ---------------- Persistent state ---------------- */
  const defaultState = () => ({
    wallet: 0,
    owned: ["hym3300e"],
    selected: "hym3300e",
    hasExtension: false,
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

  function refreshWallets() {
    $("#menu-wallet").textContent = fmtMoney(state.wallet);
    $("#garage-wallet").textContent = fmtMoney(state.wallet);
  }

  const unlimited = (m) => MOWERS.unlimited(m);

  /* ---------------- sound toggle ---------------- */
  const soundBtn = $("#sound-toggle");
  function applyMute() {
    Sound.setEnabled(!state.muted);
    soundBtn.textContent = state.muted ? "🔇" : "🔊";
    soundBtn.classList.toggle("muted", state.muted);
  }
  soundBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    Sound.resume(); applyMute(); saveState();
    if (!state.muted) Sound.ui();
  });

  /* ============================================================
     GARAGE
     ============================================================ */
  function renderGarage() {
    renderUpgrades();
    const grid = $("#mower-grid");
    grid.innerHTML = "";
    MOWERS.forEach(m => {
      const owned = state.owned.includes(m.id);
      const selected = state.selected === m.id;
      const bars = MOWERS.bars(m);

      const card = document.createElement("div");
      card.className = "mower-card" + (selected ? " selected" : "") + (owned ? "" : " locked");
      card.innerHTML = `
        <div class="mower-thumb"><canvas class="thumb-canvas" width="240" height="132"></canvas><span class="thumb-tag tag-${m.power}">${powerLabel(m)}</span></div>
        <div>
          <div class="mower-class">${m.class}</div>
          <div class="mower-name">${m.name}</div>
        </div>
        <div class="mower-diff">⚙ ${m.difficulty}</div>
        <div class="mower-desc">${m.desc}</div>
        <div class="mower-spec">${m.spec}</div>
        ${statRow("Speed", bars.speed)}
        ${statRow("Cut", bars.width)}
        ${statRow(m.corded ? "Reach" : "Runtime", bars.runtime)}
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
      paintThumb(card.querySelector(".thumb-canvas"), m);
    });
    refreshWallets();
  }

  function powerLabel(m) {
    return { corded: "MAINS", battery: "BATTERY", petrol: "PETROL", robot: "ROBOT" }[m.power] || "";
  }

  function renderUpgrades() {
    const box = $("#garage-upgrades");
    if (!box) return;
    const ext = MOWERS.EXTENSION;
    const owned = state.hasExtension;
    box.innerHTML = `
      <div class="upgrade-card ${owned ? "owned" : ""}">
        <div class="upgrade-icon">🔌</div>
        <div class="upgrade-body">
          <div class="upgrade-name">Extension Cable <span class="muted">(+${ext.reach} cells reach)</span></div>
          <div class="upgrade-desc">Fits every corded mower — reach further from each wall socket, so you re-plug far less often.</div>
        </div>
        <div class="upgrade-foot"></div>
      </div>`;
    const foot = box.querySelector(".upgrade-foot");
    if (owned) {
      const t = document.createElement("span"); t.className = "owned-tag"; t.textContent = "✓ Fitted";
      foot.appendChild(t);
    } else {
      const b = document.createElement("button");
      const ok = state.wallet >= ext.price;
      b.className = "btn " + (ok ? "btn-primary" : ""); b.disabled = !ok;
      b.innerHTML = `Buy · <span class="price-tag">${fmtMoney(ext.price)}</span>`;
      b.onclick = () => {
        if (state.wallet < ext.price) { Sound.deny(); return; }
        state.wallet -= ext.price; state.hasExtension = true; Sound.buy(); saveState(); renderGarage();
      };
      foot.appendChild(b);
    }
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
    Sound.buy(); saveState(); renderGarage();
  }

  /* ---------------- shared mower artwork ----------------
     One painter used for BOTH the in-game sprite and the garage
     thumbnails, so they always match. Drawn top-down, facing -y
     (up): rounded front cutting deck, centre powerplant that
     varies by type, a rear hard-top grass box, big rear wheels
     (or a striping roller), and a steel handlebar — the Hyundai
     Power Products look: black body with yellow/lime accents.   */
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function paintMower(c, m, opts) {
    opts = opts || {};
    const wide = !!opts.wide, turbo = !!opts.turbo, t = opts.t || 0;
    const robot = !!m.robot, rider = !!m.rider;
    const cw = Math.max(2.3, m.cutWidth + (wide ? 2 : 0));
    const bw = cw * CELL * 0.74;                                  // deck width
    const bl = Math.min(CELL * 2.3, Math.max(CELL * 1.5, bw * 1.0)); // body length
    const frontY = -bl * 0.54, deckH = bl * 0.72, backY = frontY + bl;
    const accent = wide ? "#8fd14f" : m.accent;

    const wheel = (wx, wy, rad) => {
      c.fillStyle = "#0a0a0a"; rr(c, wx - rad, wy - rad * 1.5, rad * 2, rad * 3, rad); c.fill();
      c.fillStyle = "#3c3c40"; c.beginPath(); c.arc(wx, wy, rad * 0.55, 0, 7); c.fill();
      c.fillStyle = "#6a6a6e"; c.beginPath(); c.arc(wx, wy, rad * 0.22, 0, 7); c.fill();
    };

    // turbo aura
    if (turbo) {
      c.strokeStyle = "rgba(255,138,0," + (0.45 + 0.3 * Math.sin(t / 60)) + ")";
      c.lineWidth = 3; rr(c, -bw / 2 - 4, frontY - 4, bw + 8, bl + 8, 13); c.stroke();
    }

    // ground shadow
    c.fillStyle = "rgba(0,0,0,.28)";
    rr(c, -bw / 2 + 3, frontY + 5, bw, bl, 13); c.fill();

    // ---- running gear (under body) ----
    if (!robot) {
      if (m.stripe) {                                  // rear striping roller
        c.fillStyle = "#1d1d1f"; rr(c, -bw * 0.5, backY - bl * 0.17, bw, bl * 0.14, bl * 0.06); c.fill();
        c.fillStyle = "#3a3a3d"; rr(c, -bw * 0.5 + 3, backY - bl * 0.17 + 2, bw - 6, 3, 2); c.fill();
      } else {                                         // big rear drive wheels
        wheel(-bw * 0.5, backY - bl * 0.14, bl * 0.135);
        wheel( bw * 0.5, backY - bl * 0.14, bl * 0.135);
      }
      wheel(-bw * 0.46, frontY + bl * 0.16, bl * 0.1); // small front wheels
      wheel( bw * 0.46, frontY + bl * 0.16, bl * 0.1);
    } else {
      wheel(-bw * 0.42, 0, bl * 0.1);
      wheel( bw * 0.42, 0, bl * 0.1);
    }

    // ---- rear hard-top grass box (not robot) ----
    if (!robot) {
      c.fillStyle = "#2b2b2e"; rr(c, -bw * 0.42, backY - bl * 0.36, bw * 0.84, bl * 0.32, 7); c.fill();
      c.strokeStyle = "rgba(0,0,0,.5)"; c.lineWidth = 1; rr(c, -bw * 0.42, backY - bl * 0.36, bw * 0.84, bl * 0.32, 7); c.stroke();
      c.fillStyle = "#3c3c40";                         // airflow vents on the box lid
      for (let i = 0; i < 4; i++) { rr(c, -bw * 0.34 + i * bw * 0.2, backY - bl * 0.31, bw * 0.13, bl * 0.045, 2); c.fill(); }
    }

    // ---- cutting deck ----
    c.fillStyle = m.color; rr(c, -bw / 2, frontY, bw, deckH, 13); c.fill();
    c.fillStyle = "rgba(255,255,255,.05)"; rr(c, -bw / 2 + 3, frontY + 3, bw - 6, deckH * 0.4, 10); c.fill();
    c.fillStyle = accent; rr(c, -bw / 2 + 5, frontY + 2, bw - 10, 5, 3); c.fill();   // front cutting mouth
    c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = 1.5; rr(c, -bw / 2, frontY, bw, deckH, 13); c.stroke();

    if (m.power === "petrol") {                          // 4-in-1 side-discharge chute
      c.fillStyle = "#181818"; rr(c, bw / 2 - 2, frontY + deckH * 0.32, bl * 0.13, deckH * 0.24, 3); c.fill();
    }

    // ---- powerplant ----
    const cy0 = frontY + deckH * 0.5;
    if (m.power === "petrol") {
      c.fillStyle = "#1c1c1c"; rr(c, -bw * 0.2, cy0 - bl * 0.17, bw * 0.4, bl * 0.34, 5); c.fill();
      c.fillStyle = "#4a4a4e"; c.beginPath(); c.arc(0, cy0, bw * 0.12, 0, 7); c.fill();   // air filter / recoil
      c.fillStyle = "#6a6a6e"; c.beginPath(); c.arc(0, cy0, bw * 0.06, 0, 7); c.fill();
      c.fillStyle = "#555"; rr(c, -bw * 0.27, cy0 - bl * 0.03, bw * 0.07, bl * 0.07, 2); c.fill(); // exhaust
    } else if (m.power === "battery") {
      c.fillStyle = "#1c1c1c"; rr(c, -bw * 0.21, cy0 - bl * 0.16, bw * 0.42, bl * 0.32, 5); c.fill();
      c.fillStyle = "#101012"; rr(c, -bw * 0.15, cy0 - bl * 0.11, bw * 0.3, bl * 0.22, 3); c.fill();
      c.fillStyle = "#8fd14f"; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-bw * 0.08 + i * bw * 0.08, cy0, 1.7, 0, 7); c.fill(); }
    } else if (m.power === "corded") {
      c.fillStyle = "#1c1c1c"; rr(c, -bw * 0.19, cy0 - bl * 0.15, bw * 0.38, bl * 0.3, 6); c.fill();
      c.fillStyle = accent; for (let i = 0; i < 3; i++) { rr(c, -bw * 0.12, cy0 - bl * 0.075 + i * bl * 0.06, bw * 0.24, 2, 1); c.fill(); }
      c.fillStyle = "#444"; rr(c, -bw * 0.04, backY - bl * 0.42, bw * 0.08, bl * 0.06, 2); c.fill(); // cable inlet
    } else if (robot) {
      c.fillStyle = "#11151c"; rr(c, -bw * 0.36, frontY + 2, bw * 0.72, deckH - 4, 14); c.fill();
      c.fillStyle = accent; rr(c, -bw * 0.3, frontY + 3, bw * 0.6, 3, 2); c.fill();           // front bumper
      c.fillStyle = "#0a0d12"; c.beginPath(); c.arc(0, cy0, bw * 0.15, 0, 7); c.fill();       // sensor dome
      c.fillStyle = accent; c.beginPath(); c.arc(0, cy0, bw * 0.055, 0, 7); c.fill();
    }

    // ---- Hyundai badge ----
    if (!robot) { c.fillStyle = m.accent; rr(c, -bw * 0.15, cy0 - 2.5, bw * 0.3, 5, 2); c.fill(); }

    // ---- handlebar (walk-behind) ----
    if (!robot && !rider) {
      c.lineCap = "round";
      c.strokeStyle = "#9a9a9e"; c.lineWidth = Math.max(2, bw * 0.03);
      c.beginPath();
      c.moveTo(-bw * 0.32, backY - bl * 0.1); c.lineTo(-bw * 0.22, backY + bl * 0.13);
      c.lineTo( bw * 0.22, backY + bl * 0.13); c.lineTo( bw * 0.32, backY - bl * 0.1);
      c.stroke();
      c.strokeStyle = accent; c.lineWidth = Math.max(2, bw * 0.045);
      c.beginPath(); c.moveTo(-bw * 0.22, backY + bl * 0.13); c.lineTo(bw * 0.22, backY + bl * 0.13); c.stroke();
      c.lineCap = "butt";
    }
  }

  // paint a mower into a garage thumbnail canvas, scaled to fit
  function paintThumb(canvas, m) {
    if (!canvas) return;
    const c = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    c.clearRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#101113"); g.addColorStop(1, "#070708");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const cw = Math.max(2.3, m.cutWidth);
    const bw = cw * CELL * 0.74, bl = Math.min(CELL * 2.3, Math.max(CELL * 1.5, bw * 1.0));
    const scale = Math.min(W * 0.74 / bw, H * 0.78 / (bl * 1.25));
    c.save();
    c.translate(W / 2, H / 2 - bl * scale * 0.08);
    c.scale(scale, scale);
    paintMower(c, m, {});
    c.restore();
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
      const unlockedLvl = i <= state.levelReached;
      const stars = state.levelStars[i] || 0;
      const best = state.levelScores[i];
      const time = state.bestTimes[i];
      const row = document.createElement("div");
      row.className = "lr-row" + (unlockedLvl ? "" : " lr-locked");
      row.innerHTML = `
        <span class="stars">${[0,1,2].map(s => `<span class="${s<stars?'on':''}">${s<stars?'★':'☆'}</span>`).join("")}</span>
        <span class="lr-name">${unlockedLvl ? L.name : "🔒 Locked"}</span>
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
    // cable mechanic
    corded: false, sockets: [], anchor: null, reach: 0, cableTaut: false, replugCd: 0,
    player: { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, angle: 0 },
    input: { up: false, down: false, left: false, right: false },
    lastTs: 0, rafId: 0
  };

  function cellBlocked(x, y) {
    const L = G.level;
    if (x < 0 || y < 0 || x >= L.cols || y >= L.rows) return true;
    return G.grid[y * L.cols + x] === 2;
  }

  function nearestSocket(x, y) {
    let best = null, bd = Infinity;
    for (const s of G.sockets) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
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

    const p = G.player;
    p.x = (level.start.x + 0.5) * CELL;
    p.y = (level.start.y + 0.5) * CELL;
    p.px = p.x; p.py = p.y;
    p.vx = p.vy = 0; p.angle = 0;

    G.energyMax = G.mower.energy;
    G.energy = G.energyMax;
    G.time = 0; G.bumps = 0; G.bumpCooldown = 0;
    G.reward = level.reward; G.runCash = 0;
    G.score = 0; G.combo = 1; G.comboTimer = 0;
    G.coinsCollected = 0;
    G.turboTimer = 0; G.wideTimer = 0;
    G.powerups = []; G.powerupTimer = 8;
    G.popups = []; G.shake = 0;

    // cable / sockets
    G.sockets = (level.sockets || []).map(s => ({ x: (s.x + 0.5) * CELL, y: (s.y + 0.5) * CELL, cx: s.x, cy: s.y }));
    G.corded = !!G.mower.corded;
    if (G.corded) {
      const ext = state.hasExtension ? MOWERS.EXTENSION.reach : 0;
      G.reach = (G.mower.cableReach + ext) * CELL;
      G.anchor = nearestSocket(p.x, p.y) || { x: p.x, y: p.y };
    } else {
      G.anchor = null; G.reach = 0;
    }
    G.cableTaut = false; G.replugCd = 0;

    // coins
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
      type: h.type, x: (h.x + 0.5) * CELL, y: (h.y + 0.5) * CELL,
      vx: (Math.random() < 0.5 ? -1 : 1) * (h.type === "dog" ? 70 : 50),
      vy: (Math.random() < 0.5 ? -1 : 1) * (h.type === "dog" ? 70 : 50),
      wob: Math.random() * 6
    }));
    G.hazardCooldown = 0;

    G.paused = false; G.running = true;

    $("#hud-mower-name").textContent = G.mower.name;
    $("#hud-level").textContent = (index + 1);
    $("#hud-target").textContent = level.target + "%";
    updateHUD();

    show("game");
    hideOverlay();
    Sound.resume();
    Sound.startEngine(G.mower.power !== "petrol");

    G.lastTs = performance.now();
    cancelAnimationFrame(G.rafId);
    G.rafId = requestAnimationFrame(loop);
  }

  function computeStars(coinRatio) {
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
      const coinRatio = L.coins ? G.coinsCollected / L.coins : 1;
      const stars = computeStars(coinRatio);

      const cleanBonus = G.bumps === 0 ? 1000 : 0;
      const starBonus = stars * 500;
      const timeBonus = L.timeLimit ? Math.round(Math.max(0, L.timeLimit - G.time) * 5) : Math.round(Math.max(0, 200 - G.time) * 3);
      const finalScore = Math.round(G.score + cleanBonus + starBonus + timeBonus);

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
      const reason = (!unlimited(G.mower) && G.energy <= 0)
        ? (G.mower.power === "battery" ? "Battery flat" : "Out of fuel")
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
    p.px = p.x; p.py = p.y;

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

    // ---- cable constraint (corded mowers) ----
    G.replugCd = Math.max(0, G.replugCd - dt);
    if (G.corded && G.anchor) {
      // re-plug when driving over a different socket
      for (const s of G.sockets) {
        if (s === G.anchor) continue;
        if (Math.hypot(p.x - s.x, p.y - s.y) < CELL * 0.7 && G.replugCd <= 0) {
          G.anchor = s; G.replugCd = 0.5;
          addPopup(s.x, s.y - 12, "🔌 Re-plugged", "#36c0ff");
          Sound.refuel();
        }
      }
      const cdx = p.x - G.anchor.x, cdy = p.y - G.anchor.y;
      const cd = Math.hypot(cdx, cdy);
      if (cd > G.reach) {
        // taut — clamp to the cable's reach circle
        const clampX = G.anchor.x + (cdx / cd) * G.reach;
        const clampY = G.anchor.y + (cdy / cd) * G.reach;
        if (!blockedAt(clampX, clampY)) { p.x = clampX; p.y = clampY; }
        else { p.x = p.px; p.y = p.py; }
        p.vx *= 0.2; p.vy *= 0.2;
        if (!G.cableTaut && speedNow > 60) Sound.bump();
        G.cableTaut = true;
      } else {
        G.cableTaut = cd > G.reach * 0.9; // warn near the limit
      }
    }

    // bump
    G.bumpCooldown = Math.max(0, G.bumpCooldown - dt);
    if (bumped && G.bumpCooldown <= 0) {
      Sound.bump(); G.bumps++; G.combo = 1; G.comboTimer = 0;
      G.shake = 8; G.bumpCooldown = 0.4;
    }

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
        G.comboTimer = 0.7;
        G.combo = Math.min(MAX_COMBO, G.combo + cutCount * 0.06);
        G.score += cutCount * 10 * G.combo;
        if (Math.random() < 0.25) Sound.cut();
      }
      if (!unlimited(m)) {
        G.energy -= m.drain * dt * (0.6 + 0.4 * (speedNow / m.speed));
      }
    }

    if (G.comboTimer > 0) G.comboTimer -= dt;
    else if (G.combo > 1) G.combo = Math.max(1, G.combo - dt * 1.5);

    // coins
    for (const c of G.coins) {
      if (c.collected) continue;
      c.t += dt;
      if (Math.hypot(p.x - c.x, p.y - c.y) < CELL * 0.7) {
        c.collected = true; G.coinsCollected++; G.runCash += COIN_VALUE;
        G.score += Math.round(80 * G.combo);
        addPopup(c.x, c.y, "+" + fmtMoney(COIN_VALUE), "#ffcf2b"); Sound.coin();
      }
    }

    // power-ups
    G.powerupTimer -= dt;
    if (G.powerupTimer <= 0 && G.powerups.length < 2) {
      spawnPowerup(); G.powerupTimer = 12 + Math.random() * 8;
    }
    for (let i = G.powerups.length - 1; i >= 0; i--) {
      const pu = G.powerups[i];
      pu.life -= dt; pu.t += dt;
      if (pu.life <= 0) { G.powerups.splice(i, 1); continue; }
      if (Math.hypot(p.x - pu.x, p.y - pu.y) < CELL * 0.8) { applyPowerup(pu); G.powerups.splice(i, 1); }
    }

    // hazards
    G.hazardCooldown = Math.max(0, G.hazardCooldown - dt);
    for (const h of G.hazards) {
      h.wob += dt * 4;
      let hx = h.x + h.vx * dt, hy = h.y + h.vy * dt;
      if (cellBlocked(Math.floor(hx / CELL), Math.floor(h.y / CELL)) || hx < CELL*0.6 || hx > L.cols*CELL - CELL*0.6) h.vx *= -1;
      else h.x = hx;
      if (cellBlocked(Math.floor(h.x / CELL), Math.floor(hy / CELL)) || hy < CELL*0.6 || hy > L.rows*CELL - CELL*0.6) h.vy *= -1;
      else h.y = hy;
      if (Math.random() < 0.01) { h.vx += (Math.random()-0.5)*30; h.vy += (Math.random()-0.5)*30; }
      if (G.hazardCooldown <= 0 && Math.hypot(p.x - h.x, p.y - h.y) < CELL * 0.85) {
        p.vx = -p.vx * 0.4; p.vy = -p.vy * 0.4;
        G.combo = 1; G.comboTimer = 0; G.bumps++; G.shake = 10; G.hazardCooldown = 0.8;
        addPopup(p.x, p.y - 10, h.type === "dog" ? "Woof!" : "Honk!", "#ff6b6b"); Sound.bark();
      }
    }

    // refuel / charge pads (battery + petrol only)
    if (!unlimited(m) && L.refuel) {
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

    // time & fail
    G.time += dt;
    if (!unlimited(m) && G.energy <= 0) { G.energy = 0; endRun(false); return; }
    if (L.timeLimit > 0 && G.time >= L.timeLimit) { endRun(false); return; }

    const pct = (G.cut / G.mowable) * 100;
    if (pct >= L.target) { endRun(true); return; }

    updateHUD();
  }

  function spawnPowerup() {
    const L = G.level;
    const fuelType = unlimited(G.mower) ? "cash" : "jerry";
    const types = ["turbo", "widecut", "cash", fuelType];
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
      case "jerry":   G.energy = Math.min(G.energyMax, G.energy + G.energyMax * 0.35); addPopup(pu.x, pu.y, "+FUEL", "#4ad07a"); break;
      case "cash":    G.runCash += 20; G.score += 200; addPopup(pu.x, pu.y, "+£20", "#ffcf2b"); break;
    }
  }

  function addPopup(x, y, text, color) {
    G.popups.push({ x, y, text, color, life: 0.9 });
    if (G.popups.length > 30) G.popups.shift();
  }

  function updateHUD() {
    const m = G.mower;
    const pct = Math.round((G.cut / G.mowable) * 100);
    $("#hud-progress").textContent = pct + "%";
    $("#hud-score").textContent = Math.round(G.score).toLocaleString("en-GB");

    const bar = $("#hud-energy-bar");
    let fill, text, danger = false;
    if (G.corded) {
      const cd = G.anchor ? Math.hypot(G.player.x - G.anchor.x, G.player.y - G.anchor.y) : 0;
      const slack = Math.max(0, 1 - cd / G.reach);
      fill = Math.round(slack * 100);
      text = G.cableTaut ? "CABLE TAUT" : "CABLE";
      danger = G.cableTaut;
    } else if (m.robot) {
      fill = 100; text = "AUTO";
    } else {
      fill = Math.round((G.energy / G.energyMax) * 100);
      text = (m.power === "battery" ? "BATT " : "FUEL ") + fill + "%";
      danger = fill < 20;
    }
    bar.style.width = fill + "%";
    bar.style.background = danger ? "linear-gradient(90deg,#e44,#ff8a00)" : "linear-gradient(90deg,#4ad07a,#ffcf2b)";
    $("#hud-energy-text").textContent = text;

    $("#hud-time").textContent = G.level.timeLimit > 0 ? fmtTime(G.level.timeLimit - G.time) : fmtTime(G.time);
    $("#hud-money").textContent = (state.wallet + G.runCash).toLocaleString("en-GB");

    const comboEl = $("#hud-combo");
    const cx = G.combo;
    comboEl.classList.toggle("active", cx > 1.05);
    comboEl.querySelector(".combo-x").textContent = "x" + cx.toFixed(1);
    $("#combo-fill").style.width = Math.round(((cx - 1) / (MAX_COMBO - 1)) * 100) + "%";
  }

  /* ---------------- rendering ---------------- */
  function render() {
    const L = G.level, m = G.mower;
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

    if (!unlimited(m) && L.refuel) L.refuel.forEach(r => drawRefuel(r.x * CELL, r.y * CELL));
    if (G.corded) drawSockets();
    G.coins.forEach(drawCoin);
    G.powerups.forEach(drawPowerup);
    L.obstacles.forEach(drawObstacle);
    if (G.corded && G.anchor) drawCable();
    G.hazards.forEach(drawHazard);
    drawMower();
    drawClips();
    drawPopups();

    if (!unlimited(m) && G.energy / G.energyMax < 0.18) {
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(performance.now() / 120);
      ctx.fillStyle = "#e44"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawSockets() {
    for (const s of G.sockets) {
      const active = s === G.anchor;
      ctx.save();
      ctx.translate(s.x, s.y);
      // post / wall plate
      ctx.fillStyle = active ? "#36c0ff" : "#9aa0a6";
      roundRect(-9, -9, 18, 18, 4); ctx.fill();
      ctx.fillStyle = "#11141a";
      roundRect(-6, -6, 12, 12, 3); ctx.fill();
      // prongs
      ctx.fillStyle = active ? "#bfe9ff" : "#cfd3d8";
      ctx.fillRect(-3.5, -3, 2.2, 6);
      ctx.fillRect(1.3, -3, 2.2, 6);
      if (active) {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(performance.now()/200);
        ctx.strokeStyle = "#36c0ff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawCable() {
    const a = G.anchor, p = G.player;
    const mid = { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 + 16 }; // sag
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = G.cableTaut ? "#ff5a3c" : "#ffcf2b";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mid.x, mid.y, p.x, p.y);
    ctx.stroke();
    // plug end glow
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawCoin(c) {
    if (c.collected) return;
    const bob = Math.sin(c.t * 3) * 2;
    const sx = Math.abs(Math.cos(c.t * 2));
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
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(pu.x, pu.y + bob);
    ctx.fillStyle = "rgba(0,0,0,.55)"; roundRect(-13, -13, 26, 26, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; roundRect(-13, -13, 26, 26, 7); ctx.stroke();
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
      ctx.fillStyle = "#8a5a2b"; roundRect(-11, -6 + step*0.2, 22, 12, 5); ctx.fill();
      ctx.fillStyle = "#724a22"; roundRect(7, -10, 11, 10, 4); ctx.fill();
      ctx.fillStyle = "#4a2f15"; ctx.fillRect(16, -10, 3, 5);
      ctx.fillStyle = "#222"; ctx.fillRect(-12, -14, 3, 8);
      ctx.fillStyle = "#3a2410"; ctx.fillRect(-8, 5 + step, 3, 5); ctx.fillRect(5, 5 - step, 3, 5);
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(15, -6, 1.4, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = "#f4f4f4"; roundRect(-10, -5 + step*0.2, 18, 11, 5); ctx.fill();
      ctx.fillStyle = "#fff"; roundRect(6, -14, 6, 12, 3); ctx.fill();
      ctx.beginPath(); ctx.arc(9, -14, 5, 0, 7); ctx.fill();
      ctx.fillStyle = "#ff9f1c"; ctx.beginPath(); ctx.moveTo(13,-15); ctx.lineTo(19,-13); ctx.lineTo(13,-11); ctx.fill();
      ctx.fillStyle = "#ff9f1c"; ctx.fillRect(-6, 5+step, 2, 5); ctx.fillRect(2, 5-step, 2, 5);
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(10, -15, 1.2, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawPopups() {
    ctx.save(); ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
    for (const pp of G.popups) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pp.life * 1.4));
      ctx.fillStyle = "#000"; ctx.fillText(pp.text, pp.x + 1, pp.y + 1);
      ctx.fillStyle = pp.color; ctx.fillText(pp.text, pp.x, pp.y);
    }
    ctx.restore();
  }

  function drawRefuel(px, py) {
    ctx.save();
    ctx.fillStyle = "rgba(255,207,43,0.18)"; ctx.fillRect(px, py, CELL, CELL);
    ctx.strokeStyle = "#ffcf2b"; ctx.setLineDash([4, 3]);
    ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4); ctx.setLineDash([]);
    ctx.fillStyle = "#ffcf2b"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(G.mower.power === "battery" ? "⚡" : "⛽", px + CELL / 2, py + CELL / 2 + 1);
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
        ctx.fillStyle = "#1f6b2a"; roundRect(px+1, py+1, w-2, h-2, 8); ctx.fill();
        ctx.fillStyle = "#2a8038";
        for (let yy = py+4; yy < py+h-4; yy += 7)
          for (let xx = px+4; xx < px+w-4; xx += 7) { ctx.beginPath(); ctx.arc(xx, yy, 3, 0, 7); ctx.fill(); }
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
    paintMower(ctx, m, { wide: G.wideTimer > 0, turbo: G.turboTimer > 0, t: performance.now() });
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
      submit.className = "btn btn-primary"; submit.textContent = "Save Score";
      submit.onclick = () => {
        const name = inputs.map(x => x.value || "_").join("").slice(0, 3) || "AAA";
        insertLeaderboard(name, hsEntry.score, hsEntry.level);
        Sound.buy(); wrap.remove();
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
