# Live game design

The sole game mode uses four rounds and one capture to win; the earlier 2D prototype was removed. Up to 300 human players remain seekers. Todd is a shadow of a randomly chosen seeker, with the nearest distinct ability allocation under the same 20-point budget. When a large crowd covers every ability combination, it uses a distinct full stat allocation instead. Its appearance is an OpenAI-style dot, not a copy of the seeker's sprite.

The server owns game state. Clients receive public pet cards, connection/submission status, audience results and resolved events. They never receive active hiding locations, current submitted prompts, traps, reset placement or other clients' credentials. Host and player sessions authenticate separately.

Model output supplies card flavor, stat weights, legal move choices and a brief fictional hider explanation. Deterministic code enforces stat totals, room gates, costs, player ownership, one action per round and outcomes. Responses use strict JSON schemas and `store: false`; malformed, incomplete or failed responses trigger labelled offline behavior. No chain-of-thought is requested or shown.

A seeking prompt selects an accessible destination. Flight unlocks Context Tower, smallness Token Attic, climb Hallucination Hall, speed The Black Box, and swim Streaming Moat. Garden, tavern and courtyard are open. Todd must choose a room accessible to its own card and at least one ready seeker, avoiding an unwinnable hiding spot for a small party. It does not receive seekers' current submissions.

Round constraints are eight words, emoji, a two-line rhyme, and eight words. Offline rhyme checking compares the final two English letters and is deliberately approximate. Offline image-only cards derive a balanced card from the name; visual interpretation requires a model. The fallback draws an original species avatar or displays the uploaded image. Native desktop pet-folder or sprite-sheet imports are not assumed.

Breeding requires reciprocal player requests. Resolution sorts by speed, then stable pet ID. The first parent owns the baby. One action remains attached to the player, not each owned pet. A failed asynchronous round restores game state and retains submissions while preserving current connection status.

Audience input measures sequential windows on one host microphone. Only aggregate scores leave the browser. Manual results are labelled. Round and generation checks reject old measurements. All advantages expire at the next round. Audio tracks stop on completion, cancellation or phase change.

The 3D world uses original Three.js geometry inspired by Ardross Castle's sandstone frontage, square tower, slate roofs, bay windows, corner turrets, curved terrace and woodland. Room positions and the stream are adapted for gameplay. No show logo, stills, or third-party castle model is bundled. The visual reference is [Ardross Castle's official exterior gallery](https://ardrosscastle.co.uk/); its site confirms the UK and US Traitors filming connection.

## References

- [OpenAI Showcase](https://developers.openai.com/showcase), especially [Codex Pet Arena](https://developers.openai.com/showcase/codex-pet-arena) and [Turn-based RPG](https://developers.openai.com/showcase/turn-based-rpg).
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) for the custom card and move schemas.
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) for image input and structured Responses support.
- [Decisions API](https://developers.openai.com/api/docs/guides/decisions#choose-a-question-type): choice/score/predicate calls differ from the custom JSON objects used here.
- [Three.js documentation](https://threejs.org/docs/) for WebGL rendering, scene objects, raycasting and orbit controls.

This is a local multiplayer build, with in-memory rooms and no production deployment. See the verification record for observed evidence and remaining device/credential checks.

The world fills the viewport with transparent controls at the left and right only. Secondary panels open on demand. Entering a castle room lifts/fades the upper exterior and shows furnished cutaway rooms; leaving closes it. The original 2D UI, engine, route, tests and icon dependency were deleted.
