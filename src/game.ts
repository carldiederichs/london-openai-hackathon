export type Trait = "tiny" | "flight" | "night" | "swim";
export type Species =
  "cat" | "bunny" | "owl" | "frog" | "ghost" | "dragon" | "dog" | "robot";
export type Pet = {
  id: string;
  name: string;
  species: Species;
  color: string;
  traits: Trait[];
  usage: number;
  location: string;
  acted: boolean;
  image?: string;
  baby?: boolean;
};
export type Location = {
  id: string;
  name: string;
  subtitle: string;
  requires?: Trait;
  x: number;
  y: number;
  region: "north" | "south";
};

export const TRAITS: Record<Trait, { name: string; description: string }> = {
  tiny: { name: "Pocket-sized", description: "Fits through tiny entrances" },
  flight: { name: "Flight", description: "Reaches the highest hideouts" },
  night: { name: "Night vision", description: "Searches the dark corners" },
  swim: { name: "Swimming", description: "Explores underwater passages" },
};
export const LOCATIONS: Location[] = [
  {
    id: "garden",
    name: "Prompt Garden",
    subtitle: "A suspiciously quiet patch of green.",
    x: 244,
    y: 185,
    region: "north",
  },
  {
    id: "tower",
    name: "Context Tower",
    subtitle: "Long context. Even longer stairs.",
    requires: "flight",
    x: 439,
    y: 115,
    region: "north",
  },
  {
    id: "archives",
    name: "Hallucination Hall",
    subtitle: "Trust nothing in the shadows.",
    requires: "night",
    x: 655,
    y: 190,
    region: "north",
  },
  {
    id: "attic",
    name: "Token Attic",
    subtitle: "A tiny gap. A very big secret.",
    requires: "tiny",
    x: 754,
    y: 320,
    region: "north",
  },
  {
    id: "vault",
    name: "The Black Box",
    subtitle: "Nobody really knows what is in here.",
    requires: "night",
    x: 622,
    y: 450,
    region: "south",
  },
  {
    id: "moat",
    name: "Streaming Moat",
    subtitle: "The tokens flow a little differently here.",
    requires: "swim",
    x: 235,
    y: 450,
    region: "south",
  },
  {
    id: "tavern",
    name: "Rate Limit Tavern",
    subtitle: "One more bottle is never a good idea.",
    x: 111,
    y: 320,
    region: "south",
  },
  {
    id: "courtyard",
    name: "Cache Courtyard",
    subtitle: "Have we been here before?",
    x: 441,
    y: 327,
    region: "south",
  },
];

const STARTERS: Pick<Pet, "name" | "species" | "color" | "traits">[] = [
  { name: "Pip", species: "cat", color: "#e7a968", traits: ["tiny", "night"] },
  {
    name: "Nimbus",
    species: "owl",
    color: "#aeabd6",
    traits: ["flight", "night"],
  },
  { name: "Mochi", species: "bunny", color: "#efbbc3", traits: ["tiny"] },
  { name: "Byte", species: "frog", color: "#a8c58b", traits: ["swim", "tiny"] },
  {
    name: "Boo",
    species: "ghost",
    color: "#b4d6d1",
    traits: ["flight", "night"],
  },
  { name: "Waffle", species: "dog", color: "#c5a07f", traits: ["night"] },
  { name: "Ember", species: "dragon", color: "#d1a3a4", traits: ["flight"] },
  {
    name: "Gizmo",
    species: "robot",
    color: "#9fbdcf",
    traits: ["night", "swim"],
  },
  {
    name: "Clover",
    species: "bunny",
    color: "#d3c79a",
    traits: ["tiny", "swim"],
  },
  {
    name: "Pixel",
    species: "cat",
    color: "#b9bdcd",
    traits: ["tiny", "night"],
  },
];

export type LogEntry = {
  id: number;
  text: string;
  kind: "info" | "trap" | "heal" | "dot";
  round: number;
};
export type Game = {
  pets: Pet[];
  round: number;
  sightings: number;
  status: "playing" | "won" | "lost";
  dot: string;
  reset: string | null;
  traps: string[];
  seed: number;
  searched: Record<string, number>;
  discoveries: Record<string, "trap" | "reset" | "empty" | "dot">;
  log: LogEntry[];
  turn: number;
};
export const MAX_ROUNDS = 3;
export const MAX_PETS = 16;

