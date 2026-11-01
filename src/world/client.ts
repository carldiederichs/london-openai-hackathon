import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { WorldSession, WorldState, WorldJoin } from "./engine";

export const API_BASE = (import.meta.env.VITE_WORLD_API_URL || "").replace(
  /\/$/,
  "",
);
const key = "promptkeep:shared-world:v1";
export function savedWorldSession(): WorldSession | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
export function forgetWorldSession() {
  localStorage.removeItem(key);
}
export async function leaveWorld(session: WorldSession) {
  await fetch(`${API_BASE}/api/world/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
}
export async function joinWorld(input: WorldJoin) {
  const response = await fetch(`${API_BASE}/api/world/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const reply = await response.json();
  if (!reply.ok)
    throw new Error(reply.error || "The castle could not be reached.");
  localStorage.setItem(key, JSON.stringify(reply.data));
  return reply.data as WorldSession;
}
export function useWorld(session: WorldSession | null, controller: boolean) {
  const [state, setState] = useState<WorldState | null>(null),
    [connected, setConnected] = useState(false),
    [error, setError] = useState("");
  const send = useRef<(mask: number) => void>(() => {}),
    sequence = useRef(Date.now() * 1000);
  useEffect(() => {
    if (controller && !session) return;
    const auth = controller ? session! : { role: "screen" };
    const receive = (value: WorldState) =>
      setState({
        ...value,
        pets: value.pets.map((pet) => ({
          ...pet,
          image: pet.image?.startsWith("/api/world/")
            ? `${API_BASE}${pet.image}`
            : pet.image,
        })),
      });
    if (import.meta.env.VITE_WORLD_TRANSPORT === "sites") {
      let stopped = false;
      let timer: ReturnType<typeof setTimeout>;
      let lastTime = 0,
        activeMask = 0;
      const post = async (path: string, body: unknown) => {
        const response = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
        });
        const reply = await response.json();
        if (!reply.ok)
          throw new Error(reply.error || "The castle could not be reached.");
        return reply.data;
      };
      const poll = async () => {
        try {
          const value: WorldState = controller
            ? await post("/api/world/state", session)
            : await fetch("/api/world/state", { cache: "no-store" })
                .then((r) => r.json())
                .then((r) => {
                  if (!r.ok) throw new Error(r.error);
                  return r.data;
                });
          if (!stopped && value.now >= lastTime) {
            lastTime = value.now;
            receive(value);
            setConnected(true);
            setError("");
          }
        } catch (value) {
          if (!stopped) {
            setConnected(false);
            setError((value as Error).message);
          }
        }
        if (!stopped) timer = setTimeout(poll, controller ? 750 : 200);
      };
      const movement = (mask: number) => {
        activeMask = mask;
        if (!session) return;
        void post("/api/world/input", {
          ...session,
          mask,
          sequence: ++sequence.current,
        })
          .then(() => {
            if (!stopped) {
              setConnected(true);
              setError("");
            }
          })
          .catch((value) => {
            if (!stopped) {
              setConnected(false);
              setError(value.message);
            }
          });
      };
      send.current = movement;
      if (controller) movement(0);
      const heartbeat = setInterval(() => {
        if (controller && session) movement(activeMask);
      }, 5000);
      void poll();
      return () => {
        stopped = true;
        clearTimeout(timer);
        clearInterval(heartbeat);
        movement(0);
        send.current = () => {};
      };
    }
    if (!API_BASE) {
      const socket = io("/world", { auth });
      socket.on("connect", () => {
        setConnected(true);
        setError("");
      });
      socket.on("disconnect", () => setConnected(false));
      socket.on("connect_error", (value) => {
        setConnected(false);
        setError(value.message);
      });
      socket.on("world:state", receive);
      send.current = (mask) => {
        if (socket.connected)
          socket.emit("world:input", { mask, sequence: ++sequence.current });
      };
      return () => {
        socket.emit("world:input", { mask: 0, sequence: ++sequence.current });
        socket.disconnect();
        send.current = () => {};
      };
    }
    let stopped = false,
      socket: WebSocket,
      timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      const url = new URL(`${API_BASE}/api/world/socket`);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      if (controller) {
        url.searchParams.set("playerId", session!.playerId);
        url.searchParams.set("token", session!.token);
      } else url.searchParams.set("role", "screen");
      socket = new WebSocket(url);
      socket.onopen = () => {
        setConnected(true);
        setError("");
      };
      socket.onmessage = (event) => {
        try {
          const value = JSON.parse(event.data);
          if (value.type === "state") receive(value.state);
        } catch {
          /* Ignore heartbeats. */
        }
      };
      socket.onerror = () => setError("Reconnecting to the castle…");
      socket.onclose = (event) => {
        setConnected(false);
        if (event.code === 1008) {
          setError("Your session expired. Choose a pet again.");
          return;
        }
        if (!stopped) timer = setTimeout(connect, 1500);
      };
      send.current = (mask) => {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(
            JSON.stringify({
              type: "input",
              mask,
              sequence: ++sequence.current,
            }),
          );
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      send.current(0);
      socket?.close();
      send.current = () => {};
    };
  }, [session, controller]);
  return {
    state,
    connected,
    error,
    input: (mask: number) => send.current(mask),
  };
}
