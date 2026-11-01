import type { Pet } from "../pets";
import { MAX_PLAYERS } from "../live/shared";
import { SAMPLE_PETS } from "./samples";

export const WORLD_BOUNDS = { minX: -26, maxX: 26, minZ: -18, maxZ: 34 };
export const MANSION = { minX: -12.5, maxX: 11, minZ: -10, maxZ: 0.5 };
export type WorldSession = { playerId: string; token: string };
export type WorldPet = Pet & {
  position: { x: number; z: number };
  moving: boolean;
  online: boolean;
  sampleId?: string;
};
export type WorldState = {
  pets: WorldPet[];
  count: number;
  online: number;
  capacity: number;
  now: number;
};
type Member = {
  pet: WorldPet;
  token: string;
  lastSeen: number;
  mask: number;
  sequence: number;
  inputAt: number;
};
export type WorldJoin = { name?: string; sampleId?: string; image?: string };

export class SharedWorld {
  members = new Map<string, Member>();
  images = new Map<string, string>();
  private lastTick: number;
  constructor(now = Date.now(), restored: Member[] = []) {
    this.lastTick = now;
    for (const member of restored)
      this.members.set(member.pet.id, {
        ...member,
        mask: 0,
        sequence: -1,
        inputAt: 0,
        pet: { ...member.pet, online: false, moving: false },
      });
  }
  join(input: WorldJoin, now = Date.now()): WorldSession {
    this.expire(now);
    if (this.members.size >= MAX_PLAYERS)
      throw new Error(
        `The castle has all ${MAX_PLAYERS} players. Try again shortly.`,
      );
    if (!input || typeof input !== "object")
      throw new Error("Choose a pet to enter the castle.");
    const sample = SAMPLE_PETS.find((pet) => pet.id === input.sampleId);
    if (!sample && !input.image)
      throw new Error("Choose one of the five pets or upload your own.");
    if (
      input.name !== undefined &&
      (typeof input.name !== "string" || input.name.trim().length > 20)
    )
      throw new Error("Use a pet name of up to 20 characters.");
    if (
      input.image &&
      (typeof input.image !== "string" ||
        input.image.length > 120_000 ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
          input.image,
        ))
    )
      throw new Error("Choose a resized PNG, JPEG or WebP pet image.");
    const id = crypto.randomUUID(),
      token = crypto.randomUUID() + crypto.randomUUID();
    const slot = this.members.size;
    const pet: WorldPet = {
      id,
      name: input.name?.trim() || sample?.name || "My pet",
      species: sample?.species || "cat",
      color: sample?.color || "#baa6db",
      usage: 100,
      acted: false,
      location: "camp",
      image: input.image ? `/api/world/images/${id}` : sample!.image,
      sampleId: sample?.id,
      position: {
        x: -9 + (slot % 20) * 0.9,
        z: 9 + Math.floor(slot / 20) * 0.6,
      },
      moving: false,
      online: false,
    };
    this.members.set(id, {
      pet,
      token,
      lastSeen: now,
      mask: 0,
      sequence: -1,
      inputAt: now,
    });
    if (input.image) this.images.set(id, input.image);
    return { playerId: id, token };
  }
  authenticate(session: WorldSession) {
    const member = session && this.members.get(session.playerId);
    if (!member || member.token !== session.token)
      throw new Error("Your castle session expired. Choose your pet again.");
    return member;
  }
  leave(session: WorldSession) {
    this.authenticate(session);
    this.members.delete(session.playerId);
    this.images.delete(session.playerId);
  }
  connected(id: string, online: boolean, now = Date.now()) {
    const member = this.members.get(id);
    if (!member) return;
    member.pet.online = online;
    member.lastSeen = now;
    if (!online) {
      member.mask = 0;
      member.pet.moving = false;
    }
  }
  input(id: string, mask: unknown, sequence: unknown, now = Date.now()) {
    const member = this.members.get(id);
    if (
      !member ||
      !Number.isInteger(mask) ||
      Number(mask) < 0 ||
      Number(mask) > 15 ||
      !Number.isSafeInteger(sequence) ||
      Number(sequence) <= member.sequence
    )
      return;
    member.mask = Number(mask);
    member.sequence = Number(sequence);
    member.inputAt = now;
    member.lastSeen = now;
  }
  tick(now = Date.now()) {
    const dt = Math.max(0, Math.min(0.1, (now - this.lastTick) / 1000));
    this.lastTick = now;
    let changed = false;
    for (const member of this.members.values()) {
      if (now - member.inputAt > 2000 || !member.pet.online) member.mask = 0;
      const dx = Number(!!(member.mask & 2)) - Number(!!(member.mask & 8));
      const dz = Number(!!(member.mask & 4)) - Number(!!(member.mask & 1));
      const length = Math.hypot(dx, dz),
        moving = length > 0;
      if (moving !== member.pet.moving) {
        member.pet.moving = moving;
        changed = true;
      }
      if (!moving) continue;
      const position = member.pet.position,
        distance = (4.2 * dt) / length;
      const walkable = (x: number, z: number) =>
        !(
          x > MANSION.minX &&
          x < MANSION.maxX &&
          z > MANSION.minZ &&
          z < MANSION.maxZ
        );
      const x = Math.max(
        WORLD_BOUNDS.minX,
        Math.min(WORLD_BOUNDS.maxX, position.x + dx * distance),
      );
      if (walkable(x, position.z)) position.x = x;
      const z = Math.max(
        WORLD_BOUNDS.minZ,
        Math.min(WORLD_BOUNDS.maxZ, position.z + dz * distance),
      );
      if (walkable(position.x, z)) position.z = z;
      changed = true;
    }
    return changed;
  }
  expire(now = Date.now()) {
    for (const [id, member] of this.members)
      if (!member.pet.online && now - member.lastSeen > 180_000) {
        this.members.delete(id);
        this.images.delete(id);
      }
  }
  public(playerId?: string, now = Date.now()): WorldState {
    const members = [...this.members.values()];
    return {
      pets: members
        .filter((member) => !playerId || member.pet.id === playerId)
        .map(({ pet }) => ({
          ...pet,
          position: {
            x: Math.round(pet.position.x * 100) / 100,
            z: Math.round(pet.position.z * 100) / 100,
          },
        })),
      count: members.length,
      online: members.filter(({ pet }) => pet.online).length,
      capacity: MAX_PLAYERS,
      now,
    };
  }
  snapshot() {
    return [...this.members.values()];
  }
}