// A seeded generator makes actions reproducible for demos and rule tests.
function next(seed: number): [number, number] {
  const value = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return [value / 4294967296, value];
}
function pick<T>(items: T[], seed: number): [T, number] {
  const [value, updated] = next(seed);
  return [items[Math.floor(value * items.length)], updated];
}
export function createGame(
  seed = Math.floor(Math.random() * 4294967296),
): Game {
  const ids = LOCATIONS.map((l) => l.id);
  const [dot, s1] = pick(ids, seed);
  const [reset, s2] = pick(
    ids.filter((id) => id !== dot),
    s1,
  );
  const [trap1, s3] = pick(
    ids.filter((id) => id !== dot && id !== reset),
    s2,
  );
  const [trap2, s4] = pick(
    ids.filter((id) => id !== dot && id !== reset && id !== trap1),
    s3,
  );
  return {
    pets: STARTERS.map((pet, i) => ({
      ...pet,
      traits: [...pet.traits],
      id: `pet-${i}`,
      usage: 100,
      location: "camp",
      acted: false,
    })),
    round: 1,
    sightings: 0,
    status: "playing",
    dot,
    reset,
    traps: [trap1, trap2],
    seed: s4,
    searched: {},
    discoveries: {},
    turn: 0,
    log: [
      {
        id: 0,
        text: "The gates are open. The Dot is hiding. Your move, guardians.",
        kind: "info",
        round: 1,
      },
    ],
  };
}

export function canAccess(pet: Pet, location: Location): boolean {
  return !location.requires || pet.traits.includes(location.requires);
}
export function whisper(game: Game): string {
  const room = LOCATIONS.find((l) => l.id === game.dot)!;
  return room.region === "north"
    ? "A flicker in the northern wing. Try the garden, tower, hall, or attic."
    : "Something stirred south of the keep. Try the tavern, courtyard, moat, or black box.";
}
export type Action =
  | { type: "move"; petId: string; locationId: string }
  | { type: "vet"; petId: string }
  | { type: "breed"; petId: string; partnerId: string }
  | { type: "end-round" }
  | { type: "add-pet"; name: string; image: string; traits: Trait[] };

