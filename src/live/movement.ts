// World-space routes are shared by the live game and the practice hunt.
// Ground pets use the terrace, entrance and corridor instead of crossing walls.
export type Point = [number, number, number];
export const POSITIONS: Record<string, Point> = {
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
  maze: [14, 0, 24],
  orchard: [16, 0, 13],
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
  courtyard: [0, 0.8, 3.5],
  camp: [-3, 0, 12],
  vet: [10, 0, 12],
  nursery: [5, 0, 13],
};
export const INTERIORS: Record<string, Point> = {
  ballroom: [-7, 4.4, -4],
  dormitory: [0, 4.4, -4],
  observatory: [7, 4.4, -4],
  chapel: [-7, 7.9, -4],
  serverloft: [0, 7.9, -4],
  eyrie: [7, 7.9, -4],
  coldstorage: [-7, 0.9, -4],
  floodedcellar: [0, 0.9, -4],
  drain: [7, 0.9, -4],

  tavern: [-8.4, 0.9, -3],
  tower: [-4, 0.9, -3],
  archives: [1, 0.9, -3],
  attic: [6.5, 0.9, -6],
  vault: [6.5, 0.9, -2.7],
};
const NODES: Record<string, Point> = {
  ...POSITIONS,
  ...INTERIORS,
  fork: [0, 0, 10],
  steps: [0, 0.8, 5.8],
  terrace: [0, 0.8, 1],
  entrance: [-4, 0.9, -0.3],
  corridor: [-4, 0.9, -3.7],
  west: [-8.4, 0.9, -3.7],
  hall: [1, 0.9, -3.7],
  east: [4.6, 0.9, -3.7],
  atticDoor: [4.6, 0.9, -6],
  bellPath: [12, 0, 1],
  bellStair: [12, 0, -8],
  firstLanding: [-4, 4.4, -3.7],
  secondLanding: [-4, 7.9, -3.7],
  cellarLanding: [-4, 0.9, -4],
};
const EDGES = [
  ["camp", "fork"],
  ["fork", "steps"],
  ["steps", "courtyard"],
  ["courtyard", "terrace"],
  ["terrace", "entrance"],
  ["entrance", "corridor"],
  ["corridor", "tower"],
  ["corridor", "west"],
  ["west", "tavern"],
  ["corridor", "cellarLanding"],
  ["cellarLanding", "coldstorage"],
  ["cellarLanding", "floodedcellar"],
  ["cellarLanding", "drain"],
  ["corridor", "firstLanding"],
  ["firstLanding", "ballroom"],
  ["firstLanding", "dormitory"],
  ["dormitory", "observatory"],
  ["firstLanding", "secondLanding"],
  ["secondLanding", "chapel"],
  ["secondLanding", "serverloft"],
  ["serverloft", "eyrie"],
  ["corridor", "hall"],
  ["hall", "archives"],
  ["hall", "east"],
  ["east", "vault"],
  ["east", "atticDoor"],
  ["atticDoor", "attic"],
  ["fork", "garden"],
  ["garden", "moat"],
  ["garden", "cistern"],
  ["fork", "nursery"],
  ["nursery", "vet"],
  ["vet", "burrow"],
  ["burrow", "bellPath"],
  ["bellPath", "bellStair"],
  ["bellStair", "belfry"],
  ["west", "rookery"],
  ["garden", "glasshouse"],
  ["cistern", "lake"],
  ["lake", "boathouse"],
  ["boathouse", "pavilion"],
  ["camp", "pavilion"],
  ["pavilion", "maze"],
  ["maze", "graveyard"],
  ["graveyard", "crypt"],
  ["vet", "orchard"],
  ["orchard", "maze"],
  ["orchard", "ivory"],
];
export const distance = (a: Point, b: Point) =>
  Math.hypot(...a.map((v, i) => v - b[i]));
