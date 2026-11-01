import { test } from "node:test";
import assert from "node:assert/strict";
import { Rooms } from "./rooms.ts";
import { createBrain } from "./brain.ts";
import {
  navigationPoints,
  steerOnPaths,
  roomPoint,
} from "../src/live/movement.ts";
const points = navigationPoints();
async function setup(count = 3) {
  let now = 1000;
  const rooms = new Rooms(
      createBrain(undefined),
      () => {},
      () => now,
    ),
    host = rooms.create("realtime");
  const players = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      rooms.join(host.roomCode, {
        name: `Pet ${i}`,
        description: "owl",
        companionId: i % 2 ? "dewey" : "hoots",
      }),
    ),
  );
  await rooms.start(host);
  return {
    rooms,
    host,
    players,
    room: rooms.get(host.roomCode),
    setNow: (n: number) => {
      now = n;
    },
    advance: (ms: number) => {
      now += ms;
      rooms.tick();
    },
  };
}
test("real-time capacity is 300 and built-in pets avoid model/image duplication", async () => {
  const { rooms, host, players, room } = await setup(300);
  assert.equal(players.length, 300);
  assert.equal(room.images.size, 0);
  assert.equal(room.pets[0].image, "/pets/hoots.webp");
  await assert.rejects(
    rooms.join(host.roomCode, { name: "Overflow", description: "cat" }),
    /300/,
  );
  const state = rooms.public(host.roomCode);
  assert.equal(state.playerCount, 300);
  assert.equal(state.reveal, null);
  assert.ok(!("dot" in state));
});
test("direction input is authoritative, expiring and generation checked", async () => {
  const { rooms, host, players, room, advance } = await setup(1),
    pet = room.pets[0],
    start = [...pet.position!];
  assert.throws(
    () => rooms.steer(host, { dx: 1, dz: 0, seq: 1, generation: 1 }),
    /closed/,
  );
  assert.throws(
    () => rooms.steer(players[0], { dx: 999, dz: 0, seq: 1, generation: 1 }),
    /Invalid/,
  );
  assert.throws(
    () => rooms.steer(players[0], { dx: 1, dz: 0, seq: 1, generation: 0 }),
    /Invalid/,
  );
  rooms.steer(players[0], { dx: 1, dz: 0, seq: 1, generation: 1 });
  advance(100);
  assert.notDeepEqual(pet.position, start);
  assert.ok(pet.moving);
  advance(400);
  const stopped = [...pet.position!];
  advance(100);
  assert.deepEqual(pet.position, stopped);
  assert.equal(pet.moving, false);
});
test("the Dot stays hidden and arrival ends the game immediately", async () => {
  const { rooms, players, host, room, advance } = await setup(1),
    pet = room.pets[0];
  room.dot = "garden";
  room.cursors.set(pet.id, { node: "gardenDoor", progress: 0 });
  pet.position = points.gardenDoor;
  const state = rooms.public(host.roomCode);
  assert.equal(state.reveal, null);
  assert.equal(state.clue, null);
  for (let i = 0; i < 30 && room.phase !== "over"; i++) {
    rooms.steer(players[0], { dx: -1, dz: 0, seq: i, generation: 1 });
    advance(100);
  }
  assert.equal(room.outcome, "found");
  assert.deepEqual(room.winnerPetIds, [pet.id]);
  assert.equal(room.phase, "over");
  assert.equal(rooms.public(host.roomCode).reveal?.location, "garden");
});
test("at a minute only the highest remaining usage wins, with exact ties shared", async () => {
  const { rooms, room, setNow } = await setup(3);
  room.pets[0].usage = 30;
  room.pets[1].usage = 70;
  room.pets[2].usage = 70;
  setNow(room.endsAt!);
  rooms.tick();
  assert.deepEqual(
    room.winnerPetIds,
    room.pets.slice(1).map((p) => p.id),
  );
});
test("directional routes obey room gates and cannot cross walls", () => {
  const blocked = steerOnPaths(
    { node: "nurseryDoor", progress: 0 },
    0,
    -1,
    10,
    (id) => id !== "nursery",
  );
  assert.ok(!blocked.arrived.includes("nursery"));
  const travel = steerOnPaths(
    { node: "nurseryDoor", progress: 0 },
    0,
    -1,
    2,
    () => true,
  );
  assert.equal(travel.cursor.to, "nursery");
  assert.ok(travel.position.every(Number.isFinite));
  const back = steerOnPaths(travel.cursor, 0, 1, 2, () => true);
  assert.deepEqual(back.position, points.nurseryDoor);
});
test("two nursery approach reservations reject a third and merge after arrival", async () => {
  const { rooms, players, room, advance } = await setup(3);
  room.pets.forEach((p) => {
    room.cursors.set(p.id, { node: "nurseryDoor", progress: 0 });
    p.position = points.nurseryDoor;
  });
  for (let i = 0; i < 50; i++) {
    players.forEach((session, n) =>
      rooms.steer(session, { dx: 0, dz: -1, seq: i, generation: 1 }),
    );
    advance(100);
  }
  assert.equal(room.pets.filter((p) => p.location === "nursery").length, 2);
  assert.equal(room.pets[2].location, "camp");
  for (let i = 0; i < 90; i++) advance(100);
  assert.equal(room.pets.length, 2);
  assert.ok(room.pets.find((p) => p.baby)?.coOwnerIds?.length);
});
test("care routes reach the vet and nursery without crossing walls", async () => {
  const { rooms, players, room, advance } = await setup(2);
  room.dot = "library";
  room.pets[0].usage = 30;
  rooms.destination(players[0], { location: "vet", generation: 1 });
  for (let i = 0; i < 200 && room.pets[0].location !== "vet"; i++) advance(50);
  assert.equal(room.pets[0].location, "vet");
  assert.ok(room.pets[0].usage > 65);
  rooms.destination(players[0], { location: "nursery", generation: 1 });
  rooms.destination(players[1], { location: "nursery", generation: 1 });
  for (let i = 0; i < 600 && room.pets.length === 2; i++) advance(50);
  assert.equal(room.pets.length, 1);
  assert.equal(room.pets[0].location, "nursery");
  assert.equal(room.destinations.size, 0);
});
test("real-time rooms reject legacy turn commands", async () => {
  const { rooms, players, host } = await setup(1);
  assert.throws(() => rooms.submit(players[0], {}, 1, 1), /real-time/);
  await assert.rejects(rooms.resolve(host, 1, 1), /rounds/);
  await assert.rejects(rooms.next(host), /rounds/);
});
test("host stop freezes the deadline, movement, usage and mating until resume", async () => {
  const { rooms, players, host, room, advance } = await setup(2);
  room.dot = "library";
  room.pets.forEach((p) => {
    p.location = "nursery";
    p.position = roomPoint("nursery");
    p.mating = { arrivesAt: 1000, finishesAt: 9000 };
  });
  const originalEnd = room.endsAt!;
  assert.throws(() => rooms.pause(players[0], true), /host/i);
  rooms.pause(host, true);
  const snapshot = structuredClone(room.pets);
  advance(70_000);
  assert.equal(room.phase, "seeking");
  assert.deepEqual(room.pets, snapshot);
  assert.throws(
    () => rooms.steer(players[0], { dx: 1, dz: 0, seq: 1, generation: 1 }),
    /closed/,
  );
  assert.throws(
    () => rooms.destination(players[0], { location: "vet", generation: 1 }),
    /closed/,
  );
  rooms.pause(host, false);
  assert.equal(room.endsAt, originalEnd + 70_000);
  assert.equal(room.pets[0].mating?.finishesAt, 79_000);
  advance(7900);
  assert.equal(room.pets.length, 2);
  advance(100);
  assert.equal(room.pets.length, 1);
});
test("care routing recovers from manual steering with irregular tick durations", async () => {
  const { rooms, players, room, advance } = await setup(2);
  room.dot = "library";
  for (let i = 0; i < 29; i++) {
    rooms.steer(players[0], { dx: 1, dz: 0, seq: i, generation: 1 });
    rooms.steer(players[1], { dx: -1, dz: 0, seq: i, generation: 1 });
    advance(53);
  }
  players.forEach((p) =>
    rooms.destination(p, { location: "nursery", generation: 1 }),
  );
  for (let i = 0; i < 600 && room.pets.length === 2; i++)
    advance([47, 53, 61, 49][i % 4]);
  assert.equal(room.pets.length, 1);
  assert.equal(room.pets[0].location, "nursery");
});
test("phone movement stays locked until the host starts the shared deadline", async () => {
  let now = 1000;
  const rooms = new Rooms(
      createBrain(undefined),
      () => {},
      () => now,
    ),
    host = rooms.create("realtime");
  const player = await rooms.join(host.roomCode, {
    name: "Ready",
    description: "owl",
    companionId: "hoots",
  });
  const room = rooms.get(host.roomCode),
    original = structuredClone(room.pets);
  assert.throws(
    () => rooms.steer(player, { dx: 1, dz: 0, seq: 1, generation: 1 }),
    /closed/,
  );
  now += 2000;
  rooms.tick();
  assert.deepEqual(room.pets, original);
  assert.equal(room.endsAt, null);
  await rooms.start(host);
  assert.equal(rooms.public(host.roomCode).endsAt, now + 60000);
  rooms.steer(player, { dx: 1, dz: 0, seq: 2, generation: 1 });
  now += 50;
  rooms.tick();
  assert.notDeepEqual(room.pets[0].position, original[0].position);
});
test("one in nine players gets a secret traitor role and restart clears roles", async () => {
  const { rooms, host, players, room } = await setup(18);
  assert.equal(room.traitorPlayerIds.length, 2);
  assert.equal(
    players.filter(
      (p) => rooms.roleFor(host.roomCode, p.playerId!) === "traitor",
    ).length,
    2,
  );
  assert.equal(rooms.public(host.roomCode).yourRole, undefined);
  assert.ok(!("traitorPlayerIds" in rooms.public(host.roomCode)));
  rooms.restart(host);
  assert.deepEqual(room.traitorPlayerIds, []);
  assert.equal(rooms.roleFor(host.roomCode, players[0].playerId!), undefined);
});
test("traitor collisions ban one seeker, move it to the graveyard and block further actions", async () => {
  const { rooms, host, players, room, advance } = await setup(9);
  room.traitorPlayerIds = [players[0].playerId!];
  room.dot = "library";
  const attacker = room.pets[0],
    victim = room.pets[1];
  for (const pet of [attacker, victim]) {
    pet.location = "courtyard";
    pet.position = roomPoint("courtyard");
    room.cursors.set(pet.id, { node: "courtyard", progress: 0 });
  }
  rooms.steer(players[0], { dx: 0, dz: 1, seq: 1, generation: 1 });
  advance(50);
  assert.equal(victim.usage, 0);
  assert.ok(victim.bannedAt);
  assert.equal(victim.location, "graveyard");
  assert.equal(room.destinations.has(victim.id), false);
  assert.throws(
    () => rooms.destination(players[1], { location: "vet", generation: 1 }),
    /cannot move/,
  );
  assert.ok(
    room.events.some((e) => e.text.includes("banned for distillation")),
  );
  rooms.restart(host);
  assert.ok(room.pets.every((p) => !p.bannedAt && p.usage === 100));
});
test("base camp and stopped games are safe from traitor collisions", async () => {
  const { rooms, host, players, room, advance } = await setup(9);
  room.traitorPlayerIds = [players[0].playerId!];
  rooms.steer(players[0], { dx: 1, dz: 0, seq: 1, generation: 1 });
  advance(50);
  assert.ok(room.pets.every((p) => !p.bannedAt));
  rooms.pause(host, true);
  advance(3000);
  assert.ok(room.pets.every((p) => !p.bannedAt));
});
