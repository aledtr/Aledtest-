/* ============================================================
   mowers.js — the real Hyundai Power Products line-up
   ------------------------------------------------------------
   Every machine here is a real Hyundai Power Products lawnmower,
   and its real-world spec is turned into a difficulty layer:

   • CORDED electric (mains)  — unlimited power, but you're tethered
     to a wall socket. The lead only reaches so far (cableReach).
     To mow further you must either re-plug into another socket
     dotted around the garden, or fit the EXTENSION CABLE upgrade.
   • BATTERY cordless         — total freedom of movement, but a
     finite charge (runtime). Top up on a charge pad.
   • PETROL                   — most power/width/speed, big tank,
     but you burn fuel and must visit the refuel pad.
   • ROBOT (HYRM1000)         — autonomous: never runs out (self
     charging) but a tiny 18cm deck, so coverage is the challenge.

   Game fields:
     power     : "corded" | "battery" | "petrol" | "robot"
     cutWidth  : deck width in grid cells (wider = mows more / pass)
     speed     : drive speed px/s
     turn      : steering responsiveness (higher = sharper)
     energy    : tank/battery size in seconds (∞ for corded/robot)
     drain     : energy/sec while mowing (0 for corded/robot)
     cableReach: cells the lead reaches from its socket (corded only)
     stripe    : leaves a rear-roller striped finish
     spec      : real-world spec string shown in the Garage
   ============================================================ */
(function (global) {
  "use strict";

  const INF = Infinity;

  const MOWERS = [
    {
      id: "hym3300e",
      name: "HYM3300E",
      class: "Corded Electric · 33cm",
      power: "corded", corded: true, mains: true,
      difficulty: "Starter · tethered",
      desc: "1200W 33cm corded mains mower. Unlimited running time — but a short lead. Plan around the wall sockets.",
      spec: "1200W · 33cm cut · ~8m lead · 9.4kg",
      price: 0,
      cutWidth: 2, speed: 120, turn: 0.22,
      energy: INF, drain: 0, cableReach: 9,
      color: "#1a1a1a", accent: "#ffcf2b"
    },
    {
      id: "hym3800e",
      name: "HYM3800E",
      class: "Corded Electric · 38cm",
      power: "corded", corded: true, mains: true, stripe: true,
      difficulty: "Easy · tethered",
      desc: "1600W 38cm corded roller mower. A proper 10m long-reach cable and a rear roller for striped lawns.",
      spec: "1600W · 38cm cut · 10m lead · rear roller · 40L",
      price: 130,
      cutWidth: 3, speed: 132, turn: 0.22,
      energy: INF, drain: 0, cableReach: 13,
      color: "#141414", accent: "#ffcf2b"
    },
    {
      id: "hym40li330p",
      name: "HYM40Li330P",
      class: "40V Cordless · 33cm",
      power: "battery", electric: true, battery: true, stripe: true,
      difficulty: "Easy · battery",
      desc: "40V 2.5Ah cordless roller mower. No cable at all — total freedom — but ~60 min of charge to manage.",
      spec: "40V · 2.5Ah · 33cm cut · ~60min · 80min charge",
      price: 380,
      cutWidth: 3, speed: 150, turn: 0.27,
      energy: 72, drain: 0.9,
      color: "#161616", accent: "#8fd14f"
    },
    {
      id: "hym430spe",
      name: "HYM430SPE",
      class: "Petrol · Self-Propelled · 42cm",
      power: "petrol", electric: false,
      difficulty: "Medium · petrol",
      desc: "139cc electric-start, self-propelled petrol. Drives itself along — just steer — and refuels fast.",
      spec: "139cc 4-stroke · 42cm cut · self-propelled · 45L",
      price: 560,
      cutWidth: 4, speed: 154, turn: 0.24,
      energy: 70, drain: 1.0,
      color: "#101010", accent: "#ffcf2b"
    },
    {
      id: "hym460sp",
      name: "HYM460SP",
      class: "Petrol · Self-Propelled · 46cm",
      power: "petrol", electric: false,
      difficulty: "Medium · petrol",
      desc: "139cc 4-in-1 self-propelled petrol. A wider 46cm deck clears more ground each pass.",
      spec: "139cc 4-stroke · 46cm cut · 4-in-1 · 55L",
      price: 760,
      cutWidth: 4, speed: 160, turn: 0.22,
      energy: 78, drain: 1.0,
      color: "#0e0e0e", accent: "#ffcf2b"
    },
    {
      id: "hym480sper",
      name: "HYM480SPER",
      class: "Petrol · Roller · 48cm",
      power: "petrol", electric: false, stripe: true,
      difficulty: "Hard · petrol",
      desc: "139cc electric-start self-propelled roller. 48cm cut, big 70L box and a stripe roller for the finish.",
      spec: "139cc · 48cm cut · electric start · rear roller · 70L",
      price: 1020,
      cutWidth: 5, speed: 158, turn: 0.21,
      energy: 86, drain: 1.0,
      color: "#0c0c0c", accent: "#ffcf2b"
    },
    {
      id: "hym510spe",
      name: "HYM510SPE",
      class: "Petrol · Self-Propelled · 51cm",
      power: "petrol", electric: false,
      difficulty: "Hard · petrol",
      desc: "196cc electric-start self-propelled. 51cm cut, 1L tank and four-speed drive — a serious workhorse.",
      spec: "196cc · 51cm cut · 4-speed · 1L tank · 70L",
      price: 1350,
      cutWidth: 6, speed: 170, turn: 0.20,
      energy: 102, drain: 1.05,
      color: "#0a0a0a", accent: "#ffcf2b"
    },
    {
      id: "hym510spez",
      name: "HYM510SPEZ",
      class: "Petrol · Zero-Turn · 51cm",
      power: "petrol", electric: false,
      difficulty: "Expert · petrol",
      desc: "196cc zero-turn petrol mower. Same big 51cm deck but razor-sharp turning to thread tight gardens at speed.",
      spec: "196cc · 51cm cut · zero-turn steering · 70L",
      price: 1950,
      cutWidth: 6, speed: 196, turn: 0.34,
      energy: 102, drain: 1.1,
      color: "#080808", accent: "#ff8a00"
    },
    {
      id: "hyrm1000",
      name: "HYRM1000",
      class: "Robot Mower · 18cm",
      power: "robot", robot: true, electric: true,
      difficulty: "Special · autonomous",
      desc: "The self-charging robot. It never runs out of power — but the 18cm deck is tiny, so total coverage is the real test.",
      spec: "22.2V Li-ion · 18cm cut · self-charging · 625m²",
      price: 2600,
      cutWidth: 1, speed: 116, turn: 0.30,
      energy: INF, drain: 0,
      color: "#0b0d12", accent: "#36c0ff"
    }
  ];

  MOWERS.byId = function (id) { return MOWERS.find(m => m.id === id) || MOWERS[0]; };

  // does this machine have an unlimited power source?
  MOWERS.unlimited = function (m) { return m.mains || m.robot; };

  // normalised 0..1 stat bars for the garage UI
  MOWERS.bars = function (m) {
    return {
      speed: Math.min(1, (m.speed - 110) / 90),
      width: Math.min(1, m.cutWidth / 6),
      runtime: MOWERS.unlimited(m) ? 1 : Math.min(1, m.energy / 110),
      handling: Math.min(1, m.turn / 0.34)
    };
  };

  // extension-cable upgrade (adds reach to every corded machine)
  MOWERS.EXTENSION = { reach: 6, price: 150 };

  global.MOWERS = MOWERS;
})(window);
