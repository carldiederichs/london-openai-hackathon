import test from "node:test";
import assert from "node:assert/strict";
import {
  act,
  canAccess,
  createGame,
  LOCATIONS,
  MAX_PETS,
  whisper,
  type Game,
  type Action,
} from "./game.ts";

function apply(game: Game, action: Action) {
  const result = act(game, action);
  assert.equal(result.error, undefined);
  return result.game;
}

test("seeded setup is reproducible, with distinct hidden objects and ten balanced pets", () => {
  assert.deepEqual(createGame(42), createGame(42));
  for (let seed = 0; seed < 100; seed++) {
    const g = createGame(seed);
    assert.equal(new Set([g.dot, g.reset, ...g.traps]).size, 4);
    assert.equal(g.pets.length, 10);
    assert.ok(
      g.pets.every((p) => p.usage === 100 && p.traits.length <= 2 && !p.acted),
    );
    assert.ok(LOCATIONS.every((l) => g.pets.some((p) => canAccess(p, l))));
  }
});

test("a locked room rejects movement without spending an action or mutating state", () => {
  const g = createGame(1),
    before = structuredClone(g);
  const result = act(g, { type: "move", petId: "pet-0", locationId: "tower" });
  assert.match(result.error!, /flight/);
  assert.equal(result.game, g);
  assert.deepEqual(g, before);
});

test("search costs ten usage, records the location, and cannot be repeated in one round", () => {
  const g = createGame(9);
  g.dot = "tower";
  g.traps = [];
  g.reset = null;
  const next = apply(g, { type: "move", petId: "pet-0", locationId: "garden" });
  assert.equal(next.pets[0].usage, 90);
  assert.equal(next.pets[0].location, "garden");
  assert.equal(next.searched.garden, 1);
  assert.equal(g.pets[0].usage, 100);
  assert.match(
    act(next, { type: "move", petId: "pet-0", locationId: "garden" }).error!,
    /already acted/,
  );
});

test("traps cost 25 extra usage, clamp to zero, and are consumed once", () => {
  const g = createGame(1);
  g.dot = "tower";
  g.reset = null;
  g.traps = ["garden"];
  g.pets[0].usage = 15;
  const next = apply(g, { type: "move", petId: "pet-0", locationId: "garden" });
  assert.equal(next.pets[0].usage, 0);
  assert.equal(next.traps.length, 0);
  const second = apply(next, {
    type: "move",
    petId: "pet-2",
    locationId: "garden",
  });
  assert.equal(second.pets[2].usage, 90);
});

test("a hidden Tivo reset restores its finder after movement and is single-use", () => {
  const g = createGame(2);
  g.dot = "tower";
  g.traps = [];
  g.reset = "garden";
  g.pets[0].usage = 10;
  const next = apply(g, { type: "move", petId: "pet-0", locationId: "garden" });
  assert.equal(next.pets[0].usage, 100);
  assert.equal(next.reset, null);
  assert.match(next.log[0].text, /Tivo reset/);
  const second = apply(next, {
    type: "move",
    petId: "pet-1",
    locationId: "garden",
  });
  assert.equal(second.pets[1].usage, 90);
});

test("exhausted pets can use the vet; healing caps at 100 and spends the action", () => {
  const g = createGame(2);
  g.pets[0].usage = 0;
  g.pets[1].usage = 80;
  assert.match(
    act(g, { type: "move", petId: "pet-0", locationId: "garden" }).error!,
    /needs 10/,
  );
  const next = apply(g, { type: "vet", petId: "pet-0" });
  assert.equal(next.pets[0].usage, 50);
  assert.ok(next.pets[0].acted);
  const capped = apply(next, { type: "vet", petId: "pet-1" });
  assert.equal(capped.pets[1].usage, 100);
  assert.match(act(g, { type: "vet", petId: "pet-2" }).error!, /full usage/);
});

test("breeding spends both parents actions and usage; babies inherit and rest until next round", () => {
  const g = createGame(2);
  const next = apply(g, { type: "breed", petId: "pet-0", partnerId: "pet-1" });
  assert.equal(next.pets.length, 11);
  assert.deepEqual(
    next.pets.slice(0, 2).map((p) => [p.usage, p.acted]),
    [
      [80, true],
      [80, true],
    ],
  );
  const baby = next.pets.at(-1)!;
  assert.deepEqual(baby.traits, ["tiny", "flight"]);
  assert.equal(baby.usage, 100);
  assert.ok(baby.acted);
  assert.match(
    act(next, { type: "move", petId: baby.id, locationId: "tower" }).error!,
    /already acted/,
  );
  const round2 = apply(next, { type: "end-round" });
  assert.equal(round2.pets.at(-1)!.acted, false);
  assert.equal(round2.pets[0].usage, 80);
});

