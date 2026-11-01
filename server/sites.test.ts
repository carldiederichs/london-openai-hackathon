import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { worldApi, project, type Row } from "../sites/world.ts";
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
    const result = await worldApi(
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
      db,
    );
    return result.json() as Promise<any>;
  };
  return { sqlite, db, call };
}
test("Sites-only database admits exactly 300 concurrent guests and isolates credentials", async () => {
  const { sqlite, call } = setup();
  try {
    const replies = await Promise.all(
      Array.from({ length: 301 }, () =>
        call("/api/world/join", { sampleId: "codex" }),
      ),
    );
    assert.equal(replies.filter((r) => r.ok).length, 300);
    assert.equal(replies.filter((r) => !r.ok).length, 1);
    const a = replies[0].data,
      b = replies[1].data;
    const screen = await call("/api/world/state");
    assert.equal(screen.data.pets.length, 300);
    assert.ok(!JSON.stringify(screen).includes(a.token));
    const own = await call("/api/world/state", a);
    assert.equal(own.data.pets.length, 1);
    assert.equal(own.data.pets[0].id, a.playerId);
    assert.equal(
      (
        await call("/api/world/input", {
          ...a,
          token: b.token,
          mask: 2,
          sequence: 1,
        })
      ).ok,
      false,
    );
    await call("/api/world/leave", a);
    assert.equal(
      (await call("/api/world/join", { sampleId: "hoots" })).ok,
      true,
    );
  } finally {
    sqlite.close();
  }
});
test("Sites-only movement persists across backend requests, stops, and rejects stale packets", async () => {
  const { sqlite, call } = setup();
  try {
    const session = (await call("/api/world/join", { sampleId: "dewey" })).data;
    await call("/api/world/input", { ...session, mask: 2, sequence: 10 });
    sqlite
      .prepare("UPDATE world_players SET changed_at=changed_at-500 WHERE id=?")
      .run(session.playerId);
    const moved = await call("/api/world/state", session);
    assert.ok(moved.data.pets[0].position.x > -9);
    await call("/api/world/input", { ...session, mask: 0, sequence: 11 });
    await call("/api/world/input", { ...session, mask: 8, sequence: 9 });
    const stopped = await call("/api/world/state", session);
    assert.equal(stopped.data.pets[0].moving, false);
    const row = sqlite
      .prepare("SELECT * FROM world_players WHERE id=?")
      .get(session.playerId) as Row;
    assert.equal(
      project({ ...row, mask: 2, changed_at: 0 }, 3000).moving,
      false,
    );
    const collision = project(
      { ...row, x: 0, z: 0.6, mask: 1, changed_at: 0 },
      1000,
    );
    assert.ok(collision.position.z >= 0.5);
  } finally {
    sqlite.close();
  }
});
