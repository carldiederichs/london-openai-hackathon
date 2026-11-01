// Max's elapsed-time journeys, extended to the whole single-floor estate.
import {
  POSITIONS,
  INTERIORS,
  ROOM_FLOORS,
  ANNEX_ROOMS,
  gardenPoint,
} from "./world.ts";
export { POSITIONS, INTERIORS, ROOM_FLOORS } from "./world.ts";
export type Point = [number, number, number];
export const distance = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const NODES: Record<string, Point> = {
  ...POSITIONS,
  ...INTERIORS,
  fork: [0, 0, 16],
  steps: [0, 0.8, 5.8],
  terrace: [0, 0.8, 1],
  entrance: [-4, 0.9, -0.3],
  corridor: [-4, 0.9, -3.7],
  west: [-8.4, 0.9, -3.7],
  hall: [1, 0.9, -3.7],
  east: [4.6, 0.9, -3.7],
  atticDoor: [4.6, 0.9, -6],
  gardenGate: [-8, 0, 12.8],
  gardenDoor: [-6, 0, 8],
  westWalk: [-12, 0, 19],
  westBridge: [-17, 0, 19],
  lakeBank: [-13, 0, 24],
  southWest: [-13, 0, 31],
  south: [0, 0, 31],
  southEast: [14, 0, 31],
  eastWalk: [22, 0, 19],
  orchardWalk: [22, 0, 13],
  ivoryFoot: [22, 0, 4],
  bellPath: [12, 0, 1],
  bellStair: [12, 0, -8],
  nurseryDoor: [5, 0, 15],
  vetDoor: [11, 0, 14],
};
for (const id of [
  "fork",
  "gardenGate",
  "gardenDoor",
  "westWalk",
  "westBridge",
  "lakeBank",
  "southWest",
  "south",
  "southEast",
  "eastWalk",
  "orchardWalk",
  "ivoryFoot",
  "nurseryDoor",
  "vetDoor",
])
  NODES[id] = gardenPoint(NODES[id]);
