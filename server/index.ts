import express from "express";
import { attachWorld } from "./world.ts";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Server } from "socket.io";
import { config } from "dotenv";
import { createBrain, type Brain } from "./brain.ts";
import { Rooms } from "./rooms.ts";
import { MAX_PLAYERS, type Session } from "../src/live/shared.ts";

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
  const rooms = new Rooms(brain, (code) =>
    io.to(code).emit("room:state", rooms.public(code)),
  );
  const expiryTimer = setInterval(() => rooms.tick(), 100);
  expiryTimer.unref();
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
  // Venue phones may share one IP. Budget joins separately from room creation
  // and leave room for retries without removing either rate limit.
  const requests = new Map<string, { time: number; count: number }>();
  app.use("/api/rooms", (req, res, next) => {
    if (req.method !== "POST") return next();
    const now = Date.now();
    for (const [key, value] of requests)
      if (now - value.time > 60_000) requests.delete(key);
    const joining = /^\/[A-Za-z0-9]{6}\/join\/?$/.test(req.path);
    const limit = joining ? MAX_PLAYERS * 2 : 40;
    const key = `${req.ip || "unknown"}:${joining ? "join" : "create"}`,
      count = requests.get(key) || { time: now, count: 0 };
    requests.set(key, count);
    if (++count.count > limit) {
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
      res.json({ ok: true, data: rooms.create() });
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
  const liveWorld = attachWorld(app, io);
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
    const key = `${session.roomCode}:${session.playerId || "host"}`;
    const set = connections.get(key) || new Set<string>();
    set.add(socket.id);
    connections.set(key, set);
    rooms.connected(session, true);
    socket.emit("room:state", rooms.public(session.roomCode));
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
    action("host:start", () => rooms.start(session));
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
        if (rooms.rooms.has(session.roomCode)) rooms.connected(session, false);
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
      liveWorld.close();
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
