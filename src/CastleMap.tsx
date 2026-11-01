import { Check, Lock, Scan, Sparkles } from "lucide-react";
import { LOCATIONS, canAccess, type Game, type Pet } from "./game";
import PetAvatar from "./PetAvatar";

function Tree({
  x,
  y,
  s = 1,
  color = "#759581",
}: {
  x: number;
  y: number;
  s?: number;
  color?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="13" rx="15" ry="6" fill="#54735a" opacity=".12" />
      <path d="M0-11V14" stroke="#8b9173" strokeWidth="6" />
      <path d="M-22 0-11-23h-6L0-48l17 25h-6L22 0Z" fill={color} />
      <path d="M0-43V0H20L9-23h6Z" fill="#4d7965" opacity=".23" />
    </g>
  );
}
function Tower({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="95" rx="40" ry="12" fill="#596f5b" opacity=".15" />
      <path d="M-29 5h58v80q-29 19-58 0Z" fill="#e7e2ca" />
      <path d="M0 5h29v80Q15 94 0 95Z" fill="#cbcdb4" />
      <path d="M-34 6 0-52 34 6Z" fill="#628574" />
      <path d="M0-52 34 6H0Z" fill="#456b5c" />
      <path d="M-35 6h70v7h-70Z" fill="#3f6655" />
      <path d="M-7 36a7 7 0 0 1 14 0v16H-7Z" fill="#829483" />
      <path
        d="M-26 65h12m25-6h15M-25 30h10m21 44h14"
        stroke="#b7bea5"
        strokeWidth="3"
      />
      <path d="M0-53V-79" stroke="#67785f" strokeWidth="3" />
      <path className="flag" d="M1-78h27l-5 8 5 8H1Z" fill="#e2a16e" />
    </g>
  );
}

