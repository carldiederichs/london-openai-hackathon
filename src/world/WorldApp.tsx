import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import QRCode from "qrcode";
import { SAMPLE_PETS } from "./samples";
import {
  WORLD_BOUNDS,
  MANSION,
  type WorldSession,
  type WorldPet,
} from "./engine";
import {
  API_BASE,
  forgetWorldSession,
  leaveWorld,
  joinWorld,
  savedWorldSession,
  useWorld,
} from "./client";
import "./world.css";

const CastleWorld = lazy(() => import("../live/CastleWorld"));

function DPad({
  disabled,
  input,
}: {
  disabled: boolean;
  input: (mask: number) => void;
}) {
  const [pressed, setPressed] = useState(0);
  const mask = useRef(0),
    sender = useRef(input),
    unavailable = useRef(disabled);
  sender.current = input;
  unavailable.current = disabled;
  const update = (value: number) => {
    if (value === mask.current) return;
    mask.current = value;
    setPressed(value);
    sender.current(value);
  };
  useEffect(() => {
    const bits: Record<string, number> = {
      ArrowUp: 1,
      w: 1,
      ArrowRight: 2,
      d: 2,
      ArrowDown: 4,
      s: 4,
      ArrowLeft: 8,
      a: 8,
    };
    const key = (event: KeyboardEvent, down: boolean) => {
      const bit = bits[event.key];
      if (
        !bit ||
        unavailable.current ||
        (event.target instanceof HTMLElement &&
          event.target.matches("input,textarea,select"))
      )
        return;
      event.preventDefault();
      update(down ? mask.current | bit : mask.current & ~bit);
    };
    const down = (event: KeyboardEvent) => key(event, true),
      up = (event: KeyboardEvent) => key(event, false);
    const stop = () => update(0);
    const hide = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stop);
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", hide);
    const keepalive = setInterval(() => {
      if (mask.current) sender.current(mask.current);
    }, 800);
    return () => {
      stop();
      clearInterval(keepalive);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop);
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (disabled) update(0);
  }, [disabled]);
  return (
    <div className="phone-dpad" aria-label="Pet movement controls">
      {[
        { bit: 1, label: "Move up", symbol: "↑", direction: "up" },
        { bit: 8, label: "Move left", symbol: "←", direction: "left" },
        { bit: 4, label: "Move down", symbol: "↓", direction: "down" },
        { bit: 2, label: "Move right", symbol: "→", direction: "right" },
      ].map(({ bit, label, symbol, direction }) => (
        <button
          key={bit}
          className={`direction direction-${direction}`}
          aria-label={label}
          aria-pressed={!!(pressed & bit)}
          disabled={disabled}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            update(mask.current | bit);
          }}
          onPointerUp={() => update(mask.current & ~bit)}
          onPointerCancel={() => update(mask.current & ~bit)}
          onLostPointerCapture={() => update(mask.current & ~bit)}
        >
          {symbol}
        </button>
      ))}
      <button
        className="direction direction-stop"
        aria-label="Stop moving"
        disabled={disabled}
        onClick={() => update(0)}
      >
        ■
      </button>
    </div>
  );
}

function MiniMap({ pet }: { pet: WorldPet }) {
  const x = (value: number) =>
    ((value - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX)) *
    100;
  const z = (value: number) =>
    ((value - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ)) *
    100;
  return (
    <div className="phone-minimap">
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="Your pet's position in the castle grounds"
      >
        <defs>
          <pattern
            id="map-grid"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M10 0H0V10"
              fill="none"
              stroke="#81907b"
              strokeOpacity=".12"
              strokeWidth=".3"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" rx="7" fill="#253c32" />
        <rect width="100" height="100" fill="url(#map-grid)" />
        <path
          d="M50 36V100M12 64H88"
          stroke="#baaa81"
          strokeOpacity=".35"
          strokeWidth="4"
        />
        <rect
          x={x(MANSION.minX)}
          y={z(MANSION.minZ)}
          width={x(MANSION.maxX) - x(MANSION.minX)}
          height={z(MANSION.maxZ) - z(MANSION.minZ)}
          rx="2"
          fill="#8e8c73"
        />
        <text x="48" y="27" textAnchor="middle" fill="#e4ddbd" fontSize="4">
          THE CASTLE
        </text>
        <circle
          cx={x(pet.position.x)}
          cy={z(pet.position.z)}
          r="5"
          fill="#efd5a0"
          fillOpacity=".18"
        />
        <circle
          data-testid="map-pet"
          cx={x(pet.position.x)}
          cy={z(pet.position.z)}
          r="2.1"
          fill="#ffe6ab"
          stroke="#fff7d6"
          strokeWidth=".6"
        />
      </svg>
      <span>
        You are here <i />{" "}
      </span>
    </div>
  );
}

