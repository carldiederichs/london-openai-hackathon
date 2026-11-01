# Live-game expansion

Approved direction: add phone joining, model-powered moves, and cheering input after making the first local prototype PR ready. This document describes follow-up work, not implemented features.

## Intended experience

- A host opens the castle on the big screen. Ten phone players join with a QR code and bring an image or describe their pet.
- Give each pet a card with a fixed budget, initially 20 points across five agreed stats. Suggested stats are flight, smallness, speed, climb, and swim. A larger smallness score should mean better access to narrow passages to avoid inverted comparisons.
- Players submit one action each round. Seeking prompts follow a constraint such as eight words, emoji only, or a rhyme. The model proposes a move; the server checks it against the pet's abilities and usage.
- An AI-controlled hider chooses from legal hiding spots. Show a short in-character explanation and a misleading public claim. Keep the actual hiding place out of player payloads and live explanations until its reveal.
- Two audience teams compete for one temporary rule change per round. Measure each side in separate timed microphone windows so one room microphone can compare them. Include a labelled manual host fallback for unavailable microphones or a noisy venue.
- Retain the requested bottle traps, breeding, vet, and Tivo reset, with all changes enforced by the server.

## Rules to settle in the live implementation

The latest proposal suggests four rounds and a single discovery to win; the local prototype uses three rounds and three discoveries. Make that change explicit in the live mode and its instructions.

Ten human seekers plus one AI hider conflicts with turning one of the ten human-owned pets into the hider. Resolve this before implementation. A shadow copy of a player's pet could preserve ten seeker roles while inheriting that pet's ability limits.

Decide how newborn pets are assigned to a phone player and whether a breed request needs both parents' consent. A fixed stat budget balances total points, but room distribution still needs playtesting so no stat becomes dominant.

## Implementation boundary

Use an authoritative room server, player reconnect tokens, host-only round resolution, and validated submissions. Keep API keys exclusively on the server. Resolve a round only once, handle disconnected players explicitly, and display when an offline fallback replaces an AI decision.

Phone joining on a local network requires a reachable host address; localhost on a phone points to that phone. Venue client isolation may prevent LAN access. Microphone capture requires a supported secure context and explicit browser permission. A local host can capture cheering on localhost while phones submit actions over the LAN.

Do not assume access to a particular desktop pet folder or sprite format. The image upload fallback already works in the prototype. Description-to-pet creation and native sprite import still need implementation and verification.

## References reviewed

- [OpenAI Showcase](https://developers.openai.com/showcase): useful game and interaction examples.
- [Codex Pet Arena](https://developers.openai.com/showcase/codex-pet-arena): an example of starting with a playable loop and adding animated pets and effects in later passes.
- [Turn-based RPG](https://developers.openai.com/showcase/turn-based-rpg): a model-backed game reference.
- [Decisions API](https://developers.openai.com/api/docs/guides/decisions#choose-a-question-type): supports predicates, choices, and scores. Its documentation recommends Structured Outputs with Responses for custom JSON objects and explanations. Use that distinction when selecting an API for pet cards and move proposals.

No live model request has been verified in this PR.
