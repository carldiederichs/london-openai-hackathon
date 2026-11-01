import { useEffect, useRef, useState } from "react";
import { PREVIEW_PETS } from "../pets";
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
  LIVE_LOCATIONS.find((l) => l.id === id)?.name || "Base camp";
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
  const [pets, setPets] = useState(starters),
    [selected, setSelected] = useState(PREVIEW_PETS[0].id);
  const [room, setRoom] = useState("garden"),
    [todd, setTodd] = useState(0);
  const [travel, setTravel] = useState<Travel[]>([]),
    [paused, setPaused] = useState(false);
  const [tour, setTour] = useState(false),
    [message, setMessage] = useState(
      "Choose a guardian, then click a room. Or send the whole pack.",
    );
  const [search, setSearch] = useState("");
  const [reading, setReading] = useState(false),
    trip = useRef(0);
  const pet = pets.find((p) => p.id === selected)!;
  function move(id: string) {
    if (paused) return;
    setRoom(id);
    if (!accessible(pet, id)) {
      const gate = GATES[id]!;
      setMessage(
        `${pet.name} cannot enter ${roomName(id)}. Needs ${gate.label || `${STAT_LABELS[gate.stat]} ${gate.min}+`}.`,
      );
      return;
    }
    if (pet.location === id) {
      setMessage(`${pet.name} is already in ${roomName(id)}.`);
      return;
    }
    setPets((current) =>
      current.map((p) => (p.id === selected ? { ...p, location: id } : p)),
    );
    setMessage(`${pet.name} → ${roomName(id)}`);
  }
  function sendPack() {
    const turn = trip.current++;
    // First excursion deliberately shows walking, flying, swimming, climbing,
    // and narrow entrances at once. Later excursions choose other legal rooms.
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
        };
      }),
    );
    setTodd((current) => (current + 1) % HIDING.length);
    setMessage(
      "The pack is on the move. Follow the name tags and route lines.",
    );
  }
  useEffect(() => {
    if (!tour || paused || travel.length) return;
    const timer = window.setTimeout(() => sendPack(), 2500);
    return () => window.clearTimeout(timer);
  }, [tour, paused, travel.length]);
  return (
    <main className="live-app practice-app" aria-label="Pet movement practice">
      <CastleWorld
        pets={pets}
        selected={room}
        selectedPet={selected}
        todd={HIDING[todd]}
        allowed={LIVE_LOCATIONS.filter((l) => accessible(pet, l.id)).map(
          (l) => l.id,
        )}
        onSelect={move}
        onTravelChange={setTravel}
        paused={paused}
      />
      <aside className="practice-controls glass" aria-label="Practice controls">
        <div className="practice-title">
          <a href="/" aria-label="Back to live game">
            ←
          </a>
          <span>Practice · no phone needed</span>
        </div>
        <p>
          Ten guardians. One misaligned Todd. Click a room to send your selected
          pet there.
        </p>
        <div className="practice-actions">
          <button className="primary" disabled={paused} onClick={sendPack}>
            Send the pack ↗
          </button>
          <button aria-pressed={paused} onClick={() => setPaused(!paused)}>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
        <div className="practice-actions">
          <button
            disabled={paused}
            onClick={() => setTodd((current) => (current + 1) % HIDING.length)}
          >
            Todd, run!
          </button>
          <button
            aria-pressed={tour}
            disabled={paused}
            onClick={() => {
              if (!tour) sendPack();
              setTour(!tour);
            }}
          >
            {tour ? "Stop tour" : "Loop tour"}
          </button>
        </div>
        <div className="practice-pets" aria-label="Choose a guardian">
          {pets.map((p) => (
            <button
              key={p.id}
              aria-pressed={selected === p.id}
              onClick={() => setSelected(p.id)}
              aria-label={`Select ${p.name}`}
            >
              <PetAvatar pet={p} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
        <div className="practice-card">
          <strong>{pet.name}</strong>
          <span>{roomName(pet.location)}</span>
          <small>
            {Object.entries(pet.stats)
              .map(([key, n]) => `${STAT_LABELS[key as keyof Stats]} ${n}`)
              .join(" · ")}
          </small>
        </div>
        <label className="practice-upload">
          {reading ? "Loading sprite…" : `Use your pet as ${pet.name}`}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={reading || travel.some((t) => t.id === selected)}
            onChange={async (e) => {
              const file = e.target.files?.[0];
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
                setMessage(
                  art.spriteRows
                    ? "Codex sprite loaded. Running frames play during travel; idle frames play at rest."
                    : "Pet image loaded. Send your guardian to a room.",
                );
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setReading(false);
                e.target.value = "";
              }
            }}
          />
        </label>
        <small>
          PNG / WebP / JPEG, or a Codex sprite sheet (1536 × 1872 or 1536 ×
          2288). Stays in this tab. Practice cards keep their existing
          abilities.
        </small>
        <details className="practice-rooms">
          <summary>Choose a destination</summary>
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
                disabled={paused || !accessible(pet, l.id)}
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
          onClick={() => {
            setTour(false);
            setPaused(false);
            setPets(starters());
            setTodd(0);
            trip.current = 0;
            setMessage("Guardians are heading back to base camp.");
          }}
        >
          Back to base camp
        </button>
      </aside>
      <section className="practice-status glass" aria-label="Movement status">
        <div>
          <i className={travel.length ? "in-motion" : ""} />
          <strong>
            {paused
              ? "Movement paused"
              : travel.length
                ? `${travel.length} guardians travelling`
                : "Ready to explore"}
          </strong>
        </div>
        <p role="status">{message}</p>
        {travel.length > 0 && (
          <div className="travel-list">
            {travel.map((p) => (
              <small key={p.id}>
                {p.name}{" "}
                <span>
                  {p.mode === "fly"
                    ? "flies"
                    : p.mode === "swim"
                      ? "swims"
                      : p.mode === "climb"
                        ? "climbs"
                        : "runs"}{" "}
                  → {roomName(p.to)}
                </span>
              </small>
            ))}
          </div>
        )}
        <p className="todd-status">
          ● Todd · {roomName(HIDING[todd])}
          <small>
            Visible for rehearsal. Live hiding locations stay secret.
          </small>
        </p>
      </section>
    </main>
  );
}
