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

test(
  "300 live phone sockets move and stop together on one castle screen",
  { timeout: 20_000 },
  async (t) => {
    const server = createGameServer(createBrain());
    const sockets: ReturnType<typeof io>[] = [];
    t.after(async () => {
      sockets.forEach((socket) => socket.disconnect());
      await server.close();
    });
    server.http.listen(0, "127.0.0.1");
    await once(server.http, "listening");
    const { port } = server.http.address() as { port: number };
    const base = `http://127.0.0.1:${port}`;
    const sessions: { playerId: string; token: string }[] = [];
    for (let batch = 0; batch < 300; batch += 20)
      sessions.push(
        ...(await Promise.all(
          Array.from({ length: 20 }, async (_, offset) => {
            const index = batch + offset;
            const response = await fetch(`${base}/api/world/join`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sampleId: "codex",
                name: `Phone ${index + 1}`,
              }),
            });
            const reply = await response.json();
            assert.equal(reply.ok, true);
            return reply.data;
          }),
        )),
      );
    const initial = new Map<string, number>();
    const connectedAt = performance.now();
    const phones = sessions.map((session) => {
      const socket = io(`${base}/world`, {
        auth: session,
        transports: ["websocket"],
        autoConnect: false,
        forceNew: true,
      });
      sockets.push(socket);
      return socket;
    });
    for (let batch = 0; batch < phones.length; batch += 30)
      await Promise.all(
        phones.slice(batch, batch + 30).map(
          (socket, index) =>
            new Promise<void>((resolve, reject) => {
              socket.once("connect_error", reject);
              socket.once("world:state", (state) => {
                try {
                  assert.equal(state.pets.length, 1);
                  assert.equal(
                    state.pets[0].id,
                    sessions[batch + index].playerId,
                  );
                  assert.equal(state.count, 300);
                  initial.set(state.pets[0].id, state.pets[0].position.x);
                  resolve();
                } catch (error) {
                  reject(error);
                }
              });
              socket.connect();
            }),
        ),
      );
    const connectedMs = performance.now() - connectedAt;
    const screen = io(`${base}/world`, {
      auth: { role: "screen" },
      transports: ["websocket"],
      autoConnect: false,
    });
    sockets.push(screen);
    const screenReady = new Promise<
      import("../src/world/engine.ts").WorldState
    >((resolve) => screen.once("world:state", resolve));
    screen.connect();
    const state = await screenReady;
    assert.equal(state.pets.length, 300);
    assert.equal(state.online, 300);
    const wait = (
      predicate: (
        state: import("../src/world/engine.ts").WorldState,
      ) => boolean,
    ) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          screen.off("world:state", listener);
          reject(new Error("Crowd state timed out"));
        }, 5000);
        const listener = (
          state: import("../src/world/engine.ts").WorldState,
        ) => {
          if (predicate(state)) {
            clearTimeout(timer);
            screen.off("world:state", listener);
            resolve();
          }
        };
        screen.on("world:state", listener);
      });
    const moved = wait(
      (state) =>
        state.pets.length === 300 &&
        state.pets.every(
          (pet) => pet.moving && pet.position.x > initial.get(pet.id)!,
        ),
    );
    const movementAt = performance.now();
    phones.forEach((socket) =>
      socket.emit("world:input", { mask: 2, sequence: 1 }),
    );
    await moved;
    const movementMs = performance.now() - movementAt;
    const stopped = wait((state) => state.pets.every((pet) => !pet.moving));
    phones.forEach((socket) =>
      socket.emit("world:input", { mask: 0, sequence: 2 }),
    );
    await stopped;
    t.diagnostic(
      `Localhost: 300 real WebSocket controllers connected in ${Math.round(connectedMs)} ms; all movements reached the screen in ${Math.round(movementMs)} ms. This does not measure physical phones, rendering at 300 pets, or Cloudflare.`,
    );
  },
);
