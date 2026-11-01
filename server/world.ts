import type express from "express";
import type { Server } from "socket.io";
import {
  SharedWorld,
  type WorldJoin,
  type WorldSession,
} from "../src/world/engine.ts";

export function attachWorld(app: express.Express, io: Server) {
  const world = new SharedWorld(),
    namespace = io.of("/world");
  let dirty = false;
  app.post("/api/world/join", (req, res, next) => {
    try {
      const session = world.join(req.body as WorldJoin);
      dirty = true;
      res.json({ ok: true, data: session });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/world/leave", (req, res, next) => {
    try {
      world.leave(req.body as WorldSession);
      for (const socket of namespace.sockets.values())
        if (socket.data.playerId === req.body.playerId) socket.disconnect(true);
      dirty = true;
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/world/images/:id", (req, res) => {
    const image = world.images.get(req.params.id);
    if (!image) {
      res.sendStatus(404);
      return;
    }
    const [header, data] = image.split(",");
    res
      .type(header.slice(5, header.indexOf(";")))
      .set("Cache-Control", "public, max-age=3600")
      .send(Buffer.from(data, "base64"));
  });
  namespace.use((socket, next) => {
    try {
      if (socket.handshake.auth.role !== "screen") {
        const session = socket.handshake.auth as WorldSession;
        world.authenticate(session);
        socket.data.playerId = session.playerId;
      }
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Session expired."));
    }
  });
  namespace.on("connection", (socket) => {
    const id: string | undefined = socket.data.playerId;
    if (id) world.connected(id, true);
    socket.emit("world:state", world.public(id));
    dirty = true;
    socket.on("world:input", (input) => {
      if (id) world.input(id, input?.mask, input?.sequence);
    });
    socket.on("disconnect", () => {
      if (
        id &&
        ![...namespace.sockets.values()].some(
          (other) => other.data.playerId === id,
        )
      )
        world.connected(id, false);
      dirty = true;
    });
  });
  let ticks = 0;
  const timer = setInterval(() => {
    dirty = world.tick() || dirty;
    if (++ticks % 2 || !dirty) return;
    for (const socket of namespace.sockets.values())
      socket.emit("world:state", world.public(socket.data.playerId));
    dirty = false;
  }, 50);
  timer.unref();
  return { world, close: () => clearInterval(timer) };
}
