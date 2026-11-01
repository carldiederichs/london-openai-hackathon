import { CODEX_PETS } from "../src/pets.ts";
import {
  roomPoint,
  navigationPoints,
  navigationRoute,
  steerOnPaths,
  type NavCursor,
} from "../src/live/movement.ts";
import {
  advanceMating,
  shiftPetClocks,
  enterMatingRoom,
  matingBusy,
  matingOccupants,
} from "../src/live/mating.ts";
import { ROOM_LORE } from "../src/live/lore.ts";
import { randomBytes, randomUUID } from "node:crypto";
import {
  accessible,
  ownsPet,
  petOwners,
  MAX_PLAYERS,
  HUNT_DURATION_MS,
  survivorIds,
  ADVANTAGES,
  balanceStats,
  LIVE_LOCATIONS,
  STAT_KEYS,
  validatePrompt,
  type CheerResult,
  type Constraint,
  type LiveEvent,
  type LivePet,
  type MoveInput,
  type Player,
  type PublicRoom,
  type Session,
  type Stats,
} from "../src/live/shared.ts";
import type { Brain, CardInput, HideResult } from "./brain.ts";

type Member = Player & { token: string };
export type Room = {
  code: string;
  mode: "turns" | "realtime";
  lastTick: number;
  controllers: Map<string, { dx: number; dz: number; at: number; seq: number }>;
  cursors: Map<string, NavCursor>;
  visits: Map<string, string>;
  destinations: Map<string, string>;
  hostToken: string;
  phase: PublicRoom["phase"];
  round: number;
  generation: number;
  players: Member[];
  pets: LivePet[];
  originalPets: LivePet[];
  submissions: Record<string, MoveInput>;
  dot: string;
  hiderStats: Stats;
  hide: HideResult | null;
  traps: string[];
  reset: string | null;
  events: LiveEvent[];
  clue: string | null;
  ruledOut: string[];
  cheer: CheerResult | null;
  outcome: PublicRoom["outcome"];
  fallbackCount: number;
  images: Map<string, string>;
  joining: number;
  touched: number;
  endsAt: number | null;
  pausedAt: number | null;
  winnerPetIds: string[];
};
const pathPoints = navigationPoints();
const token = () => randomBytes(24).toString("base64url");
const constraintFor = (round: number): Constraint =>
  ["eight", "emoji", "rhyme", "eight"][(round - 1) % 4] as Constraint;
const signature = (stats: Stats) =>
  STAT_KEYS.filter((k) => stats[k] >= 5).join(",");
