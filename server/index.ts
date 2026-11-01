import express from "express";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Server } from "socket.io";
import { config } from "dotenv";
import { createBrain, type Brain } from "./brain.ts";
import { Rooms } from "./rooms.ts";
import {
  ownsPet,
  petOwners,
  type Session,
  type PublicRoom,
} from "../src/live/shared.ts";

config({ path: ".env.local", quiet: true });
config({ quiet: true });
export function createGameServer(
  brain: Brain = createBrain(
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL,
  ),
) {
  const app = express(),
    http = createServer(app);
  const io = new Server(http, { maxHttpBufferSize: 32_000 });
  const dirty = new Set<string>();
  const rooms = new Rooms(brain, (code) => dirty.add(code));
  const personalized = (state: PublicRoom, playerId: string): PublicRoom => ({
    ...state,
    yourRole: rooms.roleFor(state.code, playerId),
    pets: state.pets.filter((p) => ownsPet(p, playerId)),
    players: state.players.filter((p) => p.id === playerId),
    events: state.events.slice(0, 5),
  });
  const publish = (code: string) => {
    if (!rooms.rooms.has(code)) return;
    const state = rooms.public(code);
    io.to(`${code}:host`).emit("room:state", state);
    if (state.mode === "turns")
      io.to(`${code}:players`).emit("room:state", state);
    else
      for (const player of state.players)
        io.to(`${code}:${player.id}`).emit(
          "room:state",
          personalized(state, player.id),
        );
  };
  const expiryTimer = setInterval(() => rooms.tick(), 50);
  expiryTimer.unref();
  let pulse = 0;
  const networkTimer = setInterval(() => {
    pulse++;
    if (pulse % 5 === 0) {
      for (const code of dirty) publish(code);
      dirty.clear();
    }
    for (const room of rooms.rooms.values()) {
      if (
        room.mode !== "realtime" ||
        !["lobby", "seeking"].includes(room.phase) ||
        room.pausedAt !== null
      )
        continue;
      const pets = room.pets.map((p) => ({
        id: p.id,
        position: p.position,
        bannedAt: p.bannedAt,
        moving: p.moving,
        location: p.location,
        usage: Math.round(p.usage * 10) / 10,
      }));
      const frame = {
        generation: room.generation,
        serverNow: Date.now(),
        pets,
      };
      io.to(`${room.code}:host`).volatile.emit("room:motion", frame);
      for (let i = 0; i < room.pets.length; i++)
        for (const owner of petOwners(room.pets[i]))
          io.to(`${room.code}:${owner}`).volatile.emit("room:motion", {
            ...frame,
            pets: [pets[i]],
          });
    }
  }, 100);
  networkTimer.unref();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "300kb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((a) => a?.family === "IPv4" && !a.internal)?.address;
  app.get("/api/config", (req, res) =>
    res.json({
      configured: brain.configured,
      model: brain.model,
      joinBase:
        process.env.PUBLIC_URL ||
        (lan
          ? `http://${lan}:${req.get("host")?.match(/:(\d+)$/)?.[1] || process.env.PORT || "4174"}`
          : ""),
    }),
  );
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  // Separate venue-IP budgets: a crowd joining must not block host room creation.
  const requests = new Map<string, { time: number; count: number }>();
  app.use("/api/rooms", (req, res, next) => {
    if (req.method !== "POST") return next();
    const now = Date.now();
    for (const [key, value] of requests)
      if (now - value.time > 60_000) requests.delete(key);
    const kind = req.path.endsWith("/join") ? "join" : "create";
    const key = `${req.ip || "unknown"}:${kind}`,
      count = requests.get(key) || { time: now, count: 0 };
    requests.set(key, count);
    if (++count.count > (req.path.endsWith("/join") ? 650 : 40)) {
      res.status(429).json({
        ok: false,
        error: "Too many requests. Wait a minute and try again.",
      });
      return;
    }
    next();
  });
  app.post("/api/rooms", (_req, res, next) => {
    try {
      res.json({ ok: true, data: rooms.create("realtime") });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/rooms/:code/join", async (req, res, next) => {
    try {
      res.json({
        ok: true,
        data: await rooms.join(req.params.code.toUpperCase(), req.body),
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/rooms/:code/pets/:id/image", (req, res) => {
    const image = rooms.rooms.get(req.params.code)?.images.get(req.params.id);
    if (!image) {
      res.sendStatus(404);
      return;
    }
    const [head, data] = image.split(",");
    res.setHeader("Content-Type", head.slice(5, head.indexOf(";")));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(Buffer.from(data, "base64"));
  });
  const connections = new Map<string, Set<string>>();
  io.use((socket, next) => {
    try {
      const auth = socket.handshake.auth;
      if (typeof auth.code !== "string" || typeof auth.token !== "string")
        throw new Error("A valid room session is required.");
      socket.data.session = rooms.authenticate(auth.code, auth.token);
      next();
    } catch (e) {
      next(e instanceof Error ? e : new Error("Invalid session."));
    }
  });
  io.on("connection", (socket) => {
    const session: Session = socket.data.session;
    socket.join(session.roomCode);
    socket.join(`${session.roomCode}:${session.playerId || "host"}`);
    if (session.role === "player") socket.join(`${session.roomCode}:players`);
    const key = `${session.roomCode}:${session.playerId || "host"}`;
    const set = connections.get(key) || new Set<string>();
    set.add(socket.id);
    connections.set(key, set);
    rooms.connected(session, true);
    const initial = rooms.public(session.roomCode);
    socket.emit(
      "room:state",
      session.role === "player" && initial.mode === "realtime"
        ? personalized(initial, session.playerId!)
        : initial,
    );
    const action = (event: string, fn: (data: any) => unknown) =>
      socket.on(event, async (data, ack) => {
        if (typeof ack !== "function") return;
        try {
          await fn(data);
          ack({ ok: true, data: undefined });
        } catch (e) {
          ack({
            ok: false,
            error:
              e instanceof Error ? e.message : "The action could not finish.",
          });
        }
      });
    let lastSequence = -1;
    socket.on("player:steer", (data) => {
      if (!data || !Number.isSafeInteger(data.seq) || data.seq <= lastSequence)
        return;
      try {
        rooms.steer(session, data);
        lastSequence = data.seq;
      } catch {
        /* Stale or forged frames never change the world. */
      }
    });
    action("player:destination", (d) => rooms.destination(session, d));
    action("host:start", () => rooms.start(session));
    action("host:pause", (d) => rooms.pause(session, d?.paused));
    action("host:resolve", (d) =>
      rooms.resolve(session, d?.round, d?.generation),
    );
    action("host:next", () => rooms.next(session));
    action("host:restart", () => rooms.restart(session));
    action("host:cheer", (d) => rooms.cheer(session, d));
    action("player:submit", (d) =>
      rooms.submit(session, d?.move, d?.round, d?.generation),
    );
    socket.on("disconnect", () => {
      set.delete(socket.id);
      if (!set.size) {
        connections.delete(key);
        if (rooms.rooms.has(session.roomCode)) {
          rooms.stop(session);
          rooms.connected(session, false);
        }
      }
    });
  });
  app.use(express.static(resolve("dist")));
  app.get(/^(?!\/api\/).*/, (_req, res) =>
    res.sendFile(resolve("dist/index.html")),
  );
  app.use(
    (
      error: Error & { type?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(400).json({
        ok: false,
        error:
          error.type === "entity.too.large"
            ? "That image is too large. Use a smaller image."
            : error instanceof SyntaxError
              ? "Invalid request."
              : error.message || "Request failed.",
      });
    },
  );
  return {
    app,
    http,
    io,
    rooms,
    close: () => {
      clearInterval(expiryTimer);
      clearInterval(networkTimer);
      return new Promise<void>((done) =>
        io.close(() => http.close(() => done())),
      );
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const server = createGameServer();
  server.http.listen(Number(process.env.PORT) || 4174, "0.0.0.0", () =>
    console.log(
      "Feral room server ready on port",
      Number(process.env.PORT) || 4174,
    ),
  );
}
