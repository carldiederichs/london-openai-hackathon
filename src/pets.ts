export type Species =
  "cat" | "bunny" | "owl" | "frog" | "ghost" | "dragon" | "dog" | "robot";
export type Pet = {
  id: string;
  name: string;
  species: Species;
  color: string;
  usage: number;
  location: string;
  acted: boolean;
  image?: string;
  baby?: boolean;
  tipsy?: boolean;
  effect?: { kind: "vet" | "breed" | "bottle" | "reset"; at: number };
};
export type Location = {
  id: string;
  name: string;
  subtitle: string;
  region: "north" | "south";
};
export const LOCATIONS: Location[] = [
  {
    id: "cistern",
    name: "Streaming Cistern",
    subtitle: "Dive beneath the overflow pipes. Swim 5+.",
    region: "south",
  },
  {
    id: "rookery",
    name: "Cloud Rookery",
    subtitle: "Fly to the open-air nest above the inference tower.",
    region: "north",
  },
  {
    id: "burrow",
    name: "Token Burrow",
    subtitle: "Squeeze through the tiny context window. Smallness 6+.",
    region: "south",
  },
  {
    id: "belfry",
    name: "Long-context Belfry",
    subtitle: "Reach the high bell rope. Tall pets have smallness 3 or less.",
    region: "north",
  },
  {
    id: "crypt",
    name: "Dark-mode Crypt",
    subtitle:
      "No light reaches the cold storage. Cats, owls and ghosts can see here.",
    region: "north",
  },
  {
    id: "garden",
    name: "Prompt Garden",
    subtitle: "Search the formal garden.",
    region: "north",
  },
  {
    id: "tower",
    name: "Context Tower",
    subtitle: "Fly to the entrance tower.",
    region: "north",
  },
  {
    id: "archives",
    name: "Hallucination Hall",
    subtitle: "Climb into the library rafters.",
    region: "north",
  },
  {
    id: "attic",
    name: "Token Attic",
    subtitle: "Fit through the narrow roof opening.",
    region: "north",
  },
  {
    id: "vault",
    name: "The Black Box",
    subtitle: "Dash through the closing vault gate.",
    region: "south",
  },
  {
    id: "moat",
    name: "Streaming Moat",
    subtitle: "Search beneath the stream.",
    region: "south",
  },
  {
    id: "tavern",
    name: "Rate Limit Tavern",
    subtitle: "Search the west wing.",
    region: "south",
  },
  {
    id: "courtyard",
    name: "Cache Courtyard",
    subtitle: "Search the entrance terrace.",
    region: "south",
  },
];
const STARTERS: Array<[string, Species, string]> = [
  ["Pip", "cat", "#e7a968"],
  ["Nimbus", "owl", "#aeabd6"],
  ["Mochi", "bunny", "#efbbc3"],
  ["Byte", "frog", "#a8c58b"],
  ["Boo", "ghost", "#b4d6d1"],
  ["Waffle", "dog", "#c5a07f"],
  ["Ember", "dragon", "#d1a3a4"],
  ["Gizmo", "robot", "#9fbdcf"],
  ["Clover", "bunny", "#d3c79a"],
  ["Pixel", "cat", "#b9bdcd"],
];
export const PREVIEW_PETS: Pet[] = STARTERS.map(
  ([name, species, color], i) => ({
    id: `preview-${i}`,
    name,
    species,
    color,
    usage: 100,
    location: "camp",
    acted: false,
  }),
);