const EDGES: [string, string][] = [
  ["camp", "fork"],
  ["camp", "steps"],
  ["steps", "terrace"],
  ["terrace", "entrance"],
  ["entrance", "corridor"],
  ["corridor", "tower"],
  ["corridor", "west"],
  ["west", "tavern"],
  ["corridor", "hall"],
  ["hall", "archives"],
  ["hall", "east"],
  ["east", "vault"],
  ["east", "atticDoor"],
  ["atticDoor", "attic"],
  ["camp", "gardenGate"],
  ["gardenGate", "gardenDoor"],
  ["gardenDoor", "garden"],
  ["gardenGate", "cistern"],
  ["gardenGate", "westWalk"],
  ["westWalk", "westBridge"],
  ["westBridge", "glasshouse"],
  ["westWalk", "lakeBank"],
  ["lakeBank", "lake"],
  ["lakeBank", "boathouse"],
  ["boathouse", "southWest"],
  ["southWest", "south"],
  ["south", "pavilion"],
  ["fork", "south"],
  ["south", "southEast"],
  ["southEast", "maze"],
  ["southEast", "graveyard"],
  ["graveyard", "crypt"],
  ["graveyard", "eastWalk"],
  ["fork", "eastWalk"],
  ["eastWalk", "orchardWalk"],
  ["orchardWalk", "orchard"],
  ["orchardWalk", "ivoryFoot"],
  ["ivoryFoot", "ivory"],
  ["ivoryFoot", "bellPath"],
  ["fork", "nurseryDoor"],
  ["nurseryDoor", "nursery"],
  ["nurseryDoor", "vetDoor"],
  ["vetDoor", "vet"],
  ["vetDoor", "burrow"],
  ["burrow", "bellPath"],
  ["bellPath", "bellStair"],
  ["bellStair", "belfry"],
  ["westBridge", "moat"],
  ["moat", "rookery"],
  ["corridor", "rearDoor"],
];
NODES.rearDoor = [-4, 0.9, -9];
const FLOORS: Record<string, number> = {};
for (let row = 0; row < 3; row++) {
  const z = -12 - row * 24;
  for (let col = 0; col <= 7; col++) {
    const id = `hall-${row}-${col}`;
    NODES[id] = [-42 + col * 12, 0.9, z];
    if (col) EDGES.push([`hall-${row}-${col - 1}`, id]);
    if (row) EDGES.push([`hall-${row - 1}-${col}`, id]);
  }
}
NODES.rearJoin = [-6, 0.9, -9];
EDGES.push(["rearDoor", "rearJoin"], ["rearJoin", "hall-0-3"]);
for (const room of ANNEX_ROOMS) {
  const row = Math.floor(room.index / 7),
    col = room.index % 7,
    door = room.id + "Door";
  NODES[room.id] = INTERIORS[room.id];
  if ([9, 10, 11].includes(room.index)) {
    NODES[door] = [room.x, 0.9, -12];
    const nearest = Math.round((room.x + 42) / 12);
    EDGES.push([`hall-0-${nearest}`, door], [door, room.id]);
  } else {
    NODES[door] = [room.x, 0.9, room.z + 6];
    EDGES.push(
      [`hall-${row}-${col}`, door],
      [door, `hall-${row}-${col + 1}`],
      [door, room.id],
    );
  }
}
NODES.courtNorth = [4, 0.9, -36];
NODES.courtSouth = [4, 0.9, -48];
EDGES.push(
  ["hall-1-3", "courtNorth"],
  ["courtNorth", "courtyard"],
  ["courtyard", "courtSouth"],
  ["courtSouth", "hall-2-4"],
);
const point = (id: string): Point => {
  const p = NODES[id];
  return [p[0], p[1] + 0.95, p[2]];
};
const floorOf = (id: string) => FLOORS[id] ?? 0;
const routeCache = new Map<string, string[]>();
function groundRoute(from: string, to: string): string[] {
  const key = from + ":" + to,
    cached = routeCache.get(key);
  if (cached) return cached;
  const costs = new Map([[from, 0]]),
    parents = new Map<string, string>();
  const pending = new Set(Object.keys(NODES));
  while (pending.size) {
    let id: string | undefined,
      best = Infinity;
    for (const candidate of pending) {
      const cost = costs.get(candidate) ?? Infinity;
      if (cost < best) {
        best = cost;
        id = candidate;
      }
    }
    if (!id) break;
    pending.delete(id);
    if (id === to) break;
    for (const [a, b] of EDGES) {
      const next = a === id ? b : b === id ? a : null;
      if (!next || !pending.has(next)) continue;
      // Every edge has a positive cost, including co-located doorway nodes.
      const cost = best + Math.max(0.1, distance(NODES[id], NODES[next]));
      if (cost < (costs.get(next) ?? Infinity)) {
        costs.set(next, cost);
        parents.set(next, id);
      }
    }
  }
  const route = [to];
  while (route[0] !== from && parents.has(route[0]))
    route.unshift(parents.get(route[0])!);
  if (route[0] !== from)
    throw new Error(`Missing castle route: ${from} → ${to}`);
  routeCache.set(key, route);
  return route;
}
export type Journey = {
  points: Point[];
  floors: number[];
  lengths: number[];
  length: number;
  duration: number;
  mode: "walk" | "fly" | "swim" | "climb";
};
export function roomPoint(location: string, index = 0, count = 1): Point {
  const base = INTERIORS[location] || POSITIONS[location];
  if (!base) throw new Error(`Unknown castle location: ${location}`);
  if (location === "camp") {
    const columns = Math.min(5, Math.max(1, count)),
      rows = Math.ceil(count / columns);
    return [
      base[0] + ((index % columns) - (columns - 1) / 2) * 1.6,
      base[1] + 0.95,
      base[2] + (Math.floor(index / columns) - (rows - 1) / 2) * 1.8,
    ];
  }
  const angle = (index / Math.max(count, 1)) * Math.PI * 2,
    radius = count > 1 ? 0.65 : 0;
  return [
    base[0] + Math.cos(angle) * radius,
    base[1] + 0.95,
    base[2] + Math.sin(angle) * radius,
  ];
}
export function planJourney(
  from: string,
  to: string,
  start: Point,
  end: Point,
  speed = 4,
  startFloor = ROOM_FLOORS[from] ?? 0,
): Journey {
  if (!NODES[from] || !NODES[to])
    throw new Error(`Unknown castle route: ${from} → ${to}`);
  const air = ["rookery", "ivory"];
  const water = ["moat", "cistern", "lake", "floodedcellar", "bathhouse"];
  const mode =
    air.includes(to) || air.includes(from)
      ? "fly"
      : water.includes(to) || water.includes(from)
        ? "swim"
        : ["archives", "belfry", "serverloft", "orchard", "workshop"].includes(
              to,
            )
          ? "climb"
          : "walk";
  let points: Point[], floors: number[];
  if (mode === "fly") {
    const height = Math.max(start[1], end[1], 30) + 2;
    points = [
      start,
      [start[0], height, start[2]],
      [end[0], height, end[2]],
      end,
    ];
    floors = [
      startFloor,
      startFloor,
      ROOM_FLOORS[to] ?? 0,
      ROOM_FLOORS[to] ?? 0,
    ];
  } else {
    let origin = from,
      approach: Point[] = [];
    if (distance(start, roomPoint(from)) > 1.8) {
      // Retarget on the nearest corridor/path segment, not a straight shortcut
      // to an arbitrary room. Respect the actor's currently traversed floor.
      let nearest = Infinity;
      for (const [a, b] of EDGES) {
        if (floorOf(a) !== startFloor || floorOf(b) !== startFloor) continue;
        const pa = point(a),
          pb = point(b),
          len = distance(pa, pb) ** 2;
        const t = len
          ? Math.max(
              0,
              Math.min(
                1,
                ((start[0] - pa[0]) * (pb[0] - pa[0]) +
                  (start[1] - pa[1]) * (pb[1] - pa[1]) +
                  (start[2] - pa[2]) * (pb[2] - pa[2])) /
                  len,
              ),
            )
          : 0;
        const projection = pa.map((v, i) => v + (pb[i] - v) * t) as Point;
        const gap = distance(start, projection);
        if (gap < nearest) {
          nearest = gap;
          origin = t < 0.5 ? a : b;
          approach = [projection, point(origin)];
        }
      }
    }
    const route = groundRoute(origin, to);
    points = [start, ...approach, ...route.slice(1, -1).map(point), end];
    floors = [
      startFloor,
      ...approach.map(() => startFloor),
      ...route.slice(1, -1).map(floorOf),
      ROOM_FLOORS[to] ?? 0,
    ];
  }
  const keep = points
    .map((_, i) => i)
    .filter(
      (i) =>
        !i ||
        distance(points[i], points[i - 1]) > 0.001 ||
        floors[i] !== floors[i - 1],
    );
  points = keep.map((i) => points[i]);
  floors = keep.map((i) => floors[i]);
  const curved: Point[] = [points[0]],
    curvedFloors = [floors[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1];
    const radius = Math.min(0.22, distance(a, b) / 4, distance(b, c) / 4);
    if (radius < 0.01 || a[1] !== b[1] || b[1] !== c[1]) {
      curved.push(b);
      curvedFloors.push(0);
      continue;
    }
    const enter = b.map(
      (v, k) => v + ((a[k] - v) * radius) / distance(a, b),
    ) as Point;
    const leave = b.map(
      (v, k) => v + ((c[k] - v) * radius) / distance(b, c),
    ) as Point;
    for (let n = 0; n <= 6; n++) {
      const t = n / 6;
      curved.push(
        enter.map(
          (v, k) =>
            (1 - t) ** 2 * v + 2 * (1 - t) * t * b[k] + t * t * leave[k],
        ) as Point,
      );
      curvedFloors.push(0);
    }
  }
  if (points.length > 1) {
    curved.push(points.at(-1)!);
    curvedFloors.push(0);
  }
  points = curved;
  floors = curvedFloors;
  const lengths = points.slice(1).map((p, i) => distance(points[i], p)),
    length = lengths.reduce((s, n) => s + n, 0);
  return {
    points,
    floors,
    lengths,
    length,
    duration: Math.max(
      0.2,
      length / (2.6 + Math.max(1, Math.min(8, speed)) * 0.4),
    ),
    mode,
  };
}
export function sampleJourney(
  journey: Journey,
  elapsed: number,
): { position: Point; moving: boolean; floor: number } {
  const progress = Math.max(0, Math.min(1, elapsed / journey.duration));
  if (progress === 1)
    return {
      position: [...journey.points.at(-1)!],
      moving: false,
      floor: journey.floors.at(-1)!,
    };
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
        floor: journey.floors[f < 0.5 ? i : i + 1],
      };
    }
    remaining -= length;
  }
  return {
    position: [...journey.points.at(-1)!],
    moving: false,
    floor: journey.floors.at(-1)!,
  };
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
  const frame = Math.floor(seconds * (moving ? 12 : 6)) % (moving ? 8 : 6);
  return {
    x: frame / 8,
    y: 1 - (row + 1) / rows,
    width: 1 / 8,
    height: 1 / rows,
  };
}
