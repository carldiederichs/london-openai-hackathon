import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enterMatingRoom,
  advanceMating,
  MATING_DURATION_MS,
} from "./mating.ts";
import { PREVIEW_PETS } from "../pets.ts";
import { balanceStats, type LivePet } from "./shared.ts";
const pets = (): LivePet[] =>
  PREVIEW_PETS.slice(0, 3).map((p, i) => ({
    ...p,
    ownerId: String(i),
    stats: balanceStats({}),
    origin: "fallback",
    flavor: "Test guardian",
    readyRound: 1,
  }));
test("mating waits for both arrivals, rejects a third, merges only once and spends combined usage", () => {
  let all = pets();
  all[0].usage = 40;
  all[1].usage = 30;
  all = enterMatingRoom(all, all[0].id, 1000);
  assert.equal(
    advanceMating(all, 10000, () => "baby"),
    all,
  );
  all = enterMatingRoom(all, all[1].id, 10000);
  assert.throws(() => enterMatingRoom(all, all[2].id, 10000), /only two/);
  const arrival = Math.max(...all.slice(0, 2).map((p) => p.mating!.arrivesAt));
  assert.equal(
    advanceMating(all, arrival - 1, () => "baby"),
    all,
  );
  all = advanceMating(all, arrival, () => "baby");
  assert.equal(
    advanceMating(all, arrival + MATING_DURATION_MS - 1, () => "baby"),
    all,
  );
  all = advanceMating(all, arrival + MATING_DURATION_MS, () => "baby");
  assert.equal(all.length, 2);
  assert.equal(all[1].usage, 30);
  assert.equal(
    advanceMating(all, arrival + MATING_DURATION_MS + 1, () => "duplicate"),
    all,
  );
});
test("mating rejects exhausted pets and overlapping ownership", () => {
  let all = pets();
  all[0].usage = 19;
  assert.throws(() => enterMatingRoom(all, all[0].id, 0), /20 usage/);
  all[0].usage = 100;
  all = enterMatingRoom(all, all[0].id, 0);
  all[1].coOwnerIds = [all[0].ownerId];
  assert.throws(() => enterMatingRoom(all, all[1].id, 0), /different player/);
});
