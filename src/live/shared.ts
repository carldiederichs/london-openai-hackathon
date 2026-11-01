import { LOCATIONS, type Pet } from "../pets";

export const STAT_KEYS = [
  "flight",
  "smallness",
  "speed",
  "climb",
  "swim",
] as const;
export type Stat = (typeof STAT_KEYS)[number];
export type Stats = Record<Stat, number>;
export const STAT_LABELS: Record<Stat, string> = {
  flight: "Flight",
  smallness: "Smallness",
  speed: "Speed",
  climb: "Climb",
  swim: "Swim",
};
export const GATES: Record<
  string,
  | { stat: Stat; min: number; max?: number; night?: boolean; label?: string }
  | undefined
> = {
  workshop: { stat: "climb", min: 5 },
  bathhouse: { stat: "swim", min: 5 },
  wardrobe: { stat: "smallness", min: 5 },
  cinema: {
    stat: "speed",
    min: 1,
    night: true,
    label: "Night vision · cat, owl, ghost",
  },
  dormitory: { stat: "smallness", min: 5 },
  observatory: { stat: "flight", min: 5 },
  serverloft: { stat: "climb", min: 5 },
  eyrie: { stat: "flight", min: 6 },
  coldstorage: {
    stat: "speed",
    min: 1,
    night: true,
    label: "Night vision · cat, owl, ghost",
  },
  floodedcellar: { stat: "swim", min: 5 },
  drain: { stat: "smallness", min: 6 },
  ivory: { stat: "flight", min: 6 },
  lake: { stat: "swim", min: 5 },
  orchard: { stat: "climb", min: 5 },
  glasshouse: { stat: "smallness", min: 5 },
  cistern: { stat: "swim", min: 5 },
  rookery: { stat: "flight", min: 5 },
  burrow: { stat: "smallness", min: 6 },
  belfry: { stat: "smallness", min: 1, max: 3, label: "Tall · smallness ≤3" },
  crypt: {
    stat: "speed",
    min: 1,
    night: true,
    label: "Night vision · cat, owl, ghost",
  },
  tower: { stat: "flight", min: 5 },
  attic: { stat: "smallness", min: 5 },
  archives: { stat: "climb", min: 5 },
  vault: { stat: "speed", min: 5 },
  moat: { stat: "swim", min: 5 },
};
export const LIVE_LOCATIONS = LOCATIONS;
export type LivePet = Pet & {
  ownerId: string;
  coOwnerIds?: string[];
  position?: [number, number, number];
  moving?: boolean;
  mating?: { arrivesAt: number; finishesAt?: number };
  stats: Stats;
  flavor: string;
  origin: "ai" | "fallback" | "bred";
  readyRound: number;
};
export type Player = {
  id: string;
  name: string;
  petId: string;
  online: boolean;
};
export type MoveInput =
  | { type: "seek"; petId: string; prompt: string }
  | { type: "vet"; petId: string }
  | { type: "breed"; petId: string; partnerId?: string };
export type Phase =
  "lobby" | "hiding" | "seeking" | "resolving" | "results" | "over";
export type Constraint = "eight" | "emoji" | "rhyme";
export const CONSTRAINTS: Record<
  Constraint,
  { name: string; help: string; example: string }
> = {
  eight: {
    name: "Eight-word prompts",
    help: "Write a seeking prompt using at most eight words.",
    example: "Tiny paws, check the attic for Todd.",
  },
  emoji: {
    name: "Emoji-only prompts",
    help: "Send only emoji, spaces, and punctuation.",
    example: "🪽 🏰 🔍 👀",
  },
  rhyme: {
    name: "Two lines that rhyme",
    help: "Write two short lines that rhyme. AI checks the rhyme; offline mode checks the last two letters.",
    example: "I take my flight,\nTo the tower tonight.",
  },
};
export type AdvantageId = "squeak" | "trail" | "shuffle" | "shrink";
export type Advantage = {
  id: AdvantageId;
  name: string;
  description: string;
  side: "seekers" | "todd";
};
export const ADVANTAGES: Record<AdvantageId, Advantage> = {
  squeak: {
    id: "squeak",
    name: "A tiny squeak",
    description: "Reveal which half of the castle Todd is hiding in.",
    side: "seekers",
  },
  trail: {
    id: "trail",
    name: "Token trail",
    description: "Rule out two hiding spots for this round.",
    side: "seekers",
  },
  shuffle: {
    id: "shuffle",
    name: "One more escape",
    description: "Todd relocates once before the searches resolve.",
    side: "todd",
  },
  shrink: {
    id: "shrink",
    name: "Pocket-sized trouble",
    description: "Todd gains access to the tiny attic this round.",
    side: "todd",
  },
};
export type CheerResult = {
  side: "seekers" | "todd" | "tie";
  method: "microphone" | "manual";
  seekers: number;
  todd: number;
  advantage: AdvantageId | null;
};
export type LiveEvent = {
  id: number;
  round: number;
  text: string;
  kind: "info" | "seek" | "trap" | "heal" | "todd";
  mode?: "ai" | "fallback";
};
export type PublicRoom = {
  mode: "turns" | "realtime";
  playerCount: number;
  code: string;
  phase: Phase;
  round: number;
  endsAt: number | null;
  pausedAt: number | null;
  serverNow: number;
  winnerPetIds: string[];
  winnerNames: string[];
  players: Player[];
  pets: LivePet[];
  submitted: string[];
  constraint: Constraint;
  events: LiveEvent[];
  claim: string;
  clue: string | null;
  ruledOut: string[];
  cards: AdvantageId[];
  cheer: CheerResult | null;
  outcome: "survived" | "found" | null;
  reveal: { location: string; summary: string; stats: Stats } | null;
  ai: { configured: boolean; model: string; fallbackCount: number };
  generation: number;
};
export type Session = {
  roomCode: string;
  token: string;
  role: "host" | "player";
  playerId?: string;
};
export type Reply<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string };

