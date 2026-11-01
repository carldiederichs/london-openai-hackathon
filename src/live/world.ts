// Shared rendered coordinates for routes, markers and floor selection.
export const ROOM_FLOORS: Record<string, number> = {};
export const POSITIONS: Record<string, [number, number, number]> = {
  ballroom: [-7, 4.4, -4],
  dormitory: [0, 4.4, -4],
  observatory: [7, 4.4, -4],
  chapel: [-7, 7.9, -4],
  serverloft: [0, 7.9, -4],
  eyrie: [7, 7.9, -4],
  coldstorage: [-7, 0.9, -4],
  floodedcellar: [0, 0.9, -4],
  drain: [7, 0.9, -4],
  graveyard: [20, 0, 31],
  ivory: [20, 10, 4],
  lake: [-18, 0, 24],
  boathouse: [-13, 0, 29],
  maze: [14, 0, 30],
  orchard: [16, 0, 17],
  glasshouse: [-17, 0, 13],
  pavilion: [0, 0, 31],
  cistern: [-10, 0, 14],
  rookery: [-10, 7, -7],
  burrow: [10, 0, 7],
  belfry: [10, 4, -8],
  crypt: [21, 0, 33],
  garden: [-9, 0, 8],
  tower: [-4.5, 10.4, -3],
  archives: [3.5, 4.5, 0.5],
  attic: [8.5, 7.5, -5],
  vault: [7, 0.9, 3],
  moat: [-14, 0, 3],
  tavern: [-8, 2, -0.5],
  courtyard: [4, 0.9, -42],
  camp: [-3, 0, 12],
  vet: [10, 0, 12],
  nursery: [5, 0, 13],
};
export const INTERIORS: Record<string, [number, number, number]> = {
  ballroom: [-7, 4.4, -2.3],
  dormitory: [0, 4.4, -2.3],
  observatory: [7, 4.4, -2.3],
  chapel: [-7, 7.9, -2.3],
  serverloft: [0, 7.9, -2.3],
  eyrie: [7, 7.9, -2.3],
  coldstorage: [-7, 0.9, -2.3],
  floodedcellar: [0, 0.9, -2.3],
  drain: [7, 0.9, -2.3],

  tavern: [-8.4, 0.9, -3],
  tower: [-4, 0.9, -3],
  archives: [1, 0.9, -2.3],
  attic: [6.5, 0.9, -6],
  vault: [6.5, 0.9, -2.7],
};

// Three broad wings on ONE ground floor. Front galleries and side passages
// are shared by visible geometry and the journey graph.
export const ANNEX_ROOMS = [
  "ballroom",
  "dormitory",
  "observatory",
  "chapel",
  "serverloft",
  "eyrie",
  "coldstorage",
  "floodedcellar",
  "drain",
  "kitchen",
  "music",
  "billiards",
  "orangery",
  "mailroom",
  "workshop",
  "cinema",
  "bathhouse",
  "wardrobe",
  "maproom",
  "laboratory",
  "dining",
].map((id, index) => ({
  id,
  x:
    index === 9
      ? -30
      : index === 10
        ? -18
        : index === 11
          ? 24
          : -36 + (index % 7) * 12,
  z: [9, 10, 11].includes(index) ? -5.5 : -18 - Math.floor(index / 7) * 24,
  index,
}));
for (const room of ANNEX_ROOMS) {
  POSITIONS[room.id] = [
    room.x,
    0.9,
    room.z + ([9, 10, 11].includes(room.index) ? -3 : 2),
  ];
  INTERIORS[room.id] = [
    room.x,
    0.9,
    room.z + ([9, 10, 11].includes(room.index) ? -3 : 2),
  ];
}

export const gardenPoint = ([x, y, z]: [number, number, number]): [
  number,
  number,
  number,
] => [x * 1.8, y, 5 + (z - 5) * 1.8];
for (const id of [
  "graveyard",
  "ivory",
  "lake",
  "boathouse",
  "maze",
  "orchard",
  "glasshouse",
  "pavilion",
  "cistern",
  "burrow",
  "crypt",
  "garden",
  "moat",
  "camp",
  "vet",
  "nursery",
])
  POSITIONS[id] = gardenPoint(POSITIONS[id]);
