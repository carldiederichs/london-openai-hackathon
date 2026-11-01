# Verification record

Checked on 2026-11-01. This file records evidence; PLAN.md is the authoritative task checklist.

## Automated

15 tests cover the live game: balanced cards, room gates, ownership, capacity, separate room identities, hidden-state filtering, stale and duplicate actions, single round resolution, capture, escape, reciprocal breeding, baby readiness, trap consumption, reset, vet limits, audience ties/expiry, and rollback after failed asynchronous work.

A real HTTP/Socket.IO integration test creates a room, joins a player, rejects player attempts at host controls, checks multiple connections and reconnect, submits a move and resolves a capture. The model adapter tests use the installed OpenAI SDK with a fake transport to exercise strict-schema requests, image input, successful parsing, illegal JSON content, incomplete output, HTTP failures and network errors. These are not live OpenAI calls.

TypeScript and production builds pass. The Three.js scene is lazy-loaded; Vite reports its expected >500 KB scene chunk warning. The obsolete 2D prototype tests and Lucide dependency were removed with that implementation.

## Browser observations

- Rendered the original page early, then the real 3D scene and live screens.
- Separate host and two seeker tabs joined the same room, using a description and a PNG upload. An invalid image produced an error; a valid PNG previewed and joined successfully.
- Verified 20-point cards, ability gates, reciprocal breeding, 20 usage spent per parent, baby readiness and selection next round, and no second action for the same owner.
- A word-containing emoji prompt was disabled. An emoji search and rhyming searches resolved to visible rooms. Vet restored 80 usage to 100.
- A labelled manual audience result produced one regional clue. Next round cleared that advantage.
- Refreshing the seeker restored the same identity and current room. The four-round escape ending and missing-submission confirmation worked.
- 3D canvas rendered without runtime errors. Camera orbit, zoom/reset, direct marker picking, room buttons, and switching to simple view and back were checked. Reduced-motion behavior is implemented in both CSS and the animation loop.
- Narrow and wide layouts had equal document client/scroll widths, including observed widths of 312, 609 and 1425 CSS pixels. These are browser checks, not physical-phone performance measurements.
- Visual feedback replaced the pastel floating island and generic slogan/card layout with the Ardross-inspired castle and a compact dark interface. Its current render was inspected against the official exterior photographs.
- The final layout fills the viewport with the castle and uses only left/right glass overlays. On a narrow screen the player has an icon rail and an action panel; room selection opens in that panel. Both views were rendered and exercised.
- Moving Nimbus into the tower automatically lifted the upper castle and exposed the furnished rooms with Nimbus inside. A capture displayed Todd there too. Reset closed the roof; a separate move to the vet also closed it when the last pet left. The manual cutaway preview worked.
- The final overlay was checked through room creation, joining, submitting, manual cheering, resolution, next round, reconnect and reset. The earlier four-round escape playthrough is backed by the final engine tests.
- Built assets were served by `npm start` on port 4175. The production page rendered, created a connected host room, and advertised port 4175 in its join link. Development QR links advertised port 4173 after correcting proxy Host handling. No browser errors were reported for the production render.

GitHub rejected adding a workflow because the current OAuth login lacks `workflow` scope. The prepared configuration remains in `docs/github-actions-check.yml`; no remote CI success is claimed.

## Remaining external checks

- No working `OPENAI_API_KEY` was available. Actual paid model-backed cards, moves and hider choices remain unverified. Add the key to `.env.local`, restart, join a room, and confirm AI-labelled card/move events rather than fallback events.
- Microphone hardware testing was explicitly left to the user. The manual path and server comparison rules were checked. On the host's localhost page, start a hunt, choose Measure cheering, allow the microphone, cheer in each three-second window and confirm the displayed result.
- No physical phone was available to verify the venue network. Scan the QR code from a phone on the same network; verify joining, submitting and reconnecting. If blocked, check the host address and Wi-Fi client isolation.
- No hosted deployment, durable database, account system, or public internet load test was requested or performed.

## Expanded estate verification

- Final rules suite: 15 tests, including specialist habitat gates, tipsy ordering, cures, clean newborn status, reset cleanup and room lore emitted once. TypeScript and production build pass.
- Browser exercised reciprocal breeding (80 usage per parent, baby ready next round), clinic healing and a rhyming move to the first-floor observatory. The roof opened and the floor selector followed the pets automatically.
- Visually inspected the connected estate, logo maze, graveyard, ivory tower, pixel portrait crops, distinct pets, first/second-floor rooms and darker cellars. Room search and direct map selection worked. Floor cycling wrapped Second → Cellars and Cellars → Second.
- Exterior render draw calls fell from 737 to 225 after static-geometry batching (about 69 percent). This is a renderer work measurement, not a claim of a measured FPS increase on physical phones. Pixel ratio is capped; animation timing uses elapsed seconds; idle duvet geometry no longer recomputes each frame.
- Viewport checks include 390 × 844 and desktop dimensions. The microphone, actual model requests, physical venue phone and remote CI remain the previously recorded external checks.

- Fresh production render after the final asset-loading fixes reported no console warnings or errors. Portrait textures start with a valid placeholder and the SVG uses an explicit hedge color.

### Tibo portrait — 1 November 2026

- Added the locally served public GitHub avatar of Thibault Sottiaux to the tavern,
  with a brass frame and fictional “Keeper of the Reset” plaque; source in README.
- Swapped the adjacent portraits as requested: blue pet left, Tibo right, clear
  of the sideboard. Visually verified in the local browser cutaway.
- TypeScript and production build pass. No game rules changed.

### Pixel portrait and visible reset — 1 November 2026

- Replaced the displayed photograph with generated pixel art matching the pet atlas;
  kept Tibo in the right-hand tavern frame. Source and generation prompt in README.
- Rendered a red reset button and brass RESET plate directly beneath the portrait.
  Visually inspected both in the browser cutaway.
- The server now places the single-charge reset in the tavern each hunt and excludes
  the tavern from bottle placement. The first successful tavern search restores 100
  usage and clears tipsiness; subsequent visitors receive no further charge.
- All 16 tests pass, including two simultaneous tavern visitors and recharge after
  restart. TypeScript and production build pass.
