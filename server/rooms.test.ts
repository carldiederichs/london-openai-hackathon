import { test } from "node:test";
import assert from "node:assert/strict";
import { io as connect, type Socket } from "socket.io-client";
import { once } from "node:events";
import { createBrain, fallbackCard, type Brain } from "./brain.ts";
import { MATING_DURATION_MS } from "../src/live/mating.ts";
import { ownsPet } from "../src/live/shared.ts";
import { Rooms, toddStats } from "./rooms.ts";
import { createGameServer } from "./index.ts";
import {
  accessible,
  balanceStats,
  MAX_PLAYERS,
  STAT_KEYS,
  type Session,
} from "../src/live/shared.ts";
import { ROOM_LORE } from "../src/live/lore.ts";

function brain(): Brain {
  return {
    configured: false,
    model: "test",
    card: async (input) => fallbackCard(input),
    move: async (_pet, prompt) => ({
      locationId: prompt,
      valid: true,
      narration: "A test move.",
      mode: "fallback",
    }),
    hide: async (_stats, allowed) => ({
      locationId: allowed.includes("garden") ? "garden" : allowed[0],
      summary: "A fictional replay.",
      claim: "Nothing to see here.",
      mode: "fallback",
    }),
  };
}
test("Codex sprite layout survives joining and public state without changing the card budget", async () => {
  const rooms = new Rooms(brain()),
    host = rooms.create();
  const image = "data:image/png;base64,iVBORw0KGgo=";
  await assert.rejects(
    rooms.join(host.roomCode, {
      name: "Invalid",
      description: "owl",
      image,
      spriteRows: 10 as 9,
    }),
    /supported/,
  );
  await assert.rejects(
    rooms.join(host.roomCode, {
      name: "Missing",
      description: "owl",
      spriteRows: 9,
    }),
    /supported/,
  );
  for (const spriteRows of [9, 11] as const) {
    await rooms.join(host.roomCode, {
      name: `Atlas ${spriteRows}`,
      description: "a flying owl",
      image,
      spriteRows,
    });
  }
  const pets = rooms.public(host.roomCode).pets;
  assert.deepEqual(
    pets.map((p) => p.spriteRows),
    [9, 11],
  );
  for (const pet of pets) {
    assert.equal(
      Object.values(pet.stats).reduce((sum, n) => sum + n),
      20,
    );
    assert.ok(pet.image?.startsWith(`/api/rooms/${host.roomCode}/pets/`));
  }
});
async function setup(count = 2) {
  const model = brain(),
    rooms = new Rooms(model),
    host = rooms.create();
  const players = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      rooms.join(host.roomCode, {
        name: `Pet${i}`,
        description: "a tiny flying owl",
      }),
    ),
  );
  return { rooms, model, host, players, room: rooms.get(host.roomCode) };
}
test("lobby capacity, identity, room isolation and public secret filtering", async () => {
  const { rooms, host, players, room } = await setup(MAX_PLAYERS);
  await assert.rejects(
    rooms.join(host.roomCode, { name: "Extra", description: "cat" }),
    new RegExp(String(MAX_PLAYERS)),
  );
  assert.throws(
    () => rooms.authenticate(rooms.create().roomCode, players[0].token),
    /cannot/,
  );
  await assert.rejects(rooms.start(players[0]), /host/);
  await rooms.start(host);
  const pub = rooms.public(room.code),
    json = JSON.stringify(pub);
  for (const secret of [host.token, ...players.map((p) => p.token)])
    assert.ok(!json.includes(secret));
  assert.equal(pub.reveal, null);
  assert.ok(!("dot" in pub));
  assert.ok(!("traps" in pub));
  assert.ok(!("submissions" in pub));
  const signature = (s: typeof room.hiderStats) =>
    STAT_KEYS.filter((k) => s[k] >= 5).join(",");
  assert.ok(
    room.pets.every((p) => signature(p.stats) !== signature(room.hiderStats)),
  );
  assert.equal(
    Object.values(room.hiderStats).reduce((a, b) => a + b),
    20,
  );
  assert.ok(accessible({ stats: room.hiderStats }, room.dot));
  assert.ok(room.pets.some((p) => accessible(p, room.dot)));
  assert.throws(
    () =>
      rooms.submit(
        players[0],
        { type: "seek", petId: room.pets[1].id, prompt: "garden" },
        1,
        1,
      ),
    /your/,
  );
  assert.throws(
    () =>
      rooms.submit(
        players[0],
        { type: "seek", petId: room.pets[0].id, prompt: "garden" },
        0,
        1,
      ),
    /closed/,
  );
  rooms.submit(
    players[0],
    { type: "seek", petId: room.pets[0].id, prompt: "garden" },
    1,
    1,
  );
  assert.throws(
    () =>
      rooms.submit(players[0], { type: "vet", petId: room.pets[0].id }, 1, 1),
    /locked/,
  );
  assert.ok(!JSON.stringify(rooms.public(room.code)).includes('"prompt"'));
});
test("capture, duplicate resolution protection, restart and stale generation", async () => {
  const { rooms, host, players, room } = await setup();
  await rooms.start(host);
  rooms.submit(
    players[0],
    { type: "seek", petId: room.pets[0].id, prompt: "garden" },
    1,
    1,
  );
  const resolving = rooms.resolve(host, 1, 1);
  await assert.rejects(rooms.resolve(host, 1, 1), /already/);
  await resolving;
  assert.equal(room.outcome, null);
  assert.equal(room.phase, "results");
  assert.equal(room.pets[0].usage, 90);
  assert.equal(rooms.public(room.code).reveal?.location, "garden");
  rooms.restart(host);
  assert.equal(room.generation, 2);
  assert.equal(room.pets[0].usage, 100);
  await rooms.start(host);
  assert.throws(
    () =>
      rooms.submit(
        players[0],
        { type: "seek", petId: room.pets[0].id, prompt: "garden" },
        1,
        1,
      ),
    /closed/,
  );
});
test("traps are consumed once, reset caps usage, vet works at zero, illegal AI moves spend nothing", async () => {
  const { rooms, host, players, room } = await setup(3);
  await rooms.start(host);
  room.dot = "garden";
  room.traps = ["tavern"];
  room.reset = "courtyard";
  room.pets[2].usage = 30;
  players.forEach((p, i) =>
    rooms.submit(
      p,
      {
        type: "seek",
        petId: room.pets[i].id,
        prompt: i === 2 ? "courtyard" : "tavern",
      },
      1,
      1,
    ),
  );
  await rooms.resolve(host, 1, 1);
  assert.deepEqual(
    room.pets
      .slice(0, 2)
      .map((p) => p.usage)
      .sort(),
    [65, 90],
  );
  assert.equal(room.pets.filter((p) => p.tipsy).length, 1);
  assert.equal(room.pets[2].effect?.kind, "reset");
  assert.equal(room.pets[2].tipsy, false);
  assert.equal(room.pets[2].usage, 100);
  assert.equal(room.reset, null);
  await rooms.next(host);
  room.pets[0].usage = 0;
  rooms.submit(players[0], { type: "vet", petId: room.pets[0].id }, 2, 1);
  rooms.submit(
    players[1],
    { type: "seek", petId: room.pets[1].id, prompt: "🌷" },
    2,
    1,
  );
  const before = room.pets[1].usage;
  await rooms.resolve(host, 2, 1);
  assert.equal(room.pets[0].usage, 50);
  assert.equal(room.pets[0].tipsy, false);
  assert.equal(room.pets[0].effect?.kind, "vet");
  assert.equal(room.pets[1].usage, before);
});
test("two reserved places, arrival then duvet, shared merged pet and original-pet restart", async () => {
  let now = 1000;
  const rooms = new Rooms(
      brain(),
      () => {},
      () => now,
    ),
    host = rooms.create();
  const players = await Promise.all(
    ["A", "B", "C"].map((name) =>
      rooms.join(host.roomCode, { name, description: "cat" }),
    ),
  );
  const room = rooms.get(host.roomCode),
    originals = room.pets.map((p) => p.id);
  await rooms.start(host);
  for (let i = 0; i < 2; i++)
    rooms.submit(players[i], { type: "breed", petId: originals[i] }, 1, 1);
  assert.throws(
    () =>
      rooms.submit(players[2], { type: "breed", petId: originals[2] }, 1, 1),
    /only two/,
  );
  await rooms.resolve(host, 1, 1);
  assert.equal(room.pets.filter((p) => p.location === "nursery").length, 2);
  assert.equal(room.pets[0].effect, undefined);
  now = Math.max(...room.pets.slice(0, 2).map((p) => p.mating!.arrivesAt)) + 1;
  rooms.tick();
  assert.ok(room.pets.slice(0, 2).every((p) => p.effect?.kind === "breed"));
  await rooms.next(host);
  assert.throws(
    () => rooms.submit(players[0], { type: "vet", petId: originals[0] }, 2, 1),
    /duvet/,
  );
  now += MATING_DURATION_MS - 1;
  rooms.tick();
  assert.equal(room.pets.length, 3);
  now++;
  rooms.tick();
  assert.equal(room.pets.length, 2);
  const child = room.pets.find((p) => p.baby)!;
  assert.ok(child && !originals.includes(child.id));
  assert.ok(
    ownsPet(child, players[0].playerId) && ownsPet(child, players[1].playerId),
  );
  assert.equal(
    Object.values(child.stats).reduce((a, b) => a + b),
    20,
  );
  assert.equal(child.usage, 100);
  assert.equal(child.image, undefined);
  assert.equal(child.spriteRows, undefined);
  rooms.submit(
    players[1],
    { type: "seek", petId: child.id, prompt: "🌱" },
    2,
    1,
  );
  assert.equal(Object.keys(room.submissions).length, 2);
  assert.throws(
    () =>
      rooms.submit(
        players[0],
        { type: "seek", petId: child.id, prompt: "🌱" },
        2,
        1,
      ),
    /locked/,
  );
  await rooms.resolve(host, 2, 1);
  assert.equal(child.usage, 100); // invalid test-brain location: no spend, once only
  rooms.restart(host);
  assert.deepEqual(
    room.pets.map((p) => p.id),
    originals,
  );
  assert.ok(room.pets.every((p) => p.location === "camp" && !p.mating));
  assert.deepEqual(
    room.players.map((p) => p.petId),
    originals,
  );
});
test("one pet can wait alone then leave; expiry cannot finish a pending merge", async () => {
  let now = 1000;
  const rooms = new Rooms(
      brain(),
      () => {},
      () => now,
    ),
    host = rooms.create();
  const players = await Promise.all(
    ["A", "B"].map((name) =>
      rooms.join(host.roomCode, { name, description: "cat" }),
    ),
  );
  const room = rooms.get(host.roomCode);
  await rooms.start(host);
  rooms.submit(players[0], { type: "breed", petId: room.pets[0].id }, 1, 1);
  await rooms.resolve(host, 1, 1);
  now += 5000;
  rooms.tick();
  assert.equal(room.pets[0].effect, undefined);
  await rooms.next(host);
  rooms.submit(players[1], { type: "breed", petId: room.pets[1].id }, 2, 1);
  await rooms.resolve(host, 2, 1);
  now = room.endsAt!;
  rooms.tick();
  assert.equal(room.phase, "over");
  assert.equal(room.pets.length, 2);
  now += 100000;
  rooms.tick();
  assert.equal(room.pets.length, 2);
});
test("one cheering advantage, tie, expiry, and continued play after four rounds", async () => {
  const { rooms, host, room } = await setup();
  await rooms.start(host);
  rooms.cheer(host, {
    seekers: 0.6,
    todd: 0.2,
    method: "microphone",
    round: 1,
    generation: 1,
  });
  assert.match(room.clue!, /wing|grounds/);
  assert.throws(
    () =>
      rooms.cheer(host, {
        seekers: 1,
        todd: 0,
        method: "manual",
        round: 1,
        generation: 1,
      }),
    /One/,
  );
  await rooms.resolve(host, 1, 1);
  await rooms.next(host);
  assert.equal(room.cheer, null);
  assert.equal(room.clue, null);
  assert.throws(
    () =>
      rooms.cheer(host, {
        seekers: 1,
        todd: 0,
        method: "manual",
        round: 1,
        generation: 1,
      }),
    /closed round/,
  );
  rooms.cheer(host, {
    seekers: 0.4,
    todd: 0.4,
    method: "manual",
    round: 2,
    generation: 1,
  });
  assert.equal(rooms.public(room.code).cheer?.advantage, null);
  await rooms.resolve(host, 2, 1);
  await rooms.next(host);
  await rooms.resolve(host, 3, 1);
  await rooms.next(host);
  await rooms.resolve(host, 4, 1);
  assert.equal(room.outcome, null);
  assert.equal(room.phase, "results");
  await rooms.next(host);
  assert.equal(room.round, 5);
});
test("failed asynchronous work restores the round and retained submissions", async () => {
  const { rooms, model, host, players, room } = await setup();
  await rooms.start(host);
  rooms.submit(
    players[0],
    { type: "seek", petId: room.pets[0].id, prompt: "tavern" },
    1,
    1,
  );
  const original = model.move;
  model.move = async () => {
    throw new Error("unavailable");
  };
  await assert.rejects(rooms.resolve(host, 1, 1));
  assert.equal(room.phase, "seeking");
  assert.equal(room.pets[0].usage, 100);
  model.move = original;
  await rooms.resolve(host, 1, 1);
  model.hide = async () => {
    throw new Error("unavailable");
  };
  const stableState = () => {
    const { serverNow, ...state } = rooms.public(room.code);
    return state;
  };
  const snapshot = stableState();
  await assert.rejects(rooms.next(host));
  assert.deepEqual(stableState(), snapshot);
});
test("no-key AI fallback makes balanced cards, legal moves, rhyme decisions and legal hiding", async () => {
  const ai = createBrain(),
    { room } = await setup();
  const pet = room.pets[0];
  const card = await ai.card({ name: "Wings", description: "owl with wings" });
  assert.equal(card.mode, "fallback");
  assert.equal(
    Object.values(card.stats).reduce((a, b) => a + b),
    20,
  );
  assert.equal(
    (await ai.move(pet, "garden", ["garden"], "eight")).locationId,
    "garden",
  );
  assert.equal(
    (await ai.move(pet, "I seek in light\nI fly at night", ["garden"], "rhyme"))
      .valid,
    true,
  );
  assert.equal(
    (await ai.move(pet, "I seek a cat\nI find a dog", ["garden"], "rhyme"))
      .valid,
    false,
  );
  assert.equal((await ai.hide(card.stats, ["garden"], 1)).locationId, "garden");
});
test("real HTTP and Socket.IO clients authenticate, sync, reconnect and isolate host controls", async (t) => {
  const server = createGameServer(brain());
  server.http.listen(0, "127.0.0.1");
  await once(server.http, "listening");
  const address = server.http.address() as { port: number },
    url = `http://127.0.0.1:${address.port}`;
  const sockets: Socket[] = [];
  t.after(async () => {
    sockets.forEach((s) => s.disconnect());
    await server.close();
  });
  const post = async (path: string, body: unknown) =>
    (
      await fetch(url + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    ).json();
  const host: Session = (await post("/api/rooms", {})).data;
  const player: Session = (
    await post(`/api/rooms/${host.roomCode}/join`, {
      name: "Phone pet",
      description: "swimming frog",
    })
  ).data;
  async function socket(session: Session) {
    const s = connect(url, {
      auth: { code: session.roomCode, token: session.token },
      transports: ["websocket"],
    });
    sockets.push(s);
    await new Promise<void>((resolve, reject) => {
      s.once("connect", resolve);
      s.once("connect_error", reject);
    });
    return s;
  }
  const hs = await socket(host),
    ps = await socket(player);
  const command = (s: Socket, name: string, data = {}) =>
    s.timeout(2000).emitWithAck(name, data);
  assert.equal((await command(ps, "host:start")).ok, false);
  assert.equal((await command(hs, "host:start")).ok, true);
  const second = await socket(player);
  ps.disconnect();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(server.rooms.public(host.roomCode).players[0].online, true);
  second.disconnect();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(server.rooms.public(host.roomCode).players[0].online, false);
  const reconnected = await socket(player);
  assert.equal(server.rooms.public(host.roomCode).players[0].online, true);
  const pet = server.rooms.public(host.roomCode).pets[0];
  assert.equal(
    (
      await command(reconnected, "player:submit", {
        move: { type: "seek", petId: pet.id, prompt: "garden" },
        round: 1,
        generation: 1,
      })
    ).ok,
    true,
  );
  assert.equal(
    (await command(hs, "host:resolve", { round: 1, generation: 1 })).ok,
    true,
  );
  assert.equal(server.rooms.public(host.roomCode).outcome, null);
});

test("specialist habitats enforce swimming, flying, size, height and night vision", () => {
  const base = {
    species: "dog",
    stats: { flight: 4, smallness: 4, speed: 4, climb: 4, swim: 4 },
  };
  for (const id of ["cistern", "rookery", "burrow", "belfry", "crypt"])
    assert.equal(accessible(base, id), false);
  assert.equal(
    accessible({ ...base, stats: { ...base.stats, swim: 5 } }, "cistern"),
    true,
  );
  assert.equal(
    accessible({ ...base, stats: { ...base.stats, flight: 5 } }, "rookery"),
    true,
  );
  assert.equal(
    accessible({ ...base, stats: { ...base.stats, smallness: 6 } }, "burrow"),
    true,
  );
  assert.equal(
    accessible({ ...base, stats: { ...base.stats, smallness: 3 } }, "belfry"),
    true,
  );
  for (const species of ["cat", "owl", "ghost"])
    assert.equal(accessible({ ...base, species }, "crypt"), true);
});

test("tipsy pets resolve later without changing room access", async () => {
  const { rooms, host, players, room } = await setup();
  await rooms.start(host);
  room.dot = "garden";
  room.traps = ["tavern"];
  room.reset = null;
  room.pets[0].stats = { flight: 3, smallness: 3, speed: 8, climb: 3, swim: 3 };
  room.pets[1].stats = { flight: 4, smallness: 3, speed: 7, climb: 3, swim: 3 };
  room.pets[0].tipsy = true;
  assert.equal(accessible(room.pets[0], "vault"), true);
  players.forEach((p, i) =>
    rooms.submit(
      p,
      { type: "seek", petId: room.pets[i].id, prompt: "tavern" },
      1,
      1,
    ),
  );
  await rooms.resolve(host, 1, 1);
  assert.equal(room.pets[1].usage, 65);
  assert.equal(room.pets[0].usage, 90);
  assert.equal(
    room.events.filter((e) => e.text === ROOM_LORE.tavern).length,
    1,
  );
  rooms.restart(host);
  assert.equal(
    room.pets.some((p) => p.tipsy || p.effect),
    false,
  );
});

// Exercise the real spawn location and shared single charge, without overriding it.
test("Tibo's tavern button restores only the first visitor each hunt", async () => {
  const { rooms, host, players, room } = await setup(2);
  await rooms.start(host);
  assert.equal(room.reset, "tavern");
  assert.ok(!room.traps.includes("tavern"));
  room.dot = "garden";
  room.pets.forEach((pet) => {
    pet.usage = 30;
    pet.tipsy = true;
  });
  players.forEach((player, i) =>
    rooms.submit(
      player,
      {
        type: "seek",
        petId: room.pets[i].id,
        prompt: "tavern",
      },
      1,
      1,
    ),
  );
  await rooms.resolve(host, 1, 1);
  assert.deepEqual(
    room.pets.map((pet) => pet.usage).sort((a, b) => a - b),
    [20, 100],
  );
  assert.equal(
    room.pets.filter((pet) => pet.effect?.kind === "reset").length,
    1,
  );
  assert.equal(room.pets.filter((pet) => pet.tipsy).length, 1);
  assert.equal(room.reset, null);
  rooms.restart(host);
  await rooms.start(host);
  assert.equal(room.reset, "tavern");
});

test("a crowd covering every ability combination still gets a distinct balanced Todd card", async () => {
  const { room } = await setup();
  const pets = Array.from({ length: 31 }, (_, i) => i + 1)
    .filter((mask) => mask.toString(2).replaceAll("0", "").length <= 3)
    .map((mask) => ({
      ...room.pets[0],
      id: `crowd-${mask}`,
      stats: balanceStats(
        Object.fromEntries(
          STAT_KEYS.map((key, bit) => [key, mask & (1 << bit) ? 8 : 1]),
        ),
      ),
    }));
  const signature = (stats: (typeof pets)[number]["stats"]) =>
    STAT_KEYS.filter((key) => stats[key] >= 5).join(",");
  assert.equal(new Set(pets.map((pet) => signature(pet.stats))).size, 25);
  const shadow = toddStats(pets);
  assert.equal(
    Object.values(shadow).reduce((sum, value) => sum + value, 0),
    20,
  );
  assert.ok(Object.values(shadow).every((value) => value >= 1 && value <= 8));
  assert.ok(
    pets.every((pet) =>
      STAT_KEYS.some((key) => pet.stats[key] !== shadow[key]),
    ),
  );
});

test("300 anonymous HTTP joins from one IP succeed and player 301 is rejected", async (t) => {
  const server = createGameServer(brain());
  server.http.listen(0, "127.0.0.1");
  await once(server.http, "listening");
  t.after(() => server.close());
  const { port } = server.http.address() as { port: number };
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.json();
  };
  const created = await post("/api/rooms", {});
  assert.equal(created.ok, true);
  const host: Session = created.data;
  for (let offset = 0; offset < MAX_PLAYERS; offset += 20) {
    const batch = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        post(`/api/rooms/${host.roomCode}/join`, {
          name: `Phone ${offset + i + 1}`,
          description: "a tiny flying owl",
        }),
      ),
    );
    assert.ok(
      batch.every((reply) => reply.ok),
      JSON.stringify(batch.find((reply) => !reply.ok)),
    );
  }
  const room = server.rooms.get(host.roomCode);
  assert.equal(room.players.length, MAX_PLAYERS);
  const overflow = await post(`/api/rooms/${host.roomCode}/join`, {
    name: "Overflow",
    description: "cat",
  });
  assert.equal(overflow.ok, false);
  assert.match(overflow.error, new RegExp(String(MAX_PLAYERS)));
  await server.rooms.start(host);
  assert.equal(room.phase, "seeking");
});

