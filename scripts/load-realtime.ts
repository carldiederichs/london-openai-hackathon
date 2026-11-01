import { once } from "node:events";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { createGameServer } from "../server/index.ts";
import { createBrain } from "../server/brain.ts";
import type { Session, PublicRoom, MotionFrame } from "../src/live/shared.ts";
const server = createGameServer(createBrain(undefined));
server.http.listen(0, "127.0.0.1");
await once(server.http, "listening");
const address = server.http.address() as { port: number },
  base = `http://127.0.0.1:${address.port}`;
const sockets: Socket[] = [];
const frames = new Map<string, number>();
let receivedBytes = 0,
  disconnections = 0,
  inputTimer: ReturnType<typeof setInterval> | undefined;
async function post(path: string, data: unknown): Promise<Session> {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  assert.equal(json.ok, true, JSON.stringify(json));
  return json.data;
}
function connect(session: Session): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(base, {
      transports: ["websocket"],
      auth: { code: session.roomCode, token: session.token },
      reconnection: false,
      autoConnect: false,
    });
    sockets.push(socket);
    const timeout = setTimeout(
      () => reject(new Error("Connection timeout")),
      15000,
    );
    socket.on("connect_error", reject);
    socket.on("disconnect", () => disconnections++);
    socket.on("room:state", (state: PublicRoom) => {
      receivedBytes += Buffer.byteLength(JSON.stringify(state));
      if (session.role === "player")
        assert.ok(state.pets.length <= 1, "phone receives only its owned pet");
    });
    socket.on("room:motion", (frame: MotionFrame) => {
      receivedBytes += Buffer.byteLength(JSON.stringify(frame));
      frames.set(
        session.playerId ?? "host",
        (frames.get(session.playerId ?? "host") ?? 0) + 1,
      );
    });
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.connect();
  });
}
try {
  const started = performance.now(),
    host = await post("/api/rooms", {}),
    players: Session[] = [];
  for (let batch = 0; batch < 10; batch++)
    players.push(
      ...(await Promise.all(
        Array.from({ length: 30 }, (_, i) =>
          post(`/api/rooms/${host.roomCode}/join`, {
            name: `Load ${batch * 30 + i}`,
            description: "Codex companion",
            companionId: ["dewey", "hoots", "bsod"][i % 3],
          }),
        ),
      )),
    );
  // Shared venue Wi-Fi joins must not consume the host creation budget.
  await post("/api/rooms", {});
  const hostSocket = await connect(host);
  for (let batch = 0; batch < 10; batch++)
    await Promise.all(players.slice(batch * 30, batch * 30 + 30).map(connect));
  assert.equal(server.io.engine.clientsCount, 301);
  const joinedMs = performance.now() - started;
  assert.equal(
    (await hostSocket.timeout(5000).emitWithAck("host:start", {})).ok,
    true,
  );
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  const cpuStart = process.cpuUsage(),
    runStart = performance.now();
  let seq = 0;
  inputTimer = setInterval(() => {
    seq++;
    const dx = Math.floor(seq / 10) % 2 ? 1 : -1;
    for (const socket of sockets.slice(1))
      socket.emit("player:steer", { dx, dz: 0, seq, generation: 1 });
  }, 100);
  await new Promise((resolve) => setTimeout(resolve, 12000));
  clearInterval(inputTimer);
  histogram.disable();
  const elapsed = performance.now() - runStart,
    cpu = process.cpuUsage(cpuStart),
    minimum = Math.min(...players.map((p) => frames.get(p.playerId!) ?? 0));
  assert.equal(disconnections, 0);
  assert.ok(minimum >= 80, `minimum received motion frames ${minimum}`);
  console.log(
    JSON.stringify(
      {
        connections: server.io.engine.clientsCount,
        players: players.length,
        transport: "websocket",
        joinMilliseconds: Math.round(joinedMs),
        testMilliseconds: Math.round(elapsed),
        minimumMotionFramesPerPlayer: minimum,
        unexpectedDisconnects: disconnections,
        eventLoopP95Ms: +(histogram.percentile(95) / 1e6).toFixed(2),
        eventLoopMaxMs: +(histogram.max / 1e6).toFixed(2),
        cpuMilliseconds: Math.round((cpu.user + cpu.system) / 1000),
        receivedMegabytes: +(receivedBytes / 1e6).toFixed(2),
        processRssMegabytes: Math.round(process.memoryUsage().rss / 1e6),
      },
      null,
      2,
    ),
  );
} finally {
  if (inputTimer) clearInterval(inputTimer);
  for (const socket of sockets) socket.disconnect();
  await server.close();
}