export function accessible(
  pet: { stats: Stats; species?: string },
  locationId: string,
): boolean {
  const gate = GATES[locationId];
  return (
    LIVE_LOCATIONS.some((l) => l.id === locationId) &&
    (!gate ||
      (pet.stats[gate.stat] >= gate.min &&
        (!gate.max || pet.stats[gate.stat] <= gate.max) &&
        (!gate.night || ["cat", "owl", "ghost"].includes(pet.species ?? ""))))
  );
}

// Largest-remainder allocation with a floor of 1 and a ceiling of 8 per stat.
// Never trust a model's proposed total or let an image purchase a stronger card.
export function balanceStats(input: Partial<Stats>): Stats {
  if (
    STAT_KEYS.every(
      (k) => Number.isInteger(input[k]) && input[k]! >= 1 && input[k]! <= 8,
    ) &&
    STAT_KEYS.reduce((n, k) => n + input[k]!, 0) === 20
  )
    return { ...input } as Stats;
  const weights = STAT_KEYS.map((k) =>
    Number.isFinite(input[k]) ? Math.max(1, Math.min(20, Number(input[k]))) : 4,
  );
  const values = STAT_KEYS.map(() => 1);
  for (let point = 0; point < 15; point++) {
    let best = -1;
    for (let i = 0; i < values.length; i++)
      if (
        values[i] < 8 &&
        (best < 0 || weights[i] / values[i] > weights[best] / values[best])
      )
        best = i;
    values[best]++;
  }
  return Object.fromEntries(STAT_KEYS.map((k, i) => [k, values[i]])) as Stats;
}

export function validatePrompt(
  prompt: unknown,
  constraint: Constraint,
): string | undefined {
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 220)
    return "Write a prompt between 1 and 220 characters.";
  if (constraint === "eight" && prompt.trim().split(/\s+/u).length > 8)
    return "This round allows at most eight words.";
  if (
    constraint === "emoji" &&
    (/[\p{L}\p{N}]/u.test(prompt) || !/\p{Extended_Pictographic}/u.test(prompt))
  )
    return "Use emoji only this round, with optional spaces or punctuation.";
  if (
    constraint === "rhyme" &&
    prompt.trim().split(/\n+/).filter(Boolean).length !== 2
  )
    return "Write two lines for your rhyming couplet.";
}

export function localRhyme(prompt: string): boolean {
  const ends = prompt
    .trim()
    .split(/\n+/)
    .map((line) => line.toLowerCase().match(/[a-z]+(?=[^a-z]*$)/)?.[0] ?? "");
  return (
    ends.length === 2 &&
    ends.every((e) => e.length >= 2) &&
    ends[0].slice(-2) === ends[1].slice(-2)
  );
}

export const HUNT_DURATION_MS = 60_000;
export function survivorIds(pets: LivePet[], round: number): string[] {
  return pets
    .filter((p) => p.usage > 0 && p.readyRound <= round)
    .map((p) => p.id);
}

export const petOwners = (pet: LivePet): string[] => [
  ...new Set([pet.ownerId, ...(pet.coOwnerIds ?? [])]),
];
export const ownsPet = (pet: LivePet, playerId?: string): boolean =>
  !!playerId && petOwners(pet).includes(playerId);

export type MotionFrame = {
  generation: number;
  serverNow: number;
  pets: Pick<LivePet, "id" | "position" | "moving" | "location" | "usage">[];
};
export const MAX_PLAYERS = 300;