test("one minute ends automatically, freezes shared survivors, and restarts with a fresh deadline", async () => {
  let now = 10_000,
    broadcasts = 0;
  const rooms = new Rooms(
    brain(),
    () => broadcasts++,
    () => now,
  );
  const host = rooms.create();
  const players = await Promise.all(
    ["One", "Two", "Three"].map((name) =>
      rooms.join(host.roomCode, { name, description: "cat" }),
    ),
  );
  const room = rooms.get(host.roomCode);
  assert.equal(rooms.public(host.roomCode).endsAt, null);
  await rooms.start(host);
  assert.equal(room.endsAt, 70_000);
  room.pets[0].usage = 1;
  room.pets[1].usage = 0;
  room.pets[2].usage = 50;
  const expected = [room.pets[0].id, room.pets[2].id];
  now = 69_999;
  rooms.tick();
  assert.equal(room.phase, "seeking");
  assert.equal(
    rooms.public(room.code).endsAt,
    70_000,
    "reconnect snapshot retains deadline",
  );
  now = 70_000;
  const before = broadcasts;
  rooms.tick();
  assert.equal(
    broadcasts,
    before + 1,
    "expiry broadcasts without a client command",
  );
  assert.equal(room.phase, "over");
  assert.deepEqual(room.winnerPetIds, expected);
  rooms.tick();
  assert.equal(broadcasts, before + 1, "finish only once");
  assert.throws(
    () =>
      rooms.submit(players[0], { type: "vet", petId: room.pets[0].id }, 1, 1),
    /closed/,
  );
  await assert.rejects(rooms.resolve(host, 1, 1), /closed/);
  rooms.restart(host);
  assert.equal(room.endsAt, null);
  assert.deepEqual(room.winnerPetIds, []);
  now = 90_000;
  await rooms.start(host);
  assert.equal(room.endsAt, 150_000);
});

