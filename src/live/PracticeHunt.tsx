import {
  advanceMating,
  shiftPetClocks,
  enterMatingRoom,
  matingBusy,
  matingOccupants,
} from "./mating";
import { useEffect, useRef, useState } from "react";
import { CODEX_PETS, PREVIEW_PETS } from "../pets";
import PetAvatar from "../PetAvatar";
import CastleWorld, { type Travel } from "./CastleWorld";
import { preparePetImage } from "./client";
import {
  accessible,
  GATES,
  LIVE_LOCATIONS,
  STAT_LABELS,
  type LivePet,
  type Stats,
} from "./shared";
import "./live.css";
import HuntClock, { useSecondsLeft } from "./HuntClock";
import { HUNT_DURATION_MS, survivorIds } from "./shared";

const CARDS: Record<string, Stats> = {
  cat: { flight: 2, smallness: 4, speed: 4, climb: 7, swim: 3 },
  owl: { flight: 7, smallness: 3, speed: 4, climb: 3, swim: 3 },
  bunny: { flight: 2, smallness: 7, speed: 5, climb: 3, swim: 3 },
  frog: { flight: 2, smallness: 3, speed: 4, climb: 3, swim: 8 },
  ghost: { flight: 5, smallness: 5, speed: 4, climb: 3, swim: 3 },
  dog: { flight: 2, smallness: 3, speed: 8, climb: 4, swim: 3 },
  dragon: { flight: 6, smallness: 2, speed: 5, climb: 4, swim: 3 },
  robot: { flight: 2, smallness: 3, speed: 7, climb: 5, swim: 3 },
};
const starters = (): LivePet[] =>
  PREVIEW_PETS.map((p) => ({
    ...p,
    ownerId: p.id,
    stats: CARDS[p.species],
    readyRound: 1,
    flavor: "Practice guardian",
    origin: "fallback",
  }));
const roomName = (id: string) =>
  LIVE_LOCATIONS.find((l) => l.id === id)?.name ||
  ({ nursery: "Mating room", vet: "The vet" }[id] ?? "Base camp");
const HIDING = [
  "courtyard",
  "tavern",
  "garden",
  "attic",
  "vault",
  "crypt",
  "burrow",
];

