import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { PublicRoom, Reply, Session } from "./shared";

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const reply: Reply<T> = await res.json();
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}
export const sessionKey = (role: string, code: string) =>
  `promptkeep:v1:${role}:${code}`;
export function readSession(role: string, code: string): Session | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(sessionKey(role, code)) || "null",
    );
    return value?.role === role &&
      value?.roomCode === code &&
      typeof value.token === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveSession(session: Session) {
  sessionStorage.setItem(
    sessionKey(session.role, session.roomCode),
    JSON.stringify(session),
  );
}
export function useRoom(session: Session | null) {
  const [room, setRoom] = useState<PublicRoom | null>(null),
    [connected, setConnected] = useState(false),
    [error, setError] = useState("");
  const socket = useRef<Socket | null>(null);
  useEffect(() => {
    if (!session) return;
    const s = io({
      auth: { code: session.roomCode, token: session.token },
      reconnection: true,
    });
    socket.current = s;
    s.on("connect", () => {
      setConnected(true);
      setError("");
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", (e) => {
      setConnected(false);
      setError(e.message);
    });
    s.on("room:state", (state: PublicRoom) => setRoom(state));
    return () => {
      s.disconnect();
      socket.current = null;
    };
  }, [session]);
  async function send(event: string, data: unknown = {}) {
    if (!socket.current?.connected)
      throw new Error(
        "Connection lost. Your controls will return when reconnected.",
      );
    const reply: Reply = await socket.current
      .timeout(40_000)
      .emitWithAck(event, data);
    if (!reply.ok) throw new Error(reply.error);
  }
  return { room, connected, error, send };
}
export async function preparePetImage(
  file: File,
): Promise<{ image: string; spriteRows?: 9 | 11 }> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error("Choose a PNG, JPEG or WebP under 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const spriteRows =
      bitmap.width === 1536 && bitmap.height === 1872
        ? 9
        : bitmap.width === 1536 && bitmap.height === 2288
          ? 11
          : undefined;
    if (spriteRows) {
      // Keep the entire grid and its transparent padding. Never flatten an atlas
      // into a single thumbnail; reduce every cell by the same integer factor.
      for (const divisor of [2, 4, 8]) {
        canvas.width = bitmap.width / divisor;
        canvas.height = bitmap.height / divisor;
        canvas
          .getContext("2d")!
          .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const image = canvas.toDataURL("image/webp", 0.85);
        if (image.length <= 245_000) return { image, spriteRows };
      }
      throw new Error(
        "That sprite sheet is too detailed. Try a smaller PNG or WebP export.",
      );
    }
    const ratio = Math.min(1, 192 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { image: canvas.toDataURL("image/png") };
  } finally {
    bitmap.close();
  }
}
export async function resizePet(file: File): Promise<string> {
  return (await preparePetImage(file)).image;
}