test("expiry with no survivors has no winner and excludes babies not yet ready", async () => {
  let now = 0;
  const rooms = new Rooms(
      brain(),
      () => {},
      () => now,
    ),
    host = rooms.create();
  await rooms.join(host.roomCode, { name: "Parent", description: "owl" });
  await rooms.start(host);
  const room = rooms.get(host.roomCode);
  room.pets[0].usage = 0;
  room.pets.push({
    ...room.pets[0],
    id: "not-ready",
    baby: true,
    usage: 100,
    readyRound: 2,
  });
  now = 60_000;
  assert.equal(rooms.public(room.code).outcome, "survived");
  assert.deepEqual(room.winnerPetIds, []);
  assert.match(room.events[0].text, /No pets survived/);
});

test("late model resolutions cannot change an expired or restarted hunt", async () => {
  for (const fails of [false, true]) {
    let now = 0;
    const model = brain(),
      rooms = new Rooms(
        model,
        () => {},
        () => now,
      ),
      host = rooms.create();
    const player = await rooms.join(host.roomCode, {
      name: "Late",
      description: "cat",
    });
    await rooms.start(host);
    const room = rooms.get(host.roomCode),
      pet = room.pets[0];
    let finish!: () => void;
    model.move = () =>
      new Promise((resolve, reject) => {
        finish = () =>
          fails
            ? reject(new Error("late"))
            : resolve({
                valid: true,
                locationId: "garden",
                narration: "Late move",
                mode: "fallback",
              });
      });
    rooms.submit(
      player,
      { type: "seek", petId: pet.id, prompt: "garden" },
      1,
      1,
    );
    const pending = rooms.resolve(host, 1, 1);
    now = 60_000;
    rooms.tick();
    assert.equal(room.phase, "over");
    assert.equal(pet.usage, 100, "unresolved move spends no usage at the bell");
    rooms.restart(host);
    finish();
    await pending;
    assert.equal(room.phase, "lobby");
    assert.equal(room.endsAt, null);
    assert.equal(room.pets[0].location, "camp");
    assert.equal(room.pets[0].usage, 100);
  }
});

test("server ticker publishes the finish without host input", async () => {
  const server = createGameServer(brain());
  await new Promise<void>((resolve) =>
    server.http.listen(0, "127.0.0.1", resolve),
  );
  const port = (server.http.address() as { port: number }).port;
  const host = server.rooms.create();
  await server.rooms.join(host.roomCode, {
    name: "Survivor",
    description: "cat",
  });
  const socket = connect(`http://127.0.0.1:${port}`, {
    auth: { code: host.roomCode, token: host.token },
    transports: ["websocket"],
  });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    await server.rooms.start(host);
    const room = server.rooms.get(host.roomCode);
    const finished = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("No deadline broadcast")),
        1500,
      );
      socket.on("room:state", (state) => {
        if (state.phase === "over") {
          clearTimeout(timeout);
          assert.equal(state.winnerPetIds.length, 1);
          resolve();
        }
      });
    });
    room.endsAt = Date.now() + 20;
    await finished;
  } finally {
    socket.disconnect();
    await server.close();
  }
});
