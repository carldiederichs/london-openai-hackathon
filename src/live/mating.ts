import { planJourney, roomPoint } from "./movement.ts";
import { balanceStats, petOwners, STAT_KEYS, type LivePet } from "./shared.ts";

export const MATING_DURATION_MS = 8_000;
export const matingOccupants = (pets: LivePet[]) =>
  pets.filter((p) => p.location === "nursery");
export const matingBusy = (pet: LivePet) =>
  pet.mating?.finishesAt !== undefined;

// Entry reserves a physical space, including the journey to the room.
export function enterMatingRoom(
  pets: LivePet[],
  id: string,
  now: number,
): LivePet[] {
  const pet = pets.find((p) => p.id === id);
  if (!pet) throw new Error("Choose a pet first.");
  if (pet.location === "nursery")
    throw new Error("Your pet is already in the mating room.");
  if (pet.usage < 20)
    throw new Error("Mating needs at least 20 usage per pet.");
  const occupants = matingOccupants(pets);
  if (occupants.length >= 2)
    throw new Error("Mating room full — only two pets at a time.");
  if (
    occupants.some((p) =>
      petOwners(p).some((owner) => petOwners(pet).includes(owner)),
    )
  )
    throw new Error("Choose a pet belonging to a different player.");
  const duration = planJourney(
    pet.location,
    "nursery",
    roomPoint(pet.location),
    roomPoint("nursery", occupants.length, 2),
    pet.stats.speed,
  ).duration;
  return pets.map((p) =>
    p.id === id
      ? {
          ...p,
          location: "nursery",
          acted: true,
          effect: undefined,
          mating: { arrivesAt: now + duration * 1000 + 250 },
        }
      : p,
  );
}

// Both parents stay in the world until they arrive and the duvet finishes.
// No timeout closures: restart, expiry and reconnect all use the same state.
export function advanceMating(
  pets: LivePet[],
  now: number,
  newId: () => string,
): LivePet[] {
  const pair = matingOccupants(pets);
  if (pair.length !== 2 || pair.some((p) => p.usage < 20)) return pets;
  const [a, b] = pair;
  if (petOwners(a).some((owner) => petOwners(b).includes(owner))) return pets;
  const arrivesAt = Math.max(...pair.map((p) => p.mating?.arrivesAt ?? now));
  if (now < arrivesAt) return pets;
  const finishesAt = pair[0].mating?.finishesAt;
  if (finishesAt === undefined) {
    return pets.map((p) =>
      pair.includes(p)
        ? {
            ...p,
            mating: { arrivesAt, finishesAt: now + MATING_DURATION_MS },
            effect: { kind: "breed", at: now },
          }
        : p,
    );
  }
  if (now < finishesAt) return pets;
  const owners = [...new Set(pair.flatMap(petOwners))];
  const child: LivePet = {
    ...a,
    id: newId(),
    name: `${a.name.split(" ")[0]}–${b.name.split(" ")[0]}`,
    ownerId: owners[0],
    coOwnerIds: owners.slice(1),
    stats: balanceStats(
      Object.fromEntries(
        STAT_KEYS.map((k) => [k, (a.stats[k] + b.stats[k]) / 2]),
      ),
    ),
    color: b.color,
    usage: Math.min(100, a.usage + b.usage - 40),
    readyRound: Math.max(a.readyRound, b.readyRound),
    baby: true,
    tipsy: false,
    flavor: `A fusion of ${a.name} and ${b.name}. Shared by both players.`,
    origin: "bred",
    image: undefined,
    spriteRows: undefined,
    effect: undefined,
    mating: undefined,
  };
  return [...pets.filter((p) => !pair.includes(p)), child];
}

// Preserve unfinished arrival, animation and merge deadlines across a stopped game.
export function shiftPetClocks(pets: LivePet[], duration: number): LivePet[] {
  return pets.map((p) => ({
    ...p,
    effect: p.effect ? { ...p.effect, at: p.effect.at + duration } : undefined,
    mating: p.mating
      ? {
          arrivesAt:
            p.mating.arrivesAt === Number.MAX_SAFE_INTEGER
              ? p.mating.arrivesAt
              : p.mating.arrivesAt + duration,
          ...(p.mating.finishesAt === undefined
            ? {}
            : { finishesAt: p.mating.finishesAt + duration }),
        }
      : undefined,
  }));
}
