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
  position?: [number, number, number];
  moving?: boolean;
  image?: string;
  /** Codex atlas: 8 columns; 9 standard rows or 11 including look directions. */
  spriteRows?: 9 | 11;
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
    id: "kitchen",
    name: "Token Kitchen",
    subtitle: "The chef is sampling the soup at temperature zero.",
    region: "north",
  },
  {
    id: "music",
    name: "Attention Music Room",
    subtitle: "Every instrument insists it is the lead agent.",
    region: "north",
  },
  {
    id: "billiards",
    name: "Gradient Billiards",
    subtitle: "The balls always roll downhill.",
    region: "north",
  },
  {
    id: "orangery",
    name: "Synthetic Orangery",
    subtitle: "The oranges are locally generated.",
    region: "north",
  },
  {
    id: "mailroom",
    name: "Agent Mailroom",
    subtitle: "Find Todd between the undelivered tool calls.",
    region: "north",
  },
  {
    id: "workshop",
    name: "Fine-tuning Workshop",
    subtitle: "Climb the workbench behind the spare adapters.",
    region: "north",
  },
  {
    id: "cinema",
    name: "Hallucination Cinema",
    subtitle: "A dark screening room for pets with night vision.",
    region: "north",
  },
  {
    id: "bathhouse",
    name: "Token Baths",
    subtitle: "Swim through the warm inference pool.",
    region: "north",
  },
  {
    id: "wardrobe",
    name: "Prompt Wardrobe",
    subtitle: "Small pets slip beneath the costumes.",
    region: "north",
  },
  {
    id: "maproom",
    name: "Context Map Room",
    subtitle: "Every map has forgotten its northern edge.",
    region: "north",
  },
  {
    id: "laboratory",
    name: "Alignment Laboratory",
    subtitle: "The beakers are labelled probably safe.",
    region: "north",
  },
  {
    id: "dining",
    name: "Banquet of Tokens",
    subtitle: "The entire feast fits in one context window.",
    region: "north",
  },
  {
    id: "ballroom",
    name: "Transformer Ballroom",
    subtitle: "The west-wing dance follows an attention pattern.",
    region: "north",
  },
  {
    id: "dormitory",
    name: "Dream Buffer",
    subtitle: "Tiny pets can slip beneath the four-poster beds.",
    region: "north",
  },
  {
    id: "observatory",
    name: "Prediction Observatory",
    subtitle: "Fly to the open window above the star charts.",
    region: "north",
  },
  {
    id: "chapel",
    name: "Alignment Chapel",
    subtitle: "The east-wing choir is unanimously uncertain.",
    region: "north",
  },
  {
    id: "serverloft",
    name: "GPU Gallery",
    subtitle: "Climb the racks to the warmest corner.",
    region: "north",
  },
  {
    id: "eyrie",
    name: "Agent Eyrie",
    subtitle: "Only strong flyers reach the roof hatch.",
    region: "north",
  },
  {
    id: "coldstorage",
    name: "Cold Storage",
    subtitle: "A windowless cold room for pets with night vision.",
    region: "north",
  },
  {
    id: "floodedcellar",
    name: "Cooling Baths",
    subtitle: "Swim through the sunken cooling pool in the north wing.",
    region: "north",
  },
  {
    id: "drain",
    name: "Context Drain",
    subtitle: "Squeeze into the narrow maintenance alcove.",
    region: "north",
  },
  {
    id: "graveyard",
    name: "Pet Memorials",
    subtitle: "Search between the memorial stones of retired companions.",
    region: "south",
  },
  {
    id: "ivory",
    name: "Ivory Tower",
    subtitle: "Fly to the white tower where theories never meet production.",
    region: "north",
  },
  {
    id: "lake",
    name: "Latent Lake",
    subtitle: "Swim through the reeds beneath the lily pads.",
    region: "south",
  },
  {
    id: "boathouse",
    name: "Batch Boathouse",
    subtitle: "Look under the moored boats. Open to every pet.",
    region: "south",
  },
  {
    id: "maze",
    name: "OpenAI Knot Maze",
    subtitle: "Explore the six interwoven paths of the OpenAI knot.",
    region: "south",
  },
  {
    id: "orchard",
    name: "Token Orchard",
    subtitle: "Climb the oldest apple tree to inspect the hollow.",
    region: "south",
  },
  {
    id: "glasshouse",
    name: "Gradient Glasshouse",
    subtitle: "Slip beneath the potting bench through a tiny gap.",
    region: "south",
  },
  {
    id: "pavilion",
    name: "Attention Pavilion",
    subtitle: "Search the cushions beneath the garden canopy.",
    region: "south",
  },

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
    subtitle: "Search the fountain court at the heart of the castle.",
    region: "south",
  },
];
// Species are game ability archetypes; artwork and names retain the real pet identity.
const CODEX_STARTERS: Array<[string, string, Species, string, string, 9 | 11]> =
  [
    [
      "dewey",
      "Dewey",
      "frog",
      "#69cfff",
      "A small water droplet, a calm and capable swimmer.",
      11,
    ],
    [
      "fireball",
      "Fireball",
      "dragon",
      "#ff9b46",
      "A fiery companion with a bright flame and quick feet.",
      11,
    ],
    [
      "hoots",
      "Hoots",
      "owl",
      "#eaa23d",
      "A sharp-eyed owl who can fly and see in the dark.",
      11,
    ],
    [
      "rocky",
      "Rocky",
      "cat",
      "#ad9878",
      "A sturdy little rock who climbs steadily.",
      11,
    ],
    [
      "seedy",
      "Seedy",
      "bunny",
      "#afc86b",
      "A tiny sprout who fits through narrow spaces.",
      11,
    ],
    [
      "stacky",
      "Stacky",
      "robot",
      "#a28aba",
      "A tall balanced stack of small purple robots.",
      11,
    ],
    [
      "bsod",
      "BSOD",
      "robot",
      "#63baff",
      "A nimble blue-screen robot with an antenna.",
      11,
    ],
    [
      "null-signal",
      "Null Signal",
      "ghost",
      "#9c9bb7",
      "A quiet dark companion who slips through shadows.",
      11,
    ],
    [
      "codex",
      "Codex",
      "robot",
      "#f2d9a4",
      "The original Codex companion, a curious little coding robot.",
      11,
    ],
    [
      "tung-tung",
      "Tung Tung",
      "dog",
      "#be8c56",
      "A tall wooden companion with huge eyes and a wooden bat.",
      9,
    ],
  ];
export const CODEX_PETS: (Pet & { description: string })[] = CODEX_STARTERS.map(
  ([slug, name, species, color, description, spriteRows]) => ({
    id: slug,
    name,
    species,
    color,
    description,
    image: `/pets/${slug}.webp`,
    spriteRows,
    usage: 100,
    location: "camp",
    acted: false,
  }),
);

export const PREVIEW_PETS: Pet[] = CODEX_PETS;
