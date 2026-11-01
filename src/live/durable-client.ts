import type { Session, Reply } from "./shared";

// Native WebSocket transport for the Durable Object backend. Session credentials
// travel in the first frame, never in URLs, query strings or browser bundles.
export class DurableConnection {
  connected = false;
  private ws?: WebSocket;
  private stopped = false;
  private retry?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private nextId = 0;
  private listeners = new Map<string, Array<(data?: any) => void>>();
  private pending = new Map<
    number,
    {
      resolve: (value: Reply) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(
    private base: string,
    private session: Session,
  ) {
    this.open();
  }
  on(event: string, callback: (data?: any) => void) {
    const list = this.listeners.get(event) ?? [];
    list.push(callback);
    this.listeners.set(event, list);
  }
  private dispatch(event: string, data?: any) {
    for (const handler of this.listeners.get(event) ?? []) handler(data);
  }
  private open() {
    const url = new URL(
      `/ws/${this.session.roomCode}`,
      this.base || location.origin,
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = (this.ws = new WebSocket(url));
    ws.onopen = () =>
      ws.send(
        JSON.stringify({ event: "auth", data: { token: this.session.token } }),
      );
    ws.onmessage = (event) => {
      let message: any;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(message.id);
          pending.resolve(message);
        }
        return;
      }
      if (message.event === "ready") {
        this.connected = true;
        this.attempt = 0;
        this.dispatch("connect");
      } else if (message.event === "error")
        this.dispatch(
          "connect_error",
          new Error(message.data?.message || "Connection failed"),
        );
      else this.dispatch(message.event, message.data);
    };
    ws.onerror = () =>
      this.dispatch(
        "connect_error",
        new Error("Unable to reach the game. Reconnecting…"),
      );
    ws.onclose = (event) => {
      this.connected = false;
      this.dispatch("disconnect");
      for (const item of this.pending.values()) {
        clearTimeout(item.timer);
        item.reject(new Error("Connection lost. Reconnect before retrying."));
      }
      this.pending.clear();
      if (!this.stopped && event.code !== 4001)
        this.retry = setTimeout(
          () => this.open(),
          Math.min(8000, 500 * 2 ** this.attempt++),
        );
    };
  }
  disconnect() {
    this.stopped = true;
    clearTimeout(this.retry);
    this.ws?.close();
  }
  volatile = {
    emit: (event: string, data: unknown) => {
      if (
        this.connected &&
        this.ws?.readyState === WebSocket.OPEN &&
        this.ws.bufferedAmount < 64000
      )
        this.ws.send(JSON.stringify({ event, data }));
    },
  };
  timeout(ms: number) {
    return {
      emitWithAck: (event: string, data: unknown) =>
        new Promise<Reply>((resolve, reject) => {
          if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
            reject(new Error("Connection lost"));
            return;
          }
          const id = ++this.nextId;
          const timer = setTimeout(() => {
            this.pending.delete(id);
            reject(
              new Error(
                "The action took too long. Check the game before retrying.",
              ),
            );
          }, ms);
          this.pending.set(id, { resolve, reject, timer });
          this.ws.send(JSON.stringify({ id, event, data }));
        }),
    };
  }
}
