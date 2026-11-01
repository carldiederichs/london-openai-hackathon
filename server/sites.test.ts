import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { gameApi } from "../sites/game.ts";
import { roomPoint } from "../src/live/movement.ts";
function setup() {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of readdirSync("drizzle").filter((name) =>
    name.endsWith(".sql"),
  ))
    sqlite.exec(readFileSync(`drizzle/${name}`, "utf8"));
  const prepare = (sql: string) => ({
    bind(...args: any[]) {
      return {
        async first() {
          return sqlite.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...args) };
        },
        async run() {
          return { meta: sqlite.prepare(sql).run(...args) };
        },
      };
    },
  });
  const db = {
    prepare,
    async batch(statements: any[]) {
      sqlite.exec("BEGIN");
      try {
        const values = [];
        for (const stmt of statements) values.push(await stmt.run());
        sqlite.exec("COMMIT");
        return values;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  // Serialize transactions as D1 does; requests can still race before their inserts.
  let queue = Promise.resolve();
  const batch = db.batch.bind(db);
  db.batch = (statements: any[]) => {
    const next = queue.then(() => batch(statements));
    queue = next.then(
      () => {},
      () => {},
    );
    return next;
  };
  const call = async (path: string, body?: unknown) => {
    const result = await gameApi(
      new Request(
        "https://test.chatgpt.site" + path,
        body === undefined
          ? {}
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
      ),
      { DB: db } as any,
    );
    return result.json() as Promise<any>;
  };
  return { sqlite, db, call };
}

const pet = { name: "Sites pet", description: "owl", companionId: "hoots" };
async function world(count = 2) {
  const s = setup(),
    host = (await s.call("/api/rooms", {})).data,
    code = host.roomCode;
  const players = [];
  for (let i = 0; i < count; i++) {
    const joined = await s.call(`/api/rooms/${code}/join`, {
      ...pet,
      name: `Pet ${i}`,
    });
    assert.ok(joined.ok, joined.error);
    players.push(joined.data);
  }
  const sync = async (session: any, input?: any) => {
    if (session.role === "player")
      await s.call(`/api/rooms/${code}/sync`, { token: host.token });
    return s.call(`/api/rooms/${code}/sync`, {
      token: session.token,
      ...(input ? { input } : {}),
    });
  };
  const action = (session: any, event: string, data = {}) =>
    s.call(`/api/rooms/${code}/action`, { token: session.token, event, data });
  const edit = (fn: (r: any) => void) => {
    const row = s.sqlite
      .prepare("SELECT snapshot FROM feral_games WHERE code=?")
      .get(code) as any;
    const room = JSON.parse(row.snapshot, (_k, v) =>
      v?.__feralMap ? new Map(v.__feralMap) : v,
    );
    fn(room);
    s.sqlite
      .prepare("UPDATE feral_games SET snapshot=?,updated=0 WHERE code=?")
      .run(
        JSON.stringify(room, (_k, v) =>
          v instanceof Map ? { __feralMap: [...v] } : v,
        ),
        code,
      );
  };
  return { ...s, host, code, players, sync, action, edit };
}
test("Sites persistence: concurrent joins, private views, control gate, ordered input, stop/resume and reconnect", async (t) => {
  let clock = Date.now();
  t.mock.method(Date, "now", () => clock);
  const w = await world(9);
  try {
    assert.equal((await w.sync({ ...w.host, token: "invalid" })).ok, false);
    const before = (await w.sync(w.players[0])).data;
    assert.equal(before.pets.length, 1);
    assert.equal(before.yourRole, undefined);
    assert.equal(before.reveal, null);
    const initial = before.pets[0].position;
    await w.sync(w.players[0], { dx: 1, dz: 0, seq: 1, generation: 1 });
    clock += 300;
    assert.deepEqual(
      (await w.sync(w.players[0])).data.pets[0].position,
      initial,
    );
    assert.equal((await w.action(w.players[0], "host:start")).ok, false);
    assert.ok((await w.action(w.host, "host:start")).ok);
    const views = await Promise.all(w.players.map((p) => w.sync(p)));
    assert.equal(views.filter((v) => v.data.yourRole === "traitor").length, 1);
    assert.equal(new Set(views.map((v) => v.data.endsAt)).size, 1);
    assert.equal((await w.sync(w.host)).data.yourRole, undefined);
    await w.sync(w.players[0], { dx: 1, dz: 0, seq: 2, generation: 1 });
    clock += 200;
    await w.sync(w.players[0], { dx: 1, dz: 0, seq: 3, generation: 1 });
    clock += 200;
    const moved = (await w.sync(w.players[0])).data;
    assert.notDeepEqual(moved.pets[0].position, initial);
    await w.sync(w.players[0], { dx: -1, dz: 0, seq: 2, generation: 1 });
    assert.equal(
      (
        w.sqlite
          .prepare("SELECT seq FROM feral_sessions WHERE room=? AND token=?")
          .get(w.code, w.players[0].token) as any
      ).seq,
      3,
    );
    assert.ok((await w.action(w.host, "host:pause", { paused: true })).ok);
    const frozen = (await w.sync(w.players[0])).data;
    clock += 4000;
    const still = (await w.sync(w.players[0])).data;
    assert.deepEqual(still.pets, frozen.pets);
    assert.equal(still.pausedAt, frozen.pausedAt);
    assert.ok((await w.action(w.host, "host:pause", { paused: false })).ok);
    const resumed = (await w.sync(w.players[0])).data;
    assert.equal(resumed.endsAt, frozen.endsAt + 4000);
    assert.equal((await w.sync(w.host)).data.endsAt, resumed.endsAt);
    assert.ok(!JSON.stringify(resumed).includes(w.host.token));
  } finally {
    w.sqlite.close();
  }
});
test("Sites room transactions admit 300 pets, preserve parallel joins and reject overflow", async () => {
  const w = await world(0);
  try {
    for (let batch = 0; batch < 15; batch++) {
      const joined = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          w.call(`/api/rooms/${w.code}/join`, {
            ...pet,
            name: `Pet ${batch * 20 + i}`,
          }),
        ),
      );
      assert.equal(
        joined.filter((j) => j.ok).length,
        20,
        JSON.stringify(joined.filter((j) => !j.ok)),
      );
    }
    assert.equal((await w.sync(w.host)).data.playerCount, 300);
    assert.match((await w.call(`/api/rooms/${w.code}/join`, pet)).error, /300/);
    assert.ok((await w.action(w.host, "host:start")).ok);
    const row = w.sqlite
      .prepare("SELECT snapshot FROM feral_games WHERE code=?")
      .get(w.code) as any;
    assert.equal(JSON.parse(row.snapshot).traitorPlayerIds.length, 33);
  } finally {
    w.sqlite.close();
  }
});
test("Sites care navigation survives polling, merges once and restarts originals", async (t) => {
  let clock = Date.now();
  t.mock.method(Date, "now", () => clock);
  const w = await world(3);
  try {
    await w.action(w.host, "host:start");
    for (const p of w.players.slice(0, 2))
      assert.ok(
        (
          await w.action(p, "player:destination", {
            generation: 1,
            location: "nursery",
          })
        ).ok,
      );
    // Reach the care room over real path simulation at HTTP cadence.
    for (let i = 0; i < 110; i++) {
      clock += 200;
      await w.sync(w.host);
    }
    const merged = (await w.sync(w.host)).data;
    assert.equal(merged.pets.length, 2);
    const a = (await w.sync(w.players[0])).data.pets[0],
      b = (await w.sync(w.players[1])).data.pets[0];
    assert.equal(a.id, b.id);
    assert.equal(new Set([a.ownerId, ...a.coOwnerIds]).size, 2);
    assert.ok(
      (
        await w.action(w.players[0], "player:destination", {
          generation: 1,
          location: "vet",
        })
      ).ok,
    );
    for (let i = 0; i < 80; i++) {
      clock += 200;
      await w.sync(w.host);
    }
    assert.equal((await w.sync(w.players[0])).data.pets[0].location, "vet");
    await w.action(w.host, "host:restart");
    const reset = (await w.sync(w.host)).data;
    assert.equal(reset.pets.length, 3);
    assert.equal(reset.phase, "lobby");
  } finally {
    w.sqlite.close();
  }
});
test("Sites resolves timeout and instant Dot wins, and persists graveyard bans without leaking roles", async (t) => {
  let clock = Date.now();
  t.mock.method(Date, "now", () => clock);
  const w = await world(9);
  try {
    await w.action(w.host, "host:start");
    w.edit((r) => {
      r.dot = "library";
      r.traps = [];
      r.endsAt = clock + 600;
    });
    clock += 800;
    const over = (await w.sync(w.host)).data;
    assert.equal(over.phase, "over");
    assert.equal(over.outcome, "survived");
    assert.equal(over.winnerPetIds.length, 9);
    await w.action(w.host, "host:restart");
    await w.action(w.host, "host:start");
    w.edit((r) => {
      r.dot = "garden";
      r.traps = [];
    });
    await w.action(w.players[0], "player:destination", {
      generation: 2,
      location: "garden",
    });
    for (let i = 0; i < 100; i++) {
      clock += 200;
      const state = (await w.sync(w.host)).data;
      if (state.phase === "over") break;
    }
    assert.equal((await w.sync(w.host)).data.outcome, "found");
    await w.action(w.host, "host:restart");
    await w.action(w.host, "host:start");
    w.edit((r) => {
      r.dot = "library";
      r.traps = [];
      r.traitorPlayerIds = [w.players[0].playerId];
      for (const p of r.pets.slice(0, 2)) {
        p.location = "vet";
        p.position = roomPoint("vet");
        r.cursors.set(p.id, { node: "vet", progress: 0 });
      }
      r.controllers.set(r.pets[0].id, { dx: 1, dz: 0, at: clock, seq: 100 });
    });
    clock += 200;
    await w.sync(w.host);
    const dead = (await w.sync(w.players[1])).data.pets[0];
    assert.equal(dead.location, "graveyard");
    assert.equal(dead.usage, 0);
    assert.ok(dead.bannedAt);
    assert.equal(
      (
        await w.action(w.players[1], "player:destination", {
          generation: 3,
          location: "vet",
        })
      ).ok,
      false,
    );
  } finally {
    w.sqlite.close();
  }
});

test("a phone settles the deadline without waiting for an absent host", async (t) => {
  let clock = Date.now();
  t.mock.method(Date, "now", () => clock);
  const w = await world(1);
  try {
    await w.action(w.host, "host:start");
    w.edit((r) => {
      r.endsAt = clock + 1000;
      r.dot = "library";
    });
    await w.sync(w.host);
    clock += 1200;
    const result = await w.call(`/api/rooms/${w.code}/sync`, {
      token: w.players[0].token,
    });
    assert.equal(result.data.phase, "over");
    assert.equal(result.data.winnerPetIds.length, 1);
  } finally {
    w.sqlite.close();
  }
});
