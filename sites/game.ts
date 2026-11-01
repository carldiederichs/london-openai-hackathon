import type { D1Database } from "@cloudflare/workers-types";
import { Rooms, type Room } from "../server/rooms";
import { createBrain, type Brain } from "../server/brain";
import { ownsPet, type Session, type PublicRoom } from "../src/live/shared";
export type Env = {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};
const encode = (value: unknown) =>
  JSON.stringify(value, (_k, v) =>
    v instanceof Map ? { __feralMap: [...v] } : v,
  );
const decode = (value: string): Room =>
  JSON.parse(value, (_k, v) => (v?.__feralMap ? new Map(v.__feralMap) : v));
const ok = (data?: unknown) =>
  Response.json(
    { ok: true, data },
    { headers: { "Cache-Control": "no-store" } },
  );
const fail = (error: string, status = 400) =>
  Response.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
type Row = {
  session: string;
  view: string;
  input: string | null;
  seq: number;
  seen: number;
};

// The lease is in D1, not process memory. Its fencing token guards every commit,
// so parallel Worker instances cannot overwrite each other's game decisions.
async function acquire(db: D1Database, code: string, wait: boolean) {
  const token = crypto.randomUUID(),
    until = Date.now() + 4000;
  do {
    const now = Date.now();
    const result = await db
      .prepare(
        "UPDATE feral_games SET lease=?, lease_until=? WHERE code=? AND lease_until<? AND (? OR updated<?) RETURNING snapshot",
      )
      .bind(token, now + 45000, code, now, wait ? 1 : 0, now - 150)
      .first<{ snapshot: string }>();
    if (result)
      return {
        token,
        room: decode(result.snapshot) as Room & {
          sitesInputs?: Record<string, number>;
        },
      };
    if (!wait) return null;
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 40));
  } while (Date.now() < until);
  throw new Error("The game is busy. Please try again.");
}
function view(
  rooms: Rooms,
  room: Room,
  session: Session,
  state = rooms.public(room.code),
): PublicRoom {
  return session.role === "host"
    ? state
    : {
        ...state,
        yourRole: rooms.roleFor(room.code, session.playerId!),
        pets: state.pets.filter((p) => ownsPet(p, session.playerId)),
        players: state.players.filter((p) => p.id === session.playerId),
        events: state.events.slice(0, 5),
      };
}
// Replay elapsed simulation in short steps, preserving path speed under HTTP polling.
// Sites allows 750ms for a controller refresh; releases stop sooner. The local
// WebSocket transport keeps its shorter 350ms dead-man timeout.
function advance(
  rooms: Rooms,
  room: Room,
  now: { value: number },
  target: number,
) {
  const end = Math.min(target, room.endsAt ?? target);
  let t = Math.max(room.lastTick, end - 2000);
  while (t < end && room.phase === "seeking" && room.pausedAt === null) {
    t = Math.min(end, t + 50);
    now.value = t;
    rooms.tick();
  }
  now.value = target;
  rooms.tick();
}
async function mutate(
  env: Env,
  code: string,
  action?: (rooms: Rooms, room: Room) => Promise<unknown>,
  brain?: Brain,
) {
  const lock = await acquire(env.DB, code, !!action);
  if (!lock) return;
  try {
    const room = lock.room;
    room.inputTimeoutMs = 750;
    const now = { value: room.lastTick, live: false },
      rooms = new Rooms(
        brain ?? createBrain(env.OPENAI_API_KEY, env.OPENAI_MODEL),
        () => {},
        () => (now.live ? Date.now() : now.value),
      );
    rooms.rooms.set(code, room);
    const inputs = await env.DB.prepare(
      "SELECT session,input,seq,seen FROM feral_sessions WHERE room=?",
    )
      .bind(code)
      .all<Row>();
    const target = Date.now();
    advance(rooms, room, now, target);
    for (const row of inputs.results) {
      const session: Session = JSON.parse(row.session);
      const player = room.players.find((p) => p.id === session.playerId);
      if (player) player.online = target - row.seen < 12000;
      if (
        row.input &&
        row.seq > (room.sitesInputs?.[session.token] ?? -1) &&
        target - row.seen < 750 &&
        room.phase === "seeking" &&
        room.pausedAt === null
      ) {
        (room.sitesInputs ??= {})[session.token] = row.seq;
        try {
          rooms.steer(session, JSON.parse(row.input));
        } catch {
          /* stale generation or dead pet */
        }
      }
    }
    now.live = true;
    const result = await action?.(rooms, room);
    now.value = Date.now();
    const imageStatements = [...room.images].map(([id, data]) =>
      env.DB.prepare(
        "INSERT OR REPLACE INTO feral_images(room,id,data) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM feral_games WHERE code=? AND lease=?)",
      ).bind(code, id, data, code, lock.token),
    );
    room.images.clear();
    const sessions: Session[] = [
      { roomCode: code, token: room.hostToken, role: "host" },
      ...room.players.map((p) => ({
        roomCode: code,
        token: p.token,
        role: "player" as const,
        playerId: p.id,
      })),
    ];
    const state = rooms.public(code);
    const views = sessions.map((session) => ({
      token: session.token,
      session: JSON.stringify(session),
      view: JSON.stringify(view(rooms, room, session, state)),
    }));
    const writes = [
      ...imageStatements,
      env.DB.prepare(
        `INSERT INTO feral_sessions(room,token,session,view,seen)
        SELECT ?,json_extract(value,'$.token'),json_extract(value,'$.session'),json_extract(value,'$.view'),? FROM json_each(?)
        WHERE EXISTS(SELECT 1 FROM feral_games WHERE code=? AND lease=?)
        ON CONFLICT(room,token) DO UPDATE SET view=excluded.view`,
      ).bind(code, Date.now(), JSON.stringify(views), code, lock.token),
      env.DB.prepare(
        "UPDATE feral_games SET snapshot=?,updated=?,lease='',lease_until=0 WHERE code=? AND lease=?",
      ).bind(encode(room), Date.now(), code, lock.token),
    ];
    const saved = await env.DB.batch(writes);
    if (!saved.at(-1)?.meta.changes)
      throw new Error("Game update expired. Please retry.");
    return result;
  } finally {
    await env.DB.prepare(
      "UPDATE feral_games SET lease='',lease_until=0 WHERE code=? AND lease=?",
    )
      .bind(code, lock.token)
      .run();
  }
}
export async function gameApi(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/api/health") return ok({ transport: "sites", capacity: 300 });
  if (path === "/api/config")
    return Response.json({
      configured: !!env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      joinBase: new URL(request.url).origin,
    });
  try {
    if (!env.DB) return fail("Game storage is not configured.", 503);
    if (path === "/api/rooms" && request.method === "POST") {
      const rooms = new Rooms(createBrain()),
        session = rooms.create("realtime"),
        room = rooms.get(session.roomCode);
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO feral_games(code,snapshot,updated) VALUES(?,?,?)",
        ).bind(room.code, encode(room), Date.now()),
        env.DB.prepare(
          "INSERT INTO feral_sessions(room,token,session,view,seen) VALUES(?,?,?,?,?)",
        ).bind(
          room.code,
          session.token,
          JSON.stringify(session),
          JSON.stringify(rooms.public(room.code)),
          Date.now(),
        ),
      ]);
      return ok(session);
    }
    const match = path.match(/^\/api\/rooms\/([A-F0-9]{6})\/(.+)$/i);
    if (!match) return fail("Not found", 404);
    const [, code, operation] = match;
    if (operation.startsWith("pets/") && request.method === "GET") {
      const id = operation.match(/^pets\/([^/]+)\/image$/)?.[1];
      const image = await env.DB.prepare(
        "SELECT data FROM feral_images WHERE room=? AND id=?",
      )
        .bind(code, id ?? "")
        .first<{ data: string }>();
      if (!image) return fail("Image not found", 404);
      const [header, data] = image.data.split(",");
      return new Response(
        Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
        {
          headers: {
            "Content-Type": header.slice(5, header.indexOf(";")),
            "Cache-Control": "private,max-age=3600",
          },
        },
      );
    }
    if (request.method !== "POST") return fail("Use POST", 405);
    const text = await request.text();
    if (text.length > 300000) return fail("Request too large", 413);
    const body = JSON.parse(text);
    if (operation === "join") {
      // Generate custom cards before taking the room lease. Slow model requests
      // must not freeze everyone already playing. Rooms.join still validates.
      const brain = createBrain(env.OPENAI_API_KEY, env.OPENAI_MODEL);
      if (!body.companionId) {
        const scratch = new Rooms(brain),
          temp = scratch.create("realtime");
        let prepared: Awaited<ReturnType<Brain["card"]>> | undefined;
        const original = brain.card.bind(brain);
        brain.card = async (input) =>
          prepared ?? (prepared = await original(input));
        await scratch.join(temp.roomCode, body);
      }
      return ok(
        await mutate(env, code, (rooms) => rooms.join(code, body), brain),
      );
    }
    const input = body.input;
    if (
      operation === "sync" &&
      input !== undefined &&
      (!Number.isSafeInteger(input?.seq) ||
        ![input.dx, input.dz].every(
          (v) =>
            typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1,
        ))
    )
      return fail("Invalid movement input");
    // Authenticate, store the newest input and read the caller's view in one
    // indexed statement. Ordinary phones do not compete to tick an active host.
    const auth =
      operation === "sync"
        ? await env.DB.prepare(
            `UPDATE feral_sessions SET
          input=CASE WHEN seq<? THEN ? ELSE input END,
          seq=MAX(seq,?),seen=? WHERE room=? AND token=? RETURNING session,view,seq`,
          )
            .bind(
              input?.seq ?? -1,
              input ? JSON.stringify(input) : null,
              input?.seq ?? -1,
              Date.now(),
              code,
              body.token ?? "",
            )
            .first<Row>()
        : await env.DB.prepare(
            "SELECT session,view,seq FROM feral_sessions WHERE room=? AND token=?",
          )
            .bind(code, body.token ?? "")
            .first<Row>();
    if (!auth) return fail("This session cannot access that room.", 401);
    const session: Session = JSON.parse(auth.session);
    if (operation === "sync") {
      const cached = JSON.parse(auth.view);
      if (session.role === "host" || Date.now() - cached.serverNow > 600) {
        await mutate(env, code);
        const row = await env.DB.prepare(
          "SELECT view FROM feral_sessions WHERE room=? AND token=?",
        )
          .bind(code, session.token)
          .first<{ view: string }>();
        return ok(JSON.parse(row!.view));
      }
      return ok(cached);
    }
    if (operation === "action") {
      await mutate(env, code, async (rooms) => {
        switch (body.event) {
          case "host:start":
            await rooms.start(session);
            break;
          case "host:pause":
            rooms.pause(session, body.data?.paused);
            break;
          case "host:restart":
            rooms.restart(session);
            break;
          case "player:destination":
            rooms.destination(session, body.data);
            break;
          default:
            throw new Error("Unknown action");
        }
      });
      return ok();
    }
    return fail("Not found", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return fail(message, message.startsWith("The game is busy") ? 503 : 400);
  }
}
