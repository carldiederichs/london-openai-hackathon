import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POSITIONS,
  planJourney,
  roomPoint,
  sampleJourney,
  spriteFrame,
  distance,
} from "./movement.ts";

test("ground routes pass through the terrace and entrance rather than cutting through the façade", () => {
  const start = roomPoint("camp"),
    end = roomPoint("vault");
  const trip = planJourney("camp", "vault", start, end);
  assert.deepEqual(trip.points[0], start);
  assert.deepEqual(trip.points.at(-1), end);
  assert.ok(
    trip.points.some(
      ([x, , z]) => Math.abs(x + 4) < 0.25 && Math.abs(z + 0.3) < 0.25,
    ),
    "uses entrance",
  );
  assert.ok(
    trip.points.some(
      ([x, , z]) => Math.abs(x + 4) < 0.25 && Math.abs(z + 3.7) < 0.25,
    ),
    "uses corridor",
  );
  assert.ok(
    trip.length > distance(start, end),
    "route is longer than a wall-crossing straight line",
  );
});
test("every location can be reached, stopped exactly, and revisited", () => {
  for (const from of Object.keys(POSITIONS))
    for (const to of Object.keys(POSITIONS)) {
      const trip = planJourney(from, to, roomPoint(from), roomPoint(to));
      assert.ok(Number.isFinite(trip.duration) && trip.duration > 0);
      assert.deepEqual(sampleJourney(trip, 0).position, roomPoint(from));
      const final = sampleJourney(trip, trip.duration + 1);
      assert.deepEqual(final.position, roomPoint(to));
      assert.equal(final.moving, false);
      assert.ok(trip.points.every((point) => point.every(Number.isFinite)));
    }
});
test("flight rises above the castle, swimming has a water destination, and speed changes travel time", () => {
  const start = roomPoint("camp"),
    end = roomPoint("rookery");
  const flight = planJourney("camp", "rookery", start, end, 3);
  assert.equal(flight.mode, "fly");
  assert.ok(flight.points[1][1] > 7);
  assert.equal(
    flight.points[1][0],
    start[0],
    "takes off before crossing the building",
  );
  assert.ok(
    planJourney("camp", "rookery", start, end, 8).duration < flight.duration,
  );
  assert.equal(
    planJourney("camp", "cistern", start, roomPoint("cistern")).mode,
    "swim",
  );
  const half = sampleJourney(flight, flight.duration / 2);
  assert.ok(
    half.moving &&
      distance(half.position, start) > 1 &&
      distance(half.position, end) > 1,
  );
});
test("Codex atlas animation uses directional running rows with isolated UV cells", () => {
  for (const rows of [9, 11] as const) {
    assert.equal(spriteFrame(rows, true, true, 0).y, 1 - 2 / rows);
    assert.equal(spriteFrame(rows, true, false, 0).y, 1 - 3 / rows);
    for (let t = 0; t < 4; t += 0.025) {
      for (const moving of [false, true]) {
        const f = spriteFrame(rows, moving, true, t);
        assert.ok(f.x >= 0 && f.x + f.width <= 1);
        assert.ok(f.y >= 0 && f.y + f.height <= 1);
        if (!moving)
          assert.ok(f.x < 6 / 8, "idle never samples the empty cells");
      }
    }
  }
});

test("every gameplay room has a unique location in the single-floor estate", async () => {
  const { LIVE_LOCATIONS } = await import("./shared.ts");
  const { INTERIORS, ANNEX_ROOMS } = await import("./world.ts");
  assert.equal(LIVE_LOCATIONS.length, 42);
  assert.equal(ANNEX_ROOMS.length, 21);
  assert.equal(new Set(ANNEX_ROOMS.map((r) => `${r.x},${r.z}`)).size, 21);
  for (const location of LIVE_LOCATIONS) {
    assert.ok(POSITIONS[location.id], location.id);
    const journey = planJourney(
      "camp",
      location.id,
      roomPoint("camp"),
      roomPoint(location.id),
    );
    assert.ok(journey.floors.every((f) => f === 0));
    assert.deepEqual(
      sampleJourney(journey, journey.duration).position,
      roomPoint(location.id),
    );
  }
  assert.equal(Object.keys(INTERIORS).length, 26);
});

test("far-wing routes use the rear doorway and galleries; retargeting retains the live position", () => {
  const journey = planJourney(
    "camp",
    "dining",
    roomPoint("camp"),
    roomPoint("dining"),
  );
  assert.ok(
    journey.points.some(
      ([x, , z]) => Math.abs(x + 4) < 0.3 && Math.abs(z + 9) < 0.3,
    ),
  );
  assert.ok(journey.points.some(([, , z]) => z < -30));
  const halfway = sampleJourney(journey, journey.duration * 0.45).position;
  const next = planJourney(
    "dining",
    "bathhouse",
    halfway,
    roomPoint("bathhouse"),
  );
  assert.deepEqual(sampleJourney(next, 0).position, halfway);
  assert.deepEqual(
    sampleJourney(next, next.duration).position,
    roomPoint("bathhouse"),
  );
  // A one-frame sample cannot jump across a corridor or teleport to the target.
  assert.ok(distance(sampleJourney(next, 1 / 60).position, halfway) < 0.1);
});

test("elapsed-time travel agrees across refresh rates and has gentle starts and stops", () => {
  const trip = planJourney(
    "camp",
    "kitchen",
    roomPoint("camp"),
    roomPoint("kitchen"),
  );
  const at60 = sampleJourney(trip, 60 * (1 / 60));
  const at30 = sampleJourney(trip, 30 * (1 / 30));
  assert.deepEqual(at60, at30);
  assert.ok(
    distance(sampleJourney(trip, 1 / 60).position, roomPoint("camp")) < 0.1,
  );
  assert.ok(
    distance(
      sampleJourney(trip, trip.duration - 1 / 60).position,
      roomPoint("kitchen"),
    ) < 0.1,
  );
});

test("courtyard routes clear the fountain and enter relocated front rooms through their rear doors", () => {
  const trip = planJourney(
    "camp",
    "courtyard",
    roomPoint("camp"),
    roomPoint("courtyard"),
  );
  for (let t = 0; t <= trip.duration; t += 0.05) {
    const [x, , z] = sampleJourney(trip, t).position;
    assert.ok(Math.hypot(x, z + 42) > 3.2, "fountain clearance");
  }
  for (const id of ["kitchen", "music", "billiards"]) {
    const trip = planJourney("camp", id, roomPoint("camp"), roomPoint(id));
    const [x, , z] = roomPoint(id);
    assert.equal(z, -8.5);
    assert.ok(
      trip.points.some(
        (p) => Math.abs(p[0] - x) < 0.3 && Math.abs(p[2] + 12) < 0.3,
      ),
    );
  }
  const flight = planJourney(
    "dining",
    "ivory",
    roomPoint("dining"),
    roomPoint("ivory"),
  );
  assert.ok(flight.points[1][1] > 30, "flies above the tallest keep");
});