export function act(
  game: Game,
  action: Action,
): { game: Game; error?: string } {
  const fail = (error: string) => ({ game, error });
  if (game.status !== "playing")
    return fail("This hunt is over. Start a new hunt to play again.");
  const g: Game = structuredClone(game);
  const record = (text: string, kind: LogEntry["kind"] = "info") => {
    g.turn += 1;
    g.log.unshift({ id: g.turn, text, kind, round: g.round });
  };
  const escape = () => {
    const [room, seed] = pick(
      LOCATIONS.filter((l) => l.id !== g.dot).map((l) => l.id),
      g.seed,
    );
    g.dot = room;
    g.seed = seed;
    // Old searches cease to rule out a room as soon as the Dot moves.
    g.searched = {};
  };
  if (action.type === "end-round") {
    if (g.round === MAX_ROUNDS) {
      g.status = "lost";
      record(
        `The Dot escaped from ${LOCATIONS.find((l) => l.id === g.dot)!.name}. A new hunt awaits.`,
        "dot",
      );
    } else {
      g.round += 1;
      g.pets.forEach((p) => {
        p.acted = false;
      });
      escape();
      record(
        `Round ${g.round}. The Dot moved. Every guardian has a fresh action.`,
        "dot",
      );
    }
    return { game: g };
  }
  if (action.type === "add-pet") {
    if (g.turn !== 0)
      return fail("Add pets before the first action of a new hunt.");
    if (g.pets.length >= MAX_PETS)
      return fail("The party is full (16 guardians).");
    const traits = [...new Set(action.traits)];
    if (
      !action.name.trim() ||
      action.name.trim().length > 20 ||
      traits.length < 1 ||
      traits.length > 2 ||
      traits.some((t) => !(t in TRAITS))
    )
      return fail("Give your pet a name and choose one or two abilities.");
    if (
      !/^data:image\/(png|jpeg|webp|gif);base64,/.test(action.image) ||
      action.image.length > 3_000_000
    )
      return fail("Choose a PNG, JPEG, WebP, or GIF image smaller than 2 MB.");
    g.pets.push({
      id: `upload-${g.pets.length}`,
      name: action.name.trim(),
      species: "cat",
      color: "#d8c7b0",
      traits,
      usage: 100,
      location: "camp",
      acted: false,
      image: action.image,
    });
    return { game: g };
  }
  const pet = g.pets.find((p) => p.id === action.petId);
  if (!pet) return fail("Choose a guardian first.");
  if (pet.acted) return fail(`${pet.name} has already acted this round.`);

  if (action.type === "vet") {
    if (pet.usage === 100) return fail(`${pet.name} is already at full usage.`);
    const restored = Math.min(50, 100 - pet.usage);
    pet.usage += restored;
    pet.location = "vet";
    pet.acted = true;
    record(
      `${pet.name} visited the vet. +${restored} usage. A little care goes a long way.`,
      "heal",
    );
  } else if (action.type === "breed") {
    const partner = g.pets.find((p) => p.id === action.partnerId);
    if (!partner || partner.id === pet.id)
      return fail("Choose a different guardian as a partner.");
    if (partner.acted)
      return fail(`${partner.name} has already acted this round.`);
    if (g.pets.length >= MAX_PETS)
      return fail("The party is full (16 guardians).");
    if (pet.usage < 20 || partner.usage < 20)
      return fail("Both parents need at least 20 usage.");
    const traits = [
      ...new Set([
        pet.traits[0],
        partner.traits[0],
        ...pet.traits,
        ...partner.traits,
      ]),
    ].slice(0, 2);
    pet.usage -= 20;
    partner.usage -= 20;
    pet.acted = true;
    partner.acted = true;
    pet.location = partner.location = "nursery";
    const baby: Pet = {
      id: `baby-${g.turn}-${g.pets.length}`,
      name: `Sprout ${g.pets.filter((p) => p.baby).length + 1}`,
      species: pet.species,
      color: partner.color,
      traits,
      usage: 100,
      location: "nursery",
      acted: true,
      baby: true,
    };
    g.pets.push(baby);
    record(
      `${pet.name} + ${partner.name} welcomed ${baby.name}! Inherited ${traits.map((t) => TRAITS[t].name.toLowerCase()).join(" and ")}. Ready next round.`,
      "heal",
    );
  } else {
    const location = LOCATIONS.find((l) => l.id === action.locationId);
    if (!location) return fail("Choose a hiding spot on the map.");
    if (!canAccess(pet, location))
      return fail(
        `${location.name} requires ${TRAITS[location.requires!].name.toLowerCase()}.`,
      );
    if (pet.usage < 10)
      return fail(`${pet.name} needs 10 usage to search. The vet can help.`);
    pet.usage -= 10;
    pet.acted = true;
    pet.location = location.id;
    g.searched[location.id] = g.round;
    if (g.traps.includes(location.id)) {
      pet.usage = Math.max(0, pet.usage - 25);
      g.traps = g.traps.filter((id) => id !== location.id);
      g.discoveries[location.id] = "trap";
      record(
        `${pet.name} found a bottle trap at ${location.name}. −25 usage. The trap is now cleared.`,
        "trap",
      );
    } else if (g.reset === location.id) {
      pet.usage = 100;
      g.reset = null;
      g.discoveries[location.id] = "reset";
      record(
        `${pet.name} found the hidden Tivo reset! Usage restored to 100. The button is now spent.`,
        "heal",
      );
    } else {
      g.discoveries[location.id] = "empty";
      if (g.dot !== location.id)
        record(`${pet.name} searched ${location.name}. No Dot. Keep looking.`);
    }
    // A fleeing Dot can share a location with an undiscovered trap or reset.
    if (g.dot === location.id) {
      g.sightings += 1;
      g.discoveries[location.id] = "dot";
      if (g.sightings === 3) {
        g.status = "won";
        record(
          `${pet.name} caught the Dot! Three sightings. One very safe castle.`,
          "dot",
        );
      } else {
        record(
          `${pet.name} spotted the Dot at ${location.name}! It slipped away. ${3 - g.sightings} more sightings to catch it.`,
          "dot",
        );
        escape();
      }
    }
  }
  return { game: g };
}
