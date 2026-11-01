import { SharedWorld } from "../src/world/engine.ts";

// The public Sites frontend sets VITE_WORLD_API_URL to this Worker's URL.
// All requests route to one named Durable Object; there is one shared world.
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (origin && allowed.length && !allowed.includes(origin))
      return new Response("Origin not allowed", { status: 403 });
    const cors = {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    const response = await env.WORLD.get(
      env.WORLD.idFromName("promptkeep-castle"),
    ).fetch(request);
    if (response.status === 101) return response;
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  },
};

export class CastleWorldDO {
  constructor(ctx) {
    this.ctx = ctx;
    this.world = new SharedWorld();
    this.timer = null;
    this.ticks = 0;
    ctx.blockConcurrencyWhile(async () => {
      const chunks = await ctx.storage.get([
        "members:0",
        "members:1",
        "members:2",
      ]);
      this.world = new SharedWorld(
        Date.now(),
        [0, 1, 2].flatMap((index) => chunks.get(`members:${index}`) || []),
      );
      for (const socket of ctx.getWebSockets()) {
        const data = socket.deserializeAttachment();
        if (data?.playerId) this.world.connected(data.playerId, true);
      }
    });
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/world/join" && request.method === "POST") {
        const text = await request.text();
        if (text.length > 300_000)
          throw new Error("That pet image is too large.");
        const input = JSON.parse(text),
          session = this.world.join(input);
        if (input.image) {
          await this.ctx.storage.put(`image:${session.playerId}`, input.image);
          this.world.images.delete(session.playerId);
        }
        await this.save();
        this.broadcast();
        return Response.json({ ok: true, data: session });
      }
      if (url.pathname === "/api/world/leave" && request.method === "POST") {
        const session = await request.json();
        this.world.leave(session);
        for (const socket of this.ctx.getWebSockets())
          if (socket.deserializeAttachment()?.playerId === session.playerId)
            socket.close(1000, "Pet changed.");
        await this.ctx.storage.delete(`image:${session.playerId}`);
        await this.save();
        this.broadcast();
        return Response.json({ ok: true });
      }
      if (url.pathname.startsWith("/api/world/images/")) {
        const id = url.pathname.split("/").pop(),
          image = await this.ctx.storage.get(`image:${id}`);
        if (!image) return new Response("Not found", { status: 404 });
        const [header, data] = image.split(",");
        return new Response(
          Uint8Array.from(atob(data), (value) => value.charCodeAt(0)),
          {
            headers: {
              "Content-Type": header.slice(5, header.indexOf(";")),
              "Cache-Control": "public, max-age=3600",
            },
          },
        );
      }
      if (
        url.pathname === "/api/world/socket" &&
        request.headers.get("Upgrade")?.toLowerCase() === "websocket"
      ) {
        let playerId;
        if (url.searchParams.get("role") !== "screen") {
          playerId = url.searchParams.get("playerId");
          this.world.authenticate({
            playerId,
            token: url.searchParams.get("token"),
          });
        }
        const pair = new WebSocketPair(),
          [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ playerId });
        if (playerId) this.world.connected(playerId, true);
        server.send(
          JSON.stringify({ type: "state", state: this.world.public(playerId) }),
        );
        this.broadcast();
        return new Response(null, { status: 101, webSocket: client });
      }
      return Response.json({
        ok: true,
        world: "promptkeep-castle",
        capacity: 300,
      });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error: error.message || "The castle could not finish that action.",
        },
        { status: 400 },
      );
    }
  }
  webSocketMessage(socket, message) {
    try {
      const data = socket.deserializeAttachment(),
        input = JSON.parse(message);
      if (!data?.playerId || input.type !== "input") return;
      this.world.input(data.playerId, input.mask, input.sequence);
      if (!this.timer)
        this.timer = setInterval(() => {
          const changed = this.world.tick();
          if (++this.ticks % 2 === 0 && changed) this.broadcast();
          if (this.ticks % 40 === 0) this.ctx.waitUntil(this.save());
          if (![...this.world.members.values()].some((member) => member.mask)) {
            clearInterval(this.timer);
            this.timer = null;
            this.broadcast();
            this.ctx.waitUntil(this.save());
          }
        }, 50);
    } catch {
      /* Invalid inputs never move a pet. */
    }
  }
  webSocketClose(socket) {
    const data = socket.deserializeAttachment();
    if (
      data?.playerId &&
      !this.ctx
        .getWebSockets()
        .some(
          (other) =>
            other !== socket &&
            other.readyState === 1 &&
            other.deserializeAttachment()?.playerId === data.playerId,
        )
    )
      this.world.connected(data.playerId, false);
    this.broadcast();
    this.ctx.waitUntil(this.save());
  }
  webSocketError(socket) {
    socket.close(1011, "Reconnect to the castle.");
  }
  broadcast() {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(
          JSON.stringify({
            type: "state",
            state: this.world.public(socket.deserializeAttachment()?.playerId),
          }),
        );
      } catch {
        /* Closed sockets are handled by webSocketClose. */
      }
    }
  }
  save() {
    const members = this.world.snapshot();
    return this.ctx.storage.put(
      Object.fromEntries(
        [0, 1, 2].map((index) => [
          `members:${index}`,
          members.slice(index * 100, (index + 1) * 100),
        ]),
      ),
    );
  }
}
