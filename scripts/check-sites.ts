import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
const base = process.env.GAME_BACKEND || "http://localhost:8792",
  count = Number(process.env.PLAYERS || 9),
  duration = Number(process.env.DURATION_MS || 12000);
async function post(path: string, body: unknown): Promise<any> {
  for (let i = 0; ; i++) {
    const res = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    const reply = (await res.json()) as any;
    if (res.status === 503 && i < 12) {
      await sleep(300 + Math.random() * 700);
      continue;
    }
    assert.ok(reply.ok, `${path}: ${reply.error}`);
    return reply.data;
  }
}
const host = await post("/api/rooms", {}),
  code = host.roomCode,
  start = Date.now(),
  players: any[] = [];
for (let i = 0; i < count; i += 20)
  players.push(
    ...(await Promise.all(
      Array.from({ length: Math.min(20, count - i) }, (_, j) =>
        post(`/api/rooms/${code}/join`, {
          name: `Load ${i + j}`,
          description: "water pet",
          companionId: "dewey",
        }),
      ),
    )),
  );
const joinedMs = Date.now() - start;
const sync = (s: any, input?: unknown) =>
  post(`/api/rooms/${code}/sync`, {
    token: s.token,
    ...(input ? { input } : {}),
  });
const action = (event: string, data = {}) =>
  post(`/api/rooms/${code}/action`, { token: host.token, event, data });
await action("host:start");
const first = await sync(host);
assert.equal(first.playerCount, count);
assert.equal(first.reveal, null);
const frames = Array(count + 1).fill(0),
  latencies: number[] = [],
  failures: string[] = [];
const until = Date.now() + duration;
await Promise.all(
  [host, ...players].map(async (s, index) => {
    let seq = Date.now() * 1000;
    while (Date.now() < until) {
      const at = Date.now();
      try {
        const state = await sync(
          s,
          index
            ? { dx: 1, dz: 0, seq: ++seq, generation: first.generation }
            : undefined,
        );
        assert.equal(state.generation, first.generation);
        if (index) assert.equal(state.pets.length, 1);
        frames[index]++;
        latencies.push(Date.now() - at);
      } catch (e) {
        failures.push(String(e));
      }
      await sleep(100);
    }
  }),
);
await action("host:pause", { paused: true });
const frozen = await sync(players[0]);
await sleep(600);
const still = await sync(players[0]);
assert.deepEqual(still.pets, frozen.pets);
assert.equal(still.pausedAt, frozen.pausedAt);
await action("host:pause", { paused: false });
const resumed = await sync(players[0]);
assert.equal(resumed.pausedAt, null);
assert.ok(resumed.endsAt > frozen.endsAt);
await action("host:pause", { paused: true });
latencies.sort((a, b) => a - b);
console.log(
  JSON.stringify({
    base,
    players: count,
    joinedMs,
    minFrames: Math.min(...frames),
    p50: latencies[Math.floor(latencies.length * 0.5)],
    p95: latencies[Math.floor(latencies.length * 0.95)],
    failures: failures.slice(0, 3),
    failedRequests: failures.length,
    pauseResume: true,
    code,
  }),
);
assert.equal(failures.length, 0);
assert.ok(Math.min(...frames) > 2);
