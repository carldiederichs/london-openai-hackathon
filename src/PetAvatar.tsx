import type { Pet } from "./game";

export default function PetAvatar({
  pet,
  className = "",
}: {
  pet: Pick<Pet, "species" | "color" | "name" | "image">;
  className?: string;
}) {
  if (pet.image)
    return (
      <img
        className={`pet-avatar uploaded ${className}`}
        src={pet.image}
        alt={pet.name}
      />
    );
  const { species, color } = pet;
  return (
    <svg
      className={`pet-avatar ${className}`}
      viewBox="0 0 88 88"
      role="img"
      aria-label={pet.name}
    >
      <ellipse cx="44" cy="76" rx="23" ry="5" fill="#263b32" opacity=".10" />
      {species === "dragon" && (
        <>
          <path
            d="M25 46 8 27 9 58 29 64M63 46 80 27 79 58 59 64"
            fill={color}
            stroke="#51685b"
            strokeWidth="2"
          />
          <path
            d="m23 48-10-9v15m52-6 10-9v15"
            fill="none"
            stroke="#fff"
            opacity=".4"
            strokeWidth="2"
          />
        </>
      )}
      {species === "owl" && (
        <>
          <path
            d="M22 43Q6 46 18 68L34 63M66 43Q82 46 70 68L54 63"
            fill={color}
          />
          <path d="m28 68-4 9h12m24-9 4 9H52" fill="#d2a05b" />
        </>
      )}
      {species === "cat" && (
        <>
          <path d="M25 34V12l17 15M63 34V12L46 27" fill={color} />
          <path d="m29 28 1-9 8 9m21 0-1-9-8 9" fill="#e59694" />
          <path
            d="M61 64q21-5 16-18"
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
          />
        </>
      )}
      {species === "bunny" && (
        <>
          <rect x="25" y="5" width="13" height="34" rx="6" fill={color} />
          <rect x="50" y="3" width="13" height="34" rx="6" fill={color} />
          <path
            d="M31 12v18M56 10v20"
            stroke="#e397a2"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </>
      )}
      {species === "dog" && (
        <>
          <path
            d="M26 27Q7 24 13 50l14 4m35-27q19-3 13 23l-14 4"
            fill="#8c6954"
          />
        </>
      )}
      {species === "robot" && (
        <>
          <path d="M44 17V8" stroke="#567d85" strokeWidth="4" />
          <circle cx="44" cy="8" r="4" fill="#ed9b69" />
          <rect x="14" y="36" width="9" height="20" rx="3" fill="#6c91a0" />
          <rect x="65" y="36" width="9" height="20" rx="3" fill="#6c91a0" />
        </>
      )}
      {species === "frog" && (
        <>
          <circle cx="28" cy="27" r="13" fill={color} />
          <circle cx="60" cy="27" r="13" fill={color} />
        </>
      )}
      {species === "ghost" ? (
        <path
          d="M22 45q0-24 22-24t22 24v28l-11-6-11 7-11-7-11 6Z"
          fill={color}
        />
      ) : (
        <rect
          x="21"
          y={species === "robot" ? "21" : "26"}
          width="46"
          height="46"
          rx={species === "robot" ? "10" : "20"}
          fill={color}
        />
      )}
      {species !== "ghost" && (
        <>
          <ellipse cx="30" cy="71" rx="9" ry="5" fill={color} />
          <ellipse cx="58" cy="71" rx="9" ry="5" fill={color} />
        </>
      )}
      {species === "owl" && (
        <>
          <ellipse cx="33" cy="43" rx="13" ry="15" fill="#f3eee0" />
          <ellipse cx="55" cy="43" rx="13" ry="15" fill="#f3eee0" />
        </>
      )}
      {species === "robot" && (
        <rect x="26" y="32" width="36" height="25" rx="5" fill="#365b5c" />
      )}
      <rect
        x="30"
        y={species === "frog" ? "26" : "39"}
        width="6"
        height="9"
        rx="2"
        fill={species === "robot" ? "#d0efaf" : "#344138"}
      />
      <rect
        x="52"
        y={species === "frog" ? "26" : "39"}
        width="6"
        height="9"
        rx="2"
        fill={species === "robot" ? "#d0efaf" : "#344138"}
      />
      {species === "owl" ? (
        <path d="m40 50 4 6 4-6" fill="#d7a35e" />
      ) : (
        <path
          d={species === "frog" ? "M33 46q11 9 22 0" : "M40 54q4 4 8 0"}
          fill="none"
          stroke={species === "robot" ? "#cceaa7" : "#5d5043"}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
      {species !== "robot" && (
        <>
          <ellipse cx="28" cy="52" rx="5" ry="3" fill="#dc8b87" opacity=".5" />
          <ellipse cx="60" cy="52" rx="5" ry="3" fill="#dc8b87" opacity=".5" />
        </>
      )}
      {species === "cat" && <path d="m40 27 4 7 4-7" fill="#c98a51" />}
      {species === "dragon" && (
        <>
          <path d="m29 29 3-13 9 12m18 1-3-13-9 12" fill="#efdfb1" />
        </>
      )}
    </svg>
  );
}
