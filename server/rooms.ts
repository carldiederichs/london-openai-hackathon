import {
  advanceMating,
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
  winnerPetIds: string[];
};
const token = () => randomBytes(24).toString("base64url");
const constraintFor = (round: number): Constraint =>
  ["eight", "emoji", "rhyme", "eight"][(round - 1) % 4] as Constraint;
const signature = (stats: Stats) =>
  STAT_KEYS.filter((k) => stats[k] >= 5).join(",");
export function toddStats(pets: LivePet[]): Stats {
  const used = new Set(pets.map((p) => signature(p.stats)));
  const candidates: Stats[] = [];
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
          if (signature(stats) && !used.has(signature(stats)))
            candidates.push(stats);
        }
  if (!candidates.length)
    throw new Error("No distinct Todd card is available.");
  // Shadow one seeker, redistributing the fewest points needed to unlock a
  // different set of abilities from every member of the party.
  const source = pets[Math.floor(Math.random() * pets.length)].stats;
  const distance = (s: Stats) =>
    STAT_KEYS.reduce((sum, k) => sum + Math.abs(s[k] - source[k]), 0);
  const nearest = Math.min(...candidates.map(distance));
  const shadows = candidates.filter((s) => distance(s) === nearest);
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
    if (room.endsAt === null || this.now() < room.endsAt) return false;
    room.phase = "over";
    room.outcome = "survived";
    room.winnerPetIds = survivorIds(room.pets, room.round);
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
        this.finishIfExpired(room) ||
        room.endsAt === null ||
        ["resolving", "hiding"].includes(room.phase)
      )
        continue;
      const pets = advanceMating(room.pets, this.now(), randomUUID);
      if (pets !== room.pets) {
        if (pets.length < room.pets.length) {
          const child = pets.find(
            (p) => !room.pets.some((old) => old.id === p.id),
          )!;
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
  create(): Session {
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
      winnerPetIds: [],
      fallbackCount: 0,
      images: new Map(),
      joining: 0,
      touched: Date.now(),
    });
    return { roomCode: code, token: secret, role: "host" };
  }
  async join(code: string, input: CardInput): Promise<Session> {
    const room = this.get(code);
    if (room.phase !== "lobby")
      throw new Error("This hunt has started. Join the next one.");
    if (room.players.length + room.joining >= 10)
      throw new Error("All ten player slots are taken.");
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
      const card = await this.brain.card(input);
      const id = randomUUID(),
        petId = randomUUID(),
        secret = token();
      if (room.phase !== "lobby")
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
      this.event(
        room,
        "One minute. Keep your pet above zero usage to survive. Guardians, submit your moves.",
      );
    } catch {
      room.phase = "lobby";
      throw new Error("The hunt could not start. Try again.");
    } finally {
      this.changed(room.code);
    }
  }
  submit(session: Session, raw: unknown, round: number, generation: number) {
    const verified = this.authenticate(session.roomCode, session.token),
      room = this.get(session.roomCode);
    if (verified.role !== "player")
      throw new Error("Join as a player to submit a move.");
    if (
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
    if (room.phase !== "seeking" || room.cheer)
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
    if (
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
      ["results", "over"].includes(r.phase) && r.hide
        ? { location: r.dot, summary: r.hide.summary, stats: r.hiderStats }
        : null;
    return {
      code,
      phase: r.phase,
      round: r.round,
      endsAt: r.endsAt,
      serverNow: this.now(),
      winnerPetIds: [...r.winnerPetIds],
      generation: r.generation,
      players: r.players.map(({ token: _secret, ...p }) => ({ ...p })),
      pets: structuredClone(r.pets),
      submitted: Object.keys(r.submissions),
      constraint: constraintFor(r.round),
      events: structuredClone(r.events),
      claim:
        r.phase === "hiding"
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
