import { ANCESTORS, ROOM_LORE } from "./lore";
import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { PREVIEW_PETS } from "../pets";
import PetAvatar from "../PetAvatar";
import {
  accessible,
  CONSTRAINTS,
  GATES,
  LIVE_LOCATIONS,
  STAT_KEYS,
  STAT_LABELS,
  validatePrompt,
  type LivePet,
  type MoveInput,
  type PublicRoom,
  type Session,
  type Stats,
} from "./shared";
import {
  post,
  readSession,
  preparePetImage,
  saveSession,
  sessionKey,
  useRoom,
} from "./client";
import Cheering from "./Cheering";
import type { Travel } from "./CastleWorld";
import "./live.css";
const CastleWorld = lazy(() => import("./CastleWorld"));
const previewPets = PREVIEW_PETS;
const locationName = (id: string) =>
  LIVE_LOCATIONS.find((l) => l.id === id)?.name ||
  ({ camp: "Base camp", vet: "The vet", nursery: "Nursery" }[id] ?? id);
function StatsCard({ stats }: { stats: Stats }) {
  return (
    <div className="stat-grid">
      {STAT_KEYS.map((key) => (
        <div key={key}>
          <span>{STAT_LABELS[key]}</span>
          <div className="stat-track">
            <i style={{ width: `${(stats[key] / 8) * 100}%` }} />
          </div>
          <strong>{stats[key]}</strong>
        </div>
      ))}
    </div>
  );
}
function QRJoin({ code, base }: { code: string; base: string }) {
  const [qr, setQr] = useState(""),
    [address, setAddress] = useState(base || window.location.origin);
  const url = `${address.replace(/\/$/, "")}/play/${code}`;
  useEffect(() => {
    if (base) setAddress(base);
  }, [base]);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      color: { dark: "#34433b", light: "#fffefa" },
    }).then((image) => {
      if (alive) setQr(image);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <section className="live-panel join-panel">
      {qr && (
        <img
          src={qr}
          alt={`Scan to join room ${code}`}
          width="130"
          height="130"
        />
      )}
      <div>
        <p>Same Wi-Fi as the host. Up to ten players.</p>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
        <details>
          <summary>Connection settings</summary>
          <label>
            Host address
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="http://your-host:4173"
            />
          </label>
          <small>
            Use the laptop's reachable Wi-Fi address. On public Wi-Fi, devices
            may be isolated; try a shared hotspot.
          </small>
        </details>
      </div>
    </section>
  );
}
function JoinForm({
  code,
  onJoined,
}: {
  code: string;
  onJoined: (s: Session) => void;
}) {
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [image, setImage] = useState(""),
    [spriteRows, setSpriteRows] = useState<9 | 11 | undefined>(),
    [busy, setBusy] = useState(false),
    [reading, setReading] = useState(false),
    [error, setError] = useState("");
  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onJoined(
        await post<Session>(`/api/rooms/${code}/join`, {
          name,
          description,
          ...(image ? { image, spriteRows } : {}),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="live-panel join-form">
      <p>Upload an image or describe your pet. Every card has 20 points.</p>
      <form onSubmit={join}>
        <label>
          Pet name
          <input
            required
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Professor Waffles"
            autoComplete="off"
          />
        </label>
        <label>
          Describe your pet
          <textarea
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A tiny dragon with teacup wings and excellent swimming skills"
          />
        </label>
        <label className="upload-label">
          Pet image (optional)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy || reading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setReading(true);
              setError("");
              try {
                const prepared = await preparePetImage(file);
                setImage(prepared.image);
                setSpriteRows(prepared.spriteRows);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setReading(false);
              }
            }}
          />
        </label>
        {image && (
          <div className="upload-preview">
            <PetAvatar
              pet={{
                name: "Your selected pet",
                species: "cat",
                color: "#fff",
                image,
                spriteRows,
              }}
            />
            <button
              type="button"
              onClick={() => {
                setImage("");
                setSpriteRows(undefined);
              }}
            >
              Remove image
            </button>
          </div>
        )}
        <small>
          Your resized image and description are sent to the game server and,
          when configured, OpenAI to make your card. The server keeps images
          only in memory.
        </small>
        <button
          className="primary"
          disabled={busy || reading || (!image && !description.trim())}
        >
          {busy
            ? "Creating card…"
            : reading
              ? "Preparing image…"
              : "Join the hunt"}
        </button>
        {error && (
          <p role="alert" className="live-error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
function PlayerControls({
  room,
  session,
  disabled,
  send,
  onPet,
}: {
  room: PublicRoom;
  session: Session;
  disabled: boolean;
  send: (event: string, data?: unknown) => Promise<void>;
  onPet: (p: LivePet) => void;
}) {
  const owned = room.pets.filter((p) => p.ownerId === session.playerId),
    [selected, setSelected] = useState(""),
    [action, setAction] = useState<"seek" | "breed" | "vet">("seek"),
    [prompt, setPrompt] = useState(""),
    [partner, setPartner] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pet = owned.find((p) => p.id === selected) || owned[0],
    locked = room.submitted.includes(session.playerId!),
    rule = CONSTRAINTS[room.constraint];
  useEffect(() => {
    setPrompt("");
    setError("");
    setBusy(false);
  }, [room.round, room.generation]);
  useEffect(() => {
    if (pet) onPet(pet);
  }, [pet, onPet]);
  if (!pet) return null;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const move: MoveInput =
        action === "seek"
          ? { type: "seek", petId: pet.id, prompt }
          : action === "breed"
            ? { type: "breed", petId: pet.id, partnerId: partner }
            : { type: "vet", petId: pet.id };
      await send("player:submit", {
        move,
        round: room.round,
        generation: room.generation,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const unavailable =
    disabled ||
    busy ||
    room.phase !== "seeking" ||
    locked ||
    pet.readyRound > room.round;
  return (
    <section className="live-panel player-controls">
      <div className="pet-identity">
        <PetAvatar pet={pet} />
        <div>
          <strong className="pet-name">{pet.name}</strong>
          <small>
            {pet.origin === "ai"
              ? "AI card"
              : pet.origin === "bred"
                ? "Bred card"
                : "Offline card"}{" "}
            · {locationName(pet.location)}
            {pet.tipsy ? " · Tipsy (−2 move priority)" : ""}
          </small>
        </div>
      </div>
      {owned.length > 1 && (
        <label>
          Choose your pet
          <select
            value={pet.id}
            onChange={(e) => setSelected(e.target.value)}
            disabled={locked}
          >
            {owned.map((p) => (
              <option
                value={p.id}
                key={p.id}
                disabled={p.readyRound > room.round}
              >
                {p.name}
                {p.readyRound > room.round ? " (ready next round)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="usage-row">
        <span>Usage limit</span>
        <strong>{pet.usage} / 100</strong>
      </div>
      <progress max={100} value={pet.usage} aria-label="Pet usage" />
      <details>
        <summary>Abilities · 20 points</summary>
        <StatsCard stats={pet.stats} />
        <small>
          A score of 5 unlocks its room. Speed decides action order.
        </small>
      </details>
      {room.phase === "lobby" ? (
        <p className="state-note">
          You're in! Waiting for the host to start the hunt.
        </p>
      ) : locked ? (
        <p className="state-note" role="status">
          Move locked in. Watch the castle when the host resolves the round.
        </p>
      ) : (
        <form onSubmit={submit}>
          <label>
            Action
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as typeof action)}
              disabled={unavailable}
            >
              <option value="seek">Move + seek · 10 usage</option>
              <option value="breed">Breed · 20 usage per parent</option>
              <option value="vet">Visit the vet · restore up to 50</option>
            </select>
          </label>
          {action === "seek" ? (
            <>
              <p className="prompt-rule">{rule.help}</p>
              <label>
                Your seeking prompt
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={rule.example}
                  maxLength={220}
                  disabled={unavailable}
                />
              </label>
              <small>
                {validatePrompt(prompt, room.constraint) ||
                  "Ready to send. The game enforces your pet’s abilities."}
              </small>
            </>
          ) : action === "breed" ? (
            <>
              <label>
                Other parent
                <select
                  value={partner}
                  onChange={(e) => setPartner(e.target.value)}
                  disabled={unavailable}
                >
                  <option value="">Choose another player's pet</option>
                  {room.pets
                    .filter(
                      (p) =>
                        p.ownerId !== session.playerId &&
                        p.readyRound <= room.round,
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id} disabled={p.usage < 20}>
                        {p.name} · {p.usage} usage
                      </option>
                    ))}
                </select>
              </label>
              <p>
                Both players must choose each other's pet this round. The faster
                parent’s player owns the baby, ready next round. Both players
                spend their action.
              </p>
            </>
          ) : (
            <p>
              The vet restores 50 usage, up to 100. This uses your turn. Pets
              with zero usage can still visit.
            </p>
          )}
          <button
            className="primary"
            disabled={
              unavailable ||
              (action === "seek" &&
                (!!validatePrompt(prompt, room.constraint) ||
                  pet.usage < 10)) ||
              (action === "vet" && pet.usage === 100) ||
              (action === "breed" && (!partner || pet.usage < 20))
            }
          >
            {busy
              ? "Sending…"
              : room.phase === "seeking"
                ? "Lock in action"
                : "Wait for the next round"}
          </button>
        </form>
      )}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export default function LiveApp() {
  const route = window.location.pathname.match(
      /^\/(host|play)\/([A-Za-z0-9]{6})\/?$/,
    ),
    code = route?.[2].toUpperCase() || "",
    role = route?.[1] === "host" ? "host" : "player";
  const [session, setSession] = useState<Session | null>(() =>
    code ? readSession(role, code) : null,
  );
  const { room, connected, error: connectionError, send } = useRoom(session);
  const [travel, setTravel] = useState<Travel[]>([]);
  const [selected, setSelected] = useState("courtyard"),
    [pet, setPet] = useState<LivePet | null>(null),
    [joinCode, setJoinCode] = useState(""),
    [config, setConfig] = useState<{
      configured: boolean;
      model: string;
      joinBase: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState<"restart" | "resolve" | null>(null),
    [panel, setPanel] = useState<
      "rooms" | "players" | "log" | "rules" | "join" | "cheer" | null
    >(null),
    [joinOpen, setJoinOpen] = useState(false);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setConfig)
      .catch(() =>
        setError(
          "The room server is unavailable. Run npm run dev, then reload.",
        ),
      );
  }, []);
  async function command(event: string, data: unknown = {}) {
    setBusy(true);
    setError("");
    try {
      await send(event, data);
      setConfirm(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      const s = await post<Session>("/api/rooms", {});
      saveSession(s);
      window.location.assign(`/host/${s.roomCode}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function joined(s: Session) {
    saveSession(s);
    setSession(s);
  }
  const isHost = session?.role === "host",
    ai = room?.ai || config,
    roomInfo = LIVE_LOCATIONS.find((l) => l.id === selected)!,
    gate = GATES[selected],
    allowed = pet
      ? LIVE_LOCATIONS.filter((l) => accessible(pet, l.id)).map((l) => l.id)
      : undefined;
  const joinBase = ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname,
  )
    ? config?.joinBase || window.location.origin
    : window.location.origin;
  const toggle = (next: typeof panel) =>
    setPanel((current) => (current === next ? null : next));
  const [roomQuery, setRoomQuery] = useState("");
  const roomMenu = (
    <div className="glass room-list" aria-label="Castle rooms">
      <input
        aria-label="Find a hiding place"
        placeholder="Find a place…"
        value={roomQuery}
        onChange={(e) => setRoomQuery(e.target.value)}
      />
      {LIVE_LOCATIONS.filter((l) =>
        `${l.name} ${l.subtitle}`
          .toLowerCase()
          .includes(roomQuery.toLowerCase()),
      ).map((l) => {
        const i = LIVE_LOCATIONS.findIndex((p) => p.id === l.id);
        const g = GATES[l.id],
          can = !pet || accessible(pet, l.id);
        return (
          <button
            key={l.id}
            aria-pressed={selected === l.id}
            onClick={() => setSelected(l.id)}
          >
            <span>
              {i + 1} · {l.name}
              {!can ? " · locked" : ""}
            </span>
            <small>
              {room?.ruledOut.includes(l.id)
                ? "Ruled out"
                : g
                  ? g.label || `${STAT_LABELS[g.stat]} ${g.min}+`
                  : "Open"}
            </small>
          </button>
        );
      })}
      <p>{roomInfo.subtitle}</p>
      <p className="room-lore">{ROOM_LORE[selected]}</p>
    </div>
  );
  return (
    <main
      className={`live-app ${code && role === "player" ? "has-player" : ""} ${panel ? "panel-open" : ""}`}
      aria-label="Castle hide and seek"
    >
      <Suspense
        fallback={
          <div className="world-loading" role="status">
            Loading castle…
          </div>
        }
      >
        <CastleWorld
          pets={room?.pets || previewPets}
          selected={selected}
          todd={room?.phase === "lobby" ? "courtyard" : room?.reveal?.location}
          selectedPet={pet?.id}
          onTravelChange={setTravel}
          onSelect={(id) => {
            setSelected(id);
            setPanel("rooms");
          }}
          allowed={allowed}
        />
      </Suspense>
      <aside className="hud hud-left" aria-label="Room controls">
        <div className="glass session-controls">
          {!code ? (
            <>
              <button
                className="primary"
                disabled={busy || !config}
                onClick={create}
              >
                {busy ? "Creating…" : "Create room"}
              </button>
              <button
                aria-expanded={joinOpen}
                onClick={() => setJoinOpen(!joinOpen)}
              >
                Join room
              </button>
              <a className="practice-link" href="/practice">
                Try pet movement ↗
              </a>
              {joinOpen && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    window.location.assign(`/play/${joinCode.toUpperCase()}`);
                  }}
                >
                  <label>
                    Room code
                    <input
                      aria-label="Room code"
                      pattern="[A-Za-z0-9]{6}"
                      required
                      maxLength={6}
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase())
                      }
                      placeholder="ABC123"
                    />
                  </label>
                  <button type="submit">Join</button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="room-line">
                <a
                  href="/"
                  aria-label="Return to room creation"
                  title="Return to room creation"
                >
                  ←
                </a>
                <span>{code}</span>
                {room && <span>R{room.round}/4</span>}
                <i
                  className={connected ? "online" : "offline"}
                  title={connected ? "Connected" : "Reconnecting"}
                  aria-label={connected ? "Connected" : "Reconnecting"}
                />
              </div>
              {room && (
                <small>
                  {room.players.length}/10 players · {room.submitted.length}/
                  {room.players.length} ready
                </small>
              )}
            </>
          )}
          <small className="ai-label">
            {ai?.configured ? "AI enabled" : "Offline rules"}
            {room && room.ai.fallbackCount > 0
              ? ` · ${room.ai.fallbackCount} fallbacks`
              : ""}
          </small>
          {travel.length > 0 && (
            <small role="status">
              {travel.length === 1
                ? "1 guardian travelling to its room…"
                : `${travel.length} guardians travelling to their rooms…`}
            </small>
          )}
          {room && isHost && (
            <div className="round-buttons">
              {room.phase === "lobby" && (
                <button
                  className="primary"
                  disabled={busy || !connected || !room.players.length}
                  onClick={() => command("host:start")}
                >
                  Start hunt
                </button>
              )}
              {room.phase === "seeking" && (
                <button
                  className="primary"
                  disabled={busy || !connected}
                  onClick={() =>
                    room.submitted.length < room.players.length
                      ? setConfirm("resolve")
                      : command("host:resolve", {
                          round: room.round,
                          generation: room.generation,
                        })
                  }
                >
                  Resolve {room.submitted.length} moves
                </button>
              )}
              {room.phase === "results" && (
                <button
                  className="primary"
                  disabled={busy || !connected || travel.length > 0}
                  onClick={() => command("host:next")}
                >
                  {travel.length ? "Pets travelling…" : "Next round"}
                </button>
              )}
              {["hiding", "resolving"].includes(room.phase) && (
                <p role="status">
                  {room.phase === "hiding"
                    ? "Todd is hiding…"
                    : "Resolving moves…"}
                </p>
              )}
              <button
                disabled={
                  busy ||
                  !connected ||
                  ["hiding", "resolving"].includes(room.phase)
                }
                onClick={() => setConfirm("restart")}
              >
                Reset hunt
              </button>
            </div>
          )}
        </div>
        <nav className="glass side-tools" aria-label="Game panels">
          <button
            aria-label="Rooms"
            title="Rooms"
            aria-pressed={panel === "rooms"}
            onClick={() => toggle("rooms")}
          >
            <span className="tool-icon" aria-hidden="true">
              ◇
            </span>
            <span className="tool-name">Rooms</span>
          </button>
          {room && (
            <>
              <button
                aria-label="Petdex"
                title="Petdex"
                aria-pressed={panel === "players"}
                onClick={() => toggle("players")}
              >
                <span className="tool-icon" aria-hidden="true">
                  ♟
                </span>
                <span className="tool-name">Petdex</span>
              </button>
              <button
                aria-label="Log"
                title="Log"
                aria-pressed={panel === "log"}
                onClick={() => toggle("log")}
              >
                <span className="tool-icon" aria-hidden="true">
                  ≡
                </span>
                <span className="tool-name">Log</span>
              </button>
              {isHost && (
                <>
                  <button
                    aria-label="Invite"
                    title="Invite"
                    aria-pressed={panel === "join"}
                    onClick={() => toggle("join")}
                  >
                    <span className="tool-icon" aria-hidden="true">
                      +
                    </span>
                    <span className="tool-name">Invite</span>
                  </button>
                  <button
                    aria-label="Audience"
                    title="Audience"
                    aria-pressed={panel === "cheer"}
                    onClick={() => toggle("cheer")}
                  >
                    <span className="tool-icon" aria-hidden="true">
                      ♪
                    </span>
                    <span className="tool-name">Audience</span>
                  </button>
                </>
              )}
            </>
          )}
          <button
            aria-label="Rules"
            title="Rules"
            aria-pressed={panel === "rules"}
            onClick={() => toggle("rules")}
          >
            <span className="tool-icon" aria-hidden="true">
              ?
            </span>
            <span className="tool-name">Rules</span>
          </button>
        </nav>
        {panel === "rooms" && roomMenu}
        {confirm && (
          <div className="glass confirm-panel" role="alert">
            <p>
              {confirm === "resolve"
                ? `${room!.players.length - room!.submitted.length} players will rest. Resolve now?`
                : "Reset this hunt? Players keep their original pets; babies and progress are cleared."}
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                command(
                  confirm === "resolve" ? "host:resolve" : "host:restart",
                  confirm === "resolve"
                    ? { round: room!.round, generation: room!.generation }
                    : {},
                )
              }
            >
              {confirm === "resolve" ? "Resolve anyway" : "Restart hunt"}
            </button>
            <button onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        )}
        {(error || connectionError) && (
          <div className="glass live-error" role="alert">
            {error || connectionError}
            {session && connectionError && (
              <button
                onClick={() => {
                  sessionStorage.removeItem(
                    sessionKey(session.role, session.roomCode),
                  );
                  window.location.reload();
                }}
              >
                Forget session
              </button>
            )}
          </div>
        )}
        {room?.outcome && (
          <p className="glass outcome" role="status">
            {room.outcome === "caught"
              ? "Todd caught. Seekers win."
              : "Todd escaped after four rounds."}
          </p>
        )}
      </aside>
      <aside className="hud hud-right" aria-label="Player and game details">
        {selected === "archives" && panel === "rooms" && (
          <div className="glass ancestral-gallery">
            {ANCESTORS.map((a) => (
              <details key={a.name}>
                <summary>{a.name}</summary>
                <div
                  role="img"
                  aria-label={`Antique portrait of ${a.name}`}
                  className="ancestor-photo"
                  style={{ backgroundPosition: a.position }}
                />
                <small>{a.era}</small>
                <p>
                  <em>{a.epitaph}</em>
                </p>
              </details>
            ))}
          </div>
        )}
        {panel === "rooms" && code && role === "player" && (
          <div className="mobile-room-panel">{roomMenu}</div>
        )}
        {code &&
          !session &&
          (role === "player" ? (
            <JoinForm code={code} onJoined={joined} />
          ) : (
            <div className="glass">
              <p>
                No host session in this tab. Return to the tab that created this
                room.
              </p>
              <a href="/">Create another room</a>
            </div>
          ))}
        {session && !room && (
          <p className="glass" role="status">
            Connecting…
          </p>
        )}
        {room && session && !isHost && (
          <PlayerControls
            room={room}
            session={session}
            disabled={busy || !connected}
            send={send}
            onPet={setPet}
          />
        )}
        {room &&
          isHost &&
          (panel === "join" || (room.phase === "lobby" && !panel)) && (
            <QRJoin code={room.code} base={joinBase} />
          )}
        {room && isHost && panel === "cheer" && (
          <Cheering room={room} disabled={busy || !connected} send={send} />
        )}
        {room?.clue && (
          <p className="glass clue" role="status">
            {room.clue}
          </p>
        )}
        {room?.reveal && (
          <div className="glass reveal-panel">
            <p>Todd was in {locationName(room.reveal.location)}.</p>
            <details>
              <summary>Reveal details</summary>
              <p>{room.reveal.summary}</p>
              <StatsCard stats={room.reveal.stats} />
            </details>
          </div>
        )}
        {room && panel === "players" && (
          <div className="glass live-roster">
            <a href="https://petdex.dev/" target="_blank" rel="noreferrer">
              Browse Petdex ↗
            </a>
            {room.pets.map((p) => (
              <article key={p.id}>
                <PetAvatar pet={p} />
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {p.usage} usage ·{" "}
                    {p.readyRound > room.round
                      ? "Ready next round"
                      : locationName(p.location)}
                  </small>
                  <small>
                    {room.players.find((m) => m.id === p.ownerId)?.online
                      ? "Online"
                      : "Offline"}{" "}
                    · {room.submitted.includes(p.ownerId) ? "Ready" : "Waiting"}
                  </small>
                </div>
                <details>
                  <summary>Card</summary>
                  <StatsCard stats={p.stats} />
                  <p>{p.flavor}</p>
                  <small>
                    {["cat", "owl", "ghost"].includes(p.species)
                      ? "Night vision · "
                      : ""}
                    {p.stats.smallness <= 3 ? "Tall · " : ""}
                    {p.tipsy ? "Tipsy · " : ""}
                    {p.baby ? "Born at the castle" : "Founding seeker"}
                  </small>
                  <p>
                    Can search:{" "}
                    {LIVE_LOCATIONS.filter((l) => accessible(p, l.id))
                      .map((l) => l.name)
                      .join(", ")}
                  </p>
                </details>
              </article>
            ))}
          </div>
        )}
        {room && panel === "log" && (
          <ol className="glass event-list">
            {room.events.slice(0, 30).map((e) => (
              <li key={e.id}>
                <small>
                  R{e.round}
                  {e.mode ? ` · ${e.mode === "ai" ? "AI" : "Offline"}` : ""}
                </small>
                <p>{e.text}</p>
              </li>
            ))}
          </ol>
        )}
        {panel === "rules" && (
          <div className="glass rules">
            <p>
              Find Todd once within four rounds. Each player submits one action;
              the host resolves them together.
            </p>
            <p>
              Seek costs 10 usage. Traps cost another 25. The vet restores up to
              50; Tibo restores 100. Breeding needs matching requests and 20
              usage from each parent. The baby is ready next round.
            </p>
            <p>
              Cards have 20 points. A stat of 5 unlocks its room. Speed decides
              action order. The audience grants one advantage per round.
            </p>
            <p>
              Drag to orbit. Scroll or pinch to zoom. Click a marker or use
              Rooms to inspect a hiding spot.
            </p>
          </div>
        )}
      </aside>
    </main>
  );
}
