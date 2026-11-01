import type { Session, Reply } from "./shared";
// Same-origin HTTP polling: Sites owns hosting and persistence. One request per
// controller at a time prevents slow networks from building a stale input queue.
export class SitesConnection {
  connected = false;
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private listeners = new Map<string, Array<(data?: any) => void>>();
  private input: unknown;
  constructor(
    private base: string,
    private session: Session,
  ) {
    queueMicrotask(() => this.poll());
  }
  on(event: string, handler: (data?: any) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), handler]);
  }
  private dispatch(event: string, data?: unknown) {
    this.listeners.get(event)?.forEach((h) => h(data));
  }
  private async request(
    operation: string,
    body: object,
    timeout = 10000,
  ): Promise<Reply<any>> {
    const response = await fetch(
      `${this.base}/api/rooms/${this.session.roomCode}/${operation}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: this.session.token, ...body }),
        signal: AbortSignal.timeout(timeout),
        cache: "no-store",
      },
    );
    if (!response.ok && response.status === 401) this.stopped = true;
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error("Connection interrupted. Reconnecting…");
    return response.json();
  }
  private async poll() {
    if (this.stopped) return;
    try {
      const reply = await this.request(
        "sync",
        this.input ? { input: this.input } : {},
      );
      if (!reply.ok) throw new Error(reply.error);
      if (this.stopped) return;
      if (!this.connected) {
        this.connected = true;
        this.dispatch("connect");
      }
      this.dispatch("room:state", reply.data);
    } catch (error) {
      this.connected = false;
      this.dispatch("disconnect");
      this.dispatch("connect_error", error);
    } finally {
      if (!this.stopped)
        this.timer = setTimeout(
          () => this.poll(),
          this.connected ? (this.session.role === "host" ? 100 : 200) : 1000,
        );
    }
  }
  volatile = {
    emit: (_event: string, data: unknown) => {
      const previous = this.input as { dx?: number; dz?: number } | undefined;
      const next = data as { dx?: number; dz?: number };
      this.input = data;
      // A direction change or release must not sit behind a slow state poll.
      // Server sequence checks keep delayed earlier requests from overriding it.
      if (
        this.connected &&
        (previous?.dx !== next.dx || previous?.dz !== next.dz)
      ) {
        void this.request("sync", { input: data }).catch(() => {});
      }
    },
  };
  timeout(ms: number) {
    return {
      emitWithAck: (event: string, data: unknown) =>
        this.request("action", { event, data }, ms),
    };
  }
  disconnect() {
    this.stopped = true;
    this.connected = false;
    clearTimeout(this.timer);
  }
}
