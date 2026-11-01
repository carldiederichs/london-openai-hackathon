import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { createGame } from "../game";
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
  resizePet,
  saveSession,
  sessionKey,
  useRoom,
} from "./client";
import Cheering from "./Cheering";
import "./live.css";
const CastleWorld = lazy(() => import("./CastleWorld"));
const previewPets = createGame(42).pets;
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
        <p className="eyebrow">BRING YOUR OWN PET</p>
        <h2>Scan. Join. Cause trouble.</h2>
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
          ...(image ? { image } : {}),
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
      <p className="eyebrow">ROOM {code}</p>
      <h1>Meet your guardian.</h1>
      <p>
        Upload a pet image or describe something wonderfully weird. Every pet
        gets the same 20-point budget.
      </p>
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
                setImage(await resizePet(file));
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
            <img src={image} alt="Your selected pet" />
            <button type="button" onClick={() => setImage("")}>
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
            ? "Hatching your card…"
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
          <p className="eyebrow">YOUR GUARDIAN</p>
          <h2>{pet.name}</h2>
          <small>
            {pet.origin === "ai"
              ? "AI card"
              : pet.origin === "bred"
                ? "Bred card"
                : "Offline card"}{" "}
            · {locationName(pet.location)}
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
      <p>{pet.flavor}</p>
      <div className="usage-row">
        <span>Usage limit</span>
        <strong>{pet.usage} / 100</strong>
      </div>
      <progress max={100} value={pet.usage} aria-label="Pet usage" />
      <StatsCard stats={pet.stats} />
      <p className="stat-help">
        20 points total. A score of 5 unlocks a specialist room. Speed also
        decides action order.
      </p>
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
              <h3>{rule.name}</h3>
              <p>{rule.help}</p>
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
    [confirm, setConfirm] = useState<"restart" | "resolve" | null>(null);
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
  return (
    <div className="live-app">
      <header className="live-header">
        <a href="/">
          ♜ promptkeep<span>.</span>
        </a>
        <span>
          {room
            ? `ROOM ${room.code} · ${isHost ? "HOST" : "SEEKER"}`
            : "HALLOWEEN AT THE KEEP"}
        </span>
        <a href="/prototype">Classic prototype ↗</a>
      </header>
      <main>
        <div className="live-hero">
          <div>
            <p className="eyebrow">TEN PETS. ONE SUSPICIOUS DOT.</p>
            <h1>
              {room ? (
                room.phase === "lobby" ? (
                  "Gather your guardians."
                ) : room.outcome === "caught" ? (
                  "A very caught dot."
                ) : room.outcome === "escaped" ? (
                  "A very slippery dot."
                ) : (
                  `The hunt is on. Round ${room.round}.`
                )
              ) : (
                <>
                  A little castle.
                  <br />A lot of mischief.
                </>
              )}
            </h1>
            <p>
              {room?.outcome === "caught"
                ? "The seekers caught Todd. Promptkeep is safe, for now."
                : room?.outcome === "escaped"
                  ? "Four rounds, one great escape. The dot gets the last laugh."
                  : "Bring your pet. Follow the clues. Catch Todd before the fourth round."}
            </p>
          </div>
          <div className="todd-intro">
            <span
              className="todd-face"
              aria-label="Todd, a black dot with white eyes"
            >
              ••
            </span>
            <p>
              “{room?.claim || "I have reviewed myself and found no issues."}”
            </p>
            <small>TODD · DEFINITELY ALIGNED</small>
          </div>
        </div>
        <div className="live-status">
          <span className="pill">
            {ai?.configured
              ? `AI enabled · ${ai.model}`
              : "Offline mode · no API key"}
          </span>
          {room && (
            <>
              <span className="pill">
                {connected ? "● Connected" : "○ Reconnecting…"}
              </span>
              <span>
                {room.players.length}/10 seekers · {room.submitted.length}/
                {room.players.length} moves locked
              </span>
              <span>{room.ai.fallbackCount} fallback decisions</span>
            </>
          )}
          <small>Four rounds · one capture · ten human seekers</small>
        </div>
        {(error || connectionError) && (
          <div className="live-error" role="alert">
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
                Forget this session
              </button>
            )}
          </div>
        )}
        {!code && (
          <section className="launch-panel">
            <button
              className="primary"
              disabled={busy || !config}
              onClick={create}
            >
              {busy ? "Opening the gates…" : "Host a live hunt →"}
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                window.location.assign(`/play/${joinCode.toUpperCase()}`);
              }}
            >
              <label>
                Have a room code?
                <input
                  aria-label="Room code"
                  pattern="[A-Za-z0-9]{6}"
                  required
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                />
              </label>
              <button>Join room</button>
            </form>
            <p>
              One shared screen. Ten phones.
              <br />
              No accounts, just pets.
            </p>
          </section>
        )}
        {code &&
          !session &&
          (role === "player" ? (
            <JoinForm code={code} onJoined={joined} />
          ) : (
            <section className="live-panel">
              <h2>This tab has no host session.</h2>
              <p>
                Return to the tab that created this room, or start a new hunt
                from the home page.
              </p>
              <a href="/">Back to the castle</a>
            </section>
          ))}
        {session && !room && <p role="status">Connecting to room {code}…</p>}
        <div className={`live-layout ${room && !isHost ? "has-player" : ""}`}>
          <div className="world-column">
            <Suspense
              fallback={
                <div className="world-fallback">Opening the castle…</div>
              }
            >
              <CastleWorld
                pets={room?.pets || previewPets}
                selected={selected}
                todd={room ? room.reveal?.location : null}
                onSelect={setSelected}
                allowed={allowed}
              />
            </Suspense>
            <div className="room-buttons" aria-label="Castle rooms">
              {LIVE_LOCATIONS.map((l, i) => {
                const g = GATES[l.id],
                  can = !pet || accessible(pet, l.id);
                return (
                  <button
                    key={l.id}
                    aria-pressed={selected === l.id}
                    onClick={() => setSelected(l.id)}
                  >
                    <span>
                      {i + 1}. {l.name} {!can ? "🔒" : ""}
                    </span>
                    <small>
                      {room?.ruledOut.includes(l.id)
                        ? "Ruled out this round"
                        : g
                          ? `${STAT_LABELS[g.stat]} ${g.min}+`
                          : "Open to every pet"}
                    </small>
                  </button>
                );
              })}
            </div>
            <div className="room-detail">
              <strong>{roomInfo.name}</strong>
              <span>{roomInfo.subtitle}</span>
              <small>
                {gate
                  ? `${STAT_LABELS[gate.stat]} ${gate.min}+ required`
                  : "No ability requirement"}
                {pet && !accessible(pet, selected)
                  ? " · Your pet cannot enter"
                  : ""}
              </small>
            </div>
            {room?.clue && (
              <p className="state-note" role="status">
                ♪ {room.clue}
              </p>
            )}
            {room?.reveal && (
              <section className="live-panel reveal-panel">
                <p className="eyebrow">TODD’S ROUND REPLAY</p>
                <h2>{locationName(room.reveal.location)}</h2>
                <p>{room.reveal.summary}</p>
                <small>
                  Fictional move summary, revealed after searches. Todd gets a
                  distinct 20-point shadow card.
                </small>
                <StatsCard stats={room.reveal.stats} />
              </section>
            )}
          </div>
          {room && session && !isHost && (
            <PlayerControls
              room={room}
              session={session}
              disabled={!connected || busy}
              send={send}
              onPet={setPet}
            />
          )}
        </div>
        {room && isHost && (
          <>
            <div className="host-toolbar">
              <div>
                <strong>
                  {room.phase === "lobby"
                    ? "The gates are open"
                    : room.phase === "hiding"
                      ? "Todd is finding a hiding place…"
                      : room.phase === "resolving"
                        ? "Pets are following their prompts…"
                        : room.phase === "seeking"
                          ? CONSTRAINTS[room.constraint].name
                          : room.phase === "results"
                            ? "The round is complete"
                            : "The hunt is over"}
                </strong>
                <p>
                  {room.phase === "lobby"
                    ? "Start with 1–10 players. New players join only in the lobby."
                    : room.phase === "seeking"
                      ? CONSTRAINTS[room.constraint].help
                      : "Each player gets one action per round."}
                </p>
              </div>
              <div className="button-row">
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
                    disabled={busy || !connected}
                    onClick={() => command("host:next")}
                  >
                    Next round →
                  </button>
                )}
                <button
                  disabled={
                    busy ||
                    !connected ||
                    ["hiding", "resolving"].includes(room.phase)
                  }
                  onClick={() => setConfirm("restart")}
                >
                  New hunt
                </button>
              </div>
            </div>
            {confirm && (
              <div className="confirm-panel" role="alert">
                <p>
                  {confirm === "resolve"
                    ? `${room.players.length - room.submitted.length} players have not submitted. They will rest this round. Resolve now?`
                    : "Start again? This clears the hunt and babies. Connected players keep their original pets."}
                </p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    command(
                      confirm === "resolve" ? "host:resolve" : "host:restart",
                      confirm === "resolve"
                        ? { round: room.round, generation: room.generation }
                        : {},
                    )
                  }
                >
                  {confirm === "resolve" ? "Resolve anyway" : "Restart hunt"}
                </button>
                <button onClick={() => setConfirm(null)}>Cancel</button>
              </div>
            )}
            <div className="host-extras">
              <QRJoin code={room.code} base={joinBase} />
              <Cheering room={room} disabled={busy || !connected} send={send} />
            </div>
          </>
        )}
        {room && (
          <>
            <section className="live-panel roster-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">THE CASTLE’S LITTLE GUARDIANS</p>
                  <h2>{room.players.length} seekers. One team.</h2>
                </div>
                <span className="pill">20 points each</span>
              </div>
              <div className="live-roster">
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
                        ·{" "}
                        {room.submitted.includes(p.ownerId)
                          ? "Move locked"
                          : "Waiting"}
                      </small>
                    </div>
                    <details>
                      <summary>Card</summary>
                      <p>{p.flavor}</p>
                      <StatsCard stats={p.stats} />
                    </details>
                  </article>
                ))}
              </div>
            </section>
            <section className="live-panel chronicle">
              <p className="eyebrow">THE CASTLE CHRONICLE</p>
              <h2>Little moves. Big consequences.</h2>
              <ol>
                {room.events.slice(0, 20).map((e) => (
                  <li key={e.id}>
                    <span>R{e.round}</span>
                    <p>
                      {e.text}
                      {e.mode && (
                        <small>
                          {e.mode === "ai" ? "AI" : "Offline fallback"}
                        </small>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
        {!room && (
          <section className="live-panel instructions">
            <h2>A hide-and-seek game with a usage limit.</h2>
            <div>
              <p>
                <strong>01 · Bring a guardian</strong>Describe your pet or
                upload an image. Its balanced card decides which rooms it can
                reach.
              </p>
              <p>
                <strong>02 · Prompt your next move</strong>Seek with eight
                words, emoji, or rhyme. Breed a new pet, or visit the vet to
                restore usage.
              </p>
              <p>
                <strong>03 · Catch the dot</strong>Todd has a distinct shadow
                card. The audience changes one rule per round. Find it once to
                win.
              </p>
            </div>
            <small>
              Bottle traps drain 25 usage. The hidden Tivo button fully resets
              usage. Neither grants an extra action.
            </small>
          </section>
        )}
        <footer className="live-footer">
          <span>A little human + AI mischief.</span>
          <span>
            London OpenAI Hackathon · In-memory rooms reset when the server
            stops.
          </span>
        </footer>
      </main>
    </div>
  );
}
