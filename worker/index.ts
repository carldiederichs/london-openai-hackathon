import { DurableObject } from "cloudflare:workers";
import { Rooms, type Room } from "../server/rooms";
import { createBrain } from "../server/brain";
import {
  ownsPet,
  petOwners,
  type Session,
  type PublicRoom,
} from "../src/live/shared";

type Env = {
  GAMES: DurableObjectNamespace<GameRoom>;
  ADMISSION: DurableObjectNamespace<AdmissionLimit>;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  FRONTEND_URL: string;
};
type Attachment = { session?: Session; seq: number; acceptedAt: number };
const reply = (data: unknown, status = 200) => Response.json(data, { status });
const failure = (message: string, status = 400) =>
  reply({ ok: false, error: message }, status);
function cors(request: Request, env: Env, response: Response) {
  const origin = request.headers.get("Origin");
  const headers = new Headers(response.headers);
  if (
    origin &&
    [
      env.FRONTEND_URL,
      "http://localhost:4173",
      "http://localhost:4183",
    ].includes(origin)
  ) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  return new Response(response.body, { status: response.status, headers });
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return cors(request, env, new Response(null, { status: 204 }));
    if (url.pathname === "/api/health")
      return cors(request, env, reply({ ok: true, transport: "durable" }));
    if (url.pathname === "/api/config")
      return cors(
        request,
        env,
        reply({
          configured: !!env.OPENAI_API_KEY,
          model: env.OPENAI_MODEL || "gpt-4.1-mini",
          joinBase: env.FRONTEND_URL,
        }),
      );
    if (request.method === "POST") {
      const kind =
        url.pathname === "/api/rooms"
          ? "create"
          : /\/join$/.test(url.pathname)
            ? "join"
            : null;
      if (kind) {
        const ip = request.headers.get("CF-Connecting-IP") || "local";
        const gate = env.ADMISSION.get(env.ADMISSION.idFromName(ip));
        const admitted = await gate.fetch(
          new Request(`https://limit/${kind}`, { method: "POST" }),
        );
        if (!admitted.ok) return cors(request, env, admitted);
      }
    }
    if (request.method === "POST" && url.pathname === "/api/rooms") {
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = crypto
          .randomUUID()
          .replaceAll("-", "")
          .slice(0, 6)
          .toUpperCase();
        const stub = env.GAMES.get(env.GAMES.idFromName(code));
        const result = await stub.fetch(
          new Request(`https://game/create/${code}`, { method: "POST" }),
        );
        if (result.status !== 409) return cors(request, env, result);
      }
      return cors(
        request,
        env,
        failure("Could not create a room. Try again.", 503),
      );
    }
    const match = url.pathname.match(
      /^\/(?:api\/rooms|ws)\/([A-F0-9]{6})(?:\/|$)/i,
    );
    if (!match) return cors(request, env, failure("Not found", 404));
    const stub = env.GAMES.get(env.GAMES.idFromName(match[1].toUpperCase()));
    const response = await stub.fetch(request);
    return response.status === 101 ? response : cors(request, env, response);
  },
} satisfies ExportedHandler<Env>;