test("breeding rejects invalid, exhausted, spent, identical partners and a full party", () => {
  const g = createGame(2);
  assert.ok(
    act(g, { type: "breed", petId: "pet-0", partnerId: "pet-0" }).error,
  );
  assert.ok(
    act(g, { type: "breed", petId: "pet-0", partnerId: "missing" }).error,
  );
  g.pets[1].usage = 19;
  assert.match(
    act(g, { type: "breed", petId: "pet-0", partnerId: "pet-1" }).error!,
    /20 usage/,
  );
  g.pets[1].usage = 100;
  g.pets[1].acted = true;
  assert.match(
    act(g, { type: "breed", petId: "pet-0", partnerId: "pet-1" }).error!,
    /already acted/,
  );
  g.pets[1].acted = false;
  while (g.pets.length < MAX_PETS)
    g.pets.push({ ...g.pets[0], id: `extra-${g.pets.length}` });
  assert.match(
    act(g, { type: "breed", petId: "pet-0", partnerId: "pet-1" }).error!,
    /party is full/,
  );
});

test("the Dot flees after a sighting, invalidates old searches, and is captured on the third", () => {
  let g = createGame(123);
  g.traps = [];
  g.reset = null;
  g.searched = { garden: 1 };
  for (let i = 1; i <= 3; i++) {
    const oldDot = g.dot;
    const location = LOCATIONS.find((l) => l.id === oldDot)!;
    const pet = g.pets.find((p) => !p.acted && canAccess(p, location))!;
    assert.ok(pet, "a ready guardian can reach the Dot");
    g = apply(g, { type: "move", petId: pet.id, locationId: oldDot });
    assert.equal(g.sightings, i);
    if (i < 3) {
      assert.notEqual(g.dot, oldDot);
      assert.deepEqual(g.searched, {});
    }
  }
  assert.equal(g.status, "won");
  assert.match(act(g, { type: "end-round" }).error!, /hunt is over/);
});

test("a Dot that fled onto a trap is found even when the trap exhausts the searcher", () => {
  const g = createGame(3);
  g.dot = "garden";
  g.traps = ["garden"];
  g.reset = null;
  g.pets[0].usage = 10;
  const next = apply(g, { type: "move", petId: "pet-0", locationId: "garden" });
  assert.equal(next.sightings, 1);
  assert.equal(next.pets[0].usage, 0);
  assert.equal(next.log[0].kind, "dot");
  assert.equal(next.log[1].kind, "trap");
});

test("each new round moves the Dot and resets actions; ending round three loses", () => {
  let g = createGame(333);
  for (let round = 2; round <= 3; round++) {
    const old = g.dot;
    g = apply(g, { type: "end-round" });
    assert.equal(g.round, round);
    assert.notEqual(g.dot, old);
    assert.ok(g.pets.every((p) => !p.acted));
  }
  g = apply(g, { type: "end-round" });
  assert.equal(g.status, "lost");
  assert.equal(g.round, 3);
  assert.ok(
    act(g, { type: "move", petId: "pet-0", locationId: "garden" }).error,
  );
});

test("whispers give an accurate region after setup and every escape", () => {
  for (let seed = 1; seed <= 50; seed++) {
    let g = createGame(seed);
    for (let i = 0; i < 3; i++) {
      const region = LOCATIONS.find((l) => l.id === g.dot)!.region;
      assert.match(whisper(g), region === "north" ? /northern/ : /south/);
      g = apply(g, { type: "end-round" });
    }
  }
});

test("uploads require an image and one or two valid traits, and lock when gameplay begins", () => {
  const g = createGame(1),
    image = "data:image/png;base64,aaaa";
  assert.ok(act(g, { type: "add-pet", name: "New", image, traits: [] }).error);
  assert.ok(
    act(g, {
      type: "add-pet",
      name: "New",
      image: "https://remote.example/pet.svg",
      traits: ["tiny"],
    }).error,
  );
  const next = apply(g, {
    type: "add-pet",
    name: "  New  ",
    image,
    traits: ["tiny", "flight"],
  });
  assert.equal(next.pets.at(-1)!.name, "New");
  assert.equal(next.turn, 0);
  const started = apply(next, { type: "end-round" });
  assert.ok(
    act(started, { type: "add-pet", name: "Late", image, traits: ["tiny"] })
      .error,
  );
});

test("invalid pet and location IDs return safe errors", () => {
  const g = createGame(4);
  assert.ok(
    act(g, { type: "move", petId: "missing", locationId: "garden" }).error,
  );
  assert.ok(
    act(g, { type: "move", petId: "pet-0", locationId: "missing" }).error,
  );
});
