import WebSocket from "ws";
import assert from "node:assert/strict";
import type { Session, PublicRoom } from "../src/live/shared.ts";
const base = process.env.GAME_BACKEND || "http://localhost:8791";
const count = Number(process.env.PLAYERS || 300);
const clients: Array<{
  ws: WebSocket;
  state?: PublicRoom;
  frames: number;
  pending: Map<number, (x: any) => void>;
}> = [];
let unexpected = 0,
  finished = false,
  id = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function post(path: string, data: unknown) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.data as Session;
}
async function connect(session: Session) {
  const client = {
    ws: new WebSocket(base.replace(/^http/, "ws") + "/ws/" + session.roomCode),
    frames: 0,
    pending: new Map(),
  } as (typeof clients)[number];
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Authentication timeout")),
      20000,
    );
    client.ws.onopen = () =>
      client.ws.send(
        JSON.stringify({ event: "auth", data: { token: session.token } }),
      );
    client.ws.onerror = () => reject(Error("WebSocket error"));
    client.ws.onclose = () => {
      if (!finished) unexpected++;
    };
    client.ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.id !== undefined) {
        client.pending.get(m.id)?.(m);
        client.pending.delete(m.id);
      }
      if (m.event === "room:state") {
        client.state = m.data;
        if (session.role === "player") {
          assert.ok(m.data.pets.length <= 1);
          assert.equal(m.data.dotLocation, undefined);
        }
        clearTimeout(timer);
        resolve();
      }
      if (m.event === "room:motion") {
        client.frames++;
        if (client.state)
          for (const pet of m.data.pets) {
            const original = client.state.pets.find((p) => p.id === pet.id);
            if (original) Object.assign(original, pet);
          }
      }
    };
  });
  return client;
}
async function action(
  client: (typeof clients)[number],
  event: string,
  data: unknown = {},
) {
  const n = ++id;
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(event + " timed out")), 45000);
    client.pending.set(n, (m) => {
      clearTimeout(timer);
      m.ok ? resolve() : reject(Error(m.error));
    });
    client.ws.send(JSON.stringify({ id: n, event, data }));
  });
}
try {
  const started = Date.now(),
    hostSession = await post("/api/rooms", {}),
    host = await connect(hostSession),
    sessions: Session[] = [];
  for (let i = 0; i < count; i += 20) {
    sessions.push(...await Promise.all(Array.from({length: Math.min(20,count-i)},(_,j)=>post("/api/rooms/"+hostSession.roomCode+"/join", {name:"Load "+(i+j),companionId:"dewey",description:"Codex companion"}))));
  }
  const players = [];
  for (let i = 0; i < sessions.length; i += 20)
    players.push(
      ...(await Promise.all(sessions.slice(i, i + 20).map(connect))),
    );
  const joined = Date.now() - started;
  await sleep(500);
  assert.equal(host.state?.playerCount, count);
  const before = JSON.stringify(players[0].state?.pets[0].position);
  let seq = 0;
  const input = setInterval(() => {
    seq++;
    for (const p of players)
      p.ws.send(
        JSON.stringify({
          event: "player:steer",
          data: {
            dx: seq % 40 < 20 ? 1 : -1,
            dz: 0,
            seq,
            generation: p.state?.generation,
          },
        }),
      );
  }, 100);
  await sleep(5000);
  clearInterval(input);
  assert.notEqual(
    JSON.stringify(players[0].state?.pets[0].position),
    before,
    "lobby movement",
  );
  assert.equal(players[0].state?.pets[0].usage, 100);
  await action(host, "host:start");
  await action(host, "host:pause", { paused: true });
  await sleep(600);
  assert.ok(host.state?.pausedAt);
  const paused = host.state?.pausedAt;
  await sleep(1000);
  assert.equal(host.state?.pausedAt, paused);
  await action(host, "host:pause", { paused: false });
  await sleep(600);
  assert.equal(host.state?.pausedAt, null);
  finished = true;
  players[0].ws.close();
  const reconnected = await connect(sessions[0]);
  assert.equal(reconnected.state?.phase, "seeking");
  assert.equal(unexpected, 0);
  const min = Math.min(...players.map((p) => p.frames));
  assert.ok(min >= 30, `${min} motion frames`);
  console.log(
    JSON.stringify({
      transport: "durable",
      connections: count + 1,
      joinMilliseconds: joined,
      minimumMotionFrames: min,
      unexpectedDisconnects: unexpected,
      lobbyMovement: true,
      pauseResume: true,
      reconnect: true,
    }),
  );
} finally {
  finished = true;
  for (const c of clients) c.ws.close();
}
