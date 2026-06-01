/* ============================================================
   levels.js — the career gardens
   ------------------------------------------------------------
   Each level describes a lawn:
   - name      : flavour title
   - cols/rows : grass grid size (cell = CELL px)
   - target    : % of mowable grass required to pass
   - timeLimit : seconds (0 = untimed)
   - reward    : £ paid on completion
   - obstacles : array of { type, x, y, w, h } in CELL units
   - refuel    : array of { x, y } refuel-pad cells (petrol/battery top-up)
   - start     : { x, y } mower spawn cell
   obstacle types: tree | pond | bed (flowerbed) | gnome | shed
   ============================================================ */
(function (global) {
  "use strict";

  const LEVELS = [
    {
      name: "The Back Garden",
      cols: 22, rows: 15,
      target: 80, timeLimit: 0, reward: 60,
      start: { x: 2, y: 2 },
      obstacles: [
        { type: "tree", x: 6, y: 5, w: 2, h: 2 },
        { type: "bed",  x: 15, y: 3, w: 4, h: 2 },
        { type: "gnome", x: 11, y: 10, w: 1, h: 1 }
      ],
      refuel: [{ x: 20, y: 13 }]
    },
    {
      name: "Cottage Lawn",
      cols: 26, rows: 17,
      target: 82, timeLimit: 150, reward: 95,
      start: { x: 2, y: 2 },
      obstacles: [
        { type: "pond", x: 10, y: 6, w: 4, h: 3 },
        { type: "tree", x: 4, y: 11, w: 2, h: 2 },
        { type: "tree", x: 20, y: 4, w: 2, h: 2 },
        { type: "bed",  x: 17, y: 12, w: 5, h: 2 },
        { type: "gnome", x: 8, y: 2, w: 1, h: 1 }
      ],
      refuel: [{ x: 24, y: 15 }, { x: 2, y: 15 }]
    },
    {
      name: "The Orchard",
      cols: 28, rows: 18,
      target: 84, timeLimit: 170, reward: 140,
      start: { x: 1, y: 1 },
      obstacles: [
        { type: "tree", x: 5,  y: 4, w: 2, h: 2 },
        { type: "tree", x: 12, y: 4, w: 2, h: 2 },
        { type: "tree", x: 19, y: 4, w: 2, h: 2 },
        { type: "tree", x: 5,  y: 12, w: 2, h: 2 },
        { type: "tree", x: 12, y: 12, w: 2, h: 2 },
        { type: "tree", x: 19, y: 12, w: 2, h: 2 },
        { type: "shed", x: 24, y: 1, w: 3, h: 3 }
      ],
      refuel: [{ x: 26, y: 16 }]
    },
    {
      name: "Manor Grounds",
      cols: 32, rows: 20,
      target: 85, timeLimit: 200, reward: 210,
      start: { x: 1, y: 1 },
      obstacles: [
        { type: "pond", x: 13, y: 8, w: 6, h: 4 },
        { type: "bed",  x: 4,  y: 3, w: 6, h: 2 },
        { type: "bed",  x: 22, y: 15, w: 6, h: 2 },
        { type: "tree", x: 27, y: 4, w: 2, h: 2 },
        { type: "tree", x: 4,  y: 16, w: 2, h: 2 },
        { type: "gnome", x: 16, y: 3, w: 1, h: 1 },
        { type: "gnome", x: 9, y: 17, w: 1, h: 1 },
        { type: "shed", x: 28, y: 16, w: 3, h: 3 }
      ],
      refuel: [{ x: 1, y: 18 }, { x: 30, y: 1 }]
    },
    {
      name: "The Estate Final",
      cols: 36, rows: 22,
      target: 88, timeLimit: 230, reward: 320,
      start: { x: 1, y: 1 },
      obstacles: [
        { type: "pond", x: 8,  y: 5, w: 5, h: 4 },
        { type: "pond", x: 24, y: 13, w: 5, h: 4 },
        { type: "bed",  x: 16, y: 2, w: 7, h: 2 },
        { type: "bed",  x: 4,  y: 18, w: 6, h: 2 },
        { type: "tree", x: 20, y: 8, w: 2, h: 2 },
        { type: "tree", x: 30, y: 4, w: 2, h: 2 },
        { type: "tree", x: 13, y: 14, w: 2, h: 2 },
        { type: "gnome", x: 27, y: 3, w: 1, h: 1 },
        { type: "gnome", x: 5, y: 5, w: 1, h: 1 },
        { type: "gnome", x: 33, y: 19, w: 1, h: 1 },
        { type: "shed", x: 32, y: 1, w: 3, h: 3 }
      ],
      refuel: [{ x: 1, y: 20 }, { x: 34, y: 20 }, { x: 18, y: 11 }]
    }
  ];

  global.LEVELS = LEVELS;
})(window);
