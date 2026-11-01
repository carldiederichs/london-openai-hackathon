# Feral live game design

## Current game

New rooms use a real-time, one-minute hunt for up to 300 phone players and one host. The big screen renders the existing 3D mansion; phones show their own pet, a small position map and a WASD-style arrow pad. Players swipe through the original Codex companions or supply a custom pet image or description. Built-in companions use balanced preset cards without a model request.

Before the timer starts, the server places Todd, the OpenAI Dot, in a legal hiding room. Its ability card is a shadow derived from a seeker, with a distinct allocation under the same 20-point budget. Its chosen room must also be reachable by a seeker. The Dot stays hidden throughout play. A living pet entering that room wins immediately. Otherwise, at 60 seconds the living pet with the highest remaining usage wins; exact ties share the win. Both owners of a winning merged pet win together.

The host's large timer has Start, Stop and Resume controls. Stop freezes the countdown, movement, usage drain and breeding; Resume shifts the deadline and pet timers by the paused duration. The server enforces this pause, and reconnects preserve it. The practice timer uses the same whole-game pause behavior.

## Movement, care and merging

The server simulates movement along connected estate paths. WASD, keyboard arrows or held phone arrows select a direction; clients cannot submit arbitrary positions. Input stops on release, loss of focus or disconnect, and stale input expires. Room gates enforce flight, smallness, speed, climb, swim and applicable night-vision requirements. Usage drains over time and faster while moving; a pet at zero cannot move until the next game.

Entering a room searches it. Hidden bottles cost 25 usage and cause tipsiness, which slows movement. The vet restores up to 50 usage and cures tipsiness. Tibo's tavern reset restores 100 usage and cures tipsiness once per hunt. Phone care shortcuts route a pet to the vet or mating room along the same paths; manual steering takes over.

The mating room reserves at most two places, including the final approach. Each entrant needs at least 20 usage, and the pets must belong to different owners. After both arrive, an eight-second duvet-and-hearts animation precedes their merge. The parents are replaced by one pet with a balanced card based on both parents, combined usage minus 40 capped at 100, and both owners. Either owner can control it. A lone waiting pet can leave; a third pet cannot enter during the animation. Restart restores the original roster.

## Authority and data

The server owns positions, usage, hidden objects, the deadline, pause state, occupancy and outcomes. Host and player sessions authenticate separately. New real-time rooms reject the legacy turn submission and resolution commands. Clients do not receive active Dot or bottle positions, other clients' credentials, or private model state.

The host receives the whole world's position updates. Each phone receives only its owned pet and the public game summary. Motion updates are compact and sent separately from less frequent structural state. The host interpolates positions for smooth display; sprite textures are shared, static props are batched and crowded scenes reduce labels. Capacity is checked with a local 300-player-plus-host WebSocket test; venue networking and physical-device performance require separate tests.

Rooms and session identities remain in memory. Browser session storage allows reconnects within a tab. Server restart clears rooms; this build has no durable account system or hosted deployment.

## AI and offline behavior

Model output supplies custom card flavor and stat weights, plus the initial hiding choice. Deterministic code enforces point budgets, gates and legal outcomes. Responses use strict JSON schemas and `store: false`; malformed, incomplete or failed responses trigger labelled offline behavior. No chain-of-thought is requested or shown. A live `gpt-4.1-mini` custom-card request has returned an AI-labelled 20-point card; that observation does not verify every other model path.

Real-time steering does not call a model. Built-in companions require no model request. Custom image interpretation needs a configured model; offline cards remain available for rehearsal. Ordinary images and supported Codex sprite sheets can be uploaded. Local sprite assets retain their original ownership.

## Castle and integrations

The world fills the host viewport with glass overlays at the sides and the large timer at the top centre. Entering a castle room lifts/fades the upper exterior to reveal furnished rooms. The single playable floor contains 26 rooms, with 42 hiding places across the connected castle and grounds. Upper windows and towers are decoration. The original 2D prototype and the earlier floor-switching layout are removed.

Original Three.js geometry draws inspiration from Ardross Castle's sandstone frontage, square tower, slate roofs, bay windows, turrets and woodland. The courtyard, rooms and gardens are adapted for gameplay. No show logo, stills or third-party castle model is bundled. The visual reference is [Ardross Castle's official exterior gallery](https://ardrosscastle.co.uk/).

Max's companion assets and compatible controls were selectively integrated while preserving this castle. Owen's PR #3 supplied compatible touch-release and separate rate-limit improvements; crowded-world fallback handling also keeps initial hiding responsive. Its separate sandbox and Cloudflare worker were not merged into the game because they do not include this hunt and use different castle bounds.

## Historical mode

The earlier turn-based engine remains for compatibility and tests, but is not the mode created by the website. Its prompted moves, word/emoji/rhyme constraints, host resolution, audience cheering and four-round structure are historical. Earlier reciprocal breeding and single-owner babies have been superseded by the shared two-pet merge. Earlier survival rules awarding every living pet are superseded by highest remaining usage with exact ties.

Audience microphone code measures local volume and sends aggregate scores only; it is not needed for the current hunt. Hardware testing remains user-owned.

## References

- [OpenAI Showcase](https://developers.openai.com/showcase), including [Codex Pet Arena](https://developers.openai.com/showcase/codex-pet-arena) and [Turn-based RPG](https://developers.openai.com/showcase/turn-based-rpg).
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) for custom card and move schemas.
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) for image input and structured Responses support.
- [Three.js documentation](https://threejs.org/docs/) for WebGL rendering, scene objects, raycasting and orbit controls.

See [VERIFICATION.md](VERIFICATION.md) for observed evidence and [../PLAN.md](../PLAN.md) for the remaining task checklist.
