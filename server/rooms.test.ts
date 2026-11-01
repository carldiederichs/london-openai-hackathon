import { test } from "node:test";
import assert from "node:assert/strict";
import { io as connect, type Socket } from "socket.io-client";
import { once } from "node:events";
import { createBrain, fallbackCard, type Brain } from "./brain.ts";
import { Rooms } from "./rooms.ts";
import { createGameServer } from "./index.ts";
import { accessible, STAT_KEYS, type Session } from "../src/live/shared.ts";

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
  const { rooms, host, players, room } = await setup(10);
  await assert.rejects(
    rooms.join(host.roomCode, { name: "Extra", description: "cat" }),
    /ten/,
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
  assert.equal(room.outcome, "caught");
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
  assert.equal(room.pets[1].usage, before);
});
test("breeding needs reciprocal consent and only grants a baby next round", async () => {
  const { rooms, host, players, room } = await setup();
  await rooms.start(host);
  players.forEach((p, i) =>
    rooms.submit(
      p,
      { type: "breed", petId: room.pets[i].id, partnerId: room.pets[1 - i].id },
      1,
      1,
    ),
  );
  await rooms.resolve(host, 1, 1);
  assert.equal(room.pets.length, 3);
  assert.equal(room.pets[2].readyRound, 2);
  assert.equal(room.pets[0].usage, 80);
  assert.equal(room.pets[1].usage, 80);
  await rooms.next(host);
  const baby = room.pets[2],
    owner = players.find((p) => p.playerId === baby.ownerId)!;
  rooms.submit(owner, { type: "seek", petId: baby.id, prompt: "🌱" }, 2, 1);
  assert.throws(
    () =>
      rooms.submit(
        owner,
        {
          type: "vet",
          petId: room.pets.find((p) => p.ownerId === owner.playerId && !p.baby)!
            .id,
        },
        2,
        1,
      ),
    /locked/,
  );
  rooms.restart(host);
  assert.equal(room.pets.length, 2);
  await rooms.start(host);
  rooms.submit(
    players[0],
    { type: "breed", petId: room.pets[0].id, partnerId: room.pets[1].id },
    1,
    2,
  );
  await rooms.resolve(host, 1, 2);
  assert.equal(room.pets.length, 2);
  assert.equal(room.pets[0].usage, 100);
});
test("one cheering advantage, tie, expiry, and four-round escape", async () => {
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
  assert.equal(room.outcome, "escaped");
  assert.equal(room.phase, "over");
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
  const snapshot = JSON.stringify(rooms.public(room.code));
  await assert.rejects(rooms.next(host));
  assert.equal(JSON.stringify(rooms.public(room.code)), snapshot);
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
  assert.equal(server.rooms.public(host.roomCode).outcome, "caught");
});