export default function PracticeHunt() {
  const [pets, setPets] = useState(starters);
  const [selected, setSelected] = useState(PREVIEW_PETS[0].id);
  const [room, setRoom] = useState("garden");
  const [todd, setTodd] = useState(0);
  const [travel, setTravel] = useState<Travel[]>([]);
  const [paused, setPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [tour, setTour] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [reading, setReading] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [winners, setWinners] = useState<string[] | null>(null);
  const trip = useRef(0);
  const wasTravelling = useRef(false);
  useEffect(() => {
    if (travel.length) {
      wasTravelling.current = true;
      return;
    }
    if (!wasTravelling.current) return;
    wasTravelling.current = false;
    if (endsAt === null || Date.now() >= endsAt || winners !== null) return;
    const found = pets.find((p) => p.location === HIDING[todd] && p.usage > 0);
    if (found) {
      setWinners([found.id]);
      setTour(false);
      setMessage(`${found.name} found the hidden Dot!`);
    }
  }, [travel.length, pets, todd, endsAt, winners]);
  const previousCount = useRef(pets.length);
  const seconds = useSecondsLeft(endsAt, undefined, pausedAt);
  const expired = endsAt !== null && seconds === 0;
  const finished = winners !== null;
  const active = endsAt !== null && !finished && !expired;
  const pet = pets.find((p) => p.id === selected) ?? pets[pets.length - 1];
  const occupancy = matingOccupants(pets).length;
  const busyMating =
    matingBusy(pet) || (pet.location === "nursery" && occupancy === 2);
  useEffect(() => {
    if (pets.length < previousCount.current)
      setMessage(
        `${pets[pets.length - 1].name} emerged. Both players share this pet.`,
      );
    previousCount.current = pets.length;
    if (!pets.some((p) => p.id === selected)) setSelected(pet.id);
  }, [pets, selected, pet.id]);
  useEffect(() => {
    if (paused || finished || expired) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (endsAt !== null && now >= endsAt) return;
      setPets((current) =>
        advanceMating(current, now, () => crypto.randomUUID()),
      );
    }, 100);
    return () => window.clearInterval(timer);
  }, [paused, finished, expired, endsAt]);
  const locked = () =>
    paused || (endsAt !== null && Date.now() >= endsAt) || finished;
  useEffect(() => {
    if (!expired || finished) return;
    const best = Math.max(0, ...pets.map((p) => p.usage));
    setWinners(
      survivorIds(pets, 1).filter(
        (id) => pets.find((p) => p.id === id)!.usage === best,
      ),
    );
    setTour(false);
    setMessage("");
  }, [expired, finished, pets]);
  function start() {
    setPets(starters());
    setWinners(null);
    setEndsAt(Date.now() + HUNT_DURATION_MS);
    setPaused(false);
    setPausedAt(null);
    setTour(true);
    setTodd(Math.floor(Math.random() * HIDING.length));
    trip.current = 0;
    setMessage("");
  }
  function toggleTimer() {
    if (endsAt === null) {
      start();
      return;
    }
    const now = Date.now();
    if (pausedAt !== null) {
      const duration = now - pausedAt;
      setEndsAt((end) => (end === null ? null : end + duration));
      setPets((current) => shiftPetClocks(current, duration));
      setPausedAt(null);
      setPaused(false);
    } else {
      setPausedAt(now);
      setPaused(true);
    }
  }
  function move(id: string) {
    if (locked() || busyMating) return;
    if (!accessible(pet, id)) {
      const gate = GATES[id]!;
      setMessage(
        `Needs ${gate.label || `${STAT_LABELS[gate.stat]} ${gate.min}+`}.`,
      );
      return;
    }
    if (pet.location === id) return;
    if (active && pet.usage < 10) {
      setMessage("Visit the vet to restore usage.");
      return;
    }
    setRoom(id);
    setPets((current) =>
      current.map((p) =>
        p.id === selected
          ? {
              ...p,
              location: id,
              usage: active ? p.usage - 10 : p.usage,
              effect: undefined,
              mating: undefined,
            }
          : p,
      ),
    );
    setMessage("");
  }
  function sendPack() {
    if (locked()) return;
    const turn = trip.current++;
    const first = [
      "workshop",
      "ivory",
      "wardrobe",
      "bathhouse",
      "cinema",
      "dining",
      "rookery",
      "serverloft",
      "drain",
      "coldstorage",
    ];
    setPets((current) =>
      current.map((p, i) => {
        if (p.location === "nursery" || (active && p.usage < 10)) return p;
        const options = LIVE_LOCATIONS.filter(
          (l) => accessible(p, l.id) && l.id !== p.location,
        );
        const preferred =
          turn === 0 ? first[i] : options[(turn + i) % options.length].id;
        return {
          ...p,
          location:
            accessible(p, preferred) && preferred !== p.location
              ? preferred
              : options[0].id,
          usage: active ? p.usage - 10 : p.usage,
          effect: undefined,
        };
      }),
    );
    if (!active) setTodd((current) => (current + 1) % HIDING.length);
    setMessage("");
  }
  useEffect(() => {
    if (!tour || paused || travel.length || finished || expired) return;
    const timer = window.setTimeout(sendPack, 2500);
    return () => window.clearTimeout(timer);
  }, [tour, paused, travel.length, finished, expired, endsAt]);
  return (
    <main className="live-app practice-app" aria-label="Feral practice">
      <HuntClock
        paused={paused}
        onToggle={toggleTimer}
        seconds={finished ? 0 : seconds}
        finished={finished}
        waiting={endsAt === null}
        winners={pets.filter((p) => winners?.includes(p.id)).map((p) => p.name)}
      />
      <CastleWorld
        pets={pets}
        selected={room}
        selectedPet={selected}
        todd={active ? undefined : HIDING[todd]}
        allowed={LIVE_LOCATIONS.filter((l) => accessible(pet, l.id)).map(
          (l) => l.id,
        )}
        onSelect={move}
        onTravelChange={setTravel}
        paused={paused || expired || finished}
      />
      <aside className="practice-controls glass" aria-label="Practice controls">
        <div className="practice-actions">
          <a
            className="back-link"
            href="/"
            aria-label="Back to live game"
            title="Back to live game"
          >
            ←
          </a>
          {finished || expired ? (
            <button className="primary" onClick={start}>
              Play again
            </button>
          ) : (
            <button disabled={paused} onClick={sendPack}>
              Move pack
            </button>
          )}
        </div>
        <div className="practice-pets" aria-label="Choose a guardian">
          {pets.map((p) => (
            <button
              key={p.id}
              aria-pressed={selected === p.id}
              onClick={() => setSelected(p.id)}
              aria-label={`Select ${p.name}`}
              title={`${p.name} · ${p.usage} usage`}
              className={p.usage === 0 ? "exhausted" : ""}
            >
              <PetAvatar pet={p} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
        <div className="practice-card">
          <strong>{pet.name}</strong>
          <span>{pet.usage} usage</span>
        </div>
        <details className="practice-rooms">
          <summary>Move to…</summary>
          <div>
            <input
              aria-label="Find a destination"
              placeholder="Find a room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {LIVE_LOCATIONS.filter((l) =>
              l.name.toLowerCase().includes(search.toLowerCase()),
            ).map((l) => (
              <button
                key={l.id}
                disabled={
                  paused ||
                  busyMating ||
                  expired ||
                  finished ||
                  !accessible(pet, l.id) ||
                  (active && pet.usage < 10)
                }
                aria-pressed={room === l.id}
                onClick={() => move(l.id)}
              >
                {l.name}
                {!accessible(pet, l.id) ? " · locked" : ""}
              </button>
            ))}
          </div>
        </details>
        <button
          disabled={
            paused ||
            expired ||
            finished ||
            busyMating ||
            pet.location === "nursery" ||
            occupancy >= 2 ||
            pet.usage < 20 ||
            travel.some((t) => t.id === pet.id)
          }
          onClick={() => {
            if (locked()) return;
            try {
              const next = enterMatingRoom(pets, pet.id, Date.now());
              setPets(next);
              setTour(false);
              setRoom("nursery");
              setMessage(
                occupancy
                  ? "Two pets. The duvet starts when both arrive."
                  : "Waiting for a second pet. 1/2 places taken.",
              );
            } catch (error) {
              setMessage((error as Error).message);
            }
          }}
        >
          {busyMating ? "Merging… ♥" : `Mating room · ${occupancy}/2`}
        </button>
        {active && pet.usage < 100 && (
          <button
            disabled={paused || busyMating}
            onClick={() => {
              if (locked()) return;
              setPets((current) =>
                current.map((p) =>
                  p.id === selected
                    ? {
                        ...p,
                        usage: Math.min(100, p.usage + 50),
                        location: "vet",
                        mating: undefined,
                        tipsy: false,
                        effect: { kind: "vet", at: Date.now() },
                      }
                    : p,
                ),
              );
            }}
          >
            Vet · +50 usage
          </button>
        )}
        <details className="secondary-controls">
          <summary>More</summary>
          <small>
            {roomName(pet.location)} ·{" "}
            {Object.entries(pet.stats)
              .map(([k, n]) => `${STAT_LABELS[k as keyof Stats]} ${n}`)
              .join(" · ")}
          </small>
          <details className="codex-pet-picker">
            <summary>Codex companions</summary>
            <div className="practice-pets">
              {CODEX_PETS.map((companion) => (
                <button
                  key={companion.id}
                  disabled={
                    reading ||
                    busyMating ||
                    pet.location === "nursery" ||
                    travel.some((t) => t.id === pet.id)
                  }
                  aria-label={`Use ${companion.name}`}
                  onClick={() => {
                    setPets((current) =>
                      current.map((p) =>
                        p.id === pet.id
                          ? {
                              ...p,
                              name: companion.name,
                              image: companion.image,
                              spriteRows: companion.spriteRows,
                            }
                          : p,
                      ),
                    );
                  }}
                >
                  <PetAvatar pet={companion} />
                  <span>{companion.name}</span>
                </button>
              ))}
            </div>
          </details>
          <label className="practice-upload">
            {reading ? "Loading…" : "Change pet image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={
                reading || busyMating || travel.some((t) => t.id === selected)
              }
              onChange={async (e) => {
                const input = e.currentTarget,
                  file = input.files?.[0];
                if (!file) return;
                const id = selected;
                setReading(true);
                try {
                  const art = await preparePetImage(file);
                  setPets((current) =>
                    current.map((p) =>
                      p.id === id
                        ? { ...p, ...art, spriteRows: art.spriteRows }
                        : p,
                    ),
                  );
                  setMessage("");
                } catch (error) {
                  setMessage((error as Error).message);
                } finally {
                  setReading(false);
                  input.value = "";
                }
              }}
            />
          </label>
          <button
            aria-pressed={tour}
            disabled={finished || expired}
            onClick={() => setTour(!tour)}
          >
            {tour ? "Stop auto-move" : "Auto-move pack"}
          </button>
          <button
            disabled={paused || finished || expired}
            onClick={() => setTodd((current) => (current + 1) % HIDING.length)}
          >
            Move Todd
          </button>
          <button
            onClick={() => {
              setEndsAt(null);
              setWinners(null);
              setPets(starters());
              setPaused(false);
              setPausedAt(null);
              setTour(false);
              trip.current = 0;
              setTodd(0);
              setMessage("");
            }}
          >
            Reset practice
          </button>
          <small>
            Practice only. Moves cost 10 usage; the vet restores 50. Stop pauses
            the clock and movement. Phone play includes hidden bottles and
            Tibo’s reset. Two pets in the mating room merge after eight seconds;
            both owners share the new pet.
          </small>
        </details>
        {message && (
          <p className="practice-message" role="status">
            {message}
          </p>
        )}
      </aside>
    </main>
  );
}