// One object is the only authority for one game. It reuses the tested rules,
// rather than maintaining a second implementation of movement or winning.
export class GameRoom extends DurableObject<Env> {
  private rooms: Rooms;
  private code = "";
  private dirty = false;
  private tickTimer?: ReturnType<typeof setInterval>;
  private pulse = 0;
  private checkpointTask: Promise<void> = Promise.resolve();
  private restored: Promise<void>;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.rooms = new Rooms(
      createBrain(env.OPENAI_API_KEY, env.OPENAI_MODEL),
      () => {
        this.dirty = true;
      },
    );
    this.restored = ctx.blockConcurrencyWhile(async () => {
      const count = (await ctx.storage.get<number>("snapshot-count")) ?? 0;
      if (count) {
        const chunks = await ctx.storage.get<string>(
          Array.from({ length: count }, (_, i) => `snapshot:${i}`),
        );
        const encoded = Array.from(
          { length: count },
          (_, i) => chunks.get(`snapshot:${i}`) ?? "",
        ).join("");
        const room = JSON.parse(encoded, (_key, value) =>
          value?.__feralMap ? new Map(value.__feralMap) : value,
        ) as Room;
        this.code = room.code;
        room.controllers.clear();
        room.lastTick = Date.now();
        room.players.forEach((p) => {
          p.online = false;
        });
        room.pets.forEach((p) => {
          p.moving = false;
        });
        // Do not repeat an interrupted model operation after an isolate restart.
        if (room.phase === "hiding") {
          room.phase = "lobby";
          room.endsAt = null;
          room.pausedAt = null;
        }
        this.rooms.rooms.set(this.code, room);
        for (const ws of ctx.getWebSockets()) {
          const session = (ws.deserializeAttachment() as Attachment)?.session;
          if (session) this.rooms.connected(session, true);
        }
        this.rooms.tick();
        this.startTicks();
      }
    });
  }
  private room() {
    return this.rooms.get(this.code);
  }
  private state(session: Session): PublicRoom {
    const state = this.rooms.public(this.code);
    return session.role === "host"
      ? state
      : {
          ...state,
          pets: state.pets.filter((p) => ownsPet(p, session.playerId)),
          players: state.players.filter((p) => p.id === session.playerId),
          events: state.events.slice(0, 5),
        };
  }
  private send(ws: WebSocket, event: string, data: unknown) {
    try {
      ws.send(JSON.stringify({ event, data }));
    } catch {
      /* Close handler owns cleanup. */
    }
  }
  private publish() {
    for (const ws of this.ctx.getWebSockets()) {
      const auth = ws.deserializeAttachment() as Attachment;
      if (auth?.session) this.send(ws, "room:state", this.state(auth.session));
    }
    this.dirty = false;
  }
  private startTicks() {
    if (this.tickTimer || !this.code || !this.ctx.getWebSockets().length)
      return;
    this.tickTimer = setInterval(() => {
      this.rooms.tick();
      this.pulse++;
      const room = this.room();
      if (
        this.pulse % 2 === 0 &&
        ["lobby", "seeking"].includes(room.phase) &&
        room.pausedAt === null
      ) {
        const all = room.pets.map((p) => ({
          id: p.id,
          position: p.position,
          moving: p.moving,
          location: p.location,
          usage: Math.round(p.usage * 10) / 10,
        }));
        for (const ws of this.ctx.getWebSockets()) {
          const auth = ws.deserializeAttachment() as Attachment;
          if (!auth?.session) {
            if (Date.now() - auth.acceptedAt > 10000)
              ws.close(4001, "Authenticate first");
            continue;
          }
          const ids =
            auth.session.role === "host"
              ? null
              : new Set(
                  room.pets
                    .filter((p) => ownsPet(p, auth.session!.playerId))
                    .map((p) => p.id),
                );
          this.send(ws, "room:motion", {
            generation: room.generation,
            serverNow: Date.now(),
            pets: ids ? all.filter((p) => ids.has(p.id)) : all,
          });
        }
      }
      if (this.pulse % 10 === 0 && this.dirty) this.publish();
      if (this.pulse % 20 === 0) this.ctx.waitUntil(this.checkpoint());
    }, 50);
  }
  private checkpoint(): Promise<void> {
    this.checkpointTask = this.checkpointTask
      .catch(() => {})
      .then(() => this.saveSnapshot());
    return this.checkpointTask;
  }
  private async saveSnapshot() {
    if (!this.code) return;
    {
      const encoded = JSON.stringify(this.room(), (_key, value) =>
        value instanceof Map ? { __feralMap: [...value] } : value,
      );
      // Bound each storage value. Images are stored separately, not copied on every tick.
      const count = Math.ceil(encoded.length / 16000);
      await this.ctx.storage.transaction(async (txn) => {
        const old = (await txn.get<number>("snapshot-count")) ?? 0;
        for (let i = 0; i < count; i++)
          await txn.put(
            `snapshot:${i}`,
            encoded.slice(i * 16000, (i + 1) * 16000),
          );
        for (let i = count; i < old; i++) await txn.delete(`snapshot:${i}`);
        await txn.put("snapshot-count", count);
      });
      const room = this.room();
      if (
        room.endsAt !== null &&
        room.pausedAt === null &&
        room.phase !== "over"
      )
        await this.ctx.storage.setAlarm(
          Math.max(Date.now() + 1000, room.endsAt),
        );
      else await this.ctx.storage.deleteAlarm();
    }
  }
  async fetch(request: Request): Promise<Response> {
    await this.restored;
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/create/")) {
        if (this.code) return failure("Room already exists", 409);
        this.code = url.pathname.split("/").pop()!;
        const session = this.rooms.create("realtime"),
          room = this.rooms.get(session.roomCode);
        this.rooms.rooms.delete(session.roomCode);
        room.code = this.code;
        this.rooms.rooms.set(this.code, room);
        session.roomCode = this.code;
        await this.checkpoint();
        return reply({ ok: true, data: session });
      }
      if (!this.code) return failure("Room not found", 404);
      if (url.pathname.endsWith("/join") && request.method === "POST") {
        const text = await request.text();
        if (text.length > 300000)
          return failure("Pet upload is too large", 413);
        const session = await this.rooms.join(this.code, JSON.parse(text));
        const images = [...this.room().images];
        this.room().images.clear();
        for (const [id, value] of images) {
          const count = Math.ceil(value.length / 16000);
          for (let i = 0; i < count; i++)
            await this.ctx.storage.put(
              `image:${id}:${i}`,
              value.slice(i * 16000, (i + 1) * 16000),
            );
          await this.ctx.storage.put(`image:${id}:count`, count);
        }
        await this.checkpoint();
        this.publish();
        return reply({ ok: true, data: session });
      }
      const image = url.pathname.match(/\/pets\/([^/]+)\/image$/);
      if (image) {
        const id = image[1],
          count = await this.ctx.storage.get<number>(`image:${id}:count`);
        if (!count) return failure("Image not found", 404);
        const chunks = await this.ctx.storage.get<string>(
          Array.from({ length: count }, (_, i) => `image:${id}:${i}`),
        );
        const data = Array.from(
          { length: count },
          (_, i) => chunks.get(`image:${id}:${i}`) ?? "",
        ).join("");
        const [head, body] = data.split(",");
        return new Response(
          Uint8Array.from(atob(body), (c) => c.charCodeAt(0)),
          {
            headers: {
              "Content-Type": head.slice(5, head.indexOf(";")),
              "Cache-Control": "private, max-age=3600",
            },
          },
        );
      }
      if (
        url.pathname.startsWith("/ws/") &&
        request.headers.get("Upgrade")?.toLowerCase() === "websocket"
      ) {
        const origin = request.headers.get("Origin");
        if (
          origin &&
          ![
            this.env.FRONTEND_URL,
            "http://localhost:4173",
            "http://localhost:4183",
          ].includes(origin)
        )
          return failure("Origin not allowed", 403);
        if (this.ctx.getWebSockets().length >= 340)
          return failure("Connection limit reached", 429);
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({
          seq: -1,
          acceptedAt: Date.now(),
        } satisfies Attachment);
        this.startTicks();
        return new Response(null, { status: 101, webSocket: client });
      }
      return failure("Not found", 404);
    } catch (e) {
      return failure(e instanceof Error ? e.message : "The request failed");
    }
  }
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    await this.restored;
    if (typeof raw !== "string" || raw.length > 32000) {
      ws.close(4009, "Message too large");
      return;
    }
    let message: { event: string; id?: number; data?: any };
    try {
      message = JSON.parse(raw);
    } catch {
      ws.close(4002, "Invalid message");
      return;
    }
    const auth = ws.deserializeAttachment() as Attachment;
    try {
      if (message.event === "auth") {
        if (auth.session) throw new Error("Already authenticated");
        auth.session = this.rooms.authenticate(this.code, message.data?.token);
        ws.serializeAttachment(auth);
        this.rooms.connected(auth.session, true);
        this.send(ws, "ready", {});
        this.send(ws, "room:state", this.state(auth.session));
        this.startTicks();
        return;
      }
      const session = auth.session;
      if (!session) throw new Error("Authenticate first");
      const data = message.data;
      switch (message.event) {
        case "player:steer":
          if (!Number.isSafeInteger(data?.seq) || data.seq <= auth.seq) return;
          this.rooms.steer(session, data);
          auth.seq = data.seq;
          ws.serializeAttachment(auth);
          return;
        case "player:destination":
          this.rooms.destination(session, data);
          break;
        case "host:start":
          await this.rooms.start(session);
          break;
        case "host:pause":
          this.rooms.pause(session, data?.paused);
          break;
        case "host:restart":
          this.rooms.restart(session);
          break;
        default:
          throw new Error("Unknown action");
      }
      await this.checkpoint();
      this.publish();
      ws.send(JSON.stringify({ id: message.id, ok: true }));
    } catch (e) {
      const error = e instanceof Error ? e.message : "Action failed";
      if (!auth.session) {
        this.send(ws, "error", { message: error });
        ws.close(4001, "Invalid session");
      } else if (message.id !== undefined)
        ws.send(JSON.stringify({ id: message.id, ok: false, error }));
    }
  }
  async webSocketClose(ws: WebSocket) {
    try {
      ws.close(1000, "Disconnected");
    } catch {
      /* Already closed. */
    }
    await this.restored;
    const auth = ws.deserializeAttachment() as Attachment;
    if (auth?.session) {
      const same = this.ctx
        .getWebSockets()
        .some(
          (other) =>
            other !== ws &&
            (other.deserializeAttachment() as Attachment)?.session?.token ===
              auth.session!.token,
        );
      if (!same) {
        this.rooms.stop(auth.session);
        this.rooms.connected(auth.session, false);
      }
    }
    if (!this.ctx.getWebSockets().some((other) => other !== ws)) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
    await this.checkpoint();
  }
  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }
  async alarm() {
    await this.restored;
    this.rooms.tick();
    this.publish();
    await this.checkpoint();
  }
}

// Independent counters let a whole venue join without exhausting host creation.
export class AdmissionLimit extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const kind = new URL(request.url).pathname.slice(1);
    if (kind !== "create" && kind !== "join") return failure("Not found", 404);
    const now = Date.now();
    const allowed = await this.ctx.storage.transaction(async (txn) => {
      let window = await txn.get<{ start: number; count: number }>(kind);
      if (!window || now - window.start >= 60000)
        window = { start: now, count: 0 };
      if (window.count >= (kind === "join" ? 650 : 40)) return false;
      window.count++;
      await txn.put(kind, window);
      return true;
    });
    if (allowed) await this.ctx.storage.setAlarm(now + 120000);
    return allowed
      ? reply({ ok: true })
      : failure("Too many requests. Try again in a minute.", 429);
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
