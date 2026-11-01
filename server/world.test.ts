import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { io } from "socket.io-client";
import { SharedWorld, MANSION } from "../src/world/engine.ts";
import { createGameServer } from "./index.ts";
import { createBrain } from "./brain.ts";

test("shared world accepts 300 guests and never publishes their credentials", () => {
  const world = new SharedWorld(0);
  const sessions = Array.from({ length: 300 }, () =>
    world.join({ sampleId: "codex" }, 0),
  );
  assert.throws(() => world.join({ sampleId: "codex" }, 0), /300/);
  const publicState = JSON.stringify(world.public());
  assert.ok(sessions.every((session) => !publicState.includes(session.token)));
  assert.equal(world.public(sessions[0].playerId).pets.length, 1);
  assert.throws(
    () => world.authenticate({ ...sessions[0], token: sessions[1].token }),
    /expired/,
  );
});

test("arrows move the owned pet, stale input stops it, and the mansion blocks walking", () => {
  const world = new SharedWorld(0),
    session = world.join({ sampleId: "hoots" }, 0);
  world.connected(session.playerId, true, 0);
  const member = world.authenticate(session),
    start = member.pet.position.x;
  world.input(session.playerId, 2, 1, 0);
  world.tick(100);
  assert.ok(member.pet.position.x > start);
  world.input(session.playerId, 8, 0, 100);
  world.tick(200);
  assert.ok(member.pet.position.x > start);
  world.tick(3000);
  const stopped = member.pet.position.x;
  world.tick(3100);
  assert.equal(member.pet.position.x, stopped);
  assert.equal(member.pet.moving, false);
  member.pet.position = { x: 0, z: MANSION.maxZ + 0.1 };
  world.input(session.playerId, 1, 2, 3100);
  world.tick(3200);
  assert.ok(member.pet.position.z > MANSION.maxZ);
  world.connected(session.playerId, false, 3200);
  world.tick(3300);
  assert.equal(member.pet.moving, false);
});

test("a phone arrow moves the same pet on a separate shared-screen socket", async (t) => {
  const server = createGameServer(createBrain());
  server.http.listen(0, "127.0.0.1");
  await once(server.http, "listening");
  const { port } = server.http.address() as { port: number },
    base = `http://127.0.0.1:${port}`;
  const response = await fetch(`${base}/api/world/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sampleId: "seedy", name: "Phone pet" }),
  });
  const reply = await response.json();
  assert.equal(reply.ok, true);
  const screen = io(`${base}/world`, {
    auth: { role: "screen" },
    transports: ["websocket"],
  });
  const phone = io(`${base}/world`, {
    auth: reply.data,
    transports: ["websocket"],
  });
  t.after(async () => {
    screen.disconnect();
    phone.disconnect();
    await server.close();
  });
  const wait = (socket: typeof phone, predicate: (value: any) => boolean) =>
    new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off("world:state", listener);
        reject(new Error("World state timed out"));
      }, 5000);
      const listener = (value: any) => {
        if (predicate(value)) {
          clearTimeout(timer);
          socket.off("world:state", listener);
          resolve(value);
        }
      };
      socket.on("world:state", listener);
    });
  const initial = await wait(phone, (value) => value.pets.length === 1);
  const initialX = initial.pets[0].position.x;
  const screenMoved = wait(screen, (value) =>
    value.pets.some(
      (pet: any) => pet.id === reply.data.playerId && pet.position.x > initialX,
    ),
  );
  phone.emit("world:input", { mask: 2, sequence: 1 });
  const moved = await screenMoved;
  assert.ok(
    moved.pets.find((pet: any) => pet.id === reply.data.playerId).position.x >
      initialX,
  );
  phone.emit("world:input", { mask: 0, sequence: 2 });
});
