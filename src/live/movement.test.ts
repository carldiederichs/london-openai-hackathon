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
    trip.points.some(([x, , z]) => x === -4 && z === -0.3),
    "uses entrance",
  );
  assert.ok(
    trip.points.some(([x, , z]) => x === -4 && z === -3.7),
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