export type Journey = {
  points: Point[];
  lengths: number[];
  length: number;
  duration: number;
  mode: "walk" | "fly" | "swim" | "climb";
};
export function roomPoint(location: string, index = 0, count = 1): Point {
  const base = INTERIORS[location] || POSITIONS[location] || POSITIONS.camp;
  if (location === "camp") {
    const columns = Math.min(5, Math.max(1, count)),
      rows = Math.ceil(count / columns);
    return [
      base[0] + ((index % columns) - (columns - 1) / 2) * 2.4,
      base[1] + 0.95,
      base[2] + (Math.floor(index / columns) - (rows - 1) / 2) * 3.2,
    ];
  }
  const angle = (index / Math.max(count, 1)) * Math.PI * 2;
  // Spread the pack across camp; keep arrivals inside their room.
  const radius = count > 1 ? 0.85 : 0.35;
  return [
    base[0] + Math.cos(angle) * radius,
    base[1] + 0.95,
    base[2] + Math.sin(angle) * radius,
  ];
}
function groundRoute(from: string, to: string): Point[] {
  const costs = new Map<string, number>([[from, 0]]),
    parents = new Map<string, string>();
  const pending = new Set(Object.keys(NODES));
  while (pending.size) {
    const id = [...pending].sort(
      (a, b) => (costs.get(a) ?? Infinity) - (costs.get(b) ?? Infinity),
    )[0];
    if (!costs.has(id)) break;
    pending.delete(id);
    if (id === to) break;
    for (const [a, b] of EDGES) {
      const next = a === id ? b : b === id ? a : null;
      if (!next || !pending.has(next)) continue;
      const cost = costs.get(id)! + distance(NODES[id], NODES[next]);
      if (cost < (costs.get(next) ?? Infinity)) {
        costs.set(next, cost);
        parents.set(next, id);
      }
    }
  }
  const route = [to];
  while (route[0] !== from && parents.has(route[0]))
    route.unshift(parents.get(route[0])!);
  return route[0] === from
    ? route.map((id) => {
        const p = NODES[id];
        return [p[0], p[1] + 0.95, p[2]];
      })
    : [];
}
export function planJourney(
  from: string,
  to: string,
  start: Point,
  end: Point,
  speed = 4,
): Journey {
  const mode =
    ["tower", "rookery", "ivory", "observatory", "eyrie"].includes(to) ||
    ["tower", "rookery", "ivory", "observatory", "eyrie"].includes(from)
      ? "fly"
      : ["moat", "cistern", "lake", "floodedcellar"].includes(to)
        ? "swim"
        : ["archives", "belfry", "serverloft", "orchard"].includes(to)
          ? "climb"
          : "walk";
  let points: Point[];
  if (mode === "fly") {
    const height = Math.max(start[1], end[1], 7) + 2;
    points = [
      start,
      [start[0], height, start[2]],
      [end[0], height, end[2]],
      end,
    ];
  } else {
    // A new order can arrive mid-trip. Resume from the nearest route node,
    // keeping the current position instead of teleporting to the old target.
    const origin =
      distance(start, roomPoint(from)) > 2
        ? Object.keys(NODES).sort(
            (a, b) => distance(start, NODES[a]) - distance(start, NODES[b]),
          )[0]
        : from;
    const route = groundRoute(origin, to);
    points = [
      start,
      ...(origin === from ? route.slice(1, -1) : route.slice(0, -1)),
      end,
    ];
  }
  points = points.filter((p, i) => !i || distance(p, points[i - 1]) > 0.01);
  const lengths = points.slice(1).map((p, i) => distance(points[i], p));
  const length = lengths.reduce((sum, n) => sum + n, 0);
  return {
    points,
    lengths,
    length,
    duration: Math.max(1.2, length / (2.6 + speed * 0.4)),
    mode,
  };
}
export function sampleJourney(
  journey: Journey,
  elapsed: number,
): { position: Point; moving: boolean } {
  const progress = Math.max(0, Math.min(1, elapsed / journey.duration));
  if (progress === 1)
    return { position: [...journey.points.at(-1)!], moving: false };
  // Smooth take-off / braking with an otherwise distance-based gait.
  const eased = progress * progress * (3 - 2 * progress);
  let remaining = journey.length * eased;
  for (let i = 0; i < journey.lengths.length; i++) {
    const length = journey.lengths[i];
    if (remaining <= length) {
      const a = journey.points[i],
        b = journey.points[i + 1],
        f = length ? remaining / length : 1;
      return {
        position: a.map((v, j) => v + (b[j] - v) * f) as Point,
        moving: progress < 1,
      };
    }
    remaining -= length;
  }
  return { position: [...journey.points.at(-1)!], moving: false };
}

// Codex/ChatGPT pet atlas rows 1 and 2 are literal right/left running.
// Row 7 means task work, and must never be used as a walking animation.
export function spriteFrame(
  rows: 9 | 11,
  moving: boolean,
  right: boolean,
  seconds: number,
) {
  const row = moving ? (right ? 1 : 2) : 0;
  // Match the installed Codex player's frame holds, including its long idle rests.
  const durations = moving
    ? [120, 120, 120, 120, 120, 120, 120, 220]
    : [1680, 660, 660, 840, 840, 1920];
  let remaining = (seconds * 1000) % durations.reduce((a, b) => a + b, 0);
  let frame = 0;
  while (frame < durations.length - 1 && remaining >= durations[frame]) {
    remaining -= durations[frame++];
  }
  return {
    x: frame / 8,
    y: 1 - (row + 1) / rows,
    width: 1 / 8,
    height: 1 / rows,
  };
}
