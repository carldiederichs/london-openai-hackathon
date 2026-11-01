import { useEffect, useRef, useState } from "react";
import { ADVANTAGES, type PublicRoom } from "./shared";
type Props = {
  room: PublicRoom;
  disabled: boolean;
  send: (event: string, data?: unknown) => Promise<void>;
};
export default function Cheering({ room, disabled, send }: Props) {
  const [stage, setStage] = useState(""),
    [level, setLevel] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const cancel = useRef<AbortController | null>(null);
  useEffect(() => () => cancel.current?.abort(), []);
  useEffect(() => {
    cancel.current?.abort();
    setStage("");
    setLevel(0);
    setBusy(false);
  }, [room.generation, room.round, room.phase]);
  async function manual(side: "seekers" | "todd" | "tie") {
    setBusy(true);
    setError("");
    try {
      await send("host:cheer", {
        seekers: side === "todd" ? 0 : 1,
        todd: side === "seekers" ? 0 : 1,
        method: "manual",
        round: room.round,
        generation: room.generation,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function measure() {
    setBusy(true);
    setError("");
    setStage("Allow the microphone to begin.");
    const controller = new AbortController();
    cancel.current = controller;
    let stream: MediaStream | undefined, context: AudioContext | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Microphone access needs localhost or HTTPS. Use the labelled manual result below.",
        );
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (controller.signal.aborted) return;
      context = new AudioContext();
      await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const values = new Float32Array(analyser.fftSize);
      const sample = (label: string) =>
        new Promise<number>((resolve, reject) => {
          let total = 0,
            count = 0;
          const start = performance.now();
          const timer = window.setInterval(() => {
            if (controller.signal.aborted) {
              clearInterval(timer);
              reject(new Error("Cheering cancelled."));
              return;
            }
            analyser.getFloatTimeDomainData(values);
            const rms = Math.sqrt(
              values.reduce((sum, x) => sum + x * x, 0) / values.length,
            );
            const meter = Math.min(1, rms * 4);
            total += meter;
            count++;
            setLevel(meter);
            setStage(
              `${label} · ${Math.max(0, Math.ceil((3000 - (performance.now() - start)) / 1000))}s`,
            );
            if (performance.now() - start >= 3000) {
              clearInterval(timer);
              resolve(total / Math.max(1, count));
            }
          }, 80);
        });
      const seekers = await sample("LEFT SIDE: cheer for the seekers!");
      setStage("Switch sides. Todd fans, get ready…");
      await new Promise<void>((resolve, reject) => {
        const id = setTimeout(resolve, 1500);
        controller.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(id);
            reject(new Error("Cheering cancelled."));
          },
          { once: true },
        );
      });
      const todd = await sample("RIGHT SIDE: cheer for Todd!");
      if (!controller.signal.aborted)
        await send("host:cheer", {
          seekers,
          todd,
          method: "microphone",
          round: room.round,
          generation: room.generation,
        });
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          (e as Error).message ||
            "Microphone unavailable. Use a manual result.",
        );
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      if (context) await context.close();
      if (cancel.current === controller) {
        cancel.current = null;
        setBusy(false);
        setStage("");
        setLevel(0);
      }
    }
  }
  return (
    <section className="live-panel cheer-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AUDIENCE</p>
          <h2>Choose this round’s advantage</h2>
        </div>
        <span className="pill">1 per round</span>
      </div>
      <div className="advantage-cards">
        {room.cards.map((id) => {
          const a = ADVANTAGES[id];
          return (
            <article key={id} className={a.side}>
              <small>
                {a.side === "seekers"
                  ? "LEFT · TEAM SEEKERS"
                  : "RIGHT · TEAM TODD"}
              </small>
              <h3>{a.name}</h3>
              <p>{a.description}</p>
            </article>
          );
        })}
      </div>
      {room.cheer ? (
        <p className="cheer-result">
          {room.cheer.side === "tie"
            ? "A tie. No rule change."
            : `${room.cheer.side === "seekers" ? "Seekers" : "Todd"} won: ${ADVANTAGES[room.cheer.advantage!].name}.`}{" "}
          <small>
            {room.cheer.method === "manual"
              ? "Manual host result"
              : "Microphone measurement"}{" "}
            · {Math.round(room.cheer.seekers * 100)} :{" "}
            {Math.round(room.cheer.todd * 100)}
          </small>
        </p>
      ) : (
        <>
          <p>
            Give each side three seconds. The louder average wins. Ties grant no
            advantage.
          </p>
          <div
            className="cheer-meter"
            role="meter"
            aria-label="Cheering volume"
            aria-valuenow={Math.round(level * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${level * 100}%` }} />
          </div>
          <p role="status">
            {stage ||
              "Microphone stays off until you start. Audio is measured here and never uploaded."}
          </p>
          <button
            className="primary"
            disabled={disabled || busy || room.phase !== "seeking"}
            onClick={measure}
          >
            Measure cheering
          </button>
          {busy && (
            <button onClick={() => cancel.current?.abort()}>
              Cancel measurement
            </button>
          )}
          <details>
            <summary>Manual fallback</summary>
            <p>
              Use when the microphone is unavailable. The result is clearly
              marked as manual.
            </p>
            <div className="button-row">
              {(["seekers", "todd", "tie"] as const).map((side) => (
                <button
                  key={side}
                  disabled={disabled || busy || room.phase !== "seeking"}
                  onClick={() => manual(side)}
                >
                  {side === "seekers"
                    ? "Seekers win"
                    : side === "todd"
                      ? "Todd wins"
                      : "Tie"}
                </button>
              ))}
            </div>
          </details>
        </>
      )}
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
    </section>
  );
}
