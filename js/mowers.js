/* ============================================================
   mowers.js — the Hyundai "Black Range" roster
   ------------------------------------------------------------
   Stats are game-balanced interpretations of the real line-up.
   - cutWidth : deck width in game cells (wider = mows more per pass)
   - speed    : drive speed (px/sec baseline)
   - energy   : tank / battery size (seconds of run-time worth)
   - drain    : energy used per second of mowing
   - electric : true = battery (quiet, no refuel pads needed as often)
   - turn     : steering responsiveness
   ============================================================ */
(function (global) {
  "use strict";

  const MOWERS = [
    {
      id: "hym3200e",
      name: "HYM3200E",
      class: "Corded Electric",
      desc: "32cm corded starter deck. Light, nimble and unlimited 'fuel' — but a narrow cut.",
      price: 0,            // starter, owned by default
      electric: true,
      corded: true,
      cutWidth: 2,
      speed: 132,
      turn: 0.22,
      energy: 999,         // effectively unlimited (mains powered)
      drain: 0,
      color: "#1a1a1a",
      accent: "#ffcf2b"
    },
    {
      id: "hym430sp",
      name: "HYM430SP",
      class: "Petrol · Self-Propelled",
      desc: "43cm self-propelled petrol workhorse. Balanced speed and a proper tank.",
      price: 220,
      electric: false,
      cutWidth: 3,
      speed: 150,
      turn: 0.24,
      energy: 60,
      drain: 1.0,
      color: "#101010",
      accent: "#ffcf2b"
    },
    {
      id: "hym40li420",
      name: "HYM40Li420",
      class: "40V Cordless",
      desc: "42cm 40V battery mower. Quiet, brisk, and frees you from the refuel pad.",
      price: 480,
      electric: true,
      cutWidth: 3,
      speed: 162,
      turn: 0.27,
      energy: 75,
      drain: 0.85,
      color: "#161616",
      accent: "#8fd14f"
    },
    {
      id: "hym510spe",
      name: "HYM510SPE",
      class: "Petrol · Electric Start",
      desc: "51cm electric-start petrol beast. Wide cut, big tank, push-button ignition.",
      price: 760,
      electric: false,
      cutWidth: 4,
      speed: 156,
      turn: 0.20,
      energy: 95,
      drain: 1.05,
      color: "#0c0c0c",
      accent: "#ffcf2b"
    },
    {
      id: "hym80li460",
      name: "HYM80Li460",
      class: "80V Pro Cordless",
      desc: "46cm 80V pro-grade cordless. Strong, fast and refreshingly quiet.",
      price: 1150,
      electric: true,
      cutWidth: 4,
      speed: 178,
      turn: 0.30,
      energy: 105,
      drain: 0.8,
      color: "#141414",
      accent: "#8fd14f"
    },
    {
      id: "hyr1300",
      name: "HYR1300 Rider",
      class: "Ride-On Tractor",
      desc: "The flagship. A 76cm ride-on cutting deck that demolishes big lawns in record time.",
      price: 2400,
      electric: false,
      cutWidth: 6,
      speed: 196,
      turn: 0.16,
      energy: 150,
      drain: 1.2,
      color: "#0a0a0a",
      accent: "#ffcf2b",
      rider: true
    }
  ];

  // Quick lookup helpers
  MOWERS.byId = function (id) { return MOWERS.find(m => m.id === id) || MOWERS[0]; };

  // Normalised 0..1 stat bars for the garage UI
  MOWERS.bars = function (m) {
    return {
      speed: Math.min(1, (m.speed - 120) / 90),
      width: Math.min(1, m.cutWidth / 6),
      runtime: m.electric && m.corded ? 1 : Math.min(1, m.energy / 150),
      handling: Math.min(1, m.turn / 0.30)
    };
  };

  global.MOWERS = MOWERS;
})(window);
