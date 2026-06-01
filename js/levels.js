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
   - coins     : how many collectible £ coins to scatter on the grass
   - hazards   : array of { type, x, y } roaming critters (dog | goose)
   obstacle types: tree | pond | bed (flowerbed) | gnome | shed | rock
   ============================================================ */
(function (global) {
  "use strict";

  const LEVELS = [
    {
      name: "The Back Garden",
      cols: 22, rows: 15,
      target: 80, timeLimit: 0, reward: 60, coins: 8,
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
      target: 82, timeLimit: 150, reward: 95, coins: 10,
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
      target: 84, timeLimit: 170, reward: 140, coins: 12,
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
      refuel: [{ x: 26, y: 16 }],
      hazards: [{ type: "goose", x: 14, y: 9 }]
    },
    {
      name: "Manor Grounds",
      cols: 32, rows: 20,
      target: 85, timeLimit: 200, reward: 210, coins: 14,
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
      refuel: [{ x: 1, y: 18 }, { x: 30, y: 1 }],
      hazards: [{ type: "dog", x: 16, y: 10 }]
    },
    {
      name: "Riverside Park",
      cols: 34, rows: 21,
      target: 86, timeLimit: 215, reward: 270, coins: 16,
      start: { x: 1, y: 1 },
      obstacles: [
        { type: "pond", x: 0,  y: 8, w: 6, h: 5 },
        { type: "pond", x: 28, y: 8, w: 6, h: 5 },
        { type: "bed",  x: 13, y: 2, w: 8, h: 2 },
        { type: "tree", x: 10, y: 9, w: 2, h: 2 },
        { type: "tree", x: 22, y: 9, w: 2, h: 2 },
        { type: "tree", x: 16, y: 16, w: 2, h: 2 },
        { type: "rock", x: 7, y: 4, w: 2, h: 2 },
        { type: "rock", x: 25, y: 16, w: 2, h: 2 },
        { type: "gnome", x: 17, y: 6, w: 1, h: 1 }
      ],
      refuel: [{ x: 1, y: 19 }, { x: 32, y: 19 }],
      hazards: [{ type: "goose", x: 12, y: 12 }, { type: "goose", x: 24, y: 6 }]
    },
    {
      name: "The Estate Gardens",
      cols: 36, rows: 22,
      target: 88, timeLimit: 230, reward: 340, coins: 18,
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
      refuel: [{ x: 1, y: 20 }, { x: 34, y: 20 }, { x: 18, y: 11 }],
      hazards: [{ type: "dog", x: 18, y: 11 }, { type: "goose", x: 6, y: 16 }]
    },
    {
      name: "Maze Hedges",
      cols: 38, rows: 23,
      target: 88, timeLimit: 245, reward: 430, coins: 20,
      start: { x: 1, y: 1 },
      obstacles: [
        // hedge maze made of long bed strips
        { type: "bed", x: 6,  y: 3,  w: 2, h: 12 },
        { type: "bed", x: 12, y: 8,  w: 2, h: 13 },
        { type: "bed", x: 18, y: 2,  w: 2, h: 14 },
        { type: "bed", x: 24, y: 7,  w: 2, h: 14 },
        { type: "bed", x: 30, y: 3,  w: 2, h: 13 },
        { type: "tree", x: 34, y: 4, w: 2, h: 2 },
        { type: "tree", x: 2,  y: 19, w: 2, h: 2 },
        { type: "gnome", x: 9, y: 18, w: 1, h: 1 },
        { type: "gnome", x: 27, y: 4, w: 1, h: 1 }
      ],
      refuel: [{ x: 1, y: 21 }, { x: 36, y: 21 }, { x: 21, y: 1 }],
      hazards: [{ type: "dog", x: 20, y: 18 }, { type: "goose", x: 9, y: 10 }]
    },
    {
      name: "The Grand Final",
      cols: 40, rows: 24,
      target: 90, timeLimit: 260, reward: 600, coins: 24,
      start: { x: 1, y: 1 },
      obstacles: [
        { type: "pond", x: 6,  y: 4, w: 6, h: 4 },
        { type: "pond", x: 28, y: 16, w: 6, h: 4 },
        { type: "pond", x: 17, y: 10, w: 6, h: 4 },
        { type: "bed",  x: 20, y: 2, w: 8, h: 2 },
        { type: "bed",  x: 3,  y: 20, w: 8, h: 2 },
        { type: "bed",  x: 32, y: 6, w: 6, h: 2 },
        { type: "tree", x: 14, y: 5, w: 2, h: 2 },
        { type: "tree", x: 35, y: 12, w: 2, h: 2 },
        { type: "tree", x: 9,  y: 14, w: 2, h: 2 },
        { type: "rock", x: 24, y: 6, w: 2, h: 2 },
        { type: "rock", x: 13, y: 19, w: 2, h: 2 },
        { type: "gnome", x: 30, y: 3, w: 1, h: 1 },
        { type: "gnome", x: 5, y: 11, w: 1, h: 1 },
        { type: "gnome", x: 37, y: 21, w: 1, h: 1 },
        { type: "shed", x: 36, y: 1, w: 3, h: 3 }
      ],
      refuel: [{ x: 1, y: 22 }, { x: 38, y: 22 }, { x: 20, y: 7 }, { x: 20, y: 17 }],
      hazards: [{ type: "dog", x: 20, y: 12 }, { type: "dog", x: 8, y: 20 }, { type: "goose", x: 32, y: 10 }]
    }
  ];

  global.LEVELS = LEVELS;
})(window);
