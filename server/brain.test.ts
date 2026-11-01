import { test } from "node:test";
import assert from "node:assert/strict";
import { createBrain } from "./brain.ts";
import { PREVIEW_PETS } from "../src/pets.ts";
import { balanceStats, type LivePet } from "../src/live/shared.ts";
const pet: LivePet = {
  ...PREVIEW_PETS[0],
  ownerId: "test",
  stats: balanceStats({}),
  origin: "fallback",
  flavor: "Test pet",
  readyRound: 1,
};
const response = (value: unknown, status = "completed") =>
  new Response(
    JSON.stringify({
      id: "resp_test",
      object: "response",
      status,
      output: [
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(value),
              annotations: [],
            },
          ],
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
test("structured Responses API transport handles cards, moves, and hider decisions", async () => {
  const requests: Record<string, any>[] = [];
  const transport: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    requests.push(body);
    if (body.text.format.name === "pet_card")
      return response({
        stats: { flight: 8, smallness: 3, speed: 3, climb: 3, swim: 3 },
        species: "owl",
        color: "#aeabd6",
        flavor: "A winged guardian.",
      });
    if (body.text.format.name === "seeker_move")
      return response({
        locationId: "garden",
        narration: "The guardian hops to the garden.",
        valid: true,
      });
    return response({
      locationId: "garden",
      summary: "Todd blends into the flowers.",
      claim: "I am completely aligned. Probably.",
    });
  };
  const brain = createBrain("test-key-never-sent", "gpt-4.1-mini", transport);
  const card = await brain.card({
    name: "Owl",
    description: "winged owl",
    image: "data:image/png;base64,AAAA",
  });
  assert.equal(card.mode, "ai");
  assert.equal(card.stats.flight, 8);
  assert.equal(
    (await brain.move(pet, "garden", ["garden"], "eight")).mode,
    "ai",
  );
  assert.equal((await brain.hide(card.stats, ["garden"], 1)).mode, "ai");
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.store, false);
    assert.equal(request.text.format.strict, true);
    assert.equal(request.text.format.schema.additionalProperties, false);
  }
  assert.equal(requests[0].input[0].content[1].type, "input_image");
  assert.deepEqual(requests[1].text.format.schema.properties.locationId.enum, [
    "garden",
  ]);
  const moveInput = JSON.parse(requests[1].input[0].content[0].text);
  assert.deepEqual(Object.keys(moveInput).sort(), [
    "constraint",
    "locations",
    "pet",
    "prompt",
  ]);
});
test("malformed, incomplete, failed or illegal model outputs fall back safely", async () => {
  for (const transport of [
    async () => response({ unexpected: true }),
    async () => response({}, "incomplete"),
    async () => new Response("unavailable", { status: 503 }),
    async () => {
      throw new Error("network unavailable");
    },
    async () =>
      response({ locationId: "not-a-room", narration: "invalid", valid: true }),
  ] as (typeof fetch)[]) {
    const brain = createBrain("test-key-never-sent", "gpt-4.1-mini", transport);
    assert.equal(
      (await brain.card({ name: "Cat", description: "a cat" })).mode,
      "fallback",
    );
    const move = await brain.move(pet, "garden", ["garden"], "eight");
    assert.equal(move.mode, "fallback");
    assert.equal(move.locationId, "garden");
    const hide = await brain.hide(pet.stats, ["garden"], 1);
    assert.equal(hide.mode, "fallback");
    assert.equal(hide.locationId, "garden");
  }
});