function PetPicker({
  onJoined,
}: {
  onJoined: (session: WorldSession) => void;
}) {
  const [selected, setSelected] = useState(0),
    [name, setName] = useState(""),
    [image, setImage] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const track = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null),
    uploadKind = useRef<"image" | "sheet">("image");
  const pet = SAMPLE_PETS[selected];
  const choose = (index: number) => {
    const next = (index + SAMPLE_PETS.length) % SAMPLE_PETS.length;
    setSelected(next);
    track.current?.scrollTo({
      left: next * track.current.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  async function upload(value: File) {
    setBusy(true);
    setError("");
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(value.type) ||
        value.size > 10 * 1024 * 1024
      )
        throw new Error("Choose a PNG, JPEG or WebP under 10 MB.");
      const bitmap = await createImageBitmap(value);
      try {
        const sheet = uploadKind.current === "sheet";
        if (
          sheet &&
          (bitmap.width !== 1536 || ![1872, 2288].includes(bitmap.height))
        )
          throw new Error(
            "Use a ChatGPT pet sheet exported at 1536 × 1872 or 1536 × 2288.",
          );
        const rows = bitmap.height === 1872 ? 9 : 11;
        const width = sheet ? bitmap.width / 8 : bitmap.width,
          height = sheet ? bitmap.height / rows : bitmap.height;
        const scale = Math.min(1, 192 / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        canvas
          .getContext("2d")!
          .drawImage(
            bitmap,
            0,
            0,
            width,
            height,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        setImage(canvas.toDataURL("image/webp", 0.85));
      } finally {
        bitmap.close();
      }
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function join(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onJoined(
        await joinWorld({
          name: name.trim() || (image ? "My pet" : pet.name),
          ...(image ? { image } : { sampleId: pet.id }),
        }),
      );
    } catch (value) {
      setError((value as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="pet-picker">
      <div className="phone-eyebrow">ONE CASTLE. EVERYONE’S INVITED.</div>
      <h1>
        Choose your
        <br />
        <em>companion.</em>
      </h1>
      <p className="phone-intro">
        Bring your ChatGPT pet, or swipe to meet five little adventurers.
      </p>
      {image ? (
        <div className="custom-pet">
          <img src={image} alt="Your uploaded pet" />
          <button onClick={() => setImage("")}>Choose a sample instead</button>
        </div>
      ) : (
        <div className="pet-chooser">
          <button
            className="pet-chevron previous"
            aria-label="Previous pet"
            onClick={() => choose(selected - 1)}
          >
            ‹
          </button>
          <div
            className="pet-track"
            ref={track}
            onScroll={() => {
              if (track.current)
                setSelected(
                  Math.max(
                    0,
                    Math.min(
                      4,
                      Math.round(
                        track.current.scrollLeft / track.current.clientWidth,
                      ),
                    ),
                  ),
                );
            }}
          >
            {SAMPLE_PETS.map((sample) => (
              <article
                key={sample.id}
                className="pet-slide"
                aria-label={`${sample.name}, ChatGPT sample pet`}
              >
                <div
                  className="pet-aura"
                  style={{ "--pet-color": sample.color } as React.CSSProperties}
                >
                  <img src={sample.image} alt={sample.name} draggable="false" />
                </div>
                <h2>{sample.name}</h2>
                <p>{sample.description}</p>
              </article>
            ))}
          </div>
          <button
            className="pet-chevron next"
            aria-label="Next pet"
            onClick={() => choose(selected + 1)}
          >
            ›
          </button>
          <div className="pet-dots" aria-label="Choose sample pet">
            {SAMPLE_PETS.map((sample, index) => (
              <button
                key={sample.id}
                aria-label={`Choose ${sample.name}`}
                aria-pressed={selected === index}
                onClick={() => choose(index)}
              />
            ))}
          </div>
        </div>
      )}
      <form onSubmit={join}>
        <label className="phone-name">
          Pet’s name{" "}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={20}
            placeholder={image ? "My pet" : pet.name}
            autoComplete="off"
          />
        </label>
        <button className="phone-primary" disabled={busy}>
          {busy ? "Opening the gates…" : "Enter the castle"}
          <span>↗</span>
        </button>
      </form>
      <div className="bring-your-pet">
        <span>ALREADY HAVE A COMPANION?</span>
        <div>
          <button
            disabled={busy}
            onClick={() => {
              uploadKind.current = "image";
              file.current?.click();
            }}
          >
            Upload pet image
          </button>
          <button
            disabled={busy}
            onClick={() => {
              uploadKind.current = "sheet";
              file.current?.click();
            }}
          >
            Import pet sheet
          </button>
        </div>
        <small>Supports ChatGPT pet sheets with 8 × 9 or 8 × 11 frames.</small>
        <input
          ref={file}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile) void upload(selectedFile);
            event.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="phone-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default function WorldApp() {
  const controller = /^\/(join|controller)\/?$/.test(window.location.pathname);
  const [session, setSession] = useState<WorldSession | null>(() =>
    controller ? savedWorldSession() : null,
  );
  const { state, connected, error, input } = useWorld(session, controller);
  const [joinBase, setJoinBase] = useState(window.location.origin),
    [qr, setQr] = useState("");
  useEffect(() => {
    if (
      ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
      !API_BASE
    )
      fetch("/api/config")
        .then((response) => response.json())
        .then((config) => {
          if (config.joinBase) setJoinBase(config.joinBase);
        })
        .catch(() => {});
  }, []);
  const joinUrl = `${joinBase}/join`;
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(joinUrl, {
      width: 240,
      margin: 2,
      color: { dark: "#18382f", light: "#faf4e7" },
    }).then((value) => {
      if (active) setQr(value);
    });
    return () => {
      active = false;
    };
  }, [joinUrl]);
  const pet = state?.pets.find((value) => value.id === session?.playerId);
  if (controller)
    return (
      <main className="phone-world">
        <header className="phone-header">
          <a href="/" aria-label="Castle screen">
            ♜ <span>PROMPTKEEP</span>
          </a>
          <span
            className={`phone-connection ${connected ? "is-connected" : ""}`}
          >
            {session
              ? connected
                ? "LIVE"
                : "CONNECTING"
              : "THE CASTLE AWAITS"}
            <i />
          </span>
        </header>
        {!session ? (
          <PetPicker onJoined={setSession} />
        ) : pet ? (
          <section className="phone-controller">
            <div className="phone-eyebrow">YOU’RE IN THE GROUNDS</div>
            <div className="your-pet">
              <img src={pet.image} alt={pet.name} />
              <div>
                <h1>{pet.name}</h1>
                <p>{state!.count} companions. One shared world.</p>
              </div>
            </div>
            <MiniMap pet={pet} />
            <div className="controller-heading">
              <h2>Make your move.</h2>
              <span>HOLD AN ARROW</span>
            </div>
            <DPad disabled={!connected} input={input} />
            <p className="controller-help">
              Hold to wander. Release to stop.
              <br />
              Look up—your pet is on the main screen.
            </p>
            <button
              className="change-pet"
              onClick={() => {
                input(0);
                void leaveWorld(session).catch(() => {});
                forgetWorldSession();
                setSession(null);
              }}
            >
              Choose another pet
            </button>
          </section>
        ) : (
          <section className="phone-wait">
            <span className="phone-eyebrow">FINDING YOUR COMPANION</span>
            <h1>Opening the gates…</h1>
            <p>{error || "Connecting you to the shared castle."}</p>
            {error && (
              <button
                className="phone-primary"
                onClick={() => {
                  forgetWorldSession();
                  setSession(null);
                }}
              >
                Choose a pet again
              </button>
            )}
          </section>
        )}
        {error && pet && (
          <p className="phone-error" role="status">
            {error}
          </p>
        )}
      </main>
    );
  return (
    <main className="shared-castle">
      <Suspense
        fallback={<div className="world-loading">Opening the castle…</div>}
      >
        <CastleWorld pets={state?.pets || []} onSelect={() => {}} />
      </Suspense>
      <div className="world-live-tag">
        <i className={connected ? "is-connected" : ""} />
        <strong>THE SHARED CASTLE</strong>
        <span>
          {state?.count || 0} / {state?.capacity || 300} pets
        </span>
      </div>
      <aside className="castle-join-card">
        <span className="phone-eyebrow">YOUR PET BELONGS HERE</span>
        <h1>
          Scan. Choose.
          <br />
          <em>Come on in.</em>
        </h1>
        {qr && (
          <img className="castle-qr" src={qr} alt={`Scan to join ${joinUrl}`} />
        )}
        <p>
          One shared world.
          <br />
          Your phone is the controller.
        </p>
        <a href="/join" target="_blank" rel="noreferrer">
          Open phone controls <span>↗</span>
        </a>
        <small>{joinUrl.replace(/^https?:\/\//, "")}</small>
      </aside>
      {error && (
        <p className="world-connection-error" role="status">
          {error}
        </p>
      )}
    </main>
  );
}
