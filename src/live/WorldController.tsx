import { useEffect, useRef, useState } from "react";
import PetAvatar from "../PetAvatar";
import {
  LIVE_LOCATIONS,
  ownsPet,
  type PublicRoom,
  type Session,
} from "./shared";
import { navigationPoints } from "./movement";
const points = navigationPoints();
const directions = [
  { label: "north", key: "W", dx: 0, dz: -1, icon: "↑" },
  { label: "west", key: "A", dx: -1, dz: 0, icon: "←" },
  { label: "south", key: "S", dx: 0, dz: 1, icon: "↓" },
  { label: "east", key: "D", dx: 1, dz: 0, icon: "→" },
];
export default function WorldController({
  room,
  session,
  connected,
  steer,
  send,
}: {
  room: PublicRoom;
  session: Session;
  connected: boolean;
  send: (event: string, data?: unknown) => Promise<void>;
  steer: (dx: number, dz: number, generation: number) => void;
}) {
  const pet = room.pets.find((p) => ownsPet(p, session.playerId));
  const latest = useRef({ room, pet, connected, steer });
  latest.current = { room, pet, connected, steer };
  const held = useRef(new Set<string>()),
    pulse = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pressed, setPressed] = useState<string[]>([]);
  const [error, setError] = useState("");
  async function go(location: string) {
    try {
      release();
      await send("player:destination", {
        location,
        generation: room.generation,
      });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const enabled =
    connected &&
    ["lobby", "seeking"].includes(room.phase) &&
    room.pausedAt === null &&
    !!pet &&
    pet.usage > 0 &&
    !pet.mating?.finishesAt;
  function emit() {
    const state = latest.current,
      p = state.pet;
    const active =
      state.connected &&
      ["lobby", "seeking"].includes(state.room.phase) &&
      state.room.pausedAt === null &&
      p &&
      p.usage > 0 &&
      !p.mating?.finishesAt;
    let dx = 0,
      dz = 0;
    if (active)
      for (const direction of directions)
        if (held.current.has(direction.label)) {
          dx += direction.dx;
          dz += direction.dz;
        }
    state.steer(dx, dz, state.room.generation);
  }
  function release(name?: string) {
    if (name) held.current.delete(name);
    else held.current.clear();
    setPressed([...held.current]);
    emit();
  }
  function hold(name: string) {
    clearTimeout(pulse.current);
    held.current.add(name);
    setPressed([...held.current]);
    emit();
  }
  useEffect(() => {
    const keys: Record<string, string> = {
      w: "north",
      ArrowUp: "north",
      a: "west",
      ArrowLeft: "west",
      s: "south",
      ArrowDown: "south",
      d: "east",
      ArrowRight: "east",
    };
    const down = (event: KeyboardEvent) => {
      const key = keys[event.key] ?? keys[event.key.toLowerCase()];
      if (
        !key ||
        /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName)
      )
        return;
      event.preventDefault();
      hold(key);
    };
    const up = (event: KeyboardEvent) => {
      const key = keys[event.key] ?? keys[event.key.toLowerCase()];
      if (!key) return;
      held.current.delete(key);
      setPressed([...held.current]);
      emit();
    };
    const visibility = () => {
      if (document.hidden) release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const stop = () => release();
    window.addEventListener("blur", stop);
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(() => {
      if (held.current.size) emit();
    }, 100);
    return () => {
      clearInterval(timer);
      clearTimeout(pulse.current);
      held.current.clear();
      latest.current.steer(0, 0, latest.current.room.generation);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop);
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    release();
  }, [enabled, room.generation]);
  if (!pet) return null;
  const location =
    LIVE_LOCATIONS.find((l) => l.id === pet.location)?.name ??
    { nursery: "Mating room", vet: "The vet", camp: "Base camp" }[
      pet.location
    ] ??
    "Castle paths";
  return (
    <section
      className="live-panel world-controller"
      aria-label="Pet controller"
    >
      <div className="controller-pet">
        <PetAvatar pet={pet} />
        <div>
          <strong>{pet.name}</strong>
          <small>{location}</small>
        </div>
      </div>
      <progress aria-label="Pet usage" value={pet.usage} max={100} />
      <small>
        {Math.ceil(pet.usage)} usage · {room.playerCount}{" "}
        {room.playerCount === 1 ? "player" : "players"}
      </small>
      <svg
        className="controller-map"
        viewBox="-48 -80 96 145"
        role="img"
        aria-label="Your position in the castle; north is up"
      >
        <path
          d="M-44 -74H44V1H-44ZM-18 -59H18V-25H-18ZM-34 5H42V57H-34Z"
          fill="none"
          stroke="currentColor"
          strokeWidth=".7"
        />
        {LIVE_LOCATIONS.map((l) => (
          <circle
            key={l.id}
            cx={points[l.id]?.[0]}
            cy={points[l.id]?.[2]}
            r=".7"
            fill="currentColor"
            opacity=".5"
          />
        ))}
        {pet.position && (
          <circle
            cx={pet.position[0]}
            cy={pet.position[2]}
            r="2"
            fill="#f0d99e"
          />
        )}
        <text
          x="0"
          y="-76"
          textAnchor="middle"
          fill="currentColor"
          fontSize="4"
        >
          N
        </text>
      </svg>
      <div className="direction-pad" aria-label="Movement controls">
        {directions.map((d) => (
          <button
            key={d.label}
            className={`direction-${d.label}`}
            aria-label={`Move ${d.label}`}
            aria-pressed={pressed.includes(d.label)}
            disabled={!enabled}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              hold(d.label);
            }}
            onPointerUp={() => release(d.label)}
            onPointerCancel={() => release(d.label)}
            onLostPointerCapture={() => release(d.label)}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              // Pointer handlers already moved and stopped the pet. Only pulse for keyboard clicks.
              if (e.detail !== 0) return;
              hold(d.label);
              pulse.current = setTimeout(() => release(d.label), 180);
            }}
          >
            <span>{d.icon}</span>
            <kbd>{d.key}</kbd>
          </button>
        ))}
      </div>
      {room.phase !== "lobby" && (
        <div className="care-shortcuts">
          <button disabled={!enabled} onClick={() => go("vet")}>
            Go to vet
          </button>
          <button
            disabled={!enabled || pet.usage < 20}
            onClick={() => go("nursery")}
          >
            Mating room
          </button>
        </div>
      )}
      {error && <small role="alert">{error}</small>}
      <small role="status">
        {!connected
          ? "Reconnecting…"
          : room.phase === "lobby"
            ? "Explore with the arrows. The hunt starts at the countdown."
            : room.phase === "over"
              ? room.winnerPetIds.includes(pet.id)
                ? "You won!"
                : "Game over."
              : room.pausedAt !== null
                ? "Game stopped by the host."
                : pet.usage <= 0
                  ? "Out of usage. Play again next game."
                  : pet.mating?.finishesAt
                    ? "Under the duvet… merging with your partner."
                    : "Hold arrows or WASD. Follow the paths; entering a room searches it."}
      </small>
    </section>
  );
}
