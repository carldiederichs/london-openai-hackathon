import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { CODEX_PETS } from "../src/pets";
import { LIVE_LOCATIONS, accessible, balanceStats } from "../src/live/shared";
const base = process.env.GAME_BACKEND || "http://localhost:8792";
const code = process.env.ROOM_CODE;
if (!code || !/^[A-F0-9]{6}$/.test(code))
  throw new Error(
    "Create a separate test room, then set ROOM_CODE to its code.",
  );
async function post(path: string, body: unknown): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(base + `/api/rooms/${code}/` + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as any;
    if (response.status === 503 && attempt < 15) {
      await sleep(250 + Math.random() * 500);
      continue;
    }
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }
}
const cards = CODEX_PETS.map((p) => ({
  ...p,
  stats: balanceStats({
    flight: ["owl", "dragon"].includes(p.species) ? 8 : 2,
    smallness: p.species === "bunny" ? 8 : 3,
    speed: 4,
    climb: p.species === "cat" ? 8 : 3,
    swim: p.species === "frog" ? 8 : 2,
  }),
}));
const seekers: any[] = [];
for (const place of LIVE_LOCATIONS) {
  const card = cards.find((p) => accessible(p, place.id));
  if (!card) continue;
  const session = await post("join", {
    name: `Find ${place.id}`.slice(0, 20),
    description: card.description,
    companionId: card.id,
  });
  seekers.push({ session, location: place.id });
}
const sync = (s: any) => post("sync", { token: s.token });
console.log(
  JSON.stringify({
    ready: true,
    room: code,
    seekers: seekers.length,
    instruction: "Start this test room in the host browser.",
  }),
);
let state = await sync(seekers[0].session);
while (state.phase === "lobby") {
  await sleep(250);
  state = await sync(seekers[0].session);
}
while (state.phase === "hiding") {
  await sleep(250);
  state = await sync(seekers[0].session);
}
const started = Date.now();
await Promise.all(
  seekers.map(async ({ session, location }) => {
    try {
      await post("action", {
        token: session.token,
        event: "player:destination",
        data: { location, generation: state.generation },
      });
    } catch (e) {
      // A collision can eliminate this seeker, or another seeker can win while
      // these simultaneous destination requests are still being processed.
      for (let retry = 0; retry < 5; retry++) {
        const current = await sync(session);
        if (
          current.phase === "over" ||
          current.pets.every((p: any) => p.usage <= 0)
        )
          return;
        await sleep(200);
      }
      throw e;
    }
  }),
);
while (state.phase !== "over") {
  await sleep(200);
  state = await sync(seekers[0].session);
}
assert.ok(state.winnerNames.length);
console.log(
  JSON.stringify({
    room: code,
    outcome: state.outcome,
    elapsedMs: Date.now() - started,
    winners: state.winnerNames,
    reveal: state.reveal?.location,
  }),
);
