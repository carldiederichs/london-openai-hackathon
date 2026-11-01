import { useEffect, useMemo, useState } from "react";
import { HUNT_DURATION_MS } from "./shared";

// Live clocks are anchored to the server's snapshot and monotonic elapsed time.
// Only the server decides the result; reaching zero here never awards a win.
export function useSecondsLeft(endsAt: number | null, serverNow?: number) {
  const anchor = useMemo(
    () => ({
      time: serverNow ?? Date.now(),
      received: performance.now(),
    }),
    [endsAt, serverNow],
  );
  const remaining = () =>
    endsAt === null
      ? HUNT_DURATION_MS / 1000
      : Math.max(
          0,
          Math.ceil(
            (endsAt - anchor.time - (performance.now() - anchor.received)) /
              1000,
          ),
        );
  const [, refresh] = useState(60);
  useEffect(() => {
    if (endsAt === null) return;
    const update = () =>
      refresh(
        Math.max(
          0,
          Math.ceil(
            (endsAt - anchor.time - (performance.now() - anchor.received)) /
              1000,
          ),
        ),
      );
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [endsAt, anchor]);
  // Recompute on a new snapshot immediately; never reuse the old hunt's elapsed time.
  return remaining();
}

export default function HuntClock({
  seconds,
  finished,
  winners = [],
  waiting = false,
}: {
  seconds: number;
  finished: boolean;
  winners?: string[];
  waiting?: boolean;
}) {
  return (
    <div
      className={`hunt-clock ${seconds <= 10 && !finished ? "urgent" : ""} ${finished ? "finished" : ""}`}
    >
      <div
        role="timer"
        aria-label="Time remaining"
        aria-live="off"
        className="clock-digits"
      >
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      </div>
      {finished ? (
        <div className="clock-result" role="status">
          <strong>
            {winners.length
              ? winners.length === 1
                ? "Winner"
                : "Winners"
              : "No survivors"}
          </strong>
          {winners.length > 0 && <span>{winners.join(" · ")}</span>}
        </div>
      ) : waiting ? (
        <small>Survive one minute</small>
      ) : seconds === 0 ? (
        <small>Time’s up</small>
      ) : null}
    </div>
  );
}
