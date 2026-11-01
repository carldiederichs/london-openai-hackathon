import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  Castle,
  Check,
  ChevronRight,
  CircleHelp,
  Footprints,
  Heart,
  HeartPulse,
  Leaf,
  Lock,
  Moon,
  Plus,
  RotateCcw,
  Scan,
  Shield,
  Sparkles,
  Upload,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import {
  act,
  canAccess,
  createGame,
  LOCATIONS,
  MAX_PETS,
  MAX_ROUNDS,
  TRAITS,
  whisper,
  type Action,
  type Pet,
  type Trait,
} from "./game";
import CastleMap from "./CastleMap";
import PetAvatar from "./PetAvatar";

const traitIcons: Record<Trait, typeof Leaf> = {
  tiny: Leaf,
  flight: Wind,
  night: Moon,
  swim: Waves,
};
function TraitBadge({ trait }: { trait: Trait }) {
  const Icon = traitIcons[trait];
  return (
    <span className={`trait-badge ${trait}`} title={TRAITS[trait].description}>
      <Icon size={13} />
      {TRAITS[trait].name}
    </span>
  );
}
function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-top">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function UploadPet({
  onAdd,
  close,
}: {
  onAdd: (name: string, image: string, traits: Trait[]) => string | undefined;
  close: () => void;
}) {
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [traits, setTraits] = useState<Trait[]>(["tiny"]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function chooseFile(file?: File) {
    setError("");
    setImage("");
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      ) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Choose a PNG, JPEG, WebP, or GIF under 2 MB.");
      return;
    }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      const probe = new Image();
      probe.onload = () => {
        setImage(data);
        setLoading(false);
      };
      probe.onerror = () => {
        setError("That image could not be opened. Try another file.");
        setLoading(false);
      };
      probe.src = data;
    };
    reader.onerror = () => {
      setError("The image could not be read. Try another file.");
      setLoading(false);
    };
    reader.readAsDataURL(file);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const message = onAdd(name, image, traits);
    if (message) setError(message);
    else close();
  }
  return (
    <form onSubmit={submit} className="upload-form">
      <p>
        Bring your own Codex pet to the castle. Pick its abilities for this
        local prototype.
      </p>
      <label className="upload-drop">
        {image ? (
          <img src={image} alt="Your pet preview" />
        ) : (
          <Upload size={30} />
        )}
        <strong>
          {loading
            ? "Opening your pet…"
            : image
              ? "Choose a different image"
              : "Choose your pet image"}
        </strong>
        <small>PNG, JPEG, GIF or WebP · up to 2 MB</small>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label="Pet image"
          onChange={(e) => void chooseFile(e.target.files?.[0])}
        />
      </label>
      <label className="field-label">
        Pet name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="e.g. Sir Tokensworth"
          required
        />
      </label>
      <fieldset>
        <legend>Choose one or two abilities</legend>
        <div className="trait-options">
          {(Object.keys(TRAITS) as Trait[]).map((trait) => (
            <label
              key={trait}
              className={traits.includes(trait) ? "checked" : ""}
            >
              <input
                type="checkbox"
                checked={traits.includes(trait)}
                disabled={!traits.includes(trait) && traits.length === 2}
                onChange={() =>
                  setTraits((current) =>
                    current.includes(trait)
                      ? current.filter((t) => t !== trait)
                      : [...current, trait],
                  )
                }
              />
              <TraitBadge trait={trait} />
              <small>{TRAITS[trait].description}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="form-note">
        <Lock size={13} /> Your image stays in this browser session.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary-button"
        disabled={!image || !name.trim() || !traits.length || loading}
      >
        Welcome to the castle <ArrowRight size={17} />
      </button>
    </form>
  );
}

export default function App() {
  const [game, setGame] = useState(createGame);
  const [selected, setSelected] = useState("pet-0");
  const [target, setTarget] = useState<string | null>(null);
  const [tab, setTab] = useState<"move" | "breed" | "vet">("move");
  const [partnerId, setPartner] = useState("");
  const [modal, setModal] = useState<
    "rules" | "upload" | "restart" | "round" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [logExpanded, setLogExpanded] = useState(false);
  const actionRef = useRef<HTMLElement>(null);
  function showActionsOnMobile() {
    if (window.matchMedia("(max-width: 760px)").matches)
      actionRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }
  const pet = game.pets.find((p) => p.id === selected) ?? game.pets[0];
  const room = LOCATIONS.find((l) => l.id === target);
  const ready = game.pets.filter((p) => !p.acted);
  const done = game.status !== "playing";
  const availablePartners = game.pets.filter(
    (p) => p.id !== pet.id && !p.acted && p.usage >= 20,
  );
  const partner = availablePartners.find((p) => p.id === partnerId);
  const used = game.pets.filter((p) => p.acted).length;
  const locationName =
    LOCATIONS.find((l) => l.id === pet.location)?.name ??
    { camp: "Base camp", vet: "The vet", nursery: "The nursery" }[
      pet.location
    ] ??
    "Base camp";

  function perform(action: Action) {
    const result = act(game, action);
    if (result.error) {
      setError(result.error);
      return result.error;
    }
    setGame(result.game);
    setError("");
    setNotice(result.game.log[0].text);
    return undefined;
  }
  function choosePet(next: Pet) {
    setSelected(next.id);
    setPartner("");
    setError("");
    showActionsOnMobile();
  }
  function restart() {
    setGame(createGame());
    setSelected("pet-0");
    setTarget(null);
    setPartner("");
    setTab("move");
    setModal(null);
    setNotice("A fresh hunt. A new hiding place. Good luck, guardians.");
    setError("");
  }
  const moveBlock = done
    ? "This hunt is complete"
    : pet.acted
      ? "Action used this round"
      : !room
        ? "Choose a hiding spot"
        : !canAccess(pet, room)
          ? `${TRAITS[room.requires!].name} needed`
          : pet.usage < 10
            ? "Visit the vet for more usage"
            : "";
  const breedBlock =
    done ||
    pet.acted ||
    pet.usage < 20 ||
    !partner ||
    game.pets.length >= MAX_PETS;

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#main">
            <span className="brand-mark">
              <Castle size={23} strokeWidth={1.8} />
            </span>
            <span>
              promptkeep<span className="brand-period">.</span>
            </span>
          </a>
          <div className="header-middle">
            <span className="little-star">✧</span> A SMALL WORLD. A LITTLE
            CHAOS.
          </div>
          <div className="header-actions">
            <span className="local-badge">
              <span /> Local party
            </span>
            <button className="quiet-button" onClick={() => setModal("rules")}>
              <CircleHelp size={17} />
              <span>How to play</span>
            </button>
            <button
              className="icon-button restart-button"
              aria-label="Start a new hunt"
              onClick={() => setModal("restart")}
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="page">
        <section className="page-heading">
          <div>
            <div className="eyebrow">
              <Shield size={12} /> THE GUARDIANS OF PROMPTKEEP
            </div>
            <h1>
              {game.status === "won"
                ? "The castle is safe."
                : game.status === "lost"
                  ? "A very narrow escape."
                  : "The Dot is loose."}
              <span className="title-dot" />
            </h1>
            <p>
              {done
                ? game.status === "won"
                  ? "Teamwork, tiny paws, and a well-placed search. Beautifully done."
                  : "Your guardians gave it their best. The next hunt is yours."
                : "Explore the castle. Keep your usage up. Catch a little trouble."}
            </p>
          </div>
          <div className="hunt-progress">
            <div className="progress-caption">
              <span>THE HUNT</span>
              <strong>
                {game.sightings}
                <span> / 3 sightings</span>
              </strong>
            </div>
            <div className="sighting-track">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={`sighting-step ${game.sightings >= n ? "caught" : ""}`}
                >
                  {game.sightings >= n ? (
                    <Check size={16} />
                  ) : (
                    <span className="dot-creature">
                      <i />
                      <i />
                    </span>
                  )}
                </div>
              ))}
            </div>
            <small>
              {game.sightings === 0
                ? "Spot it three times. Make the third one count."
                : game.sightings < 3
                  ? "It slipped away. Follow the new castle whisper."
                  : "Captured. Mischief successfully contained."}
            </small>
          </div>
        </section>

        <section className="arena-layout" aria-label="The hunt">
          <div className="arena-column">
            <div className="arena-toolbar">
              <div className="round-indicator">
                <span className="round-icon">
                  <Castle size={16} />
                </span>
                <strong>
                  Round {game.round}
                  <span> / {MAX_ROUNDS}</span>
                </strong>
                <span className="round-divider" />
                <span>
                  {done ? "Hunt complete" : `${ready.length} guardians ready`}
                </span>
              </div>
              <button
                className="next-round-button"
                onClick={() => setModal("round")}
                disabled={done}
              >
                {game.round === MAX_ROUNDS ? "Finish hunt" : "Next round"}
                <ArrowRight size={15} />
              </button>
            </div>
            <CastleMap
              game={game}
              pet={pet}
              target={target}
              onSelect={(id) => {
                setTarget(id);
                setTab("move");
                setError("");
                showActionsOnMobile();
              }}
            />
            {notice && (
              <div
                className={`latest-event event-${game.log[0].kind}`}
                role="status"
              >
                <span>
                  <Sparkles size={17} />
                </span>
                <div>
                  <small>JUST HAPPENED</small>
                  <p>{notice}</p>
                </div>
              </div>
            )}
            <div className="whisper">
              <span className="whisper-icon">
                <AudioLines size={20} />
              </span>
              <div>
                <span>CASTLE WHISPER</span>
                <p>
                  {done
                    ? game.status === "won"
                      ? "The Dot has been escorted back to alignment training."
                      : `Last seen at ${LOCATIONS.find((l) => l.id === game.dot)?.name}.`
                    : whisper(game)}
                </p>
              </div>
              <span className="whisper-sparkle">✧</span>
            </div>
          </div>

          <aside
            ref={actionRef}
            className="action-panel"
            aria-label="Guardian actions"
          >
            <div className="panel-heading">
              <span>YOUR NEXT MOVE</span>
              <span className={`ready-label ${pet.acted ? "spent" : ""}`}>
                <i />
                {pet.acted ? "Action used" : "Ready to explore"}
              </span>
            </div>
            <div className="selected-pet">
              <div
                className="avatar-stage"
                style={{ "--pet-color": pet.color } as React.CSSProperties}
              >
                <span className="avatar-star one">✧</span>
                <PetAvatar pet={pet} />
                <span className="avatar-star two">✦</span>
              </div>
              <div>
                <div className="pet-title-row">
                  <h2>{pet.name}</h2>
                  {pet.baby && <span className="baby-label">BABY</span>}
                </div>
                <p>
                  <Footprints size={12} />
                  {locationName}
                </p>
              </div>
            </div>
            <div className="pet-traits">
              {pet.traits.map((t) => (
                <TraitBadge key={t} trait={t} />
              ))}
            </div>
            <div className="usage">
              <div>
                <span>
                  <Zap size={13} /> Usage limit
                </span>
                <strong>
                  {pet.usage}
                  <small> / 100</small>
                </strong>
              </div>
              <meter
                min={0}
                max={100}
                low={30}
                value={pet.usage}
                aria-label={`${pet.name} usage`}
              />
              <small>
                {pet.usage > 50
                  ? "Plenty of energy for a little adventure."
                  : pet.usage >= 10
                    ? "Running low. A visit to the vet might help."
                    : "Out of juice? The vet is always here."}
              </small>
            </div>
            <div
              className="action-tabs"
              role="tablist"
              aria-label="Choose an action"
            >
              {(
                [
                  { id: "move", label: "Move", Icon: Footprints },
                  { id: "breed", label: "Breed", Icon: Heart },
                  { id: "vet", label: "Vet", Icon: HeartPulse },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  id={`tab-${id}`}
                  role="tab"
                  aria-controls={`panel-${id}`}
                  aria-selected={tab === id}
                  tabIndex={tab === id ? 0 : -1}
                  onKeyDown={(e) => {
                    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
                    if (!keys.includes(e.key)) return;
                    e.preventDefault();
                    const tabs = ["move", "breed", "vet"] as const;
                    const index = tabs.indexOf(id);
                    const next =
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? 2
                          : (index + (e.key === "ArrowRight" ? 1 : -1) + 3) % 3;
                    setTab(tabs[next]);
                    setError("");
                    document.getElementById(`tab-${tabs[next]}`)?.focus();
                  }}
                  onClick={() => {
                    setTab(id);
                    setError("");
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
            <div
              className="action-content"
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
            >
              {tab === "move" && (
                <>
                  <div className="action-description">
                    <h3>Go where curiosity takes you.</h3>
                    <p>
                      Choose a hiding spot on the map. Your guardian will move
                      there and search for the Dot.
                    </p>
                  </div>
                  <label className="field-label mobile-destination">
                    Hiding spot
                    <select
                      aria-label="Choose a hiding spot"
                      value={target ?? ""}
                      onChange={(e) => setTarget(e.target.value || null)}
                    >
                      <option value="">Choose a location</option>
                      {LOCATIONS.map((l) => (
                        <option
                          key={l.id}
                          value={l.id}
                          disabled={!canAccess(pet, l)}
                        >
                          {l.name}
                          {!canAccess(pet, l) ? " (ability needed)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className={`destination ${room ? "has-room" : ""}`}>
                    <span className="destination-icon">
                      {room && !canAccess(pet, room) ? (
                        <Lock size={19} />
                      ) : (
                        <Scan size={21} />
                      )}
                    </span>
                    <div>
                      <strong>{room?.name ?? "Pick a spot on the map"}</strong>
                      <small>
                        {room
                          ? room.requires
                            ? TRAITS[room.requires].description
                            : "Every guardian is welcome here"
                          : "Look for a numbered marker"}
                      </small>
                    </div>
                    {room && canAccess(pet, room) && <Check size={16} />}
                  </div>
                  <div className="action-cost">
                    <span>Move + search</span>
                    <span>
                      <Zap size={12} /> 10 usage · 1 action
                    </span>
                  </div>
                  <button
                    className="primary-button"
                    disabled={!!moveBlock}
                    onClick={() =>
                      perform({
                        type: "move",
                        petId: pet.id,
                        locationId: target!,
                      })
                    }
                  >
                    {moveBlock || "Let’s investigate"}
                    {!moveBlock && <ArrowRight size={17} />}
                  </button>
                </>
              )}
              {tab === "breed" && (
                <>
                  <div className="action-description">
                    <h3>A new little possibility.</h3>
                    <p>
                      Pair two ready guardians. Their baby inherits up to two
                      abilities and joins the hunt next round.
                    </p>
                  </div>
                  <label className="field-label partner-label">
                    Choose a partner
                    <select
                      aria-label="Breeding partner"
                      value={partnerId}
                      onChange={(e) => setPartner(e.target.value)}
                    >
                      <option value="">Select a guardian</option>
                      {availablePartners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ·{" "}
                          {p.traits.map((t) => TRAITS[t].name).join(" + ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  {partner && (
                    <div className="breeding-preview">
                      <PetAvatar pet={pet} />
                      <Heart size={20} />
                      <PetAvatar pet={partner} />
                      <ArrowRight size={16} />
                      <span className="baby-preview">
                        <Sparkles size={24} />
                      </span>
                    </div>
                  )}
                  <div className="action-cost">
                    <span>Both parents</span>
                    <span>
                      <Zap size={12} /> 20 usage + 1 action each
                    </span>
                  </div>
                  <button
                    className="primary-button"
                    disabled={breedBlock}
                    onClick={() =>
                      perform({ type: "breed", petId: pet.id, partnerId })
                    }
                  >
                    {game.pets.length >= MAX_PETS
                      ? "The party is full"
                      : pet.acted
                        ? "Action used this round"
                        : "Welcome a little guardian"}
                    <Heart size={16} />
                  </button>
                  <p className="action-hint">
                    Babies rest this round. Breeding in round 3 will not give
                    them a turn.
                  </p>
                </>
              )}
              {tab === "vet" && (
                <>
                  <div className="action-description">
                    <h3>A little rest. A lot of care.</h3>
                    <p>
                      The castle vet restores 50 usage points, up to 100. Even a
                      completely exhausted guardian can visit.
                    </p>
                  </div>
                  <div className="vet-card">
                    <HeartPulse size={32} />
                    <div>
                      <strong>+{Math.min(50, 100 - pet.usage)} usage</strong>
                      <span>Fresh paws, fresh perspective.</span>
                    </div>
                    <span className="vet-plus">+</span>
                  </div>
                  <div className="action-cost">
                    <span>A moment to recharge</span>
                    <span>1 action · no usage cost</span>
                  </div>
                  <button
                    className="primary-button"
                    disabled={done || pet.acted || pet.usage === 100}
                    onClick={() => perform({ type: "vet", petId: pet.id })}
                  >
                    {pet.acted
                      ? "Action used this round"
                      : pet.usage === 100
                        ? "Already feeling great"
                        : "Visit the vet"}
                    <HeartPulse size={17} />
                  </button>
                </>
              )}
              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
            </div>
            {pet.acted && !done && (
              <button
                className="next-guardian"
                onClick={() => {
                  if (ready[0]) choosePet(ready[0]);
                  else setModal("round");
                }}
              >
                {ready.length
                  ? "Choose next ready guardian"
                  : "Everyone has acted. End round"}
                <ChevronRight size={16} />
              </button>
            )}
            <div className="panel-note">
              <Shield size={13} /> One action per guardian, per round.
            </div>
          </aside>
        </section>

        {done && (
          <section className={`result-banner ${game.status}`} role="status">
            <div className="result-icon">
              {game.status === "won" ? (
                <Shield size={30} />
              ) : (
                <Wind size={30} />
              )}
            </div>
            <div>
              <h2>
                {game.status === "won"
                  ? "Mischief managed."
                  : "The Dot lives to dodge another day."}
              </h2>
              <p>
                {game.sightings} of 3 sightings · {game.pets.length} brave
                guardians · {game.round} rounds
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => setModal("restart")}
            >
              Play again
              <RotateCcw size={16} />
            </button>
          </section>
        )}

        <section className="party-section" aria-label="Your guardians">
          <div className="section-heading">
            <div>
              <h2>
                Your little guardians <span>{game.pets.length}</span>
              </h2>
              <p>A curious crew, with a few tricks up their paws.</p>
            </div>
            <button
              className="outline-button"
              onClick={() => setModal("upload")}
              disabled={game.turn !== 0 || game.pets.length >= MAX_PETS}
              title={
                game.turn !== 0
                  ? "Add pets before the first action of a new hunt"
                  : "Upload your pet image"
              }
            >
              <Plus size={16} /> Add your pet
            </button>
          </div>
          <div className="pet-roster">
            {game.pets.map((p) => (
              <button
                key={p.id}
                className={`pet-card ${p.id === pet.id ? "active" : ""} ${p.acted ? "acted" : ""}`}
                onClick={() => choosePet(p)}
                aria-pressed={p.id === pet.id}
                aria-label={`Select ${p.name}, ${p.usage} usage${p.acted ? ", action used" : ", ready"}`}
              >
                <span className="pet-card-status">
                  {p.acted ? <Check size={12} /> : <i />}
                </span>
                <PetAvatar pet={p} />
                <strong>{p.name}</strong>
                <span className="pet-card-usage">
                  <Zap size={10} />
                  {p.usage}
                  <span className="mini-traits">
                    {p.traits.map((t) => {
                      const Icon = traitIcons[t];
                      return <Icon key={t} size={11} />;
                    })}
                  </span>
                </span>
                <span className="mini-usage">
                  <i style={{ width: `${p.usage}%` }} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="bottom-grid">
          <div className="journal">
            <div className="section-heading">
              <h2>
                The castle chronicle{" "}
                <span className="journal-count">{game.log.length}</span>
              </h2>
              <button
                className="quiet-button"
                onClick={() => setLogExpanded(!logExpanded)}
              >
                {logExpanded ? "Show less" : "View all"}
                <ArrowDown size={13} className={logExpanded ? "rotated" : ""} />
              </button>
            </div>
            <ol>
              {game.log.slice(0, logExpanded ? undefined : 3).map((entry) => (
                <li key={entry.id} className={`log-${entry.kind}`}>
                  <span className="log-icon">
                    {entry.kind === "dot" ? (
                      <Scan size={14} />
                    ) : entry.kind === "trap" ? (
                      <Zap size={14} />
                    ) : entry.kind === "heal" ? (
                      <Heart size={14} />
                    ) : (
                      <Footprints size={14} />
                    )}
                  </span>
                  <p>{entry.text}</p>
                  <small>R{entry.round}</small>
                </li>
              ))}
            </ol>
          </div>
          <div className="lore-card">
            <span className="lore-label">
              <Sparkles size={13} /> A WORD FROM THE KEEP
            </span>
            <h3>
              Not all discoveries
              <br />
              are good discoveries.
            </h3>
            <p>
              Bottle traps drain 25 usage. But somewhere out there, a hidden
              Tivo reset button can fill your guardian right back up.
            </p>
            <div className="lore-footer">
              <span className="bottle-drawing">♜</span>
              <span>A little risk. A little reward.</span>
            </div>
          </div>
        </section>
        <footer>
          <span>
            <Castle size={14} /> Built for a little human + AI mischief.
          </span>
          <span>
            London OpenAI Hackathon <span>·</span> Local prototype
          </span>
        </footer>
      </main>

      {modal === "rules" && (
        <Dialog title="Welcome to Promptkeep." close={() => setModal(null)}>
          <div className="rules-intro">
            <span className="dot-creature">
              <i />
              <i />
            </span>
            <p>
              One slippery Dot. Ten little guardians. Three rounds to bring it
              home.
            </p>
          </div>
          <ol className="rules-list">
            <li>
              <b>Pick a guardian, then an action.</b>
              <span>
                Every pet gets one action each round. Pass this screen around
                your group.
              </span>
            </li>
            <li>
              <b>Search the castle.</b>
              <span>
                Moving to any accessible spot costs 10 usage and includes a
                search. Abilities unlock tiny, high, dark, or underwater places.
              </span>
            </li>
            <li>
              <b>Follow the Dot.</b>
              <span>
                Find it three times to win. It moves immediately after the first
                two sightings and at round end. The castle whisper updates when
                it moves. A cleared spot can become its next hiding place.
              </span>
            </li>
            <li>
              <b>Take care of the crew.</b>
              <span>
                Bottles cost 25 usage and are removed when triggered. The
                hidden, single-use Tivo button refills its finder. The vet
                restores 50 usage, capped at 100, even from zero.
              </span>
            </li>
            <li>
              <b>Make a new little guardian.</b>
              <span>
                Breeding uses both parents’ actions and 20 usage each. The baby
                inherits up to two abilities and can act next round. Party
                limit: 16.
              </span>
            </li>
            <li>
              <b>Keep an eye on the rounds.</b>
              <span>
                End a round when everyone is done, or skip remaining actions. If
                you have fewer than three sightings when round 3 ends, the Dot
                escapes.
              </span>
            </li>
          </ol>
          <div className="prototype-note">
            <strong>A local first version</strong>
            <p>
              No sign-in, AI calls, or real usage credits. Image abilities are
              chosen manually. Refreshing or starting a new hunt resets the game
              and uploads. Multiplayer, microphone voting, and AI-generated
              stats are future work.
            </p>
          </div>
          <button className="primary-button" onClick={() => setModal(null)}>
            Let the hunt begin
            <ArrowRight size={17} />
          </button>
        </Dialog>
      )}
      {modal === "upload" && (
        <Dialog title="A new face in the castle." close={() => setModal(null)}>
          <UploadPet
            close={() => setModal(null)}
            onAdd={(name, image, traits) => {
              const result = act(game, {
                type: "add-pet",
                name,
                image,
                traits,
              });
              if (result.error) return result.error;
              setGame(result.game);
              setSelected(result.game.pets[result.game.pets.length - 1].id);
              setNotice(`${name} joined the guardians.`);
            }}
          />
        </Dialog>
      )}
      {modal === "restart" && (
        <Dialog title="A fresh little adventure?" close={() => setModal(null)}>
          <p className="dialog-copy">
            Start a new hunt with the original ten guardians. This clears the
            current hunt, babies, and uploaded pets. The Dot, traps, and reset
            button get new hiding places.
          </p>
          <div className="dialog-actions">
            <button className="outline-button" onClick={() => setModal(null)}>
              Keep this hunt
            </button>
            <button className="primary-button" onClick={restart}>
              Start new hunt
              <RotateCcw size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {modal === "round" && (
        <Dialog
          title={
            game.round === MAX_ROUNDS
              ? "Let the final gates close?"
              : "Ready for the next round?"
          }
          close={() => setModal(null)}
        >
          <p className="dialog-copy">
            {ready.length > 0
              ? `${ready.length} guardians still have an action. Ending this round skips those actions.`
              : `All ${used} guardians have used their actions.`}{" "}
            {game.round === MAX_ROUNDS
              ? "The hunt will end and the Dot will escape."
              : "The Dot will move, and every guardian will get one new action. Usage will stay as it is."}
          </p>
          <div className="dialog-actions">
            <button className="outline-button" onClick={() => setModal(null)}>
              Keep exploring
            </button>
            <button
              className="primary-button"
              onClick={() => {
                perform({ type: "end-round" });
                setModal(null);
                setTarget(null);
                setPartner("");
              }}
            >
              {game.round === MAX_ROUNDS
                ? "Finish hunt"
                : `Start round ${game.round + 1}`}
              <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