export default function CastleMap({
  game,
  pet,
  target,
  onSelect,
}: {
  game: Game;
  pet: Pet;
  target: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="map-shell">
      <div className="map-caption">
        <span className="status-led" /> THE CASTLE GROUNDS{" "}
        <span className="map-caption-divider" /> 8 hiding spots
      </div>
      <div className="map-region north">THE NORTHERN WING</div>
      <svg
        className="castle-art"
        viewBox="0 0 900 580"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="grass"
            width="43"
            height="41"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="m9 23 2-4 2 4m24 10 2-3"
              fill="none"
              stroke="#839c7e"
              opacity=".22"
              strokeWidth="1.4"
            />
          </pattern>
          <pattern
            id="paving"
            width="21"
            height="17"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 0h21v17H0Z"
              fill="#e9e4cf"
              stroke="#d8dac3"
              strokeWidth=".7"
            />
          </pattern>
        </defs>
        <path
          d="M82 110Q139 46 257 70L379 57Q531 15 668 78q149 11 153 145l37 148q16 109-132 128l-184 37-184-8-179-31Q54 466 56 360l-15-147q-7-66 41-103Z"
          fill="#e0e9d6"
        />
        <path
          d="M82 110Q139 46 257 70L379 57Q531 15 668 78q149 11 153 145l37 148q16 109-132 128l-184 37-184-8-179-31Q54 466 56 360l-15-147q-7-66 41-103Z"
          fill="url(#grass)"
        />
        <path
          d="M-40 445q120-77 245-28t186 68q129 69 232-2t320-63"
          fill="none"
          stroke="#b9d8d2"
          strokeWidth="39"
        />
        <path
          d="M-40 441q120-77 245-28t186 68q129 69 232-2t320-63"
          fill="none"
          stroke="#d1e6de"
          strokeWidth="25"
        />
        <path
          d="m70 423 32-3m61 14 25 5m339 56 25-4m163-51 25-9m80-15 34-2"
          stroke="#f6faf0"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M109 317q91-79 141-133t191-69q168 0 211 75t100 128q-29 115-129 131t-179-122Q343 361 235 449M441 115v212M250 184l191 143 211-137M110 317l331 10"
          fill="none"
          stroke="#d0d7b8"
          strokeWidth="24"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M109 317q91-79 141-133t191-69q168 0 211 75t100 128q-29 115-129 131t-179-122Q343 361 235 449M441 115v212M250 184l191 143 211-137M110 317l331 10"
          fill="none"
          stroke="#eeead8"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m297 419 23 33M309 414l23 34"
          stroke="#a58b65"
          strokeWidth="7"
        />
        {[
          [-3, 323, 1.1],
          [82, 199, 1],
          [129, 122, 1.2],
          [184, 89, 0.85],
          [302, 102, 0.9],
          [565, 83, 0.9],
          [717, 98, 1.15],
          [794, 169, 1.2],
          [825, 239, 0.9],
          [842, 365, 1.15],
          [751, 464, 0.9],
          [676, 520, 0.8],
          [106, 470, 1.1],
          [158, 499, 0.75],
          [380, 511, 0.8],
          [37, 280, 0.7],
        ].map(([x, y, s], i) => (
          <Tree
            key={i}
            x={x}
            y={y}
            s={s}
            color={i % 3 === 0 ? "#8ba286" : "#759581"}
          />
        ))}
        <g opacity=".8" fill="#a4b995">
          <ellipse cx="209" cy="244" rx="21" ry="12" />
          <ellipse cx="702" cy="380" rx="24" ry="14" />
          <ellipse cx="539" cy="399" rx="17" ry="11" />
          <ellipse cx="329" cy="171" rx="16" ry="10" />
        </g>
        <g transform="translate(438 241)">
          <ellipse
            cx="0"
            cy="50"
            rx="126"
            ry="43"
            fill="#526e57"
            opacity=".12"
          />
          <path d="M-103-29h206V42q-103 48-206 0Z" fill="#d8dbc1" />
          <path d="M-103-29H0v98q-59-7-103-27Z" fill="#e8e6ce" />
          <path
            d="M-105-37h16v10h16v-10h16v10h16v-10h16v10h16v-10H7v10h16v-10h16v10h16v-10h16v10h16v-10h18v23h-210Z"
            fill="#eee9d3"
          />
          <path d="M-25 65V21a25 25 0 0 1 50 0v44" fill="#61796a" />
          <path d="M-18 62V23a18 18 0 0 1 36 0v39" fill="#466558" />
          <path
            d="M-18 22h36M-9 8v54M0 5v57M9 8v54"
            stroke="#97a084"
            strokeWidth="3"
          />
          <path d="M-25 65h50l18 15h-86Z" fill="#c2b599" />
          <path
            d="M-90 13h14m15 27h14m85-27h14m14 19h14m-145-44h14"
            stroke="#bbc4a8"
            strokeWidth="3"
          />
          <path d="M-14-65h28v35h-28Z" fill="#718c71" />
          <path d="M-24-65 0-98 24-65Z" fill="#54745f" />
          <path d="M-4-49h8v13h-8Z" fill="#d8ddb7" />
        </g>
        <Tower x={345} y={187} scale={0.92} />
        <Tower x={531} y={187} scale={0.92} />
        <g transform="translate(657 246)">
          <path d="M-32-12h64v43h-64Z" fill="#d7d7c0" />
          <path d="m-42-11 42-31 42 31Z" fill="#87927e" />
          <path d="M-9 31V9a9 9 0 0 1 18 0v22" fill="#647b6b" />
          <path d="M-24 4h7v11h-7m34-11h7v11h-7" fill="#eef1d9" />
        </g>
        <g transform="translate(130 267)">
          <path d="M-34-10h68v49h-68Z" fill="#e0d6b9" />
          <path d="M-44-10 0-40 44-10Z" fill="#bb8b6b" />
          <path d="M-24 0h48v28h-48Z" fill="#f2e6c8" />
          <path d="M-7 39V8H7v31" fill="#8b8668" />
          <path d="M-37-10h74v7h-74Z" fill="#a5785b" />
          <rect x="23" y="-37" width="10" height="23" fill="#c1ae8e" />
        </g>
        <g transform="translate(274 150)">
          <path d="M-35-5h70v30h-70Z" fill="#d0d9b8" />
          <path d="M-35-5 0-30 35-5Z" fill="#b9ccad" />
          <path
            d="M0-29v53M-35-5h70m-52-11v40m35-40v40"
            stroke="#edf0da"
            strokeWidth="3"
          />
        </g>
        <g transform="translate(620 407)">
          <path d="M-30 25V-5q30-39 60 0v30Z" fill="#a9b89e" />
          <path d="M-19 25V1q19-25 38 0v24Z" fill="#586e59" />
          <path d="M-12 25V6q12-16 24 0v19Z" fill="#3c5849" />
          <path d="m-37 25 9-6m56 0 9 6" stroke="#7b947a" strokeWidth="4" />
        </g>
        <g transform="translate(780 280)">
          <path d="M-22 17V-23h44v40" fill="#d9d7be" />
          <path d="m-29-23 29-28 29 28Z" fill="#99a586" />
          <rect x="-7" y="-12" width="14" height="17" rx="5" fill="#6e8169" />
        </g>
        <g transform="translate(235 414)">
          <ellipse cy="9" rx="31" ry="13" fill="#8bbcaf" />
          <path d="m-18 5 6-15h24l6 15Z" fill="#c0cbb5" />
          <path d="M-7 5v-8q7-9 14 0v8" fill="#598f80" />
        </g>
        <g fill="#e1b47e">
          {[
            [184, 280],
            [584, 345],
            [351, 380],
            [696, 140],
            [195, 375],
            [555, 144],
            [728, 416],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="3" />
              <circle cx={x + 7} cy={y + 5} r="2" />
              <circle cx={x - 5} cy={y + 7} r="2" />
            </g>
          ))}
        </g>
        <g stroke="#f5f2e3" strokeWidth="3" strokeLinecap="round">
          <path d="m594 63 5-3 5 3m25-19 5-3 5 3m-410 22 5-3 5 3" />
        </g>
        <g transform="translate(794 490)" stroke="#7d9481" fill="none">
          <circle r="22" strokeWidth="1" />
          <path d="M0-29v58M-29 0h58" opacity=".4" />
          <path d="m0-16-5 18 5-5 5 5Z" fill="#7d9481" />
        </g>
        <text
          x="794"
          y="455"
          textAnchor="middle"
          fill="#7d9481"
          fontSize="10"
          fontFamily="sans-serif"
        >
          N
        </text>
      </svg>
      <div className="map-spots">
        {LOCATIONS.map((location, i) => {
          const accessible = canAccess(pet, location);
          const selected = target === location.id;
          const searched = game.searched[location.id] === game.round;
          const occupants = game.pets.filter((p) => p.location === location.id);
          return (
            <div
              key={location.id}
              className={`map-spot ${selected ? "selected" : ""} ${accessible ? "" : "locked"}`}
              style={{
                left: `${location.x / 9}%`,
                top: `${location.y / 5.8}%`,
              }}
            >
              <button
                className="spot-button"
                aria-label={`${location.name}${accessible ? "" : ", ability required"}${searched ? ", searched since the Dot last moved" : ""}`}
                aria-pressed={selected}
                onClick={() => onSelect(location.id)}
              >
                <span className="spot-pin">
                  {!accessible ? (
                    <Lock size={12} />
                  ) : searched ? (
                    <Check size={13} />
                  ) : selected ? (
                    <Scan size={15} />
                  ) : (
                    <span>{String(i + 1).padStart(2, "0")}</span>
                  )}
                </span>
                <span className="spot-label">{location.name}</span>
              </button>
              {occupants.length > 0 && (
                <span className="map-occupant">
                  <PetAvatar pet={occupants[occupants.length - 1]} />
                  {occupants.length > 1 && <b>+{occupants.length - 1}</b>}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="map-key">
        <span>
          <i className="key-circle" /> Searchable
        </span>
        <span>
          <Lock size={11} /> Ability needed
        </span>
        <span>
          <Check size={12} /> Searched
        </span>
      </div>
      <div className="map-footnote">
        <Sparkles size={13} /> Little guardians. Big responsibilities.
      </div>
    </div>
  );
}
