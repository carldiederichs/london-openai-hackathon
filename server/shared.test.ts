import test from "node:test";
import assert from "node:assert/strict";
import {
  balanceStats,
  STAT_KEYS,
  accessible,
  validatePrompt,
  localRhyme,
} from "../src/live/shared.ts";

test("stat cards always have twenty points with bounded values", () => {
  const cases = [
    {},
    { flight: 100000 },
    { swim: -4, climb: NaN },
    { speed: Infinity },
    { flight: 8, smallness: 3, speed: 2, climb: 4, swim: 3 },
  ];
  for (const c of cases) {
    const result = balanceStats(c);
    assert.equal(
      STAT_KEYS.reduce((total, k) => total + result[k], 0),
      20,
    );
    assert.ok(
      STAT_KEYS.every(
        (k) => Number.isInteger(result[k]) && result[k] >= 1 && result[k] <= 8,
      ),
    );
  }
});
test("live access uses the specific stat, including size and speed", () => {
  const pet = {
    stats: { flight: 5, smallness: 4, speed: 5, climb: 3, swim: 3 },
  };
  assert.ok(accessible(pet, "tower"));
  assert.ok(accessible(pet, "vault"));
  assert.equal(accessible(pet, "attic"), false);
  assert.equal(accessible(pet, "missing"), false);
});
test("round constraints reject long prompts and words in emoji rounds", () => {
  assert.equal(validatePrompt("Fly to the tower now", "eight"), undefined);
  assert.ok(
    validatePrompt("one two three four five six seven eight nine", "eight"),
  );
  assert.equal(validatePrompt("🪽 🏰 🔍", "emoji"), undefined);
  assert.ok(validatePrompt("Go 🏰", "emoji"));
  assert.ok(validatePrompt("123", "emoji"));
  assert.ok(validatePrompt("Only one line", "rhyme"));
  assert.ok(localRhyme("I take flight\nInto the night"));
  assert.equal(localRhyme("Into the room\nWatch me fly"), false);
});
