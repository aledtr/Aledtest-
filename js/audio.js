/* ============================================================
   audio.js — tiny Web Audio engine (no asset files needed)
   Generates the mower engine drone + UI / event blips on the fly.
   ============================================================ */
(function (global) {
  "use strict";

  const Sound = {
    ctx: null,
    master: null,
    enabled: true,
    engine: null, // { osc, gain, filter, lfo }

    _ensure() {
      if (this.ctx) return;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    },

    // Browsers require a user gesture before audio can start.
    resume() {
      this._ensure();
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    },

    setEnabled(on) {
      this.enabled = on;
      if (this.master) this.master.gain.value = on ? 0.5 : 0;
    },

    /* ---- one-shot blip ---- */
    blip(freq = 440, dur = 0.08, type = "square", vol = 0.25) {
      if (!this.enabled) return;
      this._ensure();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    /* ---- semantic sounds ---- */
    ui()      { this.blip(540, 0.06, "square", 0.18); },
    buy()     { this.blip(660, 0.09, "triangle", 0.25); setTimeout(() => this.blip(990, 0.12, "triangle", 0.25), 90); },
    deny()    { this.blip(160, 0.18, "sawtooth", 0.22); },
    bump()    { this.blip(90, 0.16, "sawtooth", 0.30); },
    cut()     { /* soft snip, kept very quiet so it isn't spammy */ this.blip(1200 + Math.random()*250, 0.025, "square", 0.04); },
    refuel()  { this.blip(330, 0.1, "sine", 0.2); setTimeout(() => this.blip(520, 0.12, "sine", 0.2), 90); },
    coin()    { this.blip(880, 0.05, "square", 0.18); setTimeout(() => this.blip(1320, 0.09, "square", 0.18), 55); },
    power()   { [440,660,880,1100].forEach((f,i)=> setTimeout(()=>this.blip(f,0.07,"triangle",0.2), i*45)); },
    star()    { this.blip(1047, 0.12, "triangle", 0.24); },
    bark()    { this.blip(220, 0.08, "sawtooth", 0.22); setTimeout(()=>this.blip(180,0.1,"sawtooth",0.2), 90); },
    win()     { [523,659,784,1047].forEach((f,i)=> setTimeout(()=>this.blip(f,0.16,"triangle",0.26), i*120)); },
    lose()    { [440,392,330,247].forEach((f,i)=> setTimeout(()=>this.blip(f,0.2,"sawtooth",0.24), i*150)); },

    /* ---- continuous engine drone ---- */
    startEngine(electric = false) {
      if (!this.enabled) return;
      this._ensure();
      if (!this.ctx || this.engine) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();

      osc.type = electric ? "triangle" : "sawtooth";
      sub.type = "sine";
      osc.frequency.value = electric ? 220 : 70;
      sub.frequency.value = electric ? 110 : 38;
      filter.type = "lowpass";
      filter.frequency.value = electric ? 900 : 420;

      // idle wobble
      lfo.frequency.value = electric ? 9 : 6;
      lfoGain.gain.value = electric ? 12 : 18;
      lfo.connect(lfoGain).connect(osc.frequency);

      gain.gain.value = 0.0;
      osc.connect(filter); sub.connect(filter);
      filter.connect(gain).connect(this.master);
      osc.start(t); sub.start(t); lfo.start(t);
      gain.gain.linearRampToValueAtTime(electric ? 0.05 : 0.08, t + 0.3);

      this.engine = { osc, sub, gain, filter, lfo, electric, base: osc.frequency.value };
    },

    // throttle 0..1 — raises pitch/volume while moving
    setThrottle(amount) {
      if (!this.engine || !this.ctx) return;
      const e = this.engine;
      const t = this.ctx.currentTime;
      const base = e.base;
      e.osc.frequency.setTargetAtTime(base * (1 + amount * 0.9), t, 0.08);
      e.sub.frequency.setTargetAtTime((base / 1.8) * (1 + amount * 0.7), t, 0.08);
      e.filter.frequency.setTargetAtTime((e.electric ? 900 : 420) + amount * 700, t, 0.08);
      const target = (e.electric ? 0.05 : 0.08) + amount * 0.06;
      e.gain.gain.setTargetAtTime(target, t, 0.1);
    },

    stopEngine() {
      if (!this.engine || !this.ctx) return;
      const e = this.engine;
      const t = this.ctx.currentTime;
      e.gain.gain.setTargetAtTime(0.0001, t, 0.1);
      const eng = this.engine;
      this.engine = null;
      setTimeout(() => {
        try { eng.osc.stop(); eng.sub.stop(); eng.lfo.stop(); } catch (_) {}
      }, 300);
    }
  };

  global.Sound = Sound;
})(window);