export function toddStats(pets: LivePet[]): Stats {
  const used = new Set(pets.map((p) => signature(p.stats)));
  const candidates: Stats[] = [];
  const cardKey = (stats: Stats) =>
    STAT_KEYS.map((key) => stats[key]).join(",");
  const usedCards = new Set(pets.map((pet) => cardKey(pet.stats)));
  for (let a = 1; a <= 8; a++)
    for (let b = 1; b <= 8; b++)
      for (let c = 1; c <= 8; c++)
        for (let d = 1; d <= 8; d++) {
          const e = 20 - a - b - c - d;
          if (e < 1 || e > 8) continue;
          const stats: Stats = {
            flight: a,
            smallness: b,
            speed: c,
            climb: d,
            swim: e,
          };
          if (signature(stats)) candidates.push(stats);
        }
  const distinctAbilities = candidates.filter(
    (stats) => !used.has(signature(stats)),
  );
  // A crowd can cover every ability combination. Keep Todd's full stat card
  // distinct instead, so a full room can still start a balanced hunt.
  const available = distinctAbilities.length
    ? distinctAbilities
    : candidates.filter((stats) => !usedCards.has(cardKey(stats)));
  if (!available.length) throw new Error("No distinct Todd card is available.");
  // Shadow one seeker with the nearest distinct card, preferring a
  // different set of unlocked abilities whenever one remains available.
  const source = pets[Math.floor(Math.random() * pets.length)].stats;
  const distance = (s: Stats) =>
    STAT_KEYS.reduce((sum, k) => sum + Math.abs(s[k] - source[k]), 0);
  const nearest = Math.min(...available.map(distance));
  const shadows = available.filter((s) => distance(s) === nearest);
  return shadows[Math.floor(Math.random() * shadows.length)];
}
export class Rooms {
  readonly rooms = new Map<string, Room>();
  constructor(
    readonly brain: Brain,
    readonly changed: (code: string) => void = () => {},
    readonly now: () => number = Date.now,
  ) {}
  // The deadline is authoritative even if nobody has a browser open. It is
  // also checked at command boundaries, so an action cannot sneak past expiry.
  private finishIfExpired(room: Room): boolean {
    if (room.phase === "over") return true;
    if (room.pausedAt !== null) return false;
    if (room.endsAt === null || this.now() < room.endsAt) return false;
    room.phase = "over";
    room.outcome = "survived";
    const survivors = survivorIds(room.pets, room.round);
    const best = Math.max(
      0,
      ...room.pets.filter((p) => survivors.includes(p.id)).map((p) => p.usage),
    );
    room.winnerPetIds =
      room.mode === "realtime"
        ? room.pets
            .filter((p) => p.usage > 0 && p.usage === best)
            .map((p) => p.id)
        : survivors;
    room.pets.forEach((p) => {
      p.moving = false;
    });
    room.controllers.clear();
    room.destinations.clear();
    room.submissions = {};
    const names = room.pets
      .filter((p) => room.winnerPetIds.includes(p.id))
      .map((p) => p.name);
    this.event(
      room,
      names.length
        ? `Time's up. ${names.join(", ")} ${names.length === 1 ? "wins" : "share the win"}!`
        : "Time's up. No pets survived.",
    );
    this.changed(room.code);
    return true;
  }
  tick() {
    for (const room of this.rooms.values()) {
      if (
        room.pausedAt !== null ||
        this.finishIfExpired(room) ||
        (room.endsAt === null && room.mode !== "realtime") ||
        ["resolving", "hiding"].includes(room.phase)
      )
        continue;
      if (room.mode === "realtime") this.stepWorld(room);
      if (room.phase === "over" || room.phase === "lobby") continue;
      const pets = advanceMating(room.pets, this.now(), randomUUID);
      if (pets !== room.pets) {
        if (pets.length < room.pets.length) {
          const child = pets.find(
            (p) => !room.pets.some((old) => old.id === p.id),
          )!;
          if (room.mode === "realtime") {
            child.position = roomPoint("nursery");
            child.moving = false;
            room.cursors.set(child.id, { node: "nursery", progress: 0 });
            for (const parent of room.pets)
              if (!pets.some((p) => p.id === parent.id)) {
                room.cursors.delete(parent.id);
                room.controllers.delete(parent.id);
                room.destinations.delete(parent.id);
                room.visits.delete(parent.id);
              }
          }
          for (const player of room.players)
            if (ownsPet(child, player.id)) player.petId = child.id;
          this.event(
            room,
            `${child.name} emerged! Both players share the new pet.`,
            "heal",
          );
        }
        room.pets = pets;
        this.changed(room.code);
      }
    }
  }
  steer(session: Session, data: unknown) {
    const verified = this.authenticate(session.roomCode, session.token),
      room = this.get(session.roomCode);
    if (
      verified.role !== "player" ||
      room.mode !== "realtime" ||
      room.pausedAt !== null ||
      !["lobby", "seeking"].includes(room.phase)
    )
      throw new Error("Movement is closed.");
    const input = data as {
      dx?: number;
      dz?: number;
      seq?: number;
      generation?: number;
    };
    if (
      !input ||
      input.generation !== room.generation ||
      !Number.isSafeInteger(input.seq) ||
      ![input.dx, input.dz].every(
        (v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1,
      )
    )
      throw new Error("Invalid movement input.");
    const pet = room.pets.find((p) => ownsPet(p, verified.playerId));
    if (!pet || pet.usage <= 0 || matingBusy(pet)) return;
    const previous = room.controllers.get(pet.id);
    // Sequence belongs to the socket transport, not shared pet ownership.
    if (previous && this.now() - previous.at < 35 && (input.dx || input.dz))
      return;
    if (input.dx || input.dz) room.destinations.delete(pet.id);
    room.controllers.set(pet.id, {
      dx: input.dx!,
      dz: input.dz!,
      seq: input.seq!,
      at: this.now(),
    });
  }
  destination(session: Session, data: unknown) {
    const verified = this.authenticate(session.roomCode, session.token),
      room = this.get(session.roomCode);
    const input = data as { location?: string; generation?: number };
    if (
      verified.role !== "player" ||
      room.mode !== "realtime" ||
      room.pausedAt !== null ||
      room.phase !== "seeking" ||
      input?.generation !== room.generation
    )
      throw new Error("Movement is closed.");
    const pet = room.pets.find((p) => ownsPet(p, verified.playerId));
    if (!pet || pet.usage <= 0 || matingBusy(pet))
      throw new Error("This pet cannot move right now.");
    const id = input.location;
    if (
      typeof id !== "string" ||
      !(id === "vet" || id === "nursery" || accessible(pet, id))
    )
      throw new Error("That destination is locked.");
    if (
      id === "nursery" &&
      (pet.usage < 20 || matingOccupants(room.pets).length >= 2)
    )
      throw new Error("Mating needs 20 usage and a free place (two maximum).");
    room.destinations.set(pet.id, id);
    room.controllers.delete(pet.id);
  }
  stop(session: Session) {
    const room = this.rooms.get(session.roomCode);
    if (!room) return;
    for (const pet of room.pets)
      if (ownsPet(pet, session.playerId)) {
        room.controllers.delete(pet.id);
        room.destinations.delete(pet.id);
        pet.moving = false;
      }
  }
  private stepWorld(room: Room) {
    const now = this.now(),
      elapsed = Math.max(0, (now - room.lastTick) / 1000),
      dt = Math.min(0.15, elapsed);
    room.lastTick = now;
    if (!["lobby", "seeking"].includes(room.phase)) return;
    const playing = room.phase === "seeking";
    const occupied = () => matingOccupants(room.pets).length;
    for (const pet of room.pets) {
      pet.moving = false;
      if (pet.usage <= 0 || matingBusy(pet)) continue;
      // Usage is game stamina. Keep precision internally and round public packets.
      if (playing) pet.usage = Math.max(0, pet.usage - elapsed * 0.6);
      const cursor = room.cursors.get(pet.id) ?? {
        node: pet.location,
        progress: 0,
      };
      let input = room.controllers.get(pet.id),
        budget = dt * (6 + pet.stats.speed * 0.55) * (pet.tipsy ? 0.75 : 1);
      const destination = room.destinations.get(pet.id);
      let waypoint: string | undefined;
      if (destination) {
        if (cursor.node === destination && !cursor.to) {
          room.destinations.delete(pet.id);
          continue;
        }
        const next = cursor.to ?? navigationRoute(cursor.node, destination)[1];
        waypoint = next;
        if (next) {
          const target = pathPoints[next],
            position = pet.position ?? roomPoint(pet.location);
          input = {
            dx: target[0] - position[0],
            dz: target[2] - position[2],
            at: now,
            seq: 0,
          };
          budget = Math.min(
            budget,
            Math.hypot(
              target[0] - position[0],
              target[1] - position[1],
              target[2] - position[2],
            ),
          );
        }
      }
      if (!input || now - input.at > 350 || pet.usage <= 0) continue;
      const result = steerOnPaths(
        cursor,
        input.dx,
        input.dz,
        budget,
        (id) => {
          if (id === "nursery")
            return (
              playing &&
              pet.usage >= 20 &&
              occupied() < 2 &&
              !matingOccupants(room.pets).some((p) =>
                petOwners(p).some((owner) => petOwners(pet).includes(owner)),
              )
            );
          return (
            !LIVE_LOCATIONS.some((l) => l.id === id) || accessible(pet, id)
          );
        },
        waypoint,
      );
      room.cursors.set(pet.id, result.cursor);
      pet.position = result.position;
      pet.moving = result.moving;
      if (result.moving) {
        if (playing) pet.usage = Math.max(0, pet.usage - dt * 0.45);
        if (
          pet.location === "nursery" &&
          cursor.node === "nursery" &&
          result.cursor.to
        ) {
          pet.location = "camp";
          pet.mating = undefined;
          pet.effect = undefined;
        }
      }
      if (result.cursor.to === "nursery" && cursor.to !== "nursery") {
        pet.location = "nursery";
        pet.mating = { arrivesAt: Number.MAX_SAFE_INTEGER };
        this.changed(room.code);
      }
      // Reversing out releases the reservation without needing to enter the room.
      if (
        pet.location === "nursery" &&
        cursor.to === "nursery" &&
        !result.cursor.to &&
        result.cursor.node !== "nursery"
      ) {
        pet.location = "camp";
        pet.mating = undefined;
        this.changed(room.code);
      }
      for (const id of result.arrived) {
        if (!(
          id === "vet" ||
          id === "nursery" ||
          id === "camp" ||
          LIVE_LOCATIONS.some((l) => l.id === id)
        ))
          continue;
        pet.location = id;
        if (!playing) continue;
        if (room.visits.get(pet.id) === id) continue;
        room.visits.set(pet.id, id);
        if (id === "nursery") {
          pet.mating = { arrivesAt: now };
          this.changed(room.code);
        } else if (id === "vet") {
          pet.usage = Math.min(100, pet.usage + 50);
          pet.tipsy = false;
          pet.effect = { kind: "vet", at: now };
          this.changed(room.code);
        } else if (LIVE_LOCATIONS.some((l) => l.id === id)) {
          if (room.traps.includes(id)) {
            room.traps = room.traps.filter((l) => l !== id);
            pet.usage = Math.max(0, pet.usage - 25);
            pet.tipsy = true;
            pet.effect = { kind: "bottle", at: now };
            this.event(
              room,
              `${pet.name} found a hidden bottle. −25 usage.`,
              "trap",
            );
          }
          if (room.reset === id) {
            room.reset = null;
            pet.usage = 100;
            pet.tipsy = false;
            pet.effect = { kind: "reset", at: now };
            this.event(room, `${pet.name} pressed Tibo's reset.`, "heal");
          }
          if (id === room.dot && pet.usage > 0) {
            room.phase = "over";
            room.outcome = "found";
            room.winnerPetIds = [pet.id];
            room.controllers.clear();
            room.pets.forEach((p) => {
              p.moving = false;
            });
            this.event(
              room,
              `${pet.name} found the hidden Dot and wins!`,
              "todd",
            );
            this.changed(room.code);
            return;
          }
          this.changed(room.code);
        }
      }
    }
  }
  private event(
    room: Room,
    text: string,
    kind: LiveEvent["kind"] = "info",
    mode?: "ai" | "fallback",
  ) {
    room.events.unshift({
      id: (room.events[0]?.id ?? 0) + 1,
      round: room.round,
      text,
      kind,
      mode,
    });
    room.events = room.events.slice(0, 100);
    if (mode === "fallback") room.fallbackCount++;
  }
  get(code: string) {
    const room = this.rooms.get(code);
    if (!room)
      throw new Error("Room not found. Ask the host for a fresh code.");
    room.touched = Date.now();
    this.finishIfExpired(room);
    return room;
  }
  authenticate(code: string, secret: string): Session {
    const room = this.get(code);
    if (secret === room.hostToken)
      return { roomCode: code, token: secret, role: "host" };
    const player = room.players.find((p) => p.token === secret);
    if (!player) throw new Error("This session cannot access that room.");
    return {
      roomCode: code,
      token: secret,
      role: "player",
      playerId: player.id,
    };
  }
  host(session: Session) {
    const verified = this.authenticate(session.roomCode, session.token);
    if (verified.role !== "host") throw new Error("Only the host can do that.");
    return this.get(session.roomCode);
  }
  create(mode: "turns" | "realtime" = "turns"): Session {
    // Sessions are deliberately ephemeral. Never retain uploaded images after expiry.
    for (const [code, room] of this.rooms)
      if (Date.now() - room.touched > 6 * 60 * 60 * 1000)
        this.rooms.delete(code);
    if (this.rooms.size >= 12)
      throw new Error(
        "This server has reached its 12-room limit. Restart it to clear old rooms.",
      );
    let code: string;
    do {
      code = randomBytes(3).toString("hex").toUpperCase();
    } while (this.rooms.has(code));
    const secret = token();
    this.rooms.set(code, {
      code,
      hostToken: secret,
      mode,
      lastTick: this.now(),
      controllers: new Map(),
      cursors: new Map(),
      visits: new Map(),
      destinations: new Map(),
      phase: "lobby",
      round: 1,
      generation: 1,
      players: [],
      pets: [],
      originalPets: [],
      submissions: {},
      dot: "",
      hiderStats: balanceStats({}),
      hide: null,
      traps: [],
      reset: null,
      events: [],
      clue: null,
      ruledOut: [],
      cheer: null,
      outcome: null,
      endsAt: null,
      pausedAt: null,
      winnerPetIds: [],
      fallbackCount: 0,
      images: new Map(),
      joining: 0,
      touched: Date.now(),
    });
    return { roomCode: code, token: secret, role: "host" };
  }
  async join(
    code: string,
    input: CardInput & { companionId?: string },
  ): Promise<Session> {
    const room = this.get(code);
    if (
      room.mode === "turns"
        ? room.phase !== "lobby"
        : !["lobby", "seeking", "over"].includes(room.phase)
    )
      throw new Error("The world is starting. Try joining again in a moment.");
    const capacity = room.mode === "realtime" ? MAX_PLAYERS : 10;
    if (room.players.length + room.joining >= capacity)
      throw new Error(`All ${capacity} player slots are taken.`);
    if (
      !input ||
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.trim().length > 20 ||
      typeof input.description !== "string" ||
      input.description.length > 300
    )
      throw new Error(
        "Use a pet name up to 20 characters and a description up to 300.",
      );
    if (!input.image && !input.description.trim())
      throw new Error("Upload an image or describe your pet.");
    if (
      input.image &&
      (typeof input.image !== "string" ||
        input.image.length > 250_000 ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
          input.image,
        ))
    )
      throw new Error("Use a resized PNG, JPEG, or WebP pet image.");
    if (
      input.spriteRows !== undefined &&
      (!input.image || ![9, 11].includes(input.spriteRows))
    )
      throw new Error(
        "Use a supported 9-row or 11-row Codex pet sprite sheet.",
      );
    room.joining++;
    try {
      const companion = input.companionId
        ? CODEX_PETS.find((p) => p.id === input.companionId)
        : undefined;
      if (input.companionId && !companion)
        throw new Error("Unknown Codex companion.");
      const card = companion
        ? {
            species: companion.species,
            color: companion.color,
            stats: balanceStats({
              flight:
                companion.species === "owl" || companion.species === "dragon"
                  ? 8
                  : 2,
              smallness: companion.species === "bunny" ? 8 : 3,
              speed: 4,
              climb: companion.species === "cat" ? 8 : 3,
              swim: companion.species === "frog" ? 8 : 2,
            }),
            flavor: companion.description,
            mode: "fallback" as const,
          }
        : await this.brain.card(input);
      const id = randomUUID(),
        petId = randomUUID(),
        secret = token();
      if (room.mode === "turns" && room.phase !== "lobby")
        throw new Error("The hunt started while your card was being made.");
      if (input.image) room.images.set(petId, input.image);
      const pet: LivePet = {
        id: petId,
        ownerId: id,
        name: input.name.trim(),
        species: card.species,
        color: card.color,
        stats: balanceStats(card.stats),
        flavor: card.flavor,
        origin: card.mode,
        readyRound: 1,
        usage: 100,
        location: "camp",
        acted: false,
        ...(room.mode === "realtime"
          ? { position: roomPoint("camp"), moving: false }
          : {}),
        ...(companion
          ? { image: companion.image, spriteRows: companion.spriteRows }
          : {}),
        ...(input.spriteRows ? { spriteRows: input.spriteRows } : {}),
        ...(input.image
          ? { image: `/api/rooms/${code}/pets/${petId}/image` }
          : {}),
      };
      room.players.push({
        id,
        token: secret,
        petId,
        name: pet.name,
        online: false,
      });
      if (room.mode === "realtime" && room.endsAt !== null) {
        pet.usage = Math.max(
          1,
          100 -
            (Math.max(
              0,
              HUNT_DURATION_MS - (room.endsAt - (room.pausedAt ?? this.now())),
            ) /
              1000) *
              0.6,
        );
        room.cursors.set(pet.id, { node: "camp", progress: 0 });
        room.originalPets.push(structuredClone({ ...pet, usage: 100 }));
      }
      room.pets.push(pet);
      this.event(
        room,
        `${pet.name} joined with a balanced 20-point card.`,
        "info",
        card.mode,
      );
      this.changed(code);
      return { roomCode: code, token: secret, role: "player", playerId: id };
    } finally {
      room.joining--;
    }
  }
  connected(session: Session, online: boolean) {
    const room = this.get(session.roomCode),
      player = room.players.find((p) => p.id === session.playerId);
    if (player) {
      player.online = online;
      this.changed(room.code);
    }
  }
  private async placeTodd(room: Room, shrinking = false) {
    const generation = room.generation;
    const stats = {
      ...room.hiderStats,
      ...(shrinking
        ? { smallness: Math.max(5, room.hiderStats.smallness) }
        : {}),
    };
    let allowed = LIVE_LOCATIONS.filter(
      (l) =>
        accessible({ stats, species: "ghost" }, l.id) &&
        room.pets.some(
          (p) => p.readyRound <= room.round && accessible(p, l.id),
        ),
    ).map((l) => l.id);
    if (allowed.length > 1) allowed = allowed.filter((id) => id !== room.dot);
    const result = await this.brain.hide(
      stats,
      allowed,
      room.round,
      room.dot || undefined,
    );
    if (room.generation !== generation || this.finishIfExpired(room)) return;
    // A model or adapter cannot bypass the engine, even with a syntactically valid response.
    room.dot = allowed.includes(result.locationId)
      ? result.locationId
      : allowed[0];
    room.hide = result;
    if (result.mode === "fallback") room.fallbackCount++;
  }
  async start(session: Session) {
    const room = this.host(session);
    if (room.phase !== "lobby" || !room.players.length || room.joining)
      throw new Error(
        "Wait for at least one completed pet card before starting.",
      );
    if (room.mode === "realtime")
      room.pets = room.pets.map((p) => ({
        ...p,
        location: "camp",
        usage: 100,
        moving: false,
        position: roomPoint("camp"),
        mating: undefined,
        effect: undefined,
      }));
    room.originalPets = structuredClone(room.pets);
    room.phase = "hiding";
    room.hiderStats = toddStats(room.pets);
    this.changed(room.code);
    try {
      await this.placeTodd(room);
      const free = LIVE_LOCATIONS.filter(
        (l) => l.id !== room.dot && l.id !== "tavern",
      )
        .map((l) => l.id)
        .sort(() => Math.random() - 0.5);
      room.reset = "tavern";
      room.traps = free.slice(0, 2);
      room.phase = "seeking";
      room.endsAt = this.now() + HUNT_DURATION_MS;
      room.lastTick = this.now();
      if (room.mode === "realtime") {
        room.controllers.clear();
        room.destinations.clear();
        room.cursors.clear();
        room.visits.clear();
        for (const pet of room.pets) {
          pet.position = roomPoint("camp");
          pet.moving = false;
          room.cursors.set(pet.id, { node: "camp", progress: 0 });
        }
      }
      this.event(
        room,
        room.mode === "realtime"
          ? "Find the hidden Dot, or finish the minute with the most usage."
          : "One minute. Guardians, submit your moves.",
      );
    } catch {
      room.phase = "lobby";
      throw new Error("The hunt could not start. Try again.");
    } finally {
      this.changed(room.code);
    }
  }
  pause(session: Session, paused: boolean) {
    const room = this.host(session);
    if (
      typeof paused !== "boolean" ||
      this.finishIfExpired(room) ||
      room.phase !== "seeking"
    )
      throw new Error("Only an active game can be stopped or resumed.");
    if (paused === (room.pausedAt !== null)) return;
    const now = this.now();
    if (paused) {
      room.pausedAt = now;
      room.controllers.clear();
      room.pets.forEach((p) => {
        p.moving = false;
      });
    } else {
      const duration = now - room.pausedAt!;
      room.endsAt! += duration;
      room.pets = shiftPetClocks(room.pets, duration);
      room.pausedAt = null;
      room.lastTick = now;
    }
    this.event(room, paused ? "Game stopped by the host." : "Game resumed.");
    this.changed(room.code);
  }
  submit(session: Session, raw: unknown, round: number, generation: number) {
    const verified = this.authenticate(session.roomCode, session.token),
      room = this.get(session.roomCode);
    if (room.mode === "realtime")
      throw new Error("Use the real-time controls.");
    if (verified.role !== "player")
      throw new Error("Join as a player to submit a move.");
    if (
      room.pausedAt !== null ||
      room.phase !== "seeking" ||
      round !== room.round ||
      generation !== room.generation
    )
      throw new Error("That round is closed. Check the current round.");
    if (!raw || typeof raw !== "object") throw new Error("Choose an action.");
    const input = raw as MoveInput;
    const pet = room.pets.find(
      (p) => p.id === input.petId && ownsPet(p, verified.playerId),
    );
    if (!pet || pet.readyRound > room.round)
      throw new Error("Choose one of your ready pets.");
    if (
      matingBusy(pet) ||
      (pet.location === "nursery" && matingOccupants(room.pets).length === 2)
    )
      throw new Error("Your pets are merging. Wait for the duvet to finish.");
    if (room.submissions[verified.playerId!])
      throw new Error("Your move is already locked in for this round.");
    if (input.type === "seek") {
      const error = validatePrompt(input.prompt, constraintFor(room.round));
      if (error) throw new Error(error);
      if (pet.usage < 10)
        throw new Error(
          "Your pet needs 10 usage to seek. Visit the vet instead.",
        );
      room.submissions[verified.playerId!] = {
        type: "seek",
        petId: pet.id,
        prompt: input.prompt.trim(),
      };
    } else if (input.type === "vet") {
      if (pet.usage >= 100)
        throw new Error("Your pet is already at full usage.");
      room.submissions[verified.playerId!] = { type: "vet", petId: pet.id };
    } else if (input.type === "breed") {
      enterMatingRoom(room.pets, pet.id, this.now()); // Validate before reserving.
      const reserved = new Set([
        ...matingOccupants(room.pets).map((p) => p.id),
        ...Object.values(room.submissions)
          .filter((m) => m.type === "breed")
          .map((m) => m.petId),
      ]);
      if (reserved.size >= 2)
        throw new Error("Mating room full — only two pets at a time.");
      room.submissions[verified.playerId!] = { type: "breed", petId: pet.id };
    } else throw new Error("Unknown action.");
    for (const owner of petOwners(pet))
      room.submissions[owner] = room.submissions[verified.playerId!];
    this.changed(room.code);
  }
  cheer(session: Session, raw: unknown) {
    const room = this.host(session);
    if (room.mode === "realtime")
      throw new Error(
        "Audience rule changes are unavailable during real-time play.",
      );
    if (room.pausedAt !== null || room.phase !== "seeking" || room.cheer)
      throw new Error(
        "One audience result is allowed per round, before resolution.",
      );
    if (!raw || typeof raw !== "object")
      throw new Error("Record both cheering scores.");
    const input = raw as {
      seekers: number;
      todd: number;
      method: string;
      round: number;
      generation: number;
    };
    if (input.round !== room.round || input.generation !== room.generation)
      throw new Error("That audience result belongs to a closed round.");
    if (
      ![input.seekers, input.todd].every(
        (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1,
      ) ||
      !["manual", "microphone"].includes(input.method)
    )
      throw new Error("Invalid audience measurement.");
    const side =
      Math.abs(input.seekers - input.todd) < 0.015
        ? "tie"
        : input.seekers > input.todd
          ? "seekers"
          : "todd";
    const cards = this.public(room.code).cards;
    const advantage =
      side === "tie" ? null : side === "seekers" ? cards[0] : cards[1];
    room.cheer = {
      seekers: input.seekers,
      todd: input.todd,
      method: input.method as CheerResult["method"],
      side,
      advantage,
    };
    if (advantage === "squeak")
      room.clue = `Todd squeaked in the ${LIVE_LOCATIONS.find((l) => l.id === room.dot)!.region === "north" ? "northern wing" : "southern grounds"}.`;
    if (advantage === "trail")
      room.ruledOut = LIVE_LOCATIONS.filter((l) => l.id !== room.dot)
        .map((l) => l.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
    this.event(
      room,
      side === "tie"
        ? "The audience tied. No rule changes this round."
        : `${side === "seekers" ? "The seekers" : "Todd"} won the audience round: ${ADVANTAGES[advantage!].name}.`,
      "info",
    );
    this.changed(room.code);
  }
  async resolve(session: Session, round: number, generation: number) {
    const room = this.host(session);
    if (room.mode === "realtime")
      throw new Error("Real-time games do not have rounds.");
    if (
      room.pausedAt !== null ||
      room.phase !== "seeking" ||
      room.round !== round ||
      room.generation !== generation
    )
      throw new Error("This round is already resolving or closed.");
    const snapshot = structuredClone(room);
    room.phase = "resolving";
    this.changed(room.code);
    try {
      if (
        room.cheer?.advantage === "shuffle" ||
        room.cheer?.advantage === "shrink"
      )
        await this.placeTodd(room, room.cheer.advantage === "shrink");
      if (room.generation !== generation || this.finishIfExpired(room)) return;
      const entries = Object.entries(room.submissions).filter(
        ([, move], i, all) =>
          all.findIndex(([, m]) => m.petId === move.petId) === i,
      );
      const interpreted = await Promise.all(
        entries.map(async ([owner, input]) => {
          const pet = room.pets.find((p) => p.id === input.petId)!;
          const move =
            input.type === "seek"
              ? await this.brain.move(
                  pet,
                  input.prompt,
                  LIVE_LOCATIONS.filter((l) => accessible(pet, l.id)).map(
                    (l) => l.id,
                  ),
                  constraintFor(room.round),
                )
              : null;
          return { owner, input, pet, move };
        }),
      );
      if (room.generation !== generation || this.finishIfExpired(room)) return;
      interpreted.sort(
        (a, b) =>
          b.pet.stats.speed -
            (b.pet.tipsy ? 2 : 0) -
            (a.pet.stats.speed - (a.pet.tipsy ? 2 : 0)) ||
          a.pet.id.localeCompare(b.pet.id),
      );
      let caught = false;
      for (const { input, pet, move } of interpreted) {
        pet.acted = true;
        pet.effect = undefined;
        if (input.type === "vet") {
          const restored = Math.min(50, 100 - pet.usage);
          pet.usage += restored;
          pet.location = "vet";
          pet.mating = undefined;
          pet.tipsy = false;
          pet.effect = { kind: "vet", at: Date.now() };
          this.event(
            room,
            `${pet.name} visited the vet. +${restored} usage.`,
            "heal",
          );
        } else if (input.type === "breed") {
          room.pets = enterMatingRoom(room.pets, pet.id, this.now());
          this.event(
            room,
            `${pet.name} is heading to the mating room. Two places only.`,
          );
        } else if (move) {
          if (
            !move.valid ||
            !accessible(pet, move.locationId) ||
            pet.usage < 10
          ) {
            this.event(
              room,
              `${pet.name} stayed put: the prompt or move was not legal. No usage spent.`,
              "seek",
              move.mode,
            );
            continue;
          }
          pet.usage -= 10;
          pet.location = move.locationId;
          pet.mating = undefined;
          const location = LIVE_LOCATIONS.find((l) => l.id === pet.location)!;
          this.event(room, move.narration, "seek", move.mode);
          const lore = ROOM_LORE[pet.location];
          if (lore && !room.events.some((e) => e.text === lore))
            this.event(room, lore, "info");
          if (room.traps.includes(pet.location)) {
            room.traps = room.traps.filter((id) => id !== pet.location);
            pet.usage = Math.max(0, pet.usage - 25);
            pet.tipsy = true;
            pet.effect = { kind: "bottle", at: Date.now() };
            this.event(
              room,
              `${pet.name} found a temperature-2.0 bottle at ${location.name}. −25 usage; tipsy until a vet visit or reset.`,
              "trap",
            );
          } else if (room.reset === pet.location) {
            room.reset = null;
            pet.usage = 100;
            pet.tipsy = false;
            pet.effect = { kind: "reset", at: Date.now() };
            this.event(
              room,
              `${pet.name} found the Tibo reset. Usage restored to 100.`,
              "heal",
            );
          }
          if (pet.location === room.dot) {
            caught = true;
            this.event(
              room,
              `${pet.name} caught Todd at ${location.name}!`,
              "todd",
            );
          } else
            this.event(
              room,
              `${pet.name} searched ${location.name}. No Todd.`,
              "seek",
            );
        }
      }
      for (const player of room.players)
        if (!room.submissions[player.id])
          this.event(
            room,
            `${player.name} had no submitted action and rested.`,
            "info",
          );
      room.phase = "results";
      this.event(
        room,
        caught
          ? "Todd was caught. Keep your pets alive until the clock runs out."
          : `Round ${room.round} is complete. Todd's move is now revealed.`,
        "todd",
      );
    } catch {
      if (room.generation !== generation || this.finishIfExpired(room)) return;
      Object.assign(room, snapshot, {
        players: room.players,
        touched: room.touched,
      });
      throw new Error(
        "Round resolution could not finish. Your submissions are retained; try again.",
      );
    } finally {
      this.changed(room.code);
    }
  }
  async next(session: Session) {
    const room = this.host(session);
    if (room.mode === "realtime")
      throw new Error("Real-time games do not have rounds.");
    if (room.phase !== "results")
      throw new Error("Finish the current round first.");
    const snapshot = structuredClone(room);
    room.round++;
    room.phase = "hiding";
    room.submissions = {};
    room.cheer = null;
    room.clue = null;
    room.ruledOut = [];
    room.pets.forEach((p) => {
      p.acted = false;
    });
    this.changed(room.code);
    try {
      await this.placeTodd(room);
      if (room.generation !== snapshot.generation || this.finishIfExpired(room))
        return;
      room.phase = "seeking";
      this.event(
        room,
        `Round ${room.round}. Todd has moved. Every player has one fresh action.`,
      );
    } catch {
      if (room.generation !== snapshot.generation || this.finishIfExpired(room))
        return;
      Object.assign(room, snapshot, {
        players: room.players,
        touched: room.touched,
      });
      throw new Error("Todd could not move. Try the next round again.");
    } finally {
      this.changed(room.code);
    }
  }
  restart(session: Session) {
    const room = this.host(session);
    if (["hiding", "resolving"].includes(room.phase) || room.joining)
      throw new Error("Wait for the current operation to finish.");
    room.controllers.clear();
    room.destinations.clear();
    room.cursors.clear();
    room.visits.clear();
    room.phase = "lobby";
    room.round = 1;
    room.generation++;
    room.dot = "";
    room.hide = null;
    room.submissions = {};
    room.cheer = null;
    room.clue = null;
    room.ruledOut = [];
    room.outcome = null;
    room.endsAt = null;
    room.pausedAt = null;
    room.winnerPetIds = [];
    room.traps = [];
    room.reset = null;
    room.events = [];
    room.pets = (room.originalPets.length ? room.originalPets : room.pets).map(
      (p) => ({
        ...p,
        usage: 100,
        tipsy: false,
        effect: undefined,
        acted: false,
        location: "camp",
        readyRound: 1,
        mating: undefined,
      }),
    );
    for (const player of room.players)
      player.petId = room.pets.find((p) => ownsPet(p, player.id))!.id;
    this.event(
      room,
      "A fresh hunt. Players and their original pets stay connected.",
    );
    this.changed(room.code);
  }
  public(code: string): PublicRoom {
    const r = this.get(code);
    const reveal =
      (r.mode === "realtime"
        ? r.phase === "over"
        : ["results", "over"].includes(r.phase)) && r.hide
        ? { location: r.dot, summary: r.hide.summary, stats: r.hiderStats }
        : null;
    return {
      code,
      phase: r.phase,
      round: r.round,
      endsAt: r.endsAt,
      pausedAt: r.pausedAt,
      serverNow: this.now(),
      winnerPetIds: [...r.winnerPetIds],
      winnerNames: r.pets
        .filter((p) => r.winnerPetIds.includes(p.id))
        .map((p) => p.name),
      mode: r.mode,
      playerCount: r.players.length,
      generation: r.generation,
      players: r.players.map(({ token: _secret, ...p }) => ({ ...p })),
      pets: structuredClone(r.pets),
      submitted: Object.keys(r.submissions),
      constraint: constraintFor(r.round),
      events: structuredClone(r.events),
      claim:
        r.mode === "realtime"
          ? "The Dot is hidden. Find it to win."
          : r.phase === "hiding"
            ? "A completely innocent dot is thinking…"
            : (r.hide?.claim ?? "I am completely aligned. Probably."),
      clue: r.clue,
      ruledOut: [...r.ruledOut],
      cards: r.round % 2 ? ["squeak", "shuffle"] : ["trail", "shrink"],
      cheer: r.cheer ? { ...r.cheer } : null,
      outcome: r.outcome,
      reveal,
      ai: {
        configured: this.brain.configured,
        model: this.brain.model,
        fallbackCount: r.fallbackCount,
      },
    };
  }
}
